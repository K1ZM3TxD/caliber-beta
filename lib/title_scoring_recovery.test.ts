/**
 * lib/title_scoring_recovery.test.ts
 *
 * Validates recovery-term generation for Jen-like (ops+client blended) profiles.
 *
 * Context: post-fix surface experiment (2026-03-25, sess_fd37b355bf65c8) showed
 * `strategy and operations manager` is the empirically strongest search surface
 * for Jen. This test suite locks in that outcome so regressions are caught.
 *
 * Constraints:
 * - Primary calibration title must remain "Partnerships Manager" (unchanged).
 * - "Strategy & Operations Manager" must appear in recovery terms.
 * - It must rank above weaker adjacent suggestions (Brand & Content Strategist,
 *   Project Delivery Manager) which are less empirically supported for Jen-like
 *   profiles.
 */

import { generateRecoveryTerms, scoreTitles } from "./title_scoring";
import jen from "../fixtures/calibration_profiles/jen.json";

function prompts(profile: typeof jen): string[] {
  return [
    profile.prompt_answers.prompt_1,
    profile.prompt_answers.prompt_2,
    profile.prompt_answers.prompt_3,
    profile.prompt_answers.prompt_4,
    profile.prompt_answers.prompt_5,
  ];
}

const jenPrompts = prompts(jen);

describe("Jen recovery terms — strategy/ops surface improvement", () => {
  const primaryTitle = scoreTitles(jen.resume_text, jenPrompts)[0].title;
  const { terms } = generateRecoveryTerms(
    jen.resume_text,
    jenPrompts,
    "operational_execution",
    primaryTitle,
  );

  it("primary calibration title remains Partnerships Manager", () => {
    expect(primaryTitle).toBe("Partnerships Manager");
  });

  it("recovery terms include Strategy & Operations Manager", () => {
    expect(terms.map((t) => t.title)).toContain("Strategy & Operations Manager");
  });

  it("Strategy & Operations Manager ranks first in recovery terms", () => {
    expect(terms[0]?.title).toBe("Strategy & Operations Manager");
  });

  it("Strategy & Operations Manager recoveryScore exceeds Account Manager's", () => {
    const strat = terms.find((t) => t.title === "Strategy & Operations Manager");
    const acct = terms.find((t) => t.title === "Account Manager");
    expect(strat).toBeDefined();
    // Account Manager may or may not appear; if it does, StrategyOps must rank higher
    if (acct) {
      expect(strat!.recoveryScore).toBeGreaterThan(acct.recoveryScore);
    }
  });

  it("primary calibration title is NOT Strategy & Operations Manager", () => {
    // Calibration direction must not be overridden by the new cluster
    expect(primaryTitle).not.toBe("Strategy & Operations Manager");
  });

  it("Partnerships Manager is not in recovery terms (already calibrated to it)", () => {
    expect(terms.map((t) => t.title)).not.toContain("Partnerships Manager");
  });

  it("recovery terms returns at most 3 results", () => {
    expect(terms.length).toBeLessThanOrEqual(3);
  });
});

describe("Jen calibration top-3 unchanged by StrategyOps cluster", () => {
  const top3 = scoreTitles(jen.resume_text, jenPrompts);

  it("first title is Partnerships Manager", () => {
    expect(top3[0]?.title).toBe("Partnerships Manager");
  });

  it("top-3 does not include Strategy & Operations Manager", () => {
    // StrategyOps title scores below calibration threshold for Jen — must not
    // displace existing ClientGrowth adjacent titles in the primary path.
    expect(top3.map((t) => t.title)).not.toContain("Strategy & Operations Manager");
  });
});
