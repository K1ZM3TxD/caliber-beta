// lib/calibration_result_copy.ts
// Confidence-banded calibration result copy generator.
// Uses pattern_synthesis signal scoring to determine confidence band,
// then produces the two-sentence result output for the calibration page.

import { generatePatternSynthesis } from "./pattern_synthesis";
import { generateTitleRecommendation } from "./title_scoring";

// ─── Types ──────────────────────────────────────────────────────────────────

export type ConfidenceBand = "strong" | "moderate" | "weak";

export interface CalibrationResultCopy {
  /** Confidence band derived from signal strength. */
  band: ConfidenceBand;
  /** First sentence: human-context alignment sentence. */
  contextSentence: string;
  /** Second sentence: market label introduction (always present). */
  marketLabelSentence: string;
  /** The recommended market title, or null if signal is too weak. */
  marketTitle: string | null;
  /** Signal strength score (0–100) used to determine the band. */
  signalStrength: number;
}

// ─── Signal strength scoring (reuse canonical pattern_synthesis scoring) ────

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

/**
 * Compute word-count based signal strength 0–100 using the same deterministic
 * formula as pattern_synthesis.scoreSignal. This is a secondary input metric;
 * the primary confidence discriminator is the title recommendation score.
 */
export function computeSignalStrength(resumeText: string, promptAnswers: string[]): number {
  const all = [resumeText, ...promptAnswers].filter((s) => typeof s === "string").join("\n");
  const wc = countWords(all);
  return Math.round(Math.min(100, (wc / 220) * 100));
}

// ─── Band classification ───────────────────────────────────────────────────

/**
 * Classify confidence band using the canonical title recommendation score.
 * The title score (0–9.9) reflects actual signal quality from the scoring
 * library, not just input volume.
 */
export function classifyConfidenceBand(titleScore: number): ConfidenceBand {
  if (titleScore >= 7.0) return "strong";
  if (titleScore >= 4.0) return "moderate";
  return "weak";
}

// ─── Context sentence generation ───────────────────────────────────────────

function extractFirstSentence(patternSummary: string): string | null {
  const first = patternSummary
    .split(/(?<=[.!?])\s+/)
    .filter((s) => s.trim().length > 10)[0]
    ?.trim();
  return first ?? null;
}

function buildStrongContext(resumeText: string, promptAnswers: string[]): string {
  const synthesis = generatePatternSynthesis(resumeText, promptAnswers);
  return extractFirstSentence(synthesis.structural_summary)
    ?? "You\u2019re most energized when your work aligns with your natural pattern.";
}

function buildModerateContext(): string {
  return "We see some clear signals in your background, but a fuller picture would sharpen the recommendation.";
}

function buildWeakContext(): string {
  return "We don\u2019t have enough signal yet to identify a clear pattern \u2014 a bit more detail about your experience would help.";
}

// ─── Market label sentence ─────────────────────────────────────────────────

const MARKET_LABEL_INTRO = "The closest market label for the kind of work you\u2019re naturally aligned with is:";
const WEAK_MARKET_LABEL = "Add more detail about your experience so we can identify the right market label for you.";

// ─── Main generator (from raw inputs) ──────────────────────────────────────

/**
 * Generate confidence-banded result copy from raw resume + prompt answers.
 * Runs the full pattern synthesis and title recommendation pipeline.
 */
export function generateCalibrationResultCopy(
  resumeText: string,
  promptAnswers: string[],
): CalibrationResultCopy {
  const safeResume = typeof resumeText === "string" ? resumeText : "";
  const safePrompts = Array.isArray(promptAnswers)
    ? promptAnswers.filter((x) => typeof x === "string")
    : [];

  const signalStrength = computeSignalStrength(safeResume, safePrompts);

  // Run canonical title recommendation to get the primary score
  let titleScore = 0;
  let titleName: string | null = null;
  try {
    const titleResult = generateTitleRecommendation(safeResume, safePrompts);
    titleScore = titleResult.recommendation.primary_title.score;
    titleName = titleResult.recommendation.primary_title.title;
  } catch {
    titleScore = 0;
    titleName = null;
  }

  const band = classifyConfidenceBand(titleScore);

  let contextSentence: string;
  let marketTitle: string | null = null;

  if (band === "strong") {
    contextSentence = buildStrongContext(safeResume, safePrompts);
    marketTitle = titleName;
  } else if (band === "moderate") {
    contextSentence = buildModerateContext();
    marketTitle = titleScore >= 4.0 ? titleName : null;
  } else {
    contextSentence = buildWeakContext();
    marketTitle = null;
  }

  const marketLabelSentence = marketTitle !== null
    ? MARKET_LABEL_INTRO
    : WEAK_MARKET_LABEL;

  return { band, contextSentence, marketLabelSentence, marketTitle, signalStrength };
}

// ─── Session-based generator (for client-side use) ─────────────────────────

/**
 * Generate result copy from a pre-computed session object.
 * Avoids re-running synthesis and title scoring when data is already available.
 */
export function generateCalibrationResultCopyFromSession(session: {
  resume?: { rawText?: string };
  prompts?: Record<number, { answer?: string | null; clarifier?: { answer?: string | null } }>;
  synthesis?: {
    patternSummary?: string;
    titleRecommendation?: { primary_title?: { title: string; score: number } };
    marketTitle?: string | null;
    titleCandidates?: Array<{ title: string; score: number }>;
  };
}): CalibrationResultCopy {
  const resumeText = session?.resume?.rawText ?? "";
  const promptAnswers: string[] = [];
  if (session?.prompts) {
    for (let i = 1; i <= 5; i++) {
      const a = session.prompts[i]?.answer;
      if (typeof a === "string" && a.trim()) promptAnswers.push(a.trim());
    }
  }

  const signalStrength = computeSignalStrength(resumeText, promptAnswers);

  // Derive title score from session data
  const titleScore = session?.synthesis?.titleRecommendation?.primary_title?.score ?? 0;
  const band = classifyConfidenceBand(titleScore);

  let contextSentence: string;
  let marketTitle: string | null = null;

  if (band === "strong") {
    const patternSummary = session?.synthesis?.patternSummary ?? "";
    contextSentence = extractFirstSentence(patternSummary)
      ?? "You\u2019re most energized when your work aligns with your natural pattern.";
    marketTitle = session?.synthesis?.titleRecommendation?.primary_title?.title
      ?? session?.synthesis?.marketTitle
      ?? session?.synthesis?.titleCandidates?.[0]?.title
      ?? null;
  } else if (band === "moderate") {
    contextSentence = buildModerateContext();
    if (titleScore >= 4.0) {
      marketTitle = session?.synthesis?.titleRecommendation?.primary_title?.title ?? null;
    }
  } else {
    contextSentence = buildWeakContext();
    marketTitle = null;
  }

  const marketLabelSentence = marketTitle !== null
    ? MARKET_LABEL_INTRO
    : WEAK_MARKET_LABEL;

  return { band, contextSentence, marketLabelSentence, marketTitle, signalStrength };
}
