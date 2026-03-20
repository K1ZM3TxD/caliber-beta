// lib/work_mode.test.ts

import {
  classifyUserWorkMode,
  classifyJobWorkMode,
  getWorkModeCompatibility,
  applyWorkModeCeiling,
  applyWorkModeAdjustment,
  detectExecutionIntensity,
  evaluateWorkMode,
  _testing,
  type WorkMode,
  type WorkModeClassification,
} from "./work_mode";

import {
  CHRIS, MARCUS, PRIYA, FABIO, LUNA,
  ALEX, DANA, RIO, NADIA, TOMAS,
  DINGUS, JEN,
  CORE_USERS, BLENDED_USERS, ALL_USERS,
  SYSTEMS_PRODUCT_JOB, DEVOPS_ENGINEER_JOB, FULLSTACK_ENGINEER_JOB,
  INSIDE_SALES_JOB, ENTERPRISE_AE_JOB, BDR_OUTBOUND_JOB,
  OPS_COORDINATOR_JOB, WAREHOUSE_OPS_JOB, CALL_CENTER_JOB,
  SECURITY_ANALYST_JOB, DATA_ANALYST_JOB, FORENSIC_ACCOUNTANT_JOB,
  CREATIVE_DIRECTOR_JOB, CONTENT_STRATEGIST_JOB,
  SALES_OPS_HYBRID_JOB, PROPERTY_MAX_GRIND_JOB,
  VP_SALES_STRATEGY_JOB, STARTUP_COO_OPS_JOB, FIELD_OPS_DIRECTOR_JOB,
  CONSTRUCTION_PM_JOB, PROGRAM_COORDINATOR_JOB,
  FALSE_POSITIVE_TRAP_JOBS, ALL_JOBS,
} from "./__fixtures__/work_mode_fixtures";

const {
  classifyText, COMPATIBILITY_MAP, WORK_MODE_ADJUSTMENTS,
  EXECUTION_INTENSITY_TRIGGERS, INTENSITY_ADJUSTMENTS,
  STRUCTURAL_SIGNALS, EXECUTION_MANAGEMENT_SIGNALS,
  EXECUTION_DOMINANCE_THRESHOLD, applyExecutionDiscriminator,
} = _testing;

// ─── Backward-compatible aliases for existing tests ─────────

const CHRIS_RESUME = CHRIS.resumeText;
const CHRIS_PROMPTS = CHRIS.promptAnswers;
const FABIO_RESUME = FABIO.resumeText;
const FABIO_PROMPTS = FABIO.promptAnswers;
const JEN_RESUME = JEN.resumeText;
const JEN_PROMPTS = JEN.promptAnswers;

// Job text aliases for backward compatibility with existing tests
const INSIDE_SALES_JOB_TEXT = INSIDE_SALES_JOB.text;
const SYSTEMS_PRODUCT_JOB_TEXT = SYSTEMS_PRODUCT_JOB.text;
const OPS_COORDINATOR_JOB_TEXT = OPS_COORDINATOR_JOB.text;
const SECURITY_ANALYST_JOB_TEXT = SECURITY_ANALYST_JOB.text;
const SALES_OPS_HYBRID_JOB_TEXT = SALES_OPS_HYBRID_JOB.text;
const PROPERTY_MAX_GRIND_JOB_TEXT = PROPERTY_MAX_GRIND_JOB.text;

// ─── User Classification Tests ──────────────────────────────

describe("classifyUserWorkMode", () => {
  it("classifies Chris as builder_systems", () => {
    const result = classifyUserWorkMode(CHRIS_RESUME, CHRIS_PROMPTS);
    expect(result.mode).toBe("builder_systems");
    expect(result.confidence).not.toBe("none");
    expect(result.scores.builder_systems).toBeGreaterThan(result.scores.sales_execution);
  });

  it("excludes prompt_2 (drain) from positive signals", () => {
    // Chris's prompt_2 mentions "sales cycles, quota" — should NOT boost sales_execution
    const withDrain = classifyUserWorkMode(CHRIS_RESUME, CHRIS_PROMPTS);
    const salesScore = withDrain.scores.sales_execution;
    // Sales score should be low despite "sales cycles, quota" appearing in prompt_2
    expect(salesScore).toBeLessThan(withDrain.scores.builder_systems);
  });

  it("classifies Fabio as analytical_investigative", () => {
    const result = classifyUserWorkMode(FABIO_RESUME, FABIO_PROMPTS);
    expect(result.mode).toBe("analytical_investigative");
    expect(result.confidence).not.toBe("none");
  });

  it("classifies Jen — not as builder_systems", () => {
    const result = classifyUserWorkMode(JEN_RESUME, JEN_PROMPTS);
    // Jen's profile is ops/sales/enablement, not builder
    expect(result.mode).not.toBe("builder_systems");
  });
});

// ─── Job Classification Tests ───────────────────────────────

describe("classifyJobWorkMode", () => {
  it("classifies inside sales job as sales_execution", () => {
    const result = classifyJobWorkMode(INSIDE_SALES_JOB_TEXT);
    expect(result.mode).toBe("sales_execution");
    expect(result.confidence).toBe("high");
  });

  it("classifies systems/product job as builder_systems", () => {
    const result = classifyJobWorkMode(SYSTEMS_PRODUCT_JOB_TEXT);
    expect(result.mode).toBe("builder_systems");
    expect(result.confidence).toBe("high");
  });

  it("classifies ops coordinator job as operational_execution", () => {
    const result = classifyJobWorkMode(OPS_COORDINATOR_JOB_TEXT);
    expect(result.mode).toBe("operational_execution");
  });

  it("classifies security analyst job as analytical_investigative", () => {
    const result = classifyJobWorkMode(SECURITY_ANALYST_JOB_TEXT);
    expect(result.mode).toBe("analytical_investigative");
    expect(result.confidence).toBe("high");
  });

  it("classifies sales-ops hybrid as sales_execution (dominant mode wins)", () => {
    const result = classifyJobWorkMode(SALES_OPS_HYBRID_JOB_TEXT);
    expect(result.mode).toBe("sales_execution");
  });
});

