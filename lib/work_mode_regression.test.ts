// lib/work_mode_regression.test.ts
//
// Fixture Regression Matrix for chip-enabled scoring.
// Validates all 4 canonical users (Chris, Jen, Fabio, Dingus) across
// representative job families with and without chip suppression.
// Confirms anchor preservation, suppression behavior, and determinism.

import {
  evaluateWorkMode,
  classifyRoleType,
  classifyJobWorkMode,
  type WorkModeResult,
} from "./work_mode";

import {
  CHRIS,
  FABIO,
  JEN,
  DINGUS,
  MARCUS,
  SYSTEMS_PRODUCT_JOB,
  INSIDE_SALES_JOB,
  OPS_COORDINATOR_JOB,
  VERDE_SOLAR_PM_JOB,
  SECURITY_ANALYST_JOB,
  SALES_OPS_HYBRID_JOB,
  PROPERTY_MAX_GRIND_JOB,
  CREATIVE_DIRECTOR_JOB,
  ENTERPRISE_AE_JOB,
  BDR_OUTBOUND_JOB,
  SALESFORCE_CPQ_ARCHITECT_JOB,
  SENIOR_PYTHON_DEVELOPER_JOB,
  type UserFixture,
  type JobFixture,
} from "./__fixtures__/work_mode_fixtures";

// ─── Helpers ────────────────────────────────────────────────

type ChipConfig = {
  label: string;
  prefs: { primaryMode?: string; avoidedModes?: string[] } | null;
};

const NO_CHIPS: ChipConfig = { label: "no chips", prefs: null };
const AVOID_SALES: ChipConfig = {
  label: "sales avoided",
  prefs: { primaryMode: "builder_systems", avoidedModes: ["sales_execution"] },
};
const AVOID_OPS: ChipConfig = {
  label: "ops avoided",
  prefs: { primaryMode: "builder_systems", avoidedModes: ["operational_execution"] },
};

function run(
  user: UserFixture,
  job: JobFixture,
  rawScore: number,
  chips: ChipConfig,
): WorkModeResult {
  return evaluateWorkMode(
    rawScore,
    user.resumeText,
    user.promptAnswers,
    job.text,
    chips.prefs ?? undefined,
  );
}

// ═══════════════════════════════════════════════════════════
// ─── CHRIS REGRESSION (builder_systems) ─────────────────────
// ═══════════════════════════════════════════════════════════

