"use server";

import * as cheerio from "cheerio";
import { db } from "@/lib/firebase";
import { collection, addDoc } from "firebase/firestore";
import { articleUrls } from "@/lib/article-urls";

async function scrapeArticleContent(url: string): Promise<{ title: string; content: string }> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      },
      cache: 'no-store' 
    });
    if (!response.ok) {
      throw new Error(`Failed to fetch article: ${response.statusText}`);
    }
    const html = await response.text();
    const $ = cheerio.load(html);

    const title = $("h1").first().text().trim();
    const content = $(".prose").text().trim();
    
    if (!title || !content) {
        throw new Error("Could not find title or content on the page.");
    }
    
    return { title, content };
  } catch (error) {
    console.error(`Error scraping article content from ${url}:`, error);
    throw error;
  }
}

export async function scrapeAndStoreArticle(url: string): Promise<{ success: boolean, url?: string, error?: string }> {
    try {
        const { title, content } = await scrapeArticleContent(url);
        await addDoc(collection(db, "articles"), {
          url,
          title,
          content,
          scrapedAt: new Date(),
        });
        return { success: true, url: url };
    } catch (error: any) {
        console.error(`Failed to scrape and store article from ${url}:`, error);
        return { success: false, error: error.message || 'Unknown error' };
    }
}


export async function getArticleUrls(): Promise<string[]> {
  return Promise.resolve(articleUrls);
}
