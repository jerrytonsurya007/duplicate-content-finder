'use server';

/**
 * @fileOverview A flow for analyzing the similarity between articles using Gemini.
 *
 * - analyzeArticleSimilarity - A function that takes two article contents and returns a similarity score.
 * - AnalyzeArticleSimilarityInput - The input type for the analyzeArticleSimilarity function.
 * - AnalyzeArticleSimilarityOutput - The return type for the analyzeArticleSimilarity function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const AnalyzeArticleSimilarityInputSchema = z.object({
  article1Content: z
    .string()
    .describe('The content of the first article.'),
  article2Content: z
    .string()
    .describe('The content of the second article.'),
});
export type AnalyzeArticleSimilarityInput = z.infer<
  typeof AnalyzeArticleSimilarityInputSchema
>;

const AnalyzeArticleSimilarityOutputSchema = z.object({
  similarityScore: z
    .number()
    .describe(
      'A score between 0 and 1 indicating the similarity between the two articles. 1 means identical.'
    ),
  reason: z.string().describe('The reasoning behind the similarity score.'),
});
export type AnalyzeArticleSimilarityOutput = z.infer<
  typeof AnalyzeArticleSimilarityOutputSchema
>;

export async function analyzeArticleSimilarity(
  input: AnalyzeArticleSimilarityInput
): Promise<AnalyzeArticleSimilarityOutput> {
  return analyzeArticleSimilarityFlow(input);
}

const prompt = ai.definePrompt({
  name: 'analyzeArticleSimilarityPrompt',
  input: {schema: AnalyzeArticleSimilarityInputSchema},
  output: {schema: AnalyzeArticleSimilarityOutputSchema},
  prompt: `You are an expert content analyst.

You will receive the content of two articles and determine how similar they are.

Provide a similarity score between 0 and 1. 1 means they are identical, 0 means they are completely different.

Also, provide a brief explanation of why you gave the score you did.

Article 1:
{{article1Content}}

Article 2:
{{article2Content}}`,
});

const analyzeArticleSimilarityFlow = ai.defineFlow(
  {
    name: 'analyzeArticleSimilarityFlow',
    inputSchema: AnalyzeArticleSimilarityInputSchema,
    outputSchema: AnalyzeArticleSimilarityOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