describe("Regression: Chris (builder_systems)", () => {
  // ── Anchor: compatible builder job stays high ──────────
  it("builder job (raw 9.0) → untouched, no penalties", () => {
    const r = run(CHRIS, SYSTEMS_PRODUCT_JOB, 9.0, NO_CHIPS);
    expect(r.userMode.mode).toBe("builder_systems");
    expect(r.jobMode.mode).toBe("builder_systems");
    expect(r.compatibility).toBe("compatible");
    expect(r.workModeAdjustment).toBe(0);
    expect(r.executionIntensityAdjustment).toBe(0);
    expect(r.roleTypePenalty).toBe(0);
    expect(r.chipSuppression.suppressed).toBe(false);
    expect(r.postScore).toBe(9.0);
  });

  it("builder job (raw 9.9) → Chris fixture preserved", () => {
    const r = run(CHRIS, SYSTEMS_PRODUCT_JOB, 9.9, NO_CHIPS);
    expect(r.postScore).toBe(9.9);
  });

  // ── Conflicting: sales job drops significantly ─────────
  it("inside sales (raw 7.3) → conflicting, dragged below 7", () => {
    const r = run(CHRIS, INSIDE_SALES_JOB, 7.3, NO_CHIPS);
    expect(r.compatibility).toBe("conflicting");
    expect(r.workModeAdjustment).toBeLessThan(0);
    expect(r.roleType).toBe("SYSTEM_SELLER");
    expect(r.postScore).toBeLessThan(7.0);
  });

  it("enterprise AE (raw 7.0) → conflicting, score well below raw", () => {
    const r = run(CHRIS, ENTERPRISE_AE_JOB, 7.0, NO_CHIPS);
    expect(r.compatibility).toBe("conflicting");
    expect(r.postScore).toBeLessThan(7.0);
  });

  it("sales-ops hybrid (raw 7.5) → conflicting, sub-7", () => {
    const r = run(CHRIS, SALES_OPS_HYBRID_JOB, 7.5, NO_CHIPS);
    expect(r.compatibility).toBe("conflicting");
    expect(r.postScore).toBeLessThan(7.0);
  });

  it("property max grind (raw 7.3) → crushed below 5", () => {
    const r = run(CHRIS, PROPERTY_MAX_GRIND_JOB, 7.3, NO_CHIPS);
    expect(r.compatibility).toBe("conflicting");
    expect(r.executionIntensityAdjustment).toBeLessThan(0);
    expect(r.postScore).toBeLessThanOrEqual(5.0);
  });

  // ── Adjacent: ops job → mild drag ─────────────────────
  it("ops coordinator (raw 7.5) → adjacent, mild drag", () => {
    const r = run(CHRIS, OPS_COORDINATOR_JOB, 7.5, NO_CHIPS);
    expect(r.compatibility).toBe("adjacent");
    expect(r.postScore).toBeGreaterThanOrEqual(5.5);
    expect(r.postScore).toBeLessThanOrEqual(7.5);
  });

  // ── Verde Solar PM — field/construction job must NOT score as builder ──
  // Regression for: "green infrastructure" and bare "engineering" (education)
  // previously triggering builder_systems → compatible with Chris → 0 work mode
  // penalty → inflated score. Fixed by requiring tech-domain qualifiers.
  it("Verde Solar PM (raw 9.8) → adjacent (not compatible), score < 8.8", () => {
    const r = run(CHRIS, VERDE_SOLAR_PM_JOB, 9.8, NO_CHIPS);
    expect(r.jobMode.mode).toBe("operational_execution");
    expect(r.compatibility).toBe("adjacent");
    expect(r.workModeAdjustment).toBeLessThan(0);
    expect(r.roleType).toBe("SYSTEM_OPERATOR");
    expect(r.postScore).toBeLessThan(8.8);
  });

  it("Verde Solar PM — job mode classified as operational_execution", () => {
    const result = classifyJobWorkMode(VERDE_SOLAR_PM_JOB.text);
    expect(result.mode).toBe("operational_execution");
    expect(result.confidence).toBe("high");
  });

  // ── Chip suppression: sales avoided ────────────────────
  it("inside sales + sales avoided → hard capped ≤ 3.5", () => {
    const r = run(CHRIS, INSIDE_SALES_JOB, 8.5, AVOID_SALES);
    expect(r.chipSuppression.suppressed).toBe(true);
    expect(r.postScore).toBeLessThanOrEqual(3.5);
  });

  it("enterprise AE + sales avoided → hard capped ≤ 3.5", () => {
    const r = run(CHRIS, ENTERPRISE_AE_JOB, 8.0, AVOID_SALES);
    expect(r.postScore).toBeLessThanOrEqual(3.5);
  });

  it("BDR outbound + sales avoided → hard capped ≤ 3.5", () => {
    const r = run(CHRIS, BDR_OUTBOUND_JOB, 7.5, AVOID_SALES);
    expect(r.postScore).toBeLessThanOrEqual(3.5);
  });

  it("sales-ops hybrid + sales avoided → hard capped ≤ 3.5", () => {
    const r = run(CHRIS, SALES_OPS_HYBRID_JOB, 7.5, AVOID_SALES);
    expect(r.postScore).toBeLessThanOrEqual(3.5);
  });

  it("property max grind + sales avoided → hard capped ≤ 3.5", () => {
    const r = run(CHRIS, PROPERTY_MAX_GRIND_JOB, 7.3, AVOID_SALES);
    expect(r.postScore).toBeLessThanOrEqual(3.5);
  });

  it("builder job + sales avoided → NOT suppressed", () => {
    const r = run(CHRIS, SYSTEMS_PRODUCT_JOB, 9.0, AVOID_SALES);
    expect(r.chipSuppression.suppressed).toBe(false);
    expect(r.postScore).toBe(9.0);
  });

  // ── Chip suppression: ops avoided ─────────────────────
  it("ops coordinator + ops avoided → hard capped ≤ 4.0", () => {
    const r = run(CHRIS, OPS_COORDINATOR_JOB, 7.5, AVOID_OPS);
    expect(r.postScore).toBeLessThanOrEqual(4.0);
  });
});

