'use server';

/**
 * @fileOverview A flow for finding duplicate or heavily related articles using a map-reduce strategy.
 *
 * - findDuplicates - Identifies groups of similar articles from Firestore.
 * - DuplicateAnalysisResult - The output type for the findDuplicates function.
 */

import {ai} from '@/ai/genkit';
import {getScrapedArticles} from '@/app/actions';
import {z} from 'zod';

// Define the schema for a single article within a duplicate group
const DuplicateArticleSchema = z.object({
  title: z.string().describe('The title of the article.'),
  url: z.string().url().describe('The URL of the article.'),
});

// Define the schema for a group of duplicate/related articles
const DuplicateGroupSchema = z.object({
  reason: z
    .string()
    .describe('A brief explanation of why these articles are grouped together.'),
  articles: z
    .array(DuplicateArticleSchema)
    .describe(
      'A list of articles that are considered duplicates or heavily related.'
    ),
});

// Define the schema for the overall analysis result
const DuplicateAnalysisResultSchema = z.object({
  duplicateGroups: z
    .array(DuplicateGroupSchema)
    .describe(
      'An array of article groups, where each group contains articles that are duplicates or heavily related.'
    ),
});
export type DuplicateAnalysisResult = z.infer<
  typeof DuplicateAnalysisResultSchema
>;

// Define the schema for the prompt that compares *two* articles
const CompareArticlesSchema = z.object({
  article1: z.object({
    title: z.string(),
    url: z.string().url(),
    content: z.string(),
  }),
  article2: z.object({
    title: z.string(),
    url: z.string().url(),
    content: z.string(),
  }),
});

// Define the schema for the output of the two-article comparison
const ComparisonResultSchema = z.object({
  isDuplicate: z
    .boolean()
    .describe('Whether the two articles are duplicates.'),
  reason: z
    .string()
    .optional()
    .describe(
      'The reason for the duplication, if applicable (e.g., "Identical titles").'
    ),
});

const compareArticlesPrompt = ai.definePrompt({
  name: 'compareArticlesPrompt',
  input: {schema: CompareArticlesSchema},
  output: {schema: ComparisonResultSchema},
  prompt: `You are an expert content analyst. Your task is to determine if two articles are duplicates.

An article should be considered a duplicate of another only if it meets one of the following strict criteria:
1.  The titles are identical.
2.  At least one full paragraph of content is identical between the articles.

General topic similarity is NOT enough. You must find exact, word-for-word matches in the title or paragraphs.

Analyze the following two articles and determine if they are duplicates based on the strict criteria.

Article 1:
- Title: {{{article1.title}}}
- URL: {{{article1.url}}}
- Content: {{{article1.content}}}
---
Article 2:
- Title: {{{article2.title}}}
- URL: {{{article2.url}}}
- Content: {{{article2.content}}}

If they are duplicates, provide a brief reason. If not, simply state they are not duplicates.
Please provide your response in the requested JSON format.
`,
});

const findDuplicatesFlow = ai.defineFlow(
  {
    name: 'findDuplicatesFlow',
    outputSchema: DuplicateAnalysisResultSchema,
  },
  async () => {
    const articles = await getScrapedArticles();
    const numArticles = articles.length;

    if (numArticles < 2) {
      return {duplicateGroups: []};
    }

    const foundPairs = new Map<string, {reason: string; article2: string}>();
    
    // Create all unique pairs of articles to compare
    const articlePairs: {article1: (typeof articles)[0], article2: (typeof articles)[0]}[] = [];
    for (let i = 0; i < numArticles; i++) {
        for (let j = i + 1; j < numArticles; j++) {
            articlePairs.push({ article1: articles[i], article2: articles[j] });
        }
    }

    // Process pairs in batches to avoid overwhelming the system
    const BATCH_SIZE = 10;
    for (let i = 0; i < articlePairs.length; i += BATCH_SIZE) {
        const batch = articlePairs.slice(i, i + BATCH_SIZE);
        const batchPromises = batch.map(async (pair) => {
            const {output} = await compareArticlesPrompt({
              article1: pair.article1,
              article2: pair.article2,
            });

            if (output && output.isDuplicate && output.reason) {
                // Use a canonical key to store the pair to avoid duplicates like (A,B) and (B,A)
                const key = [pair.article1.url, pair.article2.url].sort().join('|');
                if (!foundPairs.has(key)) {
                    foundPairs.set(key, { reason: output.reason, article2: pair.article2.url });
                }
            }
        });
        await Promise.all(batchPromises);
    }
    
    // Convert the map of pairs into a list of actual pairs for consolidation
    const finalPairs: {url1: string, url2: string, reason: string}[] = [];
    foundPairs.forEach((value, key) => {
        const [url1, url2] = key.split('|');
        finalPairs.push({url1, url2, reason: value.reason});
    });


    // Consolidate pairs into groups
    const consolidatedGroups = new Map<string, { urls: Set<string>; reason: string }>();

    for (const pair of finalPairs) {
        let groupFound = false;
        // Check if either article in the pair already belongs to a group
        for (const group of consolidatedGroups.values()) {
            if (group.urls.has(pair.url1) || group.urls.has(pair.url2)) {
                group.urls.add(pair.url1);
                group.urls.add(pair.url2);
                // Optionally, you could append reasons: group.reason += ` | ${pair.reason}`;
                groupFound = true;
                break;
            }
        }
        // If no group was found, create a new one
        if (!groupFound) {
            const newGroupKey = pair.url1; // Use the first URL as the initial key
            consolidatedGroups.set(newGroupKey, {
                urls: new Set([pair.url1, pair.url2]),
                reason: pair.reason,
            });
        }
    }

    const articleMap = new Map(articles.map(a => [a.url, a]));

    const duplicateGroups = Array.from(consolidatedGroups.values()).map(
      (group) => {
        return {
          reason: group.reason || 'Found to be a duplicate or heavily related.',
          articles: Array.from(group.urls)
            .map(url => {
              const article = articleMap.get(url);
              return article
                ? {title: article.title, url: article.url}
                : null;
            })
            .filter((a): a is {title: string; url: string} => a !== null),
        };
      }
    );

    return {duplicateGroups};
  }
);

export async function findDuplicates(): Promise<DuplicateAnalysisResult> {
  return findDuplicatesFlow();
}
