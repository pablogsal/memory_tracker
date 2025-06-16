'use server';
/**
 * @fileOverview This file defines a Genkit flow for suggesting potential root causes of performance regressions in CPython benchmarks.
 *
 * - suggestRootCauses - A function that takes benchmark details and returns suggested root causes.
 * - RootCauseAnalysisInput - The input type for the suggestRootCauses function.
 * - RootCauseSuggestion - The return type for the suggestRootCauses function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const RootCauseAnalysisInputSchema = z.object({
  pythonVersion: z.string().describe('The Python version used for the benchmark (e.g., 3.9, 3.10).'),
  compilerFlags: z.array(z.string()).describe('The compiler flags used during the build (e.g., debug, nogil).'),
  benchmarkName: z.string().describe('The name of the benchmark that experienced a regression.'),
  commitSha: z.string().describe('The SHA of the commit where the regression was observed.'),
  metricDelta: z.number().describe('The percentage change in the benchmark metric (positive for regression).'),
});

export type RootCauseAnalysisInput = z.infer<typeof RootCauseAnalysisInputSchema>;

const RootCauseSuggestionSchema = z.object({
  suggestion: z.string().describe('A potential root cause for the performance regression.'),
  confidence: z.number().describe('A confidence score (0-1) indicating the likelihood of the suggestion being correct.'),
  rationale: z.string().describe('The reasoning behind the suggestion, including historical data or known issues.'),
});

export type RootCauseSuggestion = z.infer<typeof RootCauseSuggestionSchema>;

export async function suggestRootCauses(input: RootCauseAnalysisInput): Promise<RootCauseSuggestion[]> {
  return rootCauseAnalysisFlow(input);
}

const rootCauseAnalysisPrompt = ai.definePrompt({
  name: 'rootCauseAnalysisPrompt',
  input: {schema: RootCauseAnalysisInputSchema},
  output: {schema: z.array(RootCauseSuggestionSchema)},
  prompt: `You are an expert in CPython performance regressions. Given the following information about a performance regression, suggest potential root causes.

Python Version: {{{pythonVersion}}}
Compiler Flags: {{#each compilerFlags}}{{{this}}} {{/each}}
Benchmark Name: {{{benchmarkName}}}
Commit SHA: {{{commitSha}}}
Metric Delta: {{{metricDelta}}}%

Consider common performance issues associated with this Python version, compiler flags, and the specific benchmark. Provide a list of suggestions, each with a confidence score (0-1) and a rationale.

Format your response as a JSON array of objects with the following structure:

[
  {
    "suggestion": "A potential root cause",
    "confidence": 0.75,
    "rationale": "Explanation of why this might be the cause"
  },
  ...
]
`,
});

const rootCauseAnalysisFlow = ai.defineFlow(
  {
    name: 'rootCauseAnalysisFlow',
    inputSchema: RootCauseAnalysisInputSchema,
    outputSchema: z.array(RootCauseSuggestionSchema),
  },
  async input => {
    const {output} = await rootCauseAnalysisPrompt(input);
    return output!;
  }
);