// ═══════════════════════════════════════════════════════════
// ─── FABIO REGRESSION (analytical_investigative) ────────────
// ═══════════════════════════════════════════════════════════

describe("Regression: Fabio (analytical_investigative)", () => {
  // ── Anchor: compatible analytical job unchanged ────────
  it("security analyst (raw 8.5) → compatible, untouched", () => {
    const r = run(FABIO, SECURITY_ANALYST_JOB, 8.5, NO_CHIPS);
    expect(r.userMode.mode).toBe("analytical_investigative");
    expect(r.jobMode.mode).toBe("analytical_investigative");
    expect(r.compatibility).toBe("compatible");
    expect(r.workModeAdjustment).toBe(0);
    expect(r.postScore).toBe(8.5);
  });

  it("security analyst (raw 9.2) → anchor preserved", () => {
    const r = run(FABIO, SECURITY_ANALYST_JOB, 9.2, NO_CHIPS);
    expect(r.postScore).toBe(9.2);
  });

  // ── Conflicting: sales job suppressed ──────────────────
  it("inside sales (raw 7.0) → conflicting, below 7", () => {
    const r = run(FABIO, INSIDE_SALES_JOB, 7.0, NO_CHIPS);
    expect(r.compatibility).toBe("conflicting");
    expect(r.postScore).toBeLessThan(7.0);
  });

  it("property max grind (raw 6.5) → crushed below 5", () => {
    const r = run(FABIO, PROPERTY_MAX_GRIND_JOB, 6.5, NO_CHIPS);
    expect(r.compatibility).toBe("conflicting");
    expect(r.postScore).toBeLessThanOrEqual(5.0);
  });

  // ── Chip: sales avoided ────────────────────────────────
  it("inside sales + sales avoided → score ≤ 3.5 (penalties already crush it)", () => {
    const r = run(FABIO, INSIDE_SALES_JOB, 8.0, AVOID_SALES);
    // Work mode + EI + role-type penalties push score well below 3.5 before
    // chip suppression can even fire. Chip suppression won't set suppressed=true
    // when the pre-chip score is already below the cap.
    expect(r.postScore).toBeLessThanOrEqual(3.5);
  });

  it("security analyst + sales avoided → NOT suppressed", () => {
    const r = run(FABIO, SECURITY_ANALYST_JOB, 8.5, AVOID_SALES);
    expect(r.chipSuppression.suppressed).toBe(false);
    expect(r.postScore).toBe(8.5);
  });

  // ── Conflicting: ops job → analytical vs ops is conflicting ─
  it("ops coordinator (raw 7.0) → conflicting per compatibility map", () => {
    const r = run(FABIO, OPS_COORDINATOR_JOB, 7.0, NO_CHIPS);
    // analytical_investigative vs operational_execution = conflicting
    expect(r.compatibility).toBe("conflicting");
    expect(r.postScore).toBeLessThan(7.0);
  });
});

// ═══════════════════════════════════════════════════════════
// ─── JEN REGRESSION (blended / unclassified) ────────────────
// ═══════════════════════════════════════════════════════════

