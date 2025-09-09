'use server';

/**
 * @fileOverview A flow for finding duplicate or heavily related articles by comparing them in pairs.
 *
 * - compareArticles - Compares two articles to see if they are duplicates.
 * - ComparisonResult - The output type for the compareArticles function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'zod';

// Schema for a single article's metadata for comparison
const ArticleMetadataSchema = z.object({
  url: z.string().url(),
  h1: z.string(),
  metaTitle: z.string(),
  metaDescription: z.string(),
});

// Schema for the prompt that compares two articles
const CompareArticlesPromptSchema = z.object({
  article1: ArticleMetadataSchema,
  article2: ArticleMetadataSchema,
});

// Schema for the output of the two-article comparison
const ComparisonResultSchema = z.object({
  isDuplicate: z.boolean().describe('Whether the two articles are duplicates.'),
  reason: z
    .string()
    .optional()
    .describe(
      "The reason for the duplication (e.g., 'Identical H1 tags')."
    ),
});
export type ComparisonResult = z.infer<typeof ComparisonResultSchema>;


const compareArticlesPrompt = ai.definePrompt({
  name: 'compareArticlesPrompt',
  input: {schema: CompareArticlesPromptSchema},
  output: {schema: ComparisonResultSchema},
  prompt: `You are an expert content analyst. Your task is to determine if the two articles provided are duplicates based on their metadata.

An article should be considered a duplicate of another only if it meets one of the following strict criteria:
1.  The H1 tags are identical.
2.  The Meta Titles are identical.
3.  The Meta Descriptions are very similar or identical.

General topic similarity is NOT enough. You must find exact, word-for-word matches in the H1 or Meta Title, or strong similarity in the Meta Description.

Analyze the two articles below and determine if they are duplicates.

Article 1:
- URL: {{{article1.url}}}
- H1: {{{article1.h1}}}
- Meta Title: {{{article1.metaTitle}}}
- Meta Description: {{{article1.metaDescription}}}

---
Article 2:
- URL: {{{article2.url}}}
- H1: {{{article2.h1}}}
- Meta Title: {{{article2.metaTitle}}}
- Meta Description: {{{article2.metaDescription}}}
---

Are these two articles duplicates based on the strict criteria? If so, provide the reason.
`,
});

export async function compareArticles(
  article1: z.infer<typeof ArticleMetadataSchema>,
  article2: z.infer<typeof ArticleMetadataSchema>
): Promise<ComparisonResult> {
  try {
    const {output, finishReason} = await compareArticlesPrompt({
      article1,
      article2,
    });

    if (finishReason !== 'stop' && finishReason !== 'unknown') {
      console.warn(
        `Content generation for pair ${article1.url} and ${article2.url} stopped for an unexpected reason: ${finishReason}`
      );
      return { isDuplicate: false, reason: `Analysis stopped: ${finishReason}` };
    }

    if (output) {
      return output;
    }
    
    return { isDuplicate: false, reason: "No output from AI." };
  } catch (e: any) {
    console.error(
      `Error comparing articles ${article1.url} and ${article2.url}:`,
      e
    );
    // Instead of throwing, we log the error and return a non-duplicate result.
    // This makes the process more resilient to occasional API failures.
    return { isDuplicate: false, reason: e.message || 'Comparison failed' };
  }
}
