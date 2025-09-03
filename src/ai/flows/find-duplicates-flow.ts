'use server';

/**
 * @fileOverview A flow for finding duplicate or heavily related articles.
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

// Define the schema for the prompt that finds duplicates for a *single* article
const FindDuplicatesForArticleSchema = z.object({
  articleToCompare: z.object({
    title: z.string(),
    url: z.string().url(),
    content: z.string(),
  }),
  allArticles: z
    .array(
      z.object({
        title: z.string(),
        url: z.string().url(),
      })
    )
    .describe('A list of all other articles to compare against.'),
});

// Define the schema for the output of the single-article comparison
const FoundDuplicatesSchema = z.object({
  duplicates: z
    .array(
      z.object({
        title: z.string(),
        url: z.string().url(),
        reason: z.string(),
      })
    )
    .describe('A list of articles that are duplicates of the given article.'),
});

const findDuplicatesPrompt = ai.definePrompt({
  name: 'findDuplicatesForArticlePrompt',
  input: {schema: FindDuplicatesForArticleSchema},
  output: {schema: FoundDuplicatesSchema},
  prompt: `You are an expert content analyst. Your task is to review a given article and identify any duplicates from a list of other articles.

An article should be considered a duplicate of another only if it meets one of the following strict criteria:
1.  The titles are identical.
2.  At least one full paragraph of content is identical between the articles.

General topic similarity is NOT enough. You must find exact, word-for-word matches in the title or paragraphs.

Analyze the following primary article:
- Title: {{{articleToCompare.title}}}
  URL: {{{articleToCompare.url}}}
  Content: {{{articleToCompare.content}}}
---

Now, compare it against this list of other articles:
{{#each allArticles}}
- Title: {{{this.title}}}
  URL: {{{this.url}}}
{{/each}}

Identify which articles from the list are duplicates of the primary article based on the strict criteria. For each duplicate you find, provide a brief reason (e.g., "Identical titles," "Contains identical paragraphs"). If there are no duplicates, return an empty array.

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

    if (articles.length < 2) {
      return {duplicateGroups: []};
    }

    const allArticleTitles = articles.map(({title, url}) => ({title, url}));
    const foundPairs = new Map<string, {reason: string; article2: string}>();
    const allUrls = new Set(articles.map(a => a.url));

    for (const article of articles) {
      // Don't re-process an article if it's already part of a found pair
      if (foundPairs.has(article.url)) continue;

      const otherArticles = allArticleTitles.filter(a => a.url !== article.url);

      const {output} = await findDuplicatesPrompt({
        articleToCompare: article,
        allArticles: otherArticles,
      });

      if (output && output.duplicates) {
        for (const duplicate of output.duplicates) {
           // Ensure we don't process the same pair twice from different directions
          if (foundPairs.has(duplicate.url)) continue;
          
          // Add the forward relation
          foundPairs.set(article.url, {
            reason: duplicate.reason,
            article2: duplicate.url,
          });
          // Add the backward relation to prevent re-processing
           foundPairs.set(duplicate.url, {
            reason: duplicate.reason,
            article2: article.url,
          });
        }
      }
    }

    // Consolidate pairs into groups
    const consolidatedGroups = new Map<string, Set<string>>();
    const reasons = new Map<string, string>();

    foundPairs.forEach((value, url1) => {
      const url2 = value.article2;

      let groupFound = false;
      consolidatedGroups.forEach((group, key) => {
        if (group.has(url1) || group.has(url2)) {
          group.add(url1);
          group.add(url2);
          groupFound = true;
        }
      });

      if (!groupFound) {
        const newGroup = new Set([url1, url2]);
        const groupKey = `${url1}-${url2}`;
        consolidatedGroups.set(groupKey, newGroup);
        reasons.set(groupKey, value.reason);
      }
    });

    const articleMap = new Map(articles.map(a => [a.url, a]));

    const duplicateGroups = Array.from(consolidatedGroups.entries()).map(
      ([key, urlSet]) => {
        return {
          reason: reasons.get(key) || 'Found to be a duplicate or heavily related.',
          articles: Array.from(urlSet)
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
