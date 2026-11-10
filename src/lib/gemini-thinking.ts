// Thinking configuration per Gemini model generation.
//
// Gemini 2.5 takes a numeric `thinkingBudget`; 0 switches thinking off. We
// need it off: thinking tokens count against maxOutputTokens and starved the
// JSON output ("Unterminated string in JSON …").
//
// Gemini 3.x replaced the budget with `thinkingLevel` (minimal | low | medium
// | high) and cannot switch thinking off — MINIMAL is the floor and the
// default. Google's deprecation notice for gemini-2.5-flash (requests
// redirect to gemini-3.5-flash-lite from 2026-12-01) lists custom thinking
// configs among the changes that can cause HTTP 400 on the new model, so a
// 3.x model must never receive `thinkingBudget`.
//
// Kept free of `@/` imports so scripts/eval-model-migration.mjs can import
// this file directly (Node type stripping) and test exactly what production
// sends.

import { ThinkingLevel, type ThinkingConfig } from '@google/genai';

/** True for model ids of the Gemini 2.x generation (e.g. "gemini-2.5-flash"). */
export function usesThinkingBudget(model: string): boolean {
  return /^(models\/)?gemini-2(\.|-)/.test(model.trim());
}

// MINIMAL exists only on the Flash-Lite line. gemini-3.8-flash supports
// low | medium | high and answers MINIMAL with HTTP 400 "Thinking level
// MINIMAL is not supported for this model" (measured 2026-11-10); the
// lowest level it accepts is LOW.
function supportsMinimal(model: string): boolean {
  return /flash-lite/.test(model);
}

export function geminiThinkingConfig(model: string): ThinkingConfig {
  if (usesThinkingBudget(model)) return { thinkingBudget: 0 };
  return { thinkingLevel: supportsMinimal(model) ? ThinkingLevel.MINIMAL : ThinkingLevel.LOW };
}