// ─── Compatibility Map Tests ────────────────────────────────

describe("getWorkModeCompatibility", () => {
  it("compatible: same mode", () => {
    expect(getWorkModeCompatibility("builder_systems", "builder_systems")).toBe("compatible");
    expect(getWorkModeCompatibility("sales_execution", "sales_execution")).toBe("compatible");
  });

  it("conflicting: builder vs sales", () => {
    expect(getWorkModeCompatibility("builder_systems", "sales_execution")).toBe("conflicting");
  });

  it("conflicting: analytical vs sales", () => {
    expect(getWorkModeCompatibility("analytical_investigative", "sales_execution")).toBe("conflicting");
  });

  it("adjacent: builder vs ops", () => {
    expect(getWorkModeCompatibility("builder_systems", "operational_execution")).toBe("adjacent");
  });

  it("returns compatible when either mode is null", () => {
    expect(getWorkModeCompatibility(null, "sales_execution")).toBe("compatible");
    expect(getWorkModeCompatibility("builder_systems", null)).toBe("compatible");
  });
});

// ─── Work Mode Adjustment Tests ─────────────────────────────

describe("applyWorkModeAdjustment", () => {
  const highUser: WorkModeClassification = {
    mode: "builder_systems",
    scores: { builder_systems: 10, sales_execution: 0, operational_execution: 0, analytical_investigative: 0, creative_ideation: 0 },
    topMatches: ["product development", "SOP"],
    confidence: "high",
  };
  const highJob: WorkModeClassification = {
    mode: "sales_execution",
    scores: { builder_systems: 0, sales_execution: 12, operational_execution: 0, analytical_investigative: 0, creative_ideation: 0 },
    topMatches: ["quota", "cold calling"],
    confidence: "high",
  };
  const adjJob: WorkModeClassification = {
    mode: "operational_execution",
    scores: { builder_systems: 0, sales_execution: 0, operational_execution: 8, analytical_investigative: 0, creative_ideation: 0 },
    topMatches: ["coordination", "scheduling"],
    confidence: "high",
  };

  it("returns negative adjustment for conflicting modes", () => {
    const result = applyWorkModeAdjustment(7.8, "conflicting", highUser, highJob);
    expect(result.adjustment).toBe(WORK_MODE_ADJUSTMENTS.conflicting);
    expect(result.adjustment).toBeLessThan(0);
    expect(result.reason).toContain("conflicting");
  });

  it("returns mild negative adjustment for adjacent modes", () => {
    const result = applyWorkModeAdjustment(8.5, "adjacent", highUser, adjJob);
    expect(result.adjustment).toBe(WORK_MODE_ADJUSTMENTS.adjacent);
    expect(result.adjustment).toBeLessThan(0);
    expect(result.adjustment).toBeGreaterThan(WORK_MODE_ADJUSTMENTS.conflicting);
    expect(result.reason).toContain("adjacent");
  });

  it("returns zero adjustment for compatible modes", () => {
    const result = applyWorkModeAdjustment(8.5, "compatible", highUser, highJob);
    expect(result.adjustment).toBe(0);
    expect(result.reason).toBeNull();
  });

  it("returns zero adjustment when user confidence is none", () => {
    const weakUser: WorkModeClassification = { ...highUser, confidence: "none" };
    const result = applyWorkModeAdjustment(7.8, "conflicting", weakUser, highJob);
    expect(result.adjustment).toBe(0);
  });

  it("returns zero adjustment when job confidence is none", () => {
    const weakJob: WorkModeClassification = { ...highJob, confidence: "none" };
    const result = applyWorkModeAdjustment(7.8, "conflicting", highUser, weakJob);
    expect(result.adjustment).toBe(0);
  });
});

// ─── Legacy applyWorkModeCeiling wrapper ────────────────────

describe("applyWorkModeCeiling (legacy compat)", () => {
  const highUser: WorkModeClassification = {
    mode: "builder_systems",
    scores: { builder_systems: 10, sales_execution: 0, operational_execution: 0, analytical_investigative: 0, creative_ideation: 0 },
    topMatches: ["product development", "SOP"],
    confidence: "high",
  };
  const highJob: WorkModeClassification = {
    mode: "sales_execution",
    scores: { builder_systems: 0, sales_execution: 12, operational_execution: 0, analytical_investigative: 0, creative_ideation: 0 },
    topMatches: ["quota", "cold calling"],
    confidence: "high",
  };

  it("applies adjustment for conflicting modes via ceiling wrapper", () => {
    const result = applyWorkModeCeiling(7.8, "conflicting", highUser, highJob);
    expect(result.ceilingApplied).toBe(true);
    expect(result.score).toBeLessThan(7.8);
    expect(result.score).toBe(Math.round((7.8 + WORK_MODE_ADJUSTMENTS.conflicting) * 10) / 10);
  });

  it("does not adjust for compatible modes", () => {
    const result = applyWorkModeCeiling(8.5, "compatible", highUser, highJob);
    expect(result.ceilingApplied).toBe(false);
    expect(result.score).toBe(8.5);
  });

  it("score does not go below 0", () => {
    const result = applyWorkModeCeiling(1.0, "conflicting", highUser, highJob);
    expect(result.score).toBeGreaterThanOrEqual(0);
  });
});

