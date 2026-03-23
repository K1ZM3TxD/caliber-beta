// lib/execution_evidence_gap.test.ts
//
// Deterministic fixture tests for the execution-evidence guardrail
// gap line surfaced in Hiring Reality Check.
// Tests both guardrail-on and guardrail-off payloads.

import { evaluateWorkMode, detectExecutionEvidenceGap } from "./work_mode";
import {
  CHRIS,
  MARCUS,
  SALESFORCE_CPQ_ARCHITECT_JOB,
  SENIOR_PYTHON_DEVELOPER_JOB,
  SYSTEMS_PRODUCT_JOB,
  INSIDE_SALES_JOB,
} from "./__fixtures__/work_mode_fixtures";

// Mirror the gap line builder from the fit route for testability
function buildExecutionEvidenceGapLine(
  categories: string[],
  missingEvidence: string[],
): string {
  if (missingEvidence.length === 0) return "This role requires specific execution experience not found in your profile.";
  const missing = missingEvidence[0];
  if (categories.includes("domain_locked")) {
    return `This role requires hands-on ${missing} experience.`;
  }
  return "This role requires hands-on coding and stack-specific experience.";
}

// Simulate the payload shape the extension receives
function buildHrcPayload(
  hrcBand: string,
  hrcReason: string,
  workModeResult: ReturnType<typeof evaluateWorkMode>,
) {
  return {
    band: hrcBand,
    reason: hrcReason,
    execution_evidence_gap: workModeResult.executionEvidence.triggered
      ? buildExecutionEvidenceGapLine(
          workModeResult.executionEvidence.categories,
          workModeResult.executionEvidence.missingEvidence,
        )
      : null,
  };
}

describe("Execution evidence gap line — sidecard payload", () => {
  // ── Guardrail ON: Chris × Salesforce CPQ (domain-locked) ──

  it("Chris × Salesforce CPQ → gap line present with domain-locked copy", () => {
    const wm = evaluateWorkMode(
      9.0,
      CHRIS.resumeText,
      CHRIS.promptAnswers,
      SALESFORCE_CPQ_ARCHITECT_JOB.text,
    );
    const hrc = buildHrcPayload("Possible", "Some reason", wm);

    expect(hrc.execution_evidence_gap).not.toBeNull();
    expect(hrc.execution_evidence_gap).toContain("hands-on");
    expect(hrc.execution_evidence_gap).toContain("Salesforce");
    expect(typeof hrc.execution_evidence_gap).toBe("string");
    // Must be a single line (no newlines)
    expect(hrc.execution_evidence_gap!.includes("\n")).toBe(false);
  });

  // ── Guardrail ON: Chris × Senior Python Dev (stack execution) ──

  it("Chris × Senior Python Dev → gap line present with stack-specific copy", () => {
    const wm = evaluateWorkMode(
      8.5,
      CHRIS.resumeText,
      CHRIS.promptAnswers,
      SENIOR_PYTHON_DEVELOPER_JOB.text,
    );
    const hrc = buildHrcPayload("Possible", "Some reason", wm);

    expect(hrc.execution_evidence_gap).not.toBeNull();
    expect(hrc.execution_evidence_gap).toContain("coding");
    expect(typeof hrc.execution_evidence_gap).toBe("string");
    expect(hrc.execution_evidence_gap!.includes("\n")).toBe(false);
  });

  // ── Guardrail OFF: Chris × generic builder job ──

  it("Chris × Systems Product → no gap line (guardrail silent)", () => {
    const wm = evaluateWorkMode(
      9.0,
      CHRIS.resumeText,
      CHRIS.promptAnswers,
      SYSTEMS_PRODUCT_JOB.text,
    );
    const hrc = buildHrcPayload("High", "Strong fit", wm);

    expect(hrc.execution_evidence_gap).toBeNull();
  });

  // ── Guardrail OFF: Chris × sales job (no execution evidence signals) ──

  it("Chris × Inside Sales → no gap line (different guardrails handle this)", () => {
    const wm = evaluateWorkMode(
      7.3,
      CHRIS.resumeText,
      CHRIS.promptAnswers,
      INSIDE_SALES_JOB.text,
    );
    const hrc = buildHrcPayload("Unlikely", "Mismatch reason", wm);

    expect(hrc.execution_evidence_gap).toBeNull();
  });

  // ── Guardrail OFF: Marcus has Salesforce evidence ──

  it("Marcus × Salesforce CPQ → domain evidence present, domain_locked does not trigger", () => {
    const wm = evaluateWorkMode(
      7.0,
      MARCUS.resumeText,
      MARCUS.promptAnswers,
      SALESFORCE_CPQ_ARCHITECT_JOB.text,
    );

    // Marcus mentions Salesforce CRM in resume → domain evidence present
    expect(wm.executionEvidence.categories).not.toContain("domain_locked");
  });

  // ── Guardrail OFF: score already below cap ──

  it("Chris × Salesforce CPQ (raw 6.0) → score below cap, no gap line", () => {
    const wm = evaluateWorkMode(
      6.0,
      CHRIS.resumeText,
      CHRIS.promptAnswers,
      SALESFORCE_CPQ_ARCHITECT_JOB.text,
    );
    const hrc = buildHrcPayload("Possible", "Some reason", wm);

    expect(hrc.execution_evidence_gap).toBeNull();
    expect(wm.executionEvidence.triggered).toBe(false);
  });
});

describe("detectExecutionEvidenceGap — unit tests", () => {
  it("returns no-trigger when score is at or below cap", () => {
    const result = detectExecutionEvidenceGap(
      7.0,
      SALESFORCE_CPQ_ARCHITECT_JOB.text,
      CHRIS.resumeText,
    );
    expect(result.triggered).toBe(false);
    expect(result.adjustment).toBe(0);
  });

  it("returns no-trigger when job has no domain/stack signals", () => {
    const result = detectExecutionEvidenceGap(
      9.0,
      SYSTEMS_PRODUCT_JOB.text,
      CHRIS.resumeText,
    );
    expect(result.triggered).toBe(false);
  });

  it("detects domain_locked for Salesforce CPQ job when user lacks evidence", () => {
    const result = detectExecutionEvidenceGap(
      9.0,
      SALESFORCE_CPQ_ARCHITECT_JOB.text,
      CHRIS.resumeText,
    );
    expect(result.triggered).toBe(true);
    expect(result.categories).toContain("domain_locked");
    expect(result.cap).toBe(7.0);
    expect(result.adjustment).toBeLessThan(0);
  });

  it("detects stack_execution for Python dev job when user lacks coding evidence", () => {
    const result = detectExecutionEvidenceGap(
      8.5,
      SENIOR_PYTHON_DEVELOPER_JOB.text,
      CHRIS.resumeText,
    );
    expect(result.triggered).toBe(true);
    expect(result.categories).toContain("stack_execution");
  });

  it("does NOT trigger domain_locked when user has matching evidence", () => {
    const result = detectExecutionEvidenceGap(
      9.0,
      SALESFORCE_CPQ_ARCHITECT_JOB.text,
      "5 years Salesforce CPQ development. Built Apex triggers and SOQL queries.",
    );
    expect(result.categories).not.toContain("domain_locked");
  });

  it("does NOT trigger stack_execution when user has coding evidence", () => {
    const result = detectExecutionEvidenceGap(
      9.0,
      SENIOR_PYTHON_DEVELOPER_JOB.text,
      "Senior software engineer with 5 years Python development experience.",
    );
    expect(result.categories).not.toContain("stack_execution");
  });
});
