"use server";

import { scrapeArticles } from "@/ai/flows/scrape-articles-flow";
import type { Article } from "@/lib/types";

export async function scrape(sitemapUrl: string): Promise<Article[]> {
  return await scrapeArticles(sitemapUrl);
}
