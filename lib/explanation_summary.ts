// lib/explanation_summary.ts
// Structured explanation summary for calibration results.
// Keeps display copy separate from scoring logic and avoids
// raw/internal signal wording leaking into the UI.

export interface ExplanationSummary {
  headline: string;
  intro: string;
  bullets: string[];
  closing: string;
}

// ---------------------------------------------------------------------------
// Signal normalization — maps raw/internal tokens to human-readable wording.
// Every user-facing explanation must be routed through normalizeSignal() so
// that internal shorthand never leaks into the UI.
// ---------------------------------------------------------------------------

const SIGNAL_MAP: Record<string, string> = {
  tool: "tools",
  automate: "automation",
  sop: "SOPs",
  sale: "sales",
  workflow: "workflows",
  system: "systems",
  process: "operational processes",
  business: "business operations",
  strategy: "strategy",
  design: "design",
  ops: "operations",
  impl: "implementation",
  exec: "execution",
};

/** Normalize a single raw signal token to its display form. */
export function normalizeSignal(raw: string): string {
  const key = raw.trim().toLowerCase();
  return SIGNAL_MAP[key] ?? raw.trim();
}

/**
 * Normalize a list of raw signal tokens into a readable comma-and phrase.
 * e.g. ["tool", "automate", "sop"] → "tools, automation, and SOPs"
 */
export function normalizeSignalList(tokens: string[]): string {
  const normalized = tokens
    .map(normalizeSignal)
    .filter(Boolean);

  // Deduplicate while preserving order
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const t of normalized) {
    const lc = t.toLowerCase();
    if (!seen.has(lc)) {
      seen.add(lc);
      unique.push(t);
    }
  }

  if (unique.length === 0) return "";
  if (unique.length === 1) return unique[0];
  if (unique.length === 2) return `${unique[0]} and ${unique[1]}`;
  return `${unique.slice(0, -1).join(", ")}, and ${unique[unique.length - 1]}`;
}

// ---------------------------------------------------------------------------
// Explanation builder
// ---------------------------------------------------------------------------

/**
 * Build a structured explanation summary for the results page.
 *
 * Accepts an optional array of raw signal tokens. When provided, the first
 * bullet is derived from normalized signals instead of the static default.
 * All other copy uses the approved template.
 */
export function buildExplanationSummary(
  rawSignals?: string[],
): ExplanationSummary {
  let signalBullet =
    "Strong signals across design, business operations, tools, automation, and SOPs";

  if (rawSignals && rawSignals.length > 0) {
    const phrase = normalizeSignalList(rawSignals);
    if (phrase) {
      signalBullet = `Strong signals across ${phrase}`;
    }
  }

  return {
    headline: "Why this direction fits your background",
    intro:
      "Based on your calibration answers, we see a clear pattern in your experience pointing toward this role.",
    bullets: [
      signalBullet,
      "Hands-on work building systems, workflows, and operational processes",
      "Experience that aligns closely with what roles like this typically require",
    ],
    closing:
      "Your background consistently blends design thinking with operational execution\u2009\u2014\u2009designing systems, improving workflows, and connecting strategy to real implementation.",
  };
}