// ─── Execution Intensity Detection Tests ────────────────────

describe("detectExecutionIntensity", () => {
  it("detects no intensity in a systems/product job", () => {
    const result = detectExecutionIntensity(SYSTEMS_PRODUCT_JOB_TEXT);
    expect(result.score).toBe(0);
    expect(result.adjustment).toBe(0);
    expect(result.triggers).toHaveLength(0);
  });

  it("detects mild intensity in a basic inside sales job", () => {
    const result = detectExecutionIntensity(INSIDE_SALES_JOB_TEXT);
    expect(result.score).toBeGreaterThanOrEqual(3);
    expect(result.adjustment).toBeLessThan(0);
    expect(result.triggers.length).toBeGreaterThan(0);
  });

  it("detects heavy intensity in a grind-heavy sales job", () => {
    const result = detectExecutionIntensity(PROPERTY_MAX_GRIND_JOB_TEXT);
    expect(result.score).toBeGreaterThanOrEqual(6);
    expect(result.adjustment).toBeLessThanOrEqual(INTENSITY_ADJUSTMENTS.heavy);
    expect(result.triggers.length).toBeGreaterThanOrEqual(3);
  });

  it("detects extreme intensity in a door-to-door cold canvassing role", () => {
    const extremeJob =
      "Field Sales Canvasser\n" +
      "Make 80+ cold calls per day and go door-to-door in assigned territory.\n" +
      "Commission-based only. Must have thick skin and handle rejection daily.\n" +
      "High-volume outbound prospecting with daily activity targets.\n" +
      "Quota-carrying role with uncapped commission. Metrics-driven environment.\n" +
      "Door knocking in residential neighborhoods for in-person sales pitches.";
    const result = detectExecutionIntensity(extremeJob);
    expect(result.score).toBeGreaterThanOrEqual(10);
    expect(result.adjustment).toBe(INTENSITY_ADJUSTMENTS.extreme);
  });

  it("returns reason string with trigger details", () => {
    const result = detectExecutionIntensity(INSIDE_SALES_JOB_TEXT);
    expect(result.reason).toBeTruthy();
    expect(result.reason).toContain("Execution intensity");
  });
});

// ─── End-to-End Regression Tests ────────────────────────────

describe("evaluateWorkMode — regression scenarios", () => {

  it("Chris (Builder) vs inside-sales job → dragged below 7 (conflicting + intensity)", () => {
    // Simulating a raw score of 7.3 that inflated from keyword overlap
    const result = evaluateWorkMode(7.3, CHRIS_RESUME, CHRIS_PROMPTS, INSIDE_SALES_JOB_TEXT);
    expect(result.userMode.mode).toBe("builder_systems");
    expect(result.jobMode.mode).toBe("sales_execution");
    expect(result.compatibility).toBe("conflicting");
    expect(result.workModeAdjustment).toBeLessThan(0);
    expect(result.postScore).toBeLessThan(7.0);
  });

  it("Chris (Builder) vs systems/product role → remains high (no adjustment)", () => {
    const result = evaluateWorkMode(8.2, CHRIS_RESUME, CHRIS_PROMPTS, SYSTEMS_PRODUCT_JOB_TEXT);
    expect(result.userMode.mode).toBe("builder_systems");
    expect(result.jobMode.mode).toBe("builder_systems");
    expect(result.compatibility).toBe("compatible");
    expect(result.workModeAdjustment).toBe(0);
    expect(result.executionIntensityAdjustment).toBe(0);
    expect(result.postScore).toBe(8.2);
  });

  it("Fabio (Analytical) vs sales job → suppressed below 7", () => {
    const result = evaluateWorkMode(7.0, FABIO_RESUME, FABIO_PROMPTS, INSIDE_SALES_JOB_TEXT);
    expect(result.userMode.mode).toBe("analytical_investigative");
    expect(result.jobMode.mode).toBe("sales_execution");
    expect(result.compatibility).toBe("conflicting");
    expect(result.workModeAdjustment).toBeLessThan(0);
    expect(result.postScore).toBeLessThan(7.0);
  });

  it("Fabio (Analytical) vs security analyst job → remains high", () => {
    const result = evaluateWorkMode(8.5, FABIO_RESUME, FABIO_PROMPTS, SECURITY_ANALYST_JOB_TEXT);
    expect(result.userMode.mode).toBe("analytical_investigative");
    expect(result.jobMode.mode).toBe("analytical_investigative");
    expect(result.compatibility).toBe("compatible");
    expect(result.workModeAdjustment).toBe(0);
    expect(result.postScore).toBe(8.5);
  });

  it("Jen vs adjacent ops role → mild drag only, remains viable", () => {
    const result = evaluateWorkMode(7.2, JEN_RESUME, JEN_PROMPTS, OPS_COORDINATOR_JOB_TEXT);
    // Jen's mode could be operational_execution or sales_execution
    // Either way, ops job should NOT be conflicting for her
    expect(result.compatibility).not.toBe("conflicting");
    // Adjacent gets mild penalty; compatible gets none; either way score stays viable
    expect(result.postScore).toBeGreaterThanOrEqual(6.0);
    expect(result.postScore).toBeLessThanOrEqual(7.5);
  });

  it("Chris (Builder) vs sales-ops hybrid → conflicting adjustment prevents inflation", () => {
    const result = evaluateWorkMode(7.5, CHRIS_RESUME, CHRIS_PROMPTS, SALES_OPS_HYBRID_JOB_TEXT);
    expect(result.userMode.mode).toBe("builder_systems");
    expect(result.jobMode.mode).toBe("sales_execution");
    expect(result.compatibility).toBe("conflicting");
    expect(result.workModeAdjustment).toBeLessThan(0);
    expect(result.postScore).toBeLessThan(7.0);
  });

  it("low raw score receives adjustment and stays low", () => {
    const result = evaluateWorkMode(4.2, CHRIS_RESUME, CHRIS_PROMPTS, INSIDE_SALES_JOB_TEXT);
    expect(result.compatibility).toBe("conflicting");
    expect(result.postScore).toBeLessThan(4.2);
    // Score never goes below 0
    expect(result.postScore).toBeGreaterThanOrEqual(0);
  });
});

