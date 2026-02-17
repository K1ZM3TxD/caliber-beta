// lib/pattern_synthesis.ts
import { validatePatternSynthesis } from "./pattern_synthesis_validate";

export interface PatternSynthesisOutput {
  structural_summary: string;
  operate_best: string[];
  lose_energy: string[];
}

type Features = {
  hasOwnership: boolean;
  hasScope: boolean;
  hasConstraints: boolean;
  hasSystem: boolean;
  hasProcess: boolean;
  hasDecision: boolean;
  hasStakeholders: boolean;
  hasAmbiguity: boolean;
  hasFriction: boolean;
  signalStrength: number; // 0..100
};

function normalize(text: string): string {
  return text.toLowerCase().replace(/\s+/g, " ").trim();
}

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function scoreSignal(resumeText: string, promptAnswers: string[]): number {
  const all = [resumeText, ...promptAnswers].filter((s) => typeof s === "string").join("\n");
  const wc = countWords(all);
  // Deterministic, bounded
  const pct = Math.round(Math.min(100, (wc / 220) * 100));
  return pct;
}

function extractFeatures(resumeText: string, promptAnswers: string[]): Features {
  const allRaw = [resumeText, ...promptAnswers].filter((s) => typeof s === "string").join("\n");
  const t = normalize(allRaw);

  const hasOwnership = /\b(own|ownership|accountab|responsib|decision right|authority)\b/.test(t);
  const hasScope = /\b(scope|end-to-end|e2e|full stack|ownership of)\b/.test(t);
  const hasConstraints = /\b(constraint|boundary|guardrail|limit|policy|standard|compliance|control)\b/.test(t);
  const hasSystem = /\b(system|operating system|architecture|infrastructure|platform)\b/.test(t);
  const hasProcess = /\b(process|cadence|workflow|playbook|ritual|runbook)\b/.test(t);
  const hasDecision = /\b(decide|decision|trade[- ]?off|priorit)\b/.test(t);
  const hasStakeholders = /\b(stakeholder|exec|executive|partner|cross[- ]functional|alignment)\b/.test(t);
  const hasAmbiguity = /\b(ambiguous|ambiguity|unclear|undefined|moving target|shifting)\b/.test(t);
  const hasFriction = /\b(friction|blocked|stall|stuck|conflict|constraint)\b/.test(t);

  const signalStrength = scoreSignal(resumeText, promptAnswers);

  return {
    hasOwnership,
    hasScope,
    hasConstraints,
    hasSystem,
    hasProcess,
    hasDecision,
    hasStakeholders,
    hasAmbiguity,
    hasFriction,
    signalStrength,
  };
}

function pickIdentityContrast(f: Features): { x: string; y: string } {
  // No adjectives; surface vs structural behavior
  const x =
    f.hasScope || f.hasOwnership
      ? "ship work"
      : f.hasStakeholders
        ? "coordinate people"
        : "complete tasks";

  const y =
    f.hasSystem || f.hasProcess
      ? "change how the system operates"
      : f.hasConstraints
        ? "change the constraints"
        : f.hasDecision
          ? "define decisions and boundaries"
          : "stabilize the operating conditions";

  return { x, y };
}

function pickInterventionContrast(f: Features): { a: string; b: string } {
  // Common reaction vs structural intervention (no dramatization)
  const a =
    f.hasAmbiguity || f.hasFriction
      ? "push harder"
      : f.hasStakeholders
        ? "add meetings"
        : "add effort";

  const b =
    f.hasOwnership || f.hasDecision
      ? "clarify ownership and decisions"
      : f.hasConstraints
        ? "set constraints and sequence"
        : f.hasSystem || f.hasProcess
          ? "change the operating system"
          : "reduce the problem to constraints";

  return { a, b };
}

function constructionLayer(f: Features): string {
  // Verb-driven, concrete, no praise
  if (f.hasSystem || f.hasProcess) return "perceive, diagnose, and build";
  if (f.hasDecision || f.hasOwnership) return "scope, decide, and build";
  if (f.hasStakeholders) return "align, decide, and build";
  return "observe, decide, and build";
}

function shouldIncludeConsequence(f: Features): boolean {
  // “Conditional Consequence Drop” only when identity coherence is strong.
  // Deterministic proxy: strong signal + multiple structural markers present.
  const markers = [
    f.hasOwnership,
    f.hasScope,
    f.hasConstraints,
    f.hasSystem || f.hasProcess,
    f.hasDecision,
  ].filter(Boolean).length;

  return f.signalStrength >= 60 && markers >= 3;
}

function ensureThreeSentences(s1: string, s2: string, s3: string): string {
  // Validator counts sentences by splitting on .!? so we must end each sentence with a period.
  const a = s1.trim().replace(/[.!?]+$/g, "") + ".";
  const b = s2.trim().replace(/[.!?]+$/g, "") + ".";
  const c = s3.trim().replace(/[.!?]+$/g, "") + ".";
  return `${a} ${b} ${c}`;
}

export function generatePatternSynthesis(
  resumeText: string,
  promptAnswers: string[]
): PatternSynthesisOutput {
  const safeResume = typeof resumeText === "string" ? resumeText : "";
  const safePrompts = Array.isArray(promptAnswers) ? promptAnswers.filter((x) => typeof x === "string") : [];

  const f = extractFeatures(safeResume, safePrompts);

  // Locked synthesis form (compressed into exactly 3 sentences to satisfy v1 validator):
  // 1) Identity Contrast
  // 2) Intervention Contrast
  // 3) Construction Layer (+ optional consequence clause)
  const id = pickIdentityContrast(f);
  const iv = pickInterventionContrast(f);
  const layer = constructionLayer(f);

  const s1 = `You don’t just ${id.x} — you ${id.y}`;
  const s2 = `When something isn’t working, you don’t ${iv.a} — you ${iv.b}`;

  const consequence = shouldIncludeConsequence(f) ? "; you change how the system operates" : "";
  const s3 = `You ${layer}${consequence}`;

  const output: PatternSynthesisOutput = {
    structural_summary: ensureThreeSentences(s1, s2, s3),

    // Bullets remain v1: 4 items each, ≤ 8 words, structural language only.
    operate_best: [
      "Authority with defined ownership",
      "Scope with end-to-end control",
      "Autonomy within boundaries",
      "Stakeholder communication",
    ],

    lose_energy: [
      "Authority without ownership",
      "Scope without control",
      "Autonomy without structure",
      "Communication through intermediaries",
    ],
  };

  validatePatternSynthesis(output);
  return output;
}