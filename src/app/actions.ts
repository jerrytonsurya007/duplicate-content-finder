"use server";

import { extractArticleUrls } from "@/ai/flows/scrape-articles-flow";

export async function getUrlsFromSitemap(sitemapUrl: string): Promise<string[]> {
  return await extractArticleUrls(sitemapUrl);
}