describe("Regression: Jen (blended/unclassified)", () => {
  // ── Anchor: ops role stays viable (adjacent/compatible) ─
  it("ops coordinator (raw 7.2) → not conflicting, viable 6.0–7.5", () => {
    const r = run(JEN, OPS_COORDINATOR_JOB, 7.2, NO_CHIPS);
    expect(r.compatibility).not.toBe("conflicting");
    expect(r.postScore).toBeGreaterThanOrEqual(6.0);
    expect(r.postScore).toBeLessThanOrEqual(7.5);
  });

  // ── Sales job: Jen is ops-classified → adjacent to sales, but EI hits hard ─
  it("inside sales (raw 7.0) → adjacent with EI penalty, score drops", () => {
    const r = run(JEN, INSIDE_SALES_JOB, 7.0, NO_CHIPS);
    // Jen classifies as operational_execution → adjacent to sales_execution
    // But execution intensity on sales job adds significant EI penalty
    expect(r.compatibility).toBe("adjacent");
    expect(r.postScore).toBeLessThan(7.0);
  });

  // ── Builder job: not her domain → should not inflate ───
  it("builder/systems job (raw 8.0) → no artificial inflation", () => {
    const r = run(JEN, SYSTEMS_PRODUCT_JOB, 8.0, NO_CHIPS);
    // Jen doesn't classify as builder, so compatible(null,builder)=compatible (no penalty)
    // But raw score represents the upstream alignment; no inflation from work_mode
    expect(r.postScore).toBeLessThanOrEqual(8.0);
  });

  // ── Chip: sales avoided (Jen avoids sales) ────────────
  it("inside sales + sales avoided → hard capped ≤ 3.5", () => {
    const jenPrefs: ChipConfig = {
      label: "jen sales avoided",
      prefs: { avoidedModes: ["sales_execution"] },
    };
    const r = run(JEN, INSIDE_SALES_JOB, 7.0, jenPrefs);
    expect(r.postScore).toBeLessThanOrEqual(3.5);
  });

  // ── Weak profile: no harsh penalties for adjacent roles ─
  it("creative director (raw 6.5) → no harsh penalty, reasonable range", () => {
    const r = run(JEN, CREATIVE_DIRECTOR_JOB, 6.5, NO_CHIPS);
    // Weak/null user mode → no work mode penalty → score stays at raw
    expect(r.postScore).toBeGreaterThanOrEqual(5.0);
    expect(r.postScore).toBeLessThanOrEqual(7.0);
  });
});

// ═══════════════════════════════════════════════════════════
// ─── DINGUS REGRESSION (weak control) ───────────────────────
// ═══════════════════════════════════════════════════════════

