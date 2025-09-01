'use server';

/**
 * @fileOverview A flow for scraping articles from a website.
 *
 * - scrapeArticles - A function that scrapes articles and returns them.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import * as cheerio from 'cheerio';
import { Article } from '@/lib/types';

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
  const content = $('.blog-details-padding').text().trim();
  return content;
}

const scrapeArticlesFlow = ai.defineFlow(
  {
    name: 'scrapeArticlesFlow',
    inputSchema: z.void(),
    outputSchema: ScrapeArticlesOutputSchema,
  },
  async () => {
    const baseUrl = 'https://www.shriramfinance.in';
    const archiveUrl = `${baseUrl}/articles`;

    const response = await fetch(archiveUrl);
    const html = await response.text();
    const $ = cheerio.load(html);

    const articlePromises: Promise<Article | null>[] = [];
    // This selector is specific to the structure of shriramfinance.in
    $('.trending-box a').each((i, el) => {
      if (i >= 10) return false; // Stop after 10 articles
      
      const articleUrl = $(el).attr('href');
      if (articleUrl) {
        const fullUrl = articleUrl.startsWith('http') ? articleUrl : `${baseUrl}${articleUrl}`;
        const promise = (async (): Promise<Article | null> => {
          try {
            const title = $(el).find('h4').text().trim();
            const id = fullUrl.substring(fullUrl.lastIndexOf('/') + 1) || fullUrl;
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
    
    return articles;
  }
);


export async function scrapeArticles(): Promise<Article[]> {
    return scrapeArticlesFlow();
}
