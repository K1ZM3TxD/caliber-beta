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

/**
 * Build a structured explanation summary for the results page.
 *
 * Currently returns the approved static template. Future iterations
 * can accept normalized signal themes / archetype data and derive
 * user-specific bullets from them without changing the rendering path.
 */
export function buildExplanationSummary(): ExplanationSummary {
  return {
    headline: "Why this direction fits your background",
    intro:
      "Based on your calibration answers, we see a clear pattern in your experience pointing toward this role.",
    bullets: [
      "Strong signals across design, business operations, tools, automation, and SOPs",
      "Hands-on work building systems, workflows, and operational processes",
      "Experience that aligns closely with what roles like this typically require",
    ],
    closing:
      "Your background consistently blends design thinking with operational execution\u2009—\u2009designing systems, improving workflows, and connecting strategy to real implementation.",
  };
}
