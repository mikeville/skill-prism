// Variant matrix for the prompt eval (V0..V7).
//
// Each variant is a fully-specified configuration of the production pipeline:
// which model handles each stage, which prompt builder is used for the
// generation stage, and whether the pipeline runs the critique pass.
//
// V0 is the production baseline. V1..V7 each isolate one change so the eval
// report can attribute deltas cleanly.

import { buildPrompt } from '../../src/lib/prompt';
import { buildInsightPrompt } from '../../src/lib/insightPrompt';
import { buildSubDisciplinePrompt } from '../../src/lib/subDisciplinePrompt';
import { buildCritiquePrompt } from '../../src/lib/critiquePrompt';
import { buildInsightPromptTrimmed } from './insightPrompt.trimmed';

export type Model =
  | 'claude-haiku-4-5-20251001'
  | 'claude-sonnet-4-6'
  | 'claude-opus-4-7';

export type PipelineShape =
  // Production: classifier and generation run in parallel; critique fires
  // conditionally when a generated title trips the scope-trap heuristic.
  | 'parallel-then-critique'
  // Wait for classifier, embed traps directly into generation, no critique.
  | 'sequential-no-critique';

export type InsightPromptBuilder = typeof buildInsightPrompt;

export type Variant = {
  id: string;
  label: string;
  // Breakdown stage — independent of the insight pipeline.
  breakdownModel: Model;
  breakdownPromptBuilder: typeof buildPrompt;
  // Insight stage.
  pipeline: PipelineShape;
  classifierModel: Model;
  classifierPromptBuilder: typeof buildSubDisciplinePrompt;
  generationModel: Model;
  generationPromptBuilder: InsightPromptBuilder;
  // Only used when pipeline === 'parallel-then-critique'.
  critiqueModel: Model;
  critiquePromptBuilder: typeof buildCritiquePrompt;
};

const baseProd: Omit<Variant, 'id' | 'label'> = {
  breakdownModel: 'claude-haiku-4-5-20251001',
  breakdownPromptBuilder: buildPrompt,
  pipeline: 'parallel-then-critique',
  classifierModel: 'claude-sonnet-4-6',
  classifierPromptBuilder: buildSubDisciplinePrompt,
  generationModel: 'claude-sonnet-4-6',
  generationPromptBuilder: buildInsightPrompt,
  critiqueModel: 'claude-sonnet-4-6',
  critiquePromptBuilder: buildCritiquePrompt,
};

export const VARIANTS: Variant[] = [
  { id: 'V0', label: 'baseline (prod)', ...baseProd },

  // V1: classifier on Haiku — same pipeline shape, cheaper classifier.
  { id: 'V1', label: 'classifier→Haiku', ...baseProd, classifierModel: 'claude-haiku-4-5-20251001' },

  // V2: sequential, no critique. Generation receives the classifier's traps
  // up front; critique pass is eliminated.
  { id: 'V2', label: 'sequential, no critique', ...baseProd, pipeline: 'sequential-no-critique' },

  // V3: V2 + classifier on Haiku.
  { id: 'V3', label: 'sequential + Haiku classifier', ...baseProd,
    pipeline: 'sequential-no-critique',
    classifierModel: 'claude-haiku-4-5-20251001' },

  // V4: trimmed generation prompt. Tests whether the long TONE/KIND blocks
  // are load-bearing or already internalized by Sonnet.
  { id: 'V4', label: 'trimmed insight prompt', ...baseProd,
    generationPromptBuilder: buildInsightPromptTrimmed },

  // V5: generation on Haiku. The most aggressive cost cut — does Haiku hold
  // quality on this task, or does the model gap show?
  { id: 'V5', label: 'generation→Haiku', ...baseProd,
    generationModel: 'claude-haiku-4-5-20251001' },

  // V6: generation on Opus 4.7. Tests whether Sonnet is the quality ceiling
  // or whether Opus would meaningfully better the output.
  { id: 'V6', label: 'generation→Opus', ...baseProd, generationModel: 'claude-opus-4-7' },

  // V7: breakdown on Sonnet. Does the 9×9 grid quality jump enough to
  // justify a 5x cost increase on the most-frequent call in the app?
  { id: 'V7', label: 'breakdown→Sonnet', ...baseProd, breakdownModel: 'claude-sonnet-4-6' },
];

export function variantById(id: string): Variant | undefined {
  return VARIANTS.find((v) => v.id === id);
}
