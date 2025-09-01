'use server';

/**
 * @fileOverview A flow for extracting article URLs from a website sitemap.
 *
 * - extractArticleUrls - A function that extracts article URLs and returns them.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import * as cheerio from 'cheerio';

const ExtractUrlsInputSchema = z.object({
  sitemapUrl: z.string().url().describe('The URL of the XML sitemap.'),
});

const ExtractUrlsOutputSchema = z.array(z.string().url());

const extractArticleUrlsFlow = ai.defineFlow(
  {
    name: 'extractArticleUrlsFlow',
    inputSchema: ExtractUrlsInputSchema,
    outputSchema: ExtractUrlsOutputSchema,
  },
  async ({ sitemapUrl }) => {
    const response = await fetch(sitemapUrl);
    if (!response.ok) {
        console.error(`Failed to fetch sitemap ${sitemapUrl}: ${response.statusText}`);
        throw new Error(`Failed to fetch sitemap: ${response.statusText}`);
    }
    const xml = await response.text();
    const $ = cheerio.load(xml, { xmlMode: true });

    const articleUrls = $('loc')
      .map((i, el) => $(el).text())
      .get()
      .filter(url => url.includes('/articles/'));
    
    return articleUrls;
  }
);


export async function extractArticleUrls(sitemapUrl: string): Promise<string[]> {
    return extractArticleUrlsFlow({ sitemapUrl });
}