// ─── Target Band Validation Tests ───────────────────────────

describe("evaluateWorkMode — target band behavior", () => {
  it("same-mode strong fit: score stays in 7–9 range", () => {
    const result = evaluateWorkMode(8.5, CHRIS_RESUME, CHRIS_PROMPTS, SYSTEMS_PRODUCT_JOB_TEXT);
    expect(result.postScore).toBeGreaterThanOrEqual(7);
    expect(result.postScore).toBeLessThanOrEqual(9.5);
  });

  it("adjacent fit: score settles in 6–7.5 range", () => {
    // Builder vs Ops = adjacent
    const result = evaluateWorkMode(7.5, CHRIS_RESUME, CHRIS_PROMPTS, OPS_COORDINATOR_JOB_TEXT);
    expect(result.compatibility).toBe("adjacent");
    expect(result.postScore).toBeGreaterThanOrEqual(6.0);
    expect(result.postScore).toBeLessThanOrEqual(7.5);
  });

  it("conflicting but light role: score drops but not catastrophic", () => {
    // Builder vs sales (no grind signals beyond the standard ones)
    const result = evaluateWorkMode(6.5, CHRIS_RESUME, CHRIS_PROMPTS, INSIDE_SALES_JOB_TEXT);
    expect(result.compatibility).toBe("conflicting");
    expect(result.postScore).toBeLessThan(6.5);
    expect(result.postScore).toBeGreaterThanOrEqual(2.0);
  });

  it("conflicting + high-intensity grind role: score lands in 'actively wrong' zone (3–5)", () => {
    // Property Max style grind job against a Builder profile
    const result = evaluateWorkMode(7.0, CHRIS_RESUME, CHRIS_PROMPTS, PROPERTY_MAX_GRIND_JOB_TEXT);
    expect(result.compatibility).toBe("conflicting");
    expect(result.executionIntensityAdjustment).toBeLessThan(0);
    expect(result.postScore).toBeLessThanOrEqual(5.0);
    expect(result.postScore).toBeGreaterThanOrEqual(0);
  });

  it("Property Max grind job pushed into avoid zone for Builder profile", () => {
    // Even with raw 7.3 (keyword overlap), total adjustments should crush this
    const result = evaluateWorkMode(7.3, CHRIS_RESUME, CHRIS_PROMPTS, PROPERTY_MAX_GRIND_JOB_TEXT);
    expect(result.workModeAdjustment).toBeLessThan(-1);
    expect(result.executionIntensityAdjustment).toBeLessThan(-1);
    expect(result.postScore).toBeLessThanOrEqual(5.0);
  });

  it("Property Max grind job also bad for Analytical profile", () => {
    const result = evaluateWorkMode(6.5, FABIO_RESUME, FABIO_PROMPTS, PROPERTY_MAX_GRIND_JOB_TEXT);
    expect(result.compatibility).toBe("conflicting");
    expect(result.postScore).toBeLessThanOrEqual(5.0);
  });
});

// ─── Debug Output Structure ─────────────────────────────────

describe("evaluateWorkMode — debug output", () => {
  it("returns complete debug structure with adjustment fields", () => {
    const result = evaluateWorkMode(7.0, CHRIS_RESUME, CHRIS_PROMPTS, INSIDE_SALES_JOB_TEXT);
    expect(result).toHaveProperty("userMode");
    expect(result).toHaveProperty("jobMode");
    expect(result).toHaveProperty("compatibility");
    expect(result).toHaveProperty("preScore");
    expect(result).toHaveProperty("postScore");
    expect(result).toHaveProperty("workModeAdjustment");
    expect(result).toHaveProperty("executionIntensityAdjustment");
    expect(result).toHaveProperty("executionIntensity");
    expect(result).toHaveProperty("adjustmentReason");
    expect(result.userMode).toHaveProperty("mode");
    expect(result.userMode).toHaveProperty("scores");
    expect(result.userMode).toHaveProperty("topMatches");
    expect(result.userMode).toHaveProperty("confidence");
    expect(result.jobMode).toHaveProperty("mode");
    expect(result.jobMode).toHaveProperty("scores");
    expect(result.executionIntensity).toHaveProperty("score");
    expect(result.executionIntensity).toHaveProperty("adjustment");
    expect(result.executionIntensity).toHaveProperty("triggers");
    expect(result.adjustmentReason).toBeTruthy();
  });
});

// ═══════════════════════════════════════════════════════════
// NEW FIXTURE COVERAGE (v0.9.22 fixture expansion)
// ═══════════════════════════════════════════════════════════

// ─── New User Classification Tests ──────────────────────────