describe("Regression: Dingus (weak control — no classification)", () => {
  // REGRESSION FINDING: Dingus classifies as operational_execution (not null)
  // despite being a "weak" profile. Customer service + scheduling + organizing
  // keywords push enough ops signal density to clear the classification threshold.
  // This is accurate but flagged as a notable finding.

  it("Dingus classifies as operational_execution (not null)", () => {
    const r = run(DINGUS, INSIDE_SALES_JOB, 7.0, NO_CHIPS);
    expect(r.userMode.mode).toBe("operational_execution");
  });

  // ── Ops-classified: compatible with ops job ────────────
  it("ops job (raw 6.0) → compatible, no adjustment", () => {
    const r = run(DINGUS, OPS_COORDINATOR_JOB, 6.0, NO_CHIPS);
    expect(r.compatibility).toBe("compatible");
    expect(r.workModeAdjustment).toBe(0);
    expect(r.postScore).toBe(6.0);
  });

  // ── Adjacent to sales → mild drag ──────────────────────
  it("sales job (raw 7.0) → adjacent, EI penalties apply", () => {
    const r = run(DINGUS, INSIDE_SALES_JOB, 7.0, NO_CHIPS);
    expect(r.compatibility).toBe("adjacent");
    expect(r.postScore).toBeLessThan(7.0);
  });

  // ── Adjacent to builder → mild drag ────────────────────
  it("builder job (raw 6.5) → adjacent", () => {
    const r = run(DINGUS, SYSTEMS_PRODUCT_JOB, 6.5, NO_CHIPS);
    expect(r.compatibility).toBe("adjacent");
    expect(r.postScore).toBeLessThan(6.5);
  });

  // ── Conflicting with analytical ────────────────────────
  it("security analyst (raw 7.5) → conflicting", () => {
    const r = run(DINGUS, SECURITY_ANALYST_JOB, 7.5, NO_CHIPS);
    expect(r.compatibility).toBe("conflicting");
    expect(r.postScore).toBeLessThan(7.5);
  });

  // ── Adjacent to sales + heavy EI → drops ──────────────
  it("property max grind (raw 5.5) → adjacent + EI penalty", () => {
    const r = run(DINGUS, PROPERTY_MAX_GRIND_JOB, 5.5, NO_CHIPS);
    expect(r.compatibility).toBe("adjacent");
    expect(r.postScore).toBeLessThan(5.5);
  });

  // ── Chip suppression still works for weak profiles ─────
  it("sales job + sales avoided → hard capped ≤ 3.5 even for weak profile", () => {
    const dingusPrefs: ChipConfig = {
      label: "dingus sales avoided",
      prefs: { avoidedModes: ["sales_execution"] },
    };
    const r = run(DINGUS, INSIDE_SALES_JOB, 7.0, dingusPrefs);
    expect(r.postScore).toBeLessThanOrEqual(3.5);
  });
});

// ═══════════════════════════════════════════════════════════
// ─── DETERMINISM: full matrix repeated ──────────────────────
// ═══════════════════════════════════════════════════════════

describe("Regression: deterministic repeatability across fixture matrix", () => {
  const USERS = [CHRIS, FABIO, JEN, DINGUS] as const;
  const JOBS = [
    SYSTEMS_PRODUCT_JOB,
    INSIDE_SALES_JOB,
    OPS_COORDINATOR_JOB,
    SECURITY_ANALYST_JOB,
    PROPERTY_MAX_GRIND_JOB,
  ] as const;
  const RAW_SCORES = [6.0, 7.3, 8.5] as const;
  const CHIP_CONFIGS = [NO_CHIPS, AVOID_SALES, AVOID_OPS] as const;
  const RUNS = 5;

  it("all user×job×score×chip combinations are deterministic across 5 runs", () => {
    const failures: string[] = [];

    for (const user of USERS) {
      for (const job of JOBS) {
        for (const raw of RAW_SCORES) {
          for (const chips of CHIP_CONFIGS) {
            const scores: number[] = [];
            for (let i = 0; i < RUNS; i++) {
              const r = run(user, job, raw, chips);
              scores.push(r.postScore);
            }
            const unique = [...new Set(scores)];
            if (unique.length !== 1) {
              failures.push(
                `NON-DETERMINISTIC: ${user.name} × ${job.name} @ ${raw} [${chips.label}]: ${scores.join(",")}`,
              );
            }
          }
        }
      }
    }

    if (failures.length > 0) {
      fail(`Determinism violations:\n${failures.join("\n")}`);
    }
  });
});

// ═══════════════════════════════════════════════════════════
// ─── ROLE-TYPE CLASSIFICATION MATRIX ────────────────────────
// ═══════════════════════════════════════════════════════════

