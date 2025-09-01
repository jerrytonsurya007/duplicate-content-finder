"use server";

import { analyzeArticleSimilarity } from "@/ai/flows/analyze-article-similarity";
import { scrapeAndStoreArticles } from "@/ai/flows/scrape-articles-flow";
import type { AnalysisResult, Article } from "@/lib/types";

export async function performAnalysis(): Promise<AnalysisResult[]> {
  const articles = await scrapeAndStoreArticles();

  if (articles.length < 2) {
    // Not enough articles to compare
    return [];
  }
  
  const articlePairs: [Article, Article][] = [];

  // Create unique pairs of articles
  for (let i = 0; i < articles.length; i++) {
    for (let j = i + 1; j < articles.length; j++) {
      articlePairs.push([articles[i], articles[j]]);
    }
  }

  const analysisPromises = articlePairs.map(async ([article1, article2]) => {
    try {
      const result = await analyzeArticleSimilarity({
        article1Content: article1.content,
        article2Content: article2.content,
      });
      return {
        article1,
        article2,
        ...result,
      };
    } catch (error) {
      console.error(
        `Error analyzing pair (${article1.id}, ${article2.id}):`,
        error
      );
      // In a real app, you might want to handle this more gracefully
      // For now, we'll return null and filter it out.
      return null;
    }
  });

  const results = await Promise.all(analysisPromises);

  // Filter out nulls (from errors) and sort by score descending
  const filteredAndSortedResults = results
    .filter((result): result is AnalysisResult => result !== null)
    .sort((a, b) => b.similarityScore - a.similarityScore);

  return filteredAndSortedResults;
}