describe("classifyUserWorkMode — expanded fixtures", () => {
  it("classifies Marcus as sales_execution", () => {
    const result = classifyUserWorkMode(MARCUS.resumeText, MARCUS.promptAnswers);
    expect(result.mode).toBe("sales_execution");
    expect(result.confidence).not.toBe("none");
  });

  it("classifies Priya as operational_execution", () => {
    const result = classifyUserWorkMode(PRIYA.resumeText, PRIYA.promptAnswers);
    expect(result.mode).toBe("operational_execution");
    expect(result.confidence).not.toBe("none");
  });

  it("classifies Luna as creative_ideation", () => {
    const result = classifyUserWorkMode(LUNA.resumeText, LUNA.promptAnswers);
    expect(result.mode).toBe("creative_ideation");
    expect(result.confidence).not.toBe("none");
  });

  it("classifies Alex (builder+analytical blend) with builder dominant", () => {
    const result = classifyUserWorkMode(ALEX.resumeText, ALEX.promptAnswers);
    expect(result.mode).toBe("builder_systems");
    expect(result.scores.builder_systems).toBeGreaterThan(result.scores.analytical_investigative);
  });

  it("classifies Dana (sales+ops blend) with sales dominant", () => {
    const result = classifyUserWorkMode(DANA.resumeText, DANA.promptAnswers);
    expect(result.mode).toBe("sales_execution");
    expect(result.scores.sales_execution).toBeGreaterThan(result.scores.operational_execution);
  });

  it("classifies Rio (creative+builder blend) with creative dominant", () => {
    const result = classifyUserWorkMode(RIO.resumeText, RIO.promptAnswers);
    expect(result.mode).toBe("creative_ideation");
    expect(result.scores.creative_ideation).toBeGreaterThan(result.scores.builder_systems);
  });

  it("classifies Nadia (analytical+creative blend) with analytical dominant", () => {
    const result = classifyUserWorkMode(NADIA.resumeText, NADIA.promptAnswers);
    expect(result.mode).toBe("analytical_investigative");
    expect(result.scores.analytical_investigative).toBeGreaterThan(result.scores.creative_ideation);
  });

  it("classifies Tomas (ops+sales blend) with ops dominant", () => {
    const result = classifyUserWorkMode(TOMAS.resumeText, TOMAS.promptAnswers);
    expect(result.mode).toBe("operational_execution");
    expect(result.scores.operational_execution).toBeGreaterThan(result.scores.sales_execution);
  });

  it("Dingus remains weak/unclassified (control fixture)", () => {
    const result = classifyUserWorkMode(DINGUS.resumeText, DINGUS.promptAnswers);
    // Dingus should be low confidence — weak profile
    expect(result.confidence === "none" || result.confidence === "low").toBe(true);
  });
});

// ─── New Job Classification Tests ───────────────────────────

describe("classifyJobWorkMode — expanded fixtures", () => {
  it("classifies DevOps Engineer as builder_systems", () => {
    const result = classifyJobWorkMode(DEVOPS_ENGINEER_JOB.text);
    expect(result.mode).toBe("builder_systems");
    expect(result.confidence).toBe("high");
  });

  it("classifies Full-Stack Engineer as builder_systems", () => {
    const result = classifyJobWorkMode(FULLSTACK_ENGINEER_JOB.text);
    expect(result.mode).toBe("builder_systems");
  });

  it("classifies Enterprise AE as sales_execution", () => {
    const result = classifyJobWorkMode(ENTERPRISE_AE_JOB.text);
    expect(result.mode).toBe("sales_execution");
    expect(result.confidence).toBe("high");
  });

  it("classifies BDR Outbound as sales_execution", () => {
    const result = classifyJobWorkMode(BDR_OUTBOUND_JOB.text);
    expect(result.mode).toBe("sales_execution");
  });

  it("classifies Warehouse Ops as operational_execution", () => {
    const result = classifyJobWorkMode(WAREHOUSE_OPS_JOB.text);
    expect(result.mode).toBe("operational_execution");
  });

  it("classifies Call Center as operational_execution", () => {
    const result = classifyJobWorkMode(CALL_CENTER_JOB.text);
    expect(result.mode).toBe("operational_execution");
  });

  it("classifies Data Analyst as analytical_investigative", () => {
    const result = classifyJobWorkMode(DATA_ANALYST_JOB.text);
    expect(result.mode).toBe("analytical_investigative");
  });

  it("classifies Forensic Accountant as analytical_investigative", () => {
    const result = classifyJobWorkMode(FORENSIC_ACCOUNTANT_JOB.text);
    expect(result.mode).toBe("analytical_investigative");
  });

  it("classifies Creative Director as creative_ideation", () => {
    const result = classifyJobWorkMode(CREATIVE_DIRECTOR_JOB.text);
    expect(result.mode).toBe("creative_ideation");
    expect(result.confidence).toBe("high");
  });

  it("classifies Content Strategist as creative_ideation", () => {
    const result = classifyJobWorkMode(CONTENT_STRATEGIST_JOB.text);
    expect(result.mode).toBe("creative_ideation");
  });
});

// ─── Expanded Regression Tests (e2e evaluateWorkMode) ───────