describe("Regression: role-type classification for canonical jobs", () => {
  it("sales jobs → SYSTEM_SELLER", () => {
    expect(classifyRoleType(INSIDE_SALES_JOB.text)).toBe("SYSTEM_SELLER");
    expect(classifyRoleType(ENTERPRISE_AE_JOB.text)).toBe("SYSTEM_SELLER");
    expect(classifyRoleType(BDR_OUTBOUND_JOB.text)).toBe("SYSTEM_SELLER");
    expect(classifyRoleType(PROPERTY_MAX_GRIND_JOB.text)).toBe("SYSTEM_SELLER");
    expect(classifyRoleType(SALES_OPS_HYBRID_JOB.text)).toBe("SYSTEM_SELLER");
  });

  it("builder jobs → SYSTEM_BUILDER", () => {
    expect(classifyRoleType(SYSTEMS_PRODUCT_JOB.text)).toBe("SYSTEM_BUILDER");
  });

  it("ops jobs → SYSTEM_OPERATOR", () => {
    expect(classifyRoleType(OPS_COORDINATOR_JOB.text)).toBe("SYSTEM_OPERATOR");
  });

  it("analytical jobs → not SYSTEM_SELLER", () => {
    const rt = classifyRoleType(SECURITY_ANALYST_JOB.text);
    expect(rt).not.toBe("SYSTEM_SELLER");
  });
});

// ═══════════════════════════════════════════════════════════
// ─── REGRESSION REPORT (console output) ─────────────────────
// ═══════════════════════════════════════════════════════════

describe("Regression Report (console summary)", () => {
  type ReportRow = {
    fixture: string;
    job: string;
    raw: number;
    chips: string;
    post: number;
    compat: string;
    roleType: string;
    wmAdj: number;
    eiAdj: number;
    rtPen: number;
    chipAdj: number;
    pass: string;
  };

  it("produces fixture regression matrix", () => {
    const USERS = [CHRIS, FABIO, JEN, DINGUS] as const;
    const JOBS = [
      { fix: SYSTEMS_PRODUCT_JOB, raw: 9.0, winner: true },
      { fix: INSIDE_SALES_JOB, raw: 7.3, winner: false },
      { fix: OPS_COORDINATOR_JOB, raw: 7.2, winner: false },
      { fix: SECURITY_ANALYST_JOB, raw: 8.5, winner: false },
      { fix: PROPERTY_MAX_GRIND_JOB, raw: 7.0, winner: false },
    ] as const;
    const CHIP_CONFIGS_REPORT = [NO_CHIPS, AVOID_SALES] as const;

    const rows: ReportRow[] = [];

    for (const user of USERS) {
      for (const { fix: job, raw } of JOBS) {
        for (const chips of CHIP_CONFIGS_REPORT) {
          const r = run(user, job, raw, chips);

          // Decide pass/fail based on expected behavior
          let pass = "PASS";

          // Strong-fit anchor: compatible jobs for the right user should stay high
          if (user === CHRIS && job === SYSTEMS_PRODUCT_JOB && r.postScore < 8.0) pass = "FAIL";
          if (user === FABIO && job === SECURITY_ANALYST_JOB && r.postScore < 8.0) pass = "FAIL";

          // Conflicting without chips: should drop
          if (user === CHRIS && job === INSIDE_SALES_JOB && chips === NO_CHIPS && r.postScore >= 7.0) pass = "FAIL";
          if (user === FABIO && job === INSIDE_SALES_JOB && chips === NO_CHIPS && r.postScore >= 7.0) pass = "FAIL";

          // Chip suppression: sales avoided → sales jobs ≤ 3.5
          if (chips === AVOID_SALES && [INSIDE_SALES_JOB, PROPERTY_MAX_GRIND_JOB].includes(job as any)) {
            if (r.jobMode.mode === "sales_execution" && r.postScore > 3.5) pass = "FAIL";
          }

          // Dingus: ops-classified, so compatible with ops, adjacent/conflicting elsewhere
          if (user === DINGUS && chips === NO_CHIPS && job === OPS_COORDINATOR_JOB && r.workModeAdjustment !== 0) pass = "FAIL";

          rows.push({
            fixture: user.name,
            job: job.name,
            raw,
            chips: chips.label,
            post: r.postScore,
            compat: r.compatibility,
            roleType: r.roleType ?? "-",
            wmAdj: r.workModeAdjustment,
            eiAdj: r.executionIntensityAdjustment,
            rtPen: r.roleTypePenalty,
            chipAdj: r.chipSuppressionAdjustment,
            pass,
          });
        }
      }
    }

    // Print report
    console.log("\n╔══════════════════════════════════════════════════════════════════════════════════════════════════════════════╗");
    console.log("║                              FIXTURE REGRESSION MATRIX — CHIP-ENABLED SCORING                               ║");
    console.log("╠══════════════════════════════════════════════════════════════════════════════════════════════════════════════╣");
    console.log(
      "║ " +
      "Fixture".padEnd(8) +
      "Job".padEnd(22) +
      "Raw".padStart(5) +
      "Post".padStart(6) +
      "Compat".padStart(12) +
      "RoleType".padStart(16) +
      "WM".padStart(6) +
      "EI".padStart(6) +
      "RT".padStart(6) +
      "Chip".padStart(6) +
      "Chips".padStart(14) +
      "  Pass ║"
    );
    console.log("╠══════════════════════════════════════════════════════════════════════════════════════════════════════════════╣");

    for (const r of rows) {
      console.log(
        "║ " +
        r.fixture.padEnd(8) +
        r.job.padEnd(22) +
        r.raw.toFixed(1).padStart(5) +
        r.post.toFixed(1).padStart(6) +
        r.compat.padStart(12) +
        r.roleType.padStart(16) +
        r.wmAdj.toFixed(1).padStart(6) +
        r.eiAdj.toFixed(1).padStart(6) +
        r.rtPen.toFixed(1).padStart(6) +
        r.chipAdj.toFixed(1).padStart(6) +
        r.chips.padStart(14) +
        `  ${r.pass}`.padStart(6) + " ║"
      );
    }

    console.log("╚══════════════════════════════════════════════════════════════════════════════════════════════════════════════╝");

    // Assert all rows pass
    const failed = rows.filter((r) => r.pass === "FAIL");
    if (failed.length > 0) {
      throw new Error(
        `Regression failures:\n${failed.map((r) => `  ${r.fixture} × ${r.job} [${r.chips}]: raw=${r.raw} post=${r.post}`).join("\n")}`,
      );
    }
  });
});

