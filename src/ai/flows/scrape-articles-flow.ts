'use server';

/**
 * @fileOverview A flow for scraping articles from a website and storing them in Firebase.
 *
 * - scrapeAndStoreArticles - A function that scrapes articles, stores them, and returns them.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import * as cheerio from 'cheerio';
import { initializeApp, getApp, getApps } from 'firebase-admin/app';
import { getDatabase } from 'firebase-admin/database';
import { Article } from '@/lib/types';
import { credential } from 'firebase-admin';

const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT
  ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
  : undefined;

if (getApps().length === 0) {
  initializeApp({
    credential: serviceAccount ? credential.cert(serviceAccount) : undefined,
    databaseURL: `https://${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID}.firebaseio.com`,
  });
}

const ScrapeArticlesOutputSchema = z.array(
  z.object({
    id: z.string(),
    title: z.string(),
    url: z.string(),
    content: z.string(),
  })
);

async function getArticleContent(url: string): Promise<string> {
  const response = await fetch(url);
  const html = await response.text();
  const $ = cheerio.load(html);
  // This selector is specific to the structure of shriramfinance.in articles
  const content = $('.blog-details-content-main').text().trim();
  return content;
}

const scrapeAndStoreArticlesFlow = ai.defineFlow(
  {
    name: 'scrapeAndStoreArticlesFlow',
    inputSchema: z.void(),
    outputSchema: ScrapeArticlesOutputSchema,
  },
  async () => {
    const baseUrl = 'https://www.shriramfinance.in';
    const archiveUrl = `${baseUrl}/article`;

    const response = await fetch(archiveUrl);
    const html = await response.text();
    const $ = cheerio.load(html);

    const articlePromises: Promise<Article | null>[] = [];
    // This selector is specific to the structure of shriramfinance.in
    $('.all-blogs-main-top-content-left-card-bottom a').each((i, el) => {
      if (i >= 10) return false; // Stop after 10 articles

      const articleUrl = $(el).attr('href');
      if (articleUrl) {
        const fullUrl = articleUrl.startsWith('http') ? articleUrl : `${baseUrl}${articleUrl}`;
        const promise = (async (): Promise<Article | null> => {
          try {
            const title = $(el).find('h4').text().trim();
            const id = fullUrl.substring(fullUrl.lastIndexOf('/') + 1);
            const content = await getArticleContent(fullUrl);

            return {
              id,
              title,
              url: fullUrl,
              content,
            };
          } catch (e) {
            console.error(`Failed to scrape ${fullUrl}`, e);
            return null;
          }
        })();
        articlePromises.push(promise);
      }
    });

    const articles = (await Promise.all(articlePromises)).filter(
      (a): a is Article => a !== null && a.content.length > 0
    );

    const db = getDatabase();
    const ref = db.ref('articles');

    const dbPromises = articles.map(article => {
        const articleRef = ref.child(article.id);
        return articleRef.set({
            title: article.title,
            url: article.url,
            content: article.content,
        });
    });

    await Promise.all(dbPromises);
    
    return articles;
  }
);


export async function scrapeAndStoreArticles(): Promise<Article[]> {
    return scrapeAndStoreArticlesFlow();
}