describe("evaluateWorkMode — expanded regression", () => {

  // Same-mode preservation: each pure user vs matching job → no drag
  it("Marcus (Sales) vs inside sales job → compatible, but execution intensity still drags", () => {
    const result = evaluateWorkMode(8.0, MARCUS.resumeText, MARCUS.promptAnswers, INSIDE_SALES_JOB.text);
    expect(result.compatibility).toBe("compatible");
    expect(result.workModeAdjustment).toBe(0);
    // Execution intensity still applies — inside sales has heavy grind signals
    // (50+ calls/day, cold calling, commission, objection handling, etc.)
    expect(result.executionIntensityAdjustment).toBeLessThan(0);
    expect(result.postScore).toBeLessThan(8.0);
  });

  it("Priya (Ops) vs ops coordinator job → compatible, score preserved", () => {
    const result = evaluateWorkMode(7.5, PRIYA.resumeText, PRIYA.promptAnswers, OPS_COORDINATOR_JOB.text);
    expect(result.compatibility).toBe("compatible");
    expect(result.workModeAdjustment).toBe(0);
    expect(result.postScore).toBe(7.5);
  });

  it("Luna (Creative) vs creative director job → compatible, score preserved", () => {
    const result = evaluateWorkMode(8.5, LUNA.resumeText, LUNA.promptAnswers, CREATIVE_DIRECTOR_JOB.text);
    expect(result.compatibility).toBe("compatible");
    expect(result.workModeAdjustment).toBe(0);
    expect(result.postScore).toBe(8.5);
  });

  // Conflicting cross-mode: score dragged down
  it("Marcus (Sales) vs builder/systems job → conflicting, dragged down", () => {
    const result = evaluateWorkMode(7.5, MARCUS.resumeText, MARCUS.promptAnswers, SYSTEMS_PRODUCT_JOB.text);
    expect(result.compatibility).toBe("conflicting");
    expect(result.workModeAdjustment).toBeLessThan(0);
    expect(result.postScore).toBeLessThan(7.0);
  });

  it("Luna (Creative) vs inside sales job → conflicting, dragged down", () => {
    const result = evaluateWorkMode(7.0, LUNA.resumeText, LUNA.promptAnswers, INSIDE_SALES_JOB.text);
    expect(result.compatibility).toBe("conflicting");
    expect(result.workModeAdjustment).toBeLessThan(0);
    expect(result.postScore).toBeLessThan(7.0);
  });

  it("Fabio (Analytical) vs ops coordinator → conflicting, dragged down", () => {
    const result = evaluateWorkMode(7.0, FABIO.resumeText, FABIO.promptAnswers, OPS_COORDINATOR_JOB.text);
    expect(result.compatibility).toBe("conflicting");
    expect(result.workModeAdjustment).toBeLessThan(0);
    expect(result.postScore).toBeLessThan(7.0);
  });

  // Adjacent cross-mode: mild drag only
  it("Chris (Builder) vs analytical job → adjacent, mild drag", () => {
    const result = evaluateWorkMode(8.0, CHRIS.resumeText, CHRIS.promptAnswers, SECURITY_ANALYST_JOB.text);
    expect(result.compatibility).toBe("adjacent");
    expect(result.workModeAdjustment).toBe(WORK_MODE_ADJUSTMENTS.adjacent);
    expect(result.postScore).toBeGreaterThanOrEqual(6.5);
    expect(result.postScore).toBeLessThanOrEqual(8.0);
  });

  // Blended user: dominant mode determines compatibility
  it("Alex (builder-dominant blend) vs builder job → compatible", () => {
    const result = evaluateWorkMode(8.0, ALEX.resumeText, ALEX.promptAnswers, DEVOPS_ENGINEER_JOB.text);
    expect(result.userMode.mode).toBe("builder_systems");
    expect(result.compatibility).toBe("compatible");
    expect(result.workModeAdjustment).toBe(0);
  });

  it("Nadia (analytical-dominant blend) vs sales job → conflicting", () => {
    const result = evaluateWorkMode(7.0, NADIA.resumeText, NADIA.promptAnswers, INSIDE_SALES_JOB.text);
    expect(result.userMode.mode).toBe("analytical_investigative");
    expect(result.compatibility).toBe("conflicting");
    expect(result.postScore).toBeLessThan(7.0);
  });

  // Dingus (weak control): no adjustment applied due to low confidence
  it("Dingus (weak profile) vs sales job → low-confidence adjacent, mild drag", () => {
    const result = evaluateWorkMode(6.0, DINGUS.resumeText, DINGUS.promptAnswers, INSIDE_SALES_JOB.text);
    // Dingus classifies as operational_execution with low confidence (customer service + scheduling)
    // ops vs sales = adjacent, and low confidence still triggers adjustment (only "none" skips)
    expect(result.userMode.confidence).toBe("low");
    expect(result.compatibility).toBe("adjacent");
    expect(result.workModeAdjustment).toBe(WORK_MODE_ADJUSTMENTS.adjacent);
  });

  // Ops user vs call center (compatible but execution intensity applies)
  it("Priya (Ops) vs call center → compatible, but no execution intensity (no grind triggers)", () => {
    const result = evaluateWorkMode(7.5, PRIYA.resumeText, PRIYA.promptAnswers, CALL_CENTER_JOB.text);
    expect(result.compatibility).toBe("compatible");
    expect(result.workModeAdjustment).toBe(0);
    // Call center job has customer support but no heavy execution-intensity triggers
    expect(result.postScore).toBeGreaterThanOrEqual(7.0);
  });

  // Grind-job still crushes non-sales profiles
  it("Luna (Creative) vs Property Max grind → conflicting + intensity, crushed", () => {
    const result = evaluateWorkMode(7.0, LUNA.resumeText, LUNA.promptAnswers, PROPERTY_MAX_GRIND_JOB.text);
    expect(result.compatibility).toBe("conflicting");
    expect(result.workModeAdjustment).toBeLessThan(0);
    expect(result.executionIntensityAdjustment).toBeLessThan(0);
    expect(result.postScore).toBeLessThanOrEqual(5.0);
  });
});

// ─── False-Positive Prevention Tests ────────────────────────

describe("evaluateWorkMode — false-positive prevention", () => {

  it("VP Sales with strategy vocabulary still classifies as sales_execution, not builder", () => {
    // This job uses strategic ownership language ("own the full revenue pipeline",
    // "build and manage a sales team") that could trick the classifier into
    // builder_systems. It must still land as sales_execution.
    const jobResult = classifyJobWorkMode(VP_SALES_STRATEGY_JOB.text);
    expect(jobResult.mode).toBe("sales_execution");
    // And a builder user should get conflicting, not compatible
    const result = evaluateWorkMode(7.8, CHRIS.resumeText, CHRIS.promptAnswers, VP_SALES_STRATEGY_JOB.text);
    expect(result.compatibility).toBe("conflicting");
    expect(result.postScore).toBeLessThan(7.0);
  });

  it("Startup COO with ownership vocabulary still classifies as operational_execution, not builder", () => {
    // "Own all operational execution" + "COO" title could inflate builder signals.
    // The dense ops triggers (procurement, payroll, bookkeeping, onboarding, scheduling,
    // data entry, ERP) must dominate.
    const jobResult = classifyJobWorkMode(STARTUP_COO_OPS_JOB.text);
    expect(jobResult.mode).toBe("operational_execution");
    // Builder user should get adjacent, not compatible
    const result = evaluateWorkMode(7.5, CHRIS.resumeText, CHRIS.promptAnswers, STARTUP_COO_OPS_JOB.text);
    expect(result.compatibility).toBe("adjacent");
    expect(result.postScore).toBeLessThan(7.5);
  });

  it("Field Ops Director with leadership vocabulary still classifies as operational_execution", () => {
    // "Director" title and "ensure operational excellence" could look strategic.
    // Dense ops triggers (logistics, dispatch, inventory, procurement, invoicing,
    // payroll, ticketing, order processing, ERP, clerical) must dominate.
    const jobResult = classifyJobWorkMode(FIELD_OPS_DIRECTOR_JOB.text);
    expect(jobResult.mode).toBe("operational_execution");
    // Analytical user should get conflicting
    const result = evaluateWorkMode(7.5, FABIO.resumeText, FABIO.promptAnswers, FIELD_OPS_DIRECTOR_JOB.text);
    expect(result.compatibility).toBe("conflicting");
    expect(result.postScore).toBeLessThan(7.0);
  });

  it("BDR outbound grind job not inflated for analytical profile", () => {
    const result = evaluateWorkMode(7.0, FABIO.resumeText, FABIO.promptAnswers, BDR_OUTBOUND_JOB.text);
    expect(result.compatibility).toBe("conflicting");
    expect(result.postScore).toBeLessThan(7.0);
  });
});

// ─── Structural vs Execution Discriminator Tests ────────────

describe("applyExecutionDiscriminator", () => {
  // Helper: build a fake builder_systems classification for discriminator input
  function builderClassification(score: number): WorkModeClassification {
    return {
      mode: "builder_systems",
      scores: {
        builder_systems: score,
        sales_execution: 0,
        operational_execution: 2,
        analytical_investigative: 0,
        creative_ideation: 0,
      },
      topMatches: ["infrastructure", "workflow", "engineering"],
      confidence: "high",
    };
  }

  it("reclassifies construction PM text from builder_systems → operational_execution", () => {
    const base = builderClassification(9);
    const { classification, discriminator } = applyExecutionDiscriminator(
      CONSTRUCTION_PM_JOB.text, base,
    );
    expect(discriminator.applied).toBe(true);
    expect(discriminator.executionScore).toBeGreaterThanOrEqual(EXECUTION_DOMINANCE_THRESHOLD);
    expect(discriminator.executionScore).toBeGreaterThan(discriminator.structuralScore);
    expect(classification.mode).toBe("operational_execution");
  });

  it("reclassifies program coordinator text from builder_systems → operational_execution", () => {
    const base = builderClassification(7);
    const { classification, discriminator } = applyExecutionDiscriminator(
      PROGRAM_COORDINATOR_JOB.text, base,
    );
    expect(discriminator.applied).toBe(true);
    expect(classification.mode).toBe("operational_execution");
  });

  it("does NOT reclassify Systems/Product Manager (legitimate builder)", () => {
    const base = builderClassification(21);
    const { classification, discriminator } = applyExecutionDiscriminator(
      SYSTEMS_PRODUCT_JOB.text, base,
    );
    expect(discriminator.applied).toBe(false);
    expect(classification.mode).toBe("builder_systems");
    expect(discriminator.structuralScore).toBeGreaterThan(discriminator.executionScore);
  });

  it("does NOT reclassify DevOps Engineer (legitimate builder)", () => {
    const base = builderClassification(14);
    const { classification, discriminator } = applyExecutionDiscriminator(
      DEVOPS_ENGINEER_JOB.text, base,
    );
    expect(discriminator.applied).toBe(false);
    expect(classification.mode).toBe("builder_systems");
  });

  it("does NOT reclassify Full-Stack Engineer (legitimate builder)", () => {
    const base = builderClassification(10);
    const { classification, discriminator } = applyExecutionDiscriminator(
      FULLSTACK_ENGINEER_JOB.text, base,
    );
    expect(discriminator.applied).toBe(false);
    expect(classification.mode).toBe("builder_systems");
  });

  it("structural signals detect unambiguous tech-creation vocabulary", () => {
    const techText = "Design CI/CD pipelines, deploy microservices on Kubernetes, " +
      "architect backend systems, write production code in TypeScript, agile scrum sprints";
    const base = builderClassification(10);
    const { discriminator } = applyExecutionDiscriminator(techText, base);
    expect(discriminator.structuralScore).toBeGreaterThanOrEqual(8);
    expect(discriminator.executionScore).toBe(0);
  });

  it("execution signals detect management/coordination vocabulary", () => {
    const mgmtText = "Project management for construction programs, " +
      "budget tracking, stakeholder communication, vendor management, " +
      "subcontractor coordination, site supervision, preconstruction planning, " +
      "regulatory compliance and safety management";
    const base = builderClassification(9);
    const { discriminator } = applyExecutionDiscriminator(mgmtText, base);
    expect(discriminator.executionScore).toBeGreaterThanOrEqual(12);
    expect(discriminator.structuralScore).toBe(0);
  });

  it("preserves confidence level after reclassification", () => {
    const base = builderClassification(9);
    const { classification } = applyExecutionDiscriminator(
      CONSTRUCTION_PM_JOB.text, base,
    );
    expect(classification.confidence).toBe("high");
  });

  it("updates topMatches to execution triggers after reclassification", () => {
    const base = builderClassification(9);
    const { classification, discriminator } = applyExecutionDiscriminator(
      CONSTRUCTION_PM_JOB.text, base,
    );
    expect(classification.topMatches).toEqual(discriminator.executionTriggers);
    expect(classification.topMatches.length).toBeGreaterThan(0);
  });
});

// ─── Discriminator-Integrated Job Classification ────────────

describe("classifyJobWorkMode — discriminator traps", () => {
  it("Construction PM classifies as operational_execution (not builder_systems)", () => {
    const result = classifyJobWorkMode(CONSTRUCTION_PM_JOB.text);
    expect(result.mode).toBe("operational_execution");
  });

  it("Program Coordinator classifies as operational_execution (not builder_systems)", () => {
    const result = classifyJobWorkMode(PROGRAM_COORDINATOR_JOB.text);
    expect(result.mode).toBe("operational_execution");
  });

  it("Systems/Product Manager still classifies as builder_systems after discriminator", () => {
    const result = classifyJobWorkMode(SYSTEMS_PRODUCT_JOB.text);
    expect(result.mode).toBe("builder_systems");
    expect(result.confidence).toBe("high");
  });

  it("DevOps Engineer still classifies as builder_systems after discriminator", () => {
    const result = classifyJobWorkMode(DEVOPS_ENGINEER_JOB.text);
    expect(result.mode).toBe("builder_systems");
    expect(result.confidence).toBe("high");
  });

  it("Full-Stack Engineer still classifies as builder_systems after discriminator", () => {
    const result = classifyJobWorkMode(FULLSTACK_ENGINEER_JOB.text);
    expect(result.mode).toBe("builder_systems");
  });
});

// ─── Discriminator E2E: evaluateWorkMode scenarios ──────────

describe("evaluateWorkMode — discriminator integration", () => {
  it("Chris (Builder) vs Construction PM → adjacent, score in 4–6 range", () => {
    const result = evaluateWorkMode(
      6.5, CHRIS.resumeText, CHRIS.promptAnswers, CONSTRUCTION_PM_JOB.text,
    );
    // Construction PM reclassified to operational_execution via discriminator
    expect(result.jobMode.mode).toBe("operational_execution");
    // Builder user vs ops job = adjacent
    expect(result.compatibility).toBe("adjacent");
    expect(result.workModeAdjustment).toBe(WORK_MODE_ADJUSTMENTS.adjacent);
    expect(result.postScore).toBeGreaterThanOrEqual(4.0);
    expect(result.postScore).toBeLessThanOrEqual(6.0);
  });

  it("Chris (Builder) vs Program Coordinator → adjacent, penalized", () => {
    const result = evaluateWorkMode(
      6.0, CHRIS.resumeText, CHRIS.promptAnswers, PROGRAM_COORDINATOR_JOB.text,
    );
    expect(result.jobMode.mode).toBe("operational_execution");
    expect(result.compatibility).toBe("adjacent");
    expect(result.postScore).toBeLessThan(6.0);
  });

  it("Fabio (Analytical) vs Construction PM → conflicting, strongly penalized", () => {
    const result = evaluateWorkMode(
      7.0, FABIO.resumeText, FABIO.promptAnswers, CONSTRUCTION_PM_JOB.text,
    );
    // analytical vs operational_execution = conflicting
    expect(result.jobMode.mode).toBe("operational_execution");
    expect(result.compatibility).toBe("conflicting");
    expect(result.workModeAdjustment).toBe(WORK_MODE_ADJUSTMENTS.conflicting);
    expect(result.postScore).toBeLessThanOrEqual(5.0);
  });

  it("Priya (Ops) vs Construction PM → compatible, no drag", () => {
    const result = evaluateWorkMode(
      7.0, PRIYA.resumeText, PRIYA.promptAnswers, CONSTRUCTION_PM_JOB.text,
    );
    // ops vs ops = compatible
    expect(result.jobMode.mode).toBe("operational_execution");
    expect(result.compatibility).toBe("compatible");
    expect(result.workModeAdjustment).toBe(0);
    expect(result.postScore).toBe(7.0);
  });

  it("Chris (Builder) vs Systems/Product Job still compatible (discriminator safe)", () => {
    // Verify the discriminator does NOT damage legitimate builder→builder classification
    const result = evaluateWorkMode(
      8.5, CHRIS.resumeText, CHRIS.promptAnswers, SYSTEMS_PRODUCT_JOB.text,
    );
    expect(result.jobMode.mode).toBe("builder_systems");
    expect(result.compatibility).toBe("compatible");
    expect(result.workModeAdjustment).toBe(0);
    expect(result.postScore).toBe(8.5);
  });
});