// ═══════════════════════════════════════════════════════════
// ─── EXECUTION EVIDENCE GUARDRAIL REGRESSION ────────────────
// ═══════════════════════════════════════════════════════════

describe("Regression: execution evidence guardrail", () => {
  // ── Domain-locked: Chris vs Salesforce CPQ ────────────
  // Chris is builder_systems, Salesforce CPQ is builder_systems → compatible.
  // But Chris has zero Salesforce ecosystem evidence → guardrail caps at 7.0.

  it("Chris × Salesforce CPQ (raw 9.0) → domain_locked gap, capped ≤ 7.0", () => {
    const r = run(CHRIS, SALESFORCE_CPQ_ARCHITECT_JOB, 9.0, NO_CHIPS);
    expect(r.userMode.mode).toBe("builder_systems");
    expect(r.jobMode.mode).toBe("builder_systems");
    expect(r.compatibility).toBe("compatible");
    expect(r.executionEvidence.triggered).toBe(true);
    expect(r.executionEvidence.categories).toContain("domain_locked");
    expect(r.executionEvidence.cap).toBe(7.0);
    expect(r.postScore).toBeLessThanOrEqual(7.0);
    expect(r.executionEvidenceAdjustment).toBeLessThan(0);
    expect(r.adjustmentReason).toContain("Execution evidence guardrail");
  });

  it("Chris × Salesforce CPQ (raw 6.5) → below cap, guardrail does NOT fire", () => {
    const r = run(CHRIS, SALESFORCE_CPQ_ARCHITECT_JOB, 6.5, NO_CHIPS);
    expect(r.executionEvidence.triggered).toBe(false);
    expect(r.executionEvidenceAdjustment).toBe(0);
    expect(r.postScore).toBe(6.5);
  });

  // ── Stack execution: Chris vs Senior Python Developer ──
  // Chris is builder_systems, Python dev is builder_systems → compatible.
  // But Chris has no specific coding/language evidence → guardrail caps at 7.0.

  it("Chris × Senior Python Dev (raw 8.5) → stack_execution gap, capped ≤ 7.0", () => {
    const r = run(CHRIS, SENIOR_PYTHON_DEVELOPER_JOB, 8.5, NO_CHIPS);
    expect(r.userMode.mode).toBe("builder_systems");
    expect(r.compatibility).toBe("compatible");
    expect(r.executionEvidence.triggered).toBe(true);
    expect(r.executionEvidence.categories).toContain("stack_execution");
    expect(r.executionEvidence.cap).toBe(7.0);
    expect(r.postScore).toBeLessThanOrEqual(7.0);
    expect(r.executionEvidenceAdjustment).toBeLessThan(0);
  });

  it("Chris × Senior Python Dev (raw 6.0) → below cap, guardrail does NOT fire", () => {
    const r = run(CHRIS, SENIOR_PYTHON_DEVELOPER_JOB, 6.0, NO_CHIPS);
    expect(r.executionEvidence.triggered).toBe(false);
    expect(r.postScore).toBe(6.0);
  });

  // ── Non-trigger: Chris vs generic builder job stays untouched ──
  // Systems Product job has no domain-locked or stack-execution signals.

  it("Chris × Systems Product (raw 9.0) → guardrail does NOT fire", () => {
    const r = run(CHRIS, SYSTEMS_PRODUCT_JOB, 9.0, NO_CHIPS);
    expect(r.executionEvidence.triggered).toBe(false);
    expect(r.executionEvidenceAdjustment).toBe(0);
    expect(r.postScore).toBe(9.0);
  });

  // ── Non-trigger: Marcus has Salesforce evidence ────────
  // Marcus mentions "Used Salesforce CRM daily" → Salesforce evidence present.
  // Even though Marcus is sales_execution and would conflict with builder CPQ job,
  // the domain evidence check would pass. Work mode mismatch handles the rest.

  it("Marcus × Salesforce CPQ → mode-conflicting + domain evidence present → guardrail fires only for stack (if applicable)", () => {
    const r = run(MARCUS, SALESFORCE_CPQ_ARCHITECT_JOB, 7.0, NO_CHIPS);
    expect(r.compatibility).toBe("conflicting");
    // Marcus has Salesforce evidence (mentions "Salesforce CRM" in resume)
    // so domain_locked should NOT be in categories
    expect(r.executionEvidence.categories).not.toContain("domain_locked");
    // Score already dropped by mode conflict so guardrail may not fire at all
    expect(r.postScore).toBeLessThan(7.0);
  });

  // ── Sales job: no domain/stack signals → guardrail untouched ──

  it("Chris × Inside Sales (raw 7.3) → no execution evidence signals, guardrail silent", () => {
    const r = run(CHRIS, INSIDE_SALES_JOB, 7.3, NO_CHIPS);
    expect(r.executionEvidence.triggered).toBe(false);
    // Existing behavior preserved: conflicting mode drags score
    expect(r.postScore).toBeLessThan(7.0);
  });

  // ── Determinism: execution evidence guardrail is deterministic ──

  it("Chris × Salesforce CPQ is deterministic across 5 runs", () => {
    const scores: number[] = [];
    for (let i = 0; i < 5; i++) {
      const r = run(CHRIS, SALESFORCE_CPQ_ARCHITECT_JOB, 9.0, NO_CHIPS);
      scores.push(r.postScore);
    }
    expect(new Set(scores).size).toBe(1);
  });

  it("Chris × Senior Python Dev is deterministic across 5 runs", () => {
    const scores: number[] = [];
    for (let i = 0; i < 5; i++) {
      const r = run(CHRIS, SENIOR_PYTHON_DEVELOPER_JOB, 8.5, NO_CHIPS);
      scores.push(r.postScore);
    }
    expect(new Set(scores).size).toBe(1);
  });
});
