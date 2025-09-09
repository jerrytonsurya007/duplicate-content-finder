'use server';

/**
 * @fileOverview A flow for finding duplicate or heavily related articles using an efficient one-vs-many comparison.
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

// Schema for the primary article being analyzed
const PrimaryArticleSchema = z.object({
    url: z.string().url(),
    h1: z.string(),
    metaTitle: z.string(),
    metaDescription: z.string(),
});

// Schema for the list of other articles to compare against
const OtherArticlesSchema = z.array(z.object({
    url: z.string().url(),
    metaTitle: z.string(),
}));


// Schema for the prompt that compares one primary article against a list of others
const FindDuplicatesPromptSchema = z.object({
  primaryArticle: PrimaryArticleSchema,
  otherArticles: OtherArticlesSchema,
});

// Schema for the output of the one-vs-many comparison
const FoundDuplicatesSchema = z.object({
    isDuplicate: z.boolean().describe("Whether any duplicates were found for the primary article."),
    duplicates: z.array(z.object({
        url: z.string().url().describe("The URL of the duplicate article."),
        reason: z.string().describe("The reason for the duplication (e.g., 'Identical H1 tags').")
    })).describe("A list of articles that were found to be duplicates of the primary article.")
});

const findDuplicatesPrompt = ai.definePrompt({
  name: 'findDuplicatesPrompt',
  input: {schema: FindDuplicatesPromptSchema},
  output: {schema: FoundDuplicatesSchema},
  prompt: `You are an expert content analyst. Your task is to determine if the primary article is a duplicate of any other articles in the provided list, based on their metadata.

An article should be considered a duplicate of another only if it meets one of the following strict criteria:
1.  The H1 tags are identical.
2.  The Meta Titles are identical.
3.  The Meta Descriptions are very similar or identical.

General topic similarity is NOT enough. You must find exact, word-for-word matches in the H1 or Meta Title, or strong similarity in the Meta Description.

Analyze the primary article below and compare it against the list of other articles.

Primary Article:
- URL: {{{primaryArticle.url}}}
- H1: {{{primaryArticle.h1}}}
- Meta Title: {{{primaryArticle.metaTitle}}}
- Meta Description: {{{primaryArticle.metaDescription}}}

---
List of Other Articles to Compare Against:
{{#each otherArticles}}
- URL: {{{this.url}}}
- Meta Title: {{{this.metaTitle}}}
{{/each}}
---

Return a list of all URLs from the "other articles" list that are duplicates of the primary article, along with the specific reason for each duplication.

Please provide your response in the requested JSON format. If no duplicates are found, return an empty list.
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

    const foundPairs = new Map<string, string>(); // Key: "url1|url2", Value: reason

    for (let i = 0; i < numArticles; i++) {
        const primaryArticle = articles[i];
        // Create a list of other articles to compare against
        const otherArticles = articles.slice(0, i).concat(articles.slice(i + 1));
        
        const otherArticlesMetadata = otherArticles.map(a => ({ url: a.url, metaTitle: a.metaTitle }));

        try {
            const { output, finishReason } = await findDuplicatesPrompt({
                primaryArticle,
                otherArticles: otherArticlesMetadata
            });
            
            if (finishReason !== 'stop') {
                throw new Error(`Content generation stopped for an unexpected reason: ${finishReason}`);
            }

            if (output && output.isDuplicate) {
                output.duplicates.forEach(dup => {
                    // Use a canonical key to store the pair to avoid duplicates like (A,B) and (B,A)
                    const key = [primaryArticle.url, dup.url].sort().join('|');
                    if (!foundPairs.has(key)) {
                        foundPairs.set(key, dup.reason);
                    }
                });
            }
        } catch (e: any) {
            console.error(`Error processing article ${primaryArticle.url}:`, e);
            // Decide if you want to skip or stop. For now, we'll log and continue.
            throw new Error(`Failed to analyze article against the list. ${e.message || 'An unknown error occurred with the AI model.'}`);
        }
    }
    
    // Convert the map of pairs into a list of actual pairs for consolidation
    const finalPairs: {url1: string, url2: string, reason: string}[] = [];
    foundPairs.forEach((reason, key) => {
        const [url1, url2] = key.split('|');
        if (url1 && url2 && reason) {
            finalPairs.push({url1, url2, reason});
        }
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
                urls: new Set([pair.url1, pair.e2]),
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
                ? {title: article.metaTitle, url: article.url}
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
