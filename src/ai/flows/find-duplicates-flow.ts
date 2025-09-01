'use server';

/**
 * @fileOverview A flow for finding duplicate or heavily related articles.
 *
 * - findDuplicates - Identifies groups of similar articles from Firestore.
 * - DuplicateAnalysisResult - The output type for the findDuplicates function.
 */

import { ai } from '@/ai/genkit';
import { getScrapedArticles } from '@/app/actions';
import { z } from 'zod';

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
    .describe('A list of articles that are considered duplicates or heavily related.'),
});

// Define the schema for the overall analysis result
const DuplicateAnalysisResultSchema = z.object({
  duplicateGroups: z.array(DuplicateGroupSchema).describe('An array of article groups, where each group contains articles that are duplicates or heavily related.'),
});
export type DuplicateAnalysisResult = z.infer<
  typeof DuplicateAnalysisResultSchema
>;

// Define the input schema for the prompt, which is an array of articles
const PromptInputSchema = z.object({
    articles: z.array(z.object({
        title: z.string(),
        url: z.string().url(),
    })).describe('A list of all articles to be analyzed.')
})


const findDuplicatesPrompt = ai.definePrompt({
  name: 'findDuplicatesPrompt',
  input: { schema: PromptInputSchema },
  output: { schema: DuplicateAnalysisResultSchema },
  prompt: `You are an expert content analyst. Your task is to review a list of article titles and URLs and identify groups of articles that are duplicates or cover heavily related topics.

Review the following list of articles:
{{#each articles}}
- Title: {{{this.title}}}
  URL: {{{this.url}}}
{{/each}}

Based on your analysis, group together articles that seem to be about the same topic or are very similar. For each group, provide a brief reason for the grouping.

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
    
    if (articles.length === 0) {
        return { duplicateGroups: [] };
    }

    const { output } = await findDuplicatesPrompt({ articles });
    return output!;
  }
);

export async function findDuplicates(): Promise<DuplicateAnalysisResult> {
  return findDuplicatesFlow();
}

    