'use server';

import * as cheerio from 'cheerio';
import { db } from '@/lib/firebase';
import { collection, addDoc, getDocs, deleteDoc, doc, query, limit, getDocsFromServer } from 'firebase/firestore';
import { articleUrls } from '@/lib/article-urls';

async function scrapeArticleContent(
  url: string
): Promise<{ h1: string; metaTitle: string; metaDescription: string }> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      },
      cache: 'no-store',
    });
    if (!response.ok) {
      throw new Error(`Failed to fetch article: ${response.statusText}`);
    }
    const html = await response.text();
    const $ = cheerio.load(html);

    const h1 = $('h1').first().text().trim();
    const metaTitle = $('title').text().trim();
    const metaDescription = $('meta[name="description"]').attr('content')?.trim() || '';

    if (!h1) {
      throw new Error('Could not find an h1 tag on the page.');
    }
    if (!metaTitle) {
      throw new Error('Could not find a meta title on the page.');
    }
    if (!metaDescription) {
      // Not throwing an error, as some pages might not have a meta description.
      console.warn(`Could not find a meta description for ${url}`);
    }

    return { h1, metaTitle, metaDescription };
  } catch (error) {
    console.error(`Error scraping article content from ${url}:`, error);
    throw error;
  }
}

export async function scrapeAndStoreArticle(
  url: string
): Promise<{ success: boolean; url?: string; error?: string }> {
  try {
    const { h1, metaTitle, metaDescription } = await scrapeArticleContent(url);
    await addDoc(collection(db, 'articles'), {
      url,
      h1,
      metaTitle,
      metaDescription,
      scrapedAt: new Date(),
    });
    return { success: true, url: url };
  } catch (error: any) {
    console.error(`Failed to scrape and store article from ${url}:`, error);
    return { success: false, error: error.message || 'Unknown error' };
  }
}

export async function clearArticles(): Promise<{ success: boolean; error?: string }> {
    try {
        const articlesCollection = collection(db, "articles");
        const articleSnapshot = await getDocs(articlesCollection);
        const deletePromises = articleSnapshot.docs.map((document) => 
            deleteDoc(doc(db, "articles", document.id))
        );
        await Promise.all(deletePromises);
        return { success: true };
    } catch (error: any) {
        console.error("Failed to clear articles:", error);
        return { success: false, error: error.message || 'Unknown error' };
    }
}


export async function getArticleUrls(): Promise<string[]> {
  return Promise.resolve(articleUrls);
}

export async function getScrapedArticles(): Promise<{ url: string, h1: string; metaTitle: string; metaDescription: string; }[]> {
  const articlesCollection = collection(db, 'articles');
  const articlesSnapshot = await getDocsFromServer(articlesCollection);
  const articles = articlesSnapshot.docs.map(doc => {
    const data = doc.data();
    return {
      url: data.url,
      h1: data.h1,
      metaTitle: data.metaTitle,
      metaDescription: data.metaDescription,
    };
  });
  return articles;
}

    