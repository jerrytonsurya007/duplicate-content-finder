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
      }
    });
    if (!response.ok) {
      console.error(`Failed to fetch article ${url}: ${response.statusText}`);
      return { title: "", content: "" };
    }
    const html = await response.text();
    const $ = cheerio.load(html);

    const title = $("h1").first().text().trim();
    const content = $(".prose").text().trim();
    
    return { title, content };
  } catch (error) {
    console.error(`Error scraping article content from ${url}:`, error);
    return { title: "", content: "" };
  }
}

export async function scrapeAndStoreArticles(): Promise<string[]> {
  const scrapedUrls: string[] = [];

  for (const url of articleUrls) {
    const { title, content } = await scrapeArticleContent(url);

    if (title && content) {
      try {
        await addDoc(collection(db, "articles"), {
          url,
          title,
          content,
          scrapedAt: new Date(),
        });
        scrapedUrls.push(url);
      } catch (error) {
        console.error(`Failed to store article from ${url} in Firestore:`, error);
      }
    }
  }

  return scrapedUrls;
}
