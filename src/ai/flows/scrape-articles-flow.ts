'use server';

/**
 * @fileOverview A flow for scraping articles from a website sitemap.
 *
 * - scrapeArticles - A function that scrapes articles and returns them.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import * as cheerio from 'cheerio';
import { Article } from '@/lib/types';

const ScrapeArticlesInputSchema = z.object({
  sitemapUrl: z.string().url().describe('The URL of the XML sitemap.'),
});

const ScrapeArticlesOutputSchema = z.array(
  z.object({
    id: z.string(),
    title: z.string(),
    url: z.string(),
    content: z.string(),
  })
);

async function getArticleDetails(url: string): Promise<{ title: string; content: string } | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
        console.error(`Failed to fetch article ${url}: ${response.statusText}`);
        return null;
    }
    const html = await response.text();
    const $ = cheerio.load(html);
    const title = $('h1').first().text().trim();
    const content = $('.blog-details-padding').text().trim();
    
    if (title && content) {
      return { title, content };
    }
    return null;
  } catch (e) {
      console.error(`Failed to get details for ${url}`, e);
      return null;
  }
}

const scrapeArticlesFlow = ai.defineFlow(
  {
    name: 'scrapeArticlesFlow',
    inputSchema: ScrapeArticlesInputSchema,
    outputSchema: ScrapeArticlesOutputSchema,
  },
  async ({ sitemapUrl }) => {
    const response = await fetch(sitemapUrl);
    if (!response.ok) {
        console.error(`Failed to fetch sitemap ${sitemapUrl}: ${response.statusText}`);
        throw new Error(`Failed to fetch sitemap: ${response.statusText}`);
    }
    const xml = await response.text();
    const $ = cheerio.load(xml, { xmlMode: true });

    const articlePromises: Promise<Article | null>[] = [];
    
    const articleUrls = $('loc')
      .map((i, el) => $(el).text())
      .get()
      .filter(url => url.includes('/articles/'));

    for (const articleUrl of articleUrls) {
      const promise = (async (): Promise<Article | null> => {
        try {
          const details = await getArticleDetails(articleUrl);
          if (!details) {
              return null;
          }

          const id = articleUrl.substring(articleUrl.lastIndexOf('/') + 1) || articleUrl;
          
          return {
            id,
            title: details.title,
            url: articleUrl,
            content: details.content,
          };
        } catch (e) {
          console.error(`Failed to scrape ${articleUrl}`, e);
          return null;
        }
      })();
      articlePromises.push(promise);
    }

    const articles = (await Promise.all(articlePromises)).filter(
      (a): a is Article => a !== null && a.content.length > 0 && a.title.length > 0
    );
    
    return articles;
  }
);


export async function scrapeArticles(sitemapUrl: string): Promise<Article[]> {
    return scrapeArticlesFlow({ sitemapUrl });
}
