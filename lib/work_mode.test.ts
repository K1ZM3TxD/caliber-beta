// lib/work_mode.test.ts

import {
  classifyUserWorkMode,
  classifyJobWorkMode,
  getWorkModeCompatibility,
  applyWorkModeCeiling,
  applyWorkModeAdjustment,
  detectExecutionIntensity,
  evaluateWorkMode,
  classifyRoleType,
  applyChipSuppression,
  getRoleTypePenalty,
  _testing,
  type WorkMode,
  type WorkModeClassification,
  type RoleType,
  type ChipSuppressionResult,
  type WorkPreferencesInput,
} from "./work_mode";

const { classifyText, COMPATIBILITY_MAP, WORK_MODE_ADJUSTMENTS, EXECUTION_INTENSITY_TRIGGERS, INTENSITY_ADJUSTMENTS, CHIP_SUPPRESSION_CAPS } = _testing;

// ─── Fixture: Chris (Builder / Systems) ─────────────────────

const CHRIS_RESUME =
  "Product Development Manager | 7 years experience in SaaS and B2B\n" +
  "Led product development from market research through launch for enterprise software.\n" +
  "Built systems for evaluating market gaps and customer needs. Created SOPs for product\n" +
  "development workflows. Designed and maintained pitch decks and proposals for executive\n" +
  "stakeholders. Conducted feasibility studies for new product initiatives. Automated\n" +
  "internal workflows and reporting systems. Managed cross-functional product development\n" +
  "teams. Drove go-to-market strategy and customer discovery processes.";

const CHRIS_PROMPTS: Record<number, string> = {
  1: "design, creating systems, making sop's. building web apps/tools Making pitch decks, call scripts, data miners and customer proposal slide presentations. Creating automated workflows and sharing great tools with coworkers. Marketing and strategy sessions.",
  2: "endless sales cycles, quota driven incentive, jumping from one task to another without real depth or clarity, overall chaos in the company being short staffed and small.",
  3: "design, creating systems, making sop's. Making pitch decks, call scripts, data miners and customer proposal slide presentations. Creating automated workflows and sharing great tools with coworkers. Marketing and strategy sessions.",
  4: "problem solving, product development, customer needs and finding gaps in the market.",
  5: "songwriting, building tools, making graphics, interior design",
};

// ─── Fixture: Fabio (Analytical / Investigative) ────────────

const FABIO_RESUME =
  "Fabio Bellini Keizer, Oregon Professional Summary As an OSOC Security Analyst and dedicated cybersecurity professional, " +
  "I specialize in penetration testing, vulnerability assessment, and security risk mitigation. " +
  "I bring a strong focus on protecting organizational assets through the design and implementation of comprehensive security measures. " +
  "With hands-on experience in tools such as Kali Linux, Active Directory, and Python, I'm proficient in red team operations and network security auditing. " +
  "My background includes serving as an assistant instructor, mentoring students through practical cybersecurity training programs.";

const FABIO_PROMPTS: Record<number, string> = {
  1: "The part that felt most like me was investigating problems, connecting technical details, and turning them into something clear and actionable.",
  2: "What drained me fastest was repetitive work that required a lot of manual effort but did not involve much analysis, problem-solving, or improvement.",
  3: "People often come to me to help make sense of technical situations, especially when something is unclear, urgent, or needs to be explained well.",
  4: "I find complex challenges exciting when they require investigation, critical thinking, and a structured approach.",
  5: "I am best at work that sits at the intersection of analysis, problem-solving, and communication.",
};

// ─── Fixture: Jen (Creative Ops / Enablement) ───────────────

const JEN_RESUME =
  "Summary Self-motivated go-getter with over 10 years of experience in sales. Known for exceptional customer service " +
  "and executing sales strategies that produce results. Experience Gracer-West Holdings Salem OR Estate Manager " +
  "Maintained and managed a large household and complex of upscale properties for a private client. " +
  "Role included accounting managing staff coordinating events overseeing new projects and setting up a successful rental property. " +
  "SOYOUU LLC Keizer OR Owner Operated a successful college textbook business for 10 years. " +
  "Skills Customer service Communication skills Computer literacy Leadership Outside Sales Analytical Thinking";

const JEN_PROMPTS: Record<number, string> = {
  1: "I think the interaction with people felt the most like me. I enjoyed managing a team and achieving objectives together.",
  2: "The part that drained me the fastest was dealing with excess material waste.",
  3: "My job title is pretty flexible so that could be a lot of things. To be specific I would say ad hoc tasks that aren't part of my daily routine.",
  4: "A challenge that feels exciting is learning a new tool or taking on unfamiliar tasks.",
  5: "I'm best at relationship and team building, taking on new projects, learning new tools, entrepreneurship.",
};

// ─── Job Text Fixtures ──────────────────────────────────────

const INSIDE_SALES_JOB =
  "Inside Sales Representative\n" +
  "We are looking for a driven Inside Sales Representative to join our growing team.\n" +
  "Responsibilities:\n" +
  "- Make 50+ outbound calls per day to prospective clients\n" +
  "- Manage and grow a pipeline of qualified prospects\n" +
  "- Meet or exceed monthly sales quota and revenue targets\n" +
  "- Conduct product demos and close deals\n" +
  "- Use Salesforce CRM to track pipeline and forecast revenue\n" +
  "- Collaborate with the sales team to develop territory strategies\n" +
  "- Handle objection handling and negotiate pricing\n" +
  "Requirements:\n" +
  "- 2+ years inside sales or BDR/SDR experience\n" +
  "- Track record of meeting or exceeding quota\n" +
  "- Experience with cold calling and outbound prospecting\n" +
  "- Strong communication and closing skills\n" +
  "- Commission-based compensation structure";

const SYSTEMS_PRODUCT_JOB =
  "Product Development Manager\n" +
  "We are seeking a Product Development Manager to lead our product engineering and systems architecture efforts.\n" +
  "Responsibilities:\n" +
  "- Lead product development from concept through launch\n" +
  "- Design and implement scalable systems and infrastructure\n" +
  "- Create SOPs and workflow automation for development teams\n" +
  "- Build internal tools and integrate third-party platforms\n" +
  "- Define product roadmap and manage sprint planning\n" +
  "- Work with cross-functional stakeholders on technical architecture\n" +
  "- Deploy and monitor production systems\n" +
  "Requirements:\n" +
  "- 5+ years product development or engineering experience\n" +
  "- Experience with agile/scrum methodology\n" +
  "- Strong systems design and integration skills\n" +
  "- Track record of building and shipping software products";

const OPS_COORDINATOR_JOB =
  "Operations Coordinator\n" +
  "We are looking for an Operations Coordinator to support our growing team.\n" +
  "Responsibilities:\n" +
  "- Coordinate daily operations including scheduling and logistics\n" +
  "- Process orders and manage inventory tracking in our ERP system\n" +
  "- Handle administrative tasks including filing and data entry\n" +
  "- Support onboarding and training coordination for new hires\n" +
  "- Manage procurement and invoicing workflows\n" +
  "- Provide customer support and resolve escalated tickets\n" +
  "Requirements:\n" +
  "- 2+ years operations or administrative experience\n" +
  "- Experience with ERP systems and order processing\n" +
  "- Strong organizational and scheduling skills";

const SECURITY_ANALYST_JOB =
  "Cybersecurity Analyst\n" +
  "We are looking for a Cybersecurity Analyst to join our security operations team.\n" +
  "Responsibilities:\n" +
  "- Conduct vulnerability assessments and penetration testing\n" +
  "- Analyze security threats and investigate incidents\n" +
  "- Perform risk analysis and develop mitigation strategies\n" +
  "- Monitor SOC dashboards and respond to alerts\n" +
  "- Author detailed security audit reports\n" +
  "- Research emerging threats and attack techniques\n" +
  "Requirements:\n" +
  "- Security+ or equivalent certification\n" +
  "- Experience with red team operations\n" +
  "- Strong analytical and investigative skills";

// Tricky job: Sales-flavored role with operational/systems vocabulary that
// could inflate scores for Builder/Systems profiles.
const SALES_OPS_HYBRID_JOB =
  "Sales Operations Specialist\n" +
  "Join our team to manage sales operations, CRM systems, and coordinate cross-functional workflows.\n" +
  "Responsibilities:\n" +
  "- Manage Salesforce CRM configuration and workflow automation\n" +
  "- Build reports and dashboards for the sales team\n" +
  "- Meet quarterly quota for outbound prospecting and pipeline generation\n" +
  "- Cold call leads and close deals alongside the BDR team\n" +
  "- Track territory coverage and revenue targets\n" +
  "- Coordinate with multiple teams on process improvement\n" +
  "- Handle administrative coordination and scheduling\n" +
  "Requirements:\n" +
  "- 3+ years sales operations or inside sales experience\n" +
  "- Commission-based compensation\n" +
  "- Experience with quota-carrying sales roles";

// Grind-heavy Property Max style job: house buying specialist with
// door-to-door, high-volume calls, commission-only, rejection-heavy.
const PROPERTY_MAX_GRIND_JOB =
  "House Buying Specialist — Property Max\n" +
  "We're looking for motivated individuals to join our team as House Buying Specialists.\n" +
  "This is a fast-paced, commission-based role focused on acquiring residential properties.\n" +
  "Responsibilities:\n" +
  "- Make 60+ outbound calls per day to distressed property owners\n" +
  "- Door knocking in assigned neighborhoods to generate leads\n" +
  "- Field canvassing and in-person sales presentations to homeowners\n" +
  "- Cold calling from skip-traced lists using auto-dialer\n" +
  "- Meet weekly quota for signed purchase agreements\n" +
  "- Handle objection handling and overcome seller resistance\n" +
  "- Must have thick skin — high rejection rate is normal\n" +
  "- Quota-carrying role with uncapped commission\n" +
  "- Daily activity targets tracked via CRM metrics\n" +
  "Requirements:\n" +
  "- Resilience in rejection-heavy environments\n" +
  "- Phone-based and in-person sales experience preferred\n" +
  "- Commission-only compensation (OTE $80k–$120k)\n" +
  "- Valid driver's license for door-to-door territory coverage\n" +
  "- High-volume, metrics-driven work ethic";

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
    const result = classifyJobWorkMode(INSIDE_SALES_JOB);
    expect(result.mode).toBe("sales_execution");
    expect(result.confidence).toBe("high");
  });

  it("classifies systems/product job as builder_systems", () => {
    const result = classifyJobWorkMode(SYSTEMS_PRODUCT_JOB);
    expect(result.mode).toBe("builder_systems");
    expect(result.confidence).toBe("high");
  });

  it("classifies ops coordinator job as operational_execution", () => {
    const result = classifyJobWorkMode(OPS_COORDINATOR_JOB);
    expect(result.mode).toBe("operational_execution");
  });

  it("classifies security analyst job as analytical_investigative", () => {
    const result = classifyJobWorkMode(SECURITY_ANALYST_JOB);
    expect(result.mode).toBe("analytical_investigative");
    expect(result.confidence).toBe("high");
  });

  it("classifies sales-ops hybrid as sales_execution (dominant mode wins)", () => {
    const result = classifyJobWorkMode(SALES_OPS_HYBRID_JOB);
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
    const result = detectExecutionIntensity(SYSTEMS_PRODUCT_JOB);
    expect(result.score).toBe(0);
    expect(result.adjustment).toBe(0);
    expect(result.triggers).toHaveLength(0);
  });

  it("detects mild intensity in a basic inside sales job", () => {
    const result = detectExecutionIntensity(INSIDE_SALES_JOB);
    expect(result.score).toBeGreaterThanOrEqual(3);
    expect(result.adjustment).toBeLessThan(0);
    expect(result.triggers.length).toBeGreaterThan(0);
  });

  it("detects heavy intensity in a grind-heavy sales job", () => {
    const result = detectExecutionIntensity(PROPERTY_MAX_GRIND_JOB);
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
    const result = detectExecutionIntensity(INSIDE_SALES_JOB);
    expect(result.reason).toBeTruthy();
    expect(result.reason).toContain("Execution intensity");
  });
});

// ─── End-to-End Regression Tests ────────────────────────────

describe("evaluateWorkMode — regression scenarios", () => {

  it("Chris (Builder) vs inside-sales job → dragged below 7 (conflicting + intensity)", () => {
    // Simulating a raw score of 7.3 that inflated from keyword overlap
    const result = evaluateWorkMode(7.3, CHRIS_RESUME, CHRIS_PROMPTS, INSIDE_SALES_JOB);
    expect(result.userMode.mode).toBe("builder_systems");
    expect(result.jobMode.mode).toBe("sales_execution");
    expect(result.compatibility).toBe("conflicting");
    expect(result.workModeAdjustment).toBeLessThan(0);
    expect(result.postScore).toBeLessThan(7.0);
  });

  it("Chris (Builder) vs systems/product role → remains high (no adjustment)", () => {
    const result = evaluateWorkMode(8.2, CHRIS_RESUME, CHRIS_PROMPTS, SYSTEMS_PRODUCT_JOB);
    expect(result.userMode.mode).toBe("builder_systems");
    expect(result.jobMode.mode).toBe("builder_systems");
    expect(result.compatibility).toBe("compatible");
    expect(result.workModeAdjustment).toBe(0);
    expect(result.executionIntensityAdjustment).toBe(0);
    expect(result.postScore).toBe(8.2);
  });

  it("Fabio (Analytical) vs sales job → suppressed below 7", () => {
    const result = evaluateWorkMode(7.0, FABIO_RESUME, FABIO_PROMPTS, INSIDE_SALES_JOB);
    expect(result.userMode.mode).toBe("analytical_investigative");
    expect(result.jobMode.mode).toBe("sales_execution");
    expect(result.compatibility).toBe("conflicting");
    expect(result.workModeAdjustment).toBeLessThan(0);
    expect(result.postScore).toBeLessThan(7.0);
  });

  it("Fabio (Analytical) vs security analyst job → remains high", () => {
    const result = evaluateWorkMode(8.5, FABIO_RESUME, FABIO_PROMPTS, SECURITY_ANALYST_JOB);
    expect(result.userMode.mode).toBe("analytical_investigative");
    expect(result.jobMode.mode).toBe("analytical_investigative");
    expect(result.compatibility).toBe("compatible");
    expect(result.workModeAdjustment).toBe(0);
    expect(result.postScore).toBe(8.5);
  });

  it("Jen vs adjacent ops role → mild drag only, remains viable", () => {
    const result = evaluateWorkMode(7.2, JEN_RESUME, JEN_PROMPTS, OPS_COORDINATOR_JOB);
    // Jen's mode could be operational_execution or sales_execution
    // Either way, ops job should NOT be conflicting for her
    expect(result.compatibility).not.toBe("conflicting");
    // Adjacent gets mild penalty; compatible gets none; either way score stays viable
    expect(result.postScore).toBeGreaterThanOrEqual(6.0);
    expect(result.postScore).toBeLessThanOrEqual(7.5);
  });

  it("Chris (Builder) vs sales-ops hybrid → conflicting adjustment prevents inflation", () => {
    const result = evaluateWorkMode(7.5, CHRIS_RESUME, CHRIS_PROMPTS, SALES_OPS_HYBRID_JOB);
    expect(result.userMode.mode).toBe("builder_systems");
    expect(result.jobMode.mode).toBe("sales_execution");
    expect(result.compatibility).toBe("conflicting");
    expect(result.workModeAdjustment).toBeLessThan(0);
    expect(result.postScore).toBeLessThan(7.0);
  });

  it("low raw score receives adjustment and stays low", () => {
    const result = evaluateWorkMode(4.2, CHRIS_RESUME, CHRIS_PROMPTS, INSIDE_SALES_JOB);
    expect(result.compatibility).toBe("conflicting");
    expect(result.postScore).toBeLessThan(4.2);
    // Score never goes below 0
    expect(result.postScore).toBeGreaterThanOrEqual(0);
  });
});

// ─── Target Band Validation Tests ───────────────────────────

describe("evaluateWorkMode — target band behavior", () => {
  it("same-mode strong fit: score stays in 7–9 range", () => {
    const result = evaluateWorkMode(8.5, CHRIS_RESUME, CHRIS_PROMPTS, SYSTEMS_PRODUCT_JOB);
    expect(result.postScore).toBeGreaterThanOrEqual(7);
    expect(result.postScore).toBeLessThanOrEqual(9.5);
  });

  it("adjacent fit: score settles in 6–7.5 range", () => {
    // Builder vs Ops = adjacent
    const result = evaluateWorkMode(7.5, CHRIS_RESUME, CHRIS_PROMPTS, OPS_COORDINATOR_JOB);
    expect(result.compatibility).toBe("adjacent");
    expect(result.postScore).toBeGreaterThanOrEqual(6.0);
    expect(result.postScore).toBeLessThanOrEqual(7.5);
  });

  it("conflicting but light role: score drops significantly with role-type penalty", () => {
    // Builder vs sales — work mode conflicting (-2.5) + role-type SYSTEM_SELLER penalty + EI
    // This is the desired behavior: sales jobs should score very low for builder profiles
    const result = evaluateWorkMode(6.5, CHRIS_RESUME, CHRIS_PROMPTS, INSIDE_SALES_JOB);
    expect(result.compatibility).toBe("conflicting");
    expect(result.postScore).toBeLessThan(6.5);
    expect(result.postScore).toBeLessThanOrEqual(3.5);
    expect(result.postScore).toBeGreaterThanOrEqual(0);
    expect(result.roleType).toBe("SYSTEM_SELLER");
    expect(result.roleTypePenalty).toBeLessThan(0);
  });

  it("conflicting + high-intensity grind role: score lands in 'actively wrong' zone (3–5)", () => {
    // Property Max style grind job against a Builder profile
    const result = evaluateWorkMode(7.0, CHRIS_RESUME, CHRIS_PROMPTS, PROPERTY_MAX_GRIND_JOB);
    expect(result.compatibility).toBe("conflicting");
    expect(result.executionIntensityAdjustment).toBeLessThan(0);
    expect(result.postScore).toBeLessThanOrEqual(5.0);
    expect(result.postScore).toBeGreaterThanOrEqual(0);
  });

  it("Property Max grind job pushed into avoid zone for Builder profile", () => {
    // Even with raw 7.3 (keyword overlap), total adjustments should crush this
    const result = evaluateWorkMode(7.3, CHRIS_RESUME, CHRIS_PROMPTS, PROPERTY_MAX_GRIND_JOB);
    expect(result.workModeAdjustment).toBeLessThan(-1);
    expect(result.executionIntensityAdjustment).toBeLessThan(-1);
    expect(result.postScore).toBeLessThanOrEqual(5.0);
  });

  it("Property Max grind job also bad for Analytical profile", () => {
    const result = evaluateWorkMode(6.5, FABIO_RESUME, FABIO_PROMPTS, PROPERTY_MAX_GRIND_JOB);
    expect(result.compatibility).toBe("conflicting");
    expect(result.postScore).toBeLessThanOrEqual(5.0);
  });
});

// ─── Debug Output Structure ─────────────────────────────────

describe("evaluateWorkMode — debug output", () => {
  it("returns complete debug structure with adjustment fields", () => {
    const result = evaluateWorkMode(7.0, CHRIS_RESUME, CHRIS_PROMPTS, INSIDE_SALES_JOB);
    expect(result).toHaveProperty("userMode");
    expect(result).toHaveProperty("jobMode");
    expect(result).toHaveProperty("compatibility");
    expect(result).toHaveProperty("preScore");
    expect(result).toHaveProperty("postScore");
    expect(result).toHaveProperty("workModeAdjustment");
    expect(result).toHaveProperty("executionIntensityAdjustment");
    expect(result).toHaveProperty("executionIntensity");
    expect(result).toHaveProperty("roleType");
    expect(result).toHaveProperty("chipSuppression");
    expect(result).toHaveProperty("chipSuppressionAdjustment");
    expect(result).toHaveProperty("roleTypePenalty");
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
    expect(result.chipSuppression).toHaveProperty("suppressed");
    expect(result.chipSuppression).toHaveProperty("adjustment");
    expect(result.adjustmentReason).toBeTruthy();
  });
});

// ─── Role-Type Classification Tests ─────────────────────────

describe("classifyRoleType", () => {
  it("classifies inside sales job as SYSTEM_SELLER", () => {
    expect(classifyRoleType(INSIDE_SALES_JOB)).toBe("SYSTEM_SELLER");
  });

  it("classifies systems/product job as SYSTEM_BUILDER", () => {
    expect(classifyRoleType(SYSTEMS_PRODUCT_JOB)).toBe("SYSTEM_BUILDER");
  });

  it("classifies ops coordinator job as SYSTEM_OPERATOR", () => {
    expect(classifyRoleType(OPS_COORDINATOR_JOB)).toBe("SYSTEM_OPERATOR");
  });

  it("classifies sales-ops hybrid as SYSTEM_SELLER", () => {
    expect(classifyRoleType(SALES_OPS_HYBRID_JOB)).toBe("SYSTEM_SELLER");
  });

  it("classifies Property Max grind job as SYSTEM_SELLER", () => {
    expect(classifyRoleType(PROPERTY_MAX_GRIND_JOB)).toBe("SYSTEM_SELLER");
  });

  it("does NOT classify generic strategy/analysis/framework job as SYSTEM_BUILDER", () => {
    const genericJob =
      "Strategy Analyst\n" +
      "We are seeking a Strategy Analyst to drive cross-functional analysis and develop frameworks.\n" +
      "Responsibilities:\n" +
      "- Conduct market analysis and competitive research\n" +
      "- Develop strategic frameworks for business planning\n" +
      "- Present findings to executive leadership\n" +
      "- Collaborate with strategy and operations teams\n" +
      "Requirements:\n" +
      "- 3+ years in strategy, consulting, or analysis roles\n" +
      "- Strong analytical and framework development skills";
    const roleType = classifyRoleType(genericJob);
    expect(roleType).not.toBe("SYSTEM_BUILDER");
  });

  it("returns null for ambiguous short job descriptions", () => {
    const shortJob = "Part-time role helping with various office tasks.";
    expect(classifyRoleType(shortJob)).toBeNull();
  });
});

// ─── Chip Suppression Tests ─────────────────────────────────

describe("applyChipSuppression", () => {
  const salesJobMode: WorkModeClassification = {
    mode: "sales_execution",
    scores: { builder_systems: 0, sales_execution: 12, operational_execution: 0, analytical_investigative: 0, creative_ideation: 0 },
    topMatches: ["quota", "cold calling"],
    confidence: "high",
  };
  const opsJobMode: WorkModeClassification = {
    mode: "operational_execution",
    scores: { builder_systems: 0, sales_execution: 0, operational_execution: 8, analytical_investigative: 0, creative_ideation: 0 },
    topMatches: ["coordination", "scheduling"],
    confidence: "high",
  };
  const builderJobMode: WorkModeClassification = {
    mode: "builder_systems",
    scores: { builder_systems: 10, sales_execution: 0, operational_execution: 0, analytical_investigative: 0, creative_ideation: 0 },
    topMatches: ["architecture", "automation"],
    confidence: "high",
  };

  it("suppresses sales job to <= 3.5 when sales is avoided", () => {
    const prefs: WorkPreferencesInput = { avoidedModes: ["sales_execution"] };
    const result = applyChipSuppression(7.5, salesJobMode, "SYSTEM_SELLER", prefs);
    expect(result.suppressed).toBe(true);
    expect(result.adjustment).toBeLessThan(0);
    expect(7.5 + result.adjustment).toBeLessThanOrEqual(3.5);
  });

  it("suppresses ops job to <= 4.0 when ops is avoided", () => {
    const prefs: WorkPreferencesInput = { avoidedModes: ["operational_execution"] };
    const result = applyChipSuppression(7.0, opsJobMode, "SYSTEM_OPERATOR", prefs);
    expect(result.suppressed).toBe(true);
    expect(7.0 + result.adjustment).toBeLessThanOrEqual(4.0);
  });

  it("does not suppress when no avoidedModes set", () => {
    const prefs: WorkPreferencesInput = { primaryMode: "builder_systems" };
    const result = applyChipSuppression(7.5, salesJobMode, "SYSTEM_SELLER", prefs);
    expect(result.suppressed).toBe(false);
    expect(result.adjustment).toBe(0);
  });

  it("does not suppress when avoidedModes is empty", () => {
    const prefs: WorkPreferencesInput = { avoidedModes: [] };
    const result = applyChipSuppression(7.5, salesJobMode, "SYSTEM_SELLER", prefs);
    expect(result.suppressed).toBe(false);
  });

  it("does not suppress when workPreferences is null", () => {
    const result = applyChipSuppression(7.5, salesJobMode, "SYSTEM_SELLER", null);
    expect(result.suppressed).toBe(false);
  });

  it("does not suppress when job mode does not match avoided mode", () => {
    const prefs: WorkPreferencesInput = { avoidedModes: ["operational_execution"] };
    const result = applyChipSuppression(7.5, salesJobMode, "SYSTEM_SELLER", prefs);
    expect(result.suppressed).toBe(false);
  });

  it("does not suppress builder job when sales is avoided", () => {
    const prefs: WorkPreferencesInput = { avoidedModes: ["sales_execution"] };
    const result = applyChipSuppression(8.5, builderJobMode, "SYSTEM_BUILDER", prefs);
    expect(result.suppressed).toBe(false);
    expect(result.adjustment).toBe(0);
  });

  it("does not adjust when score is already below cap", () => {
    const prefs: WorkPreferencesInput = { avoidedModes: ["sales_execution"] };
    const result = applyChipSuppression(2.0, salesJobMode, "SYSTEM_SELLER", prefs);
    expect(result.suppressed).toBe(false);
    expect(result.adjustment).toBe(0);
  });
});

// ─── Role-Type Penalty Tests ────────────────────────────────

describe("getRoleTypePenalty", () => {
  it("no penalty for builder user vs SYSTEM_BUILDER job", () => {
    const { penalty } = getRoleTypePenalty("builder_systems", "SYSTEM_BUILDER");
    expect(penalty).toBe(0);
  });

  it("heavy penalty for builder user vs SYSTEM_SELLER job", () => {
    const { penalty } = getRoleTypePenalty("builder_systems", "SYSTEM_SELLER");
    expect(penalty).toBeLessThanOrEqual(-1.5);
  });

  it("mild penalty for builder user vs SYSTEM_OPERATOR job", () => {
    const { penalty } = getRoleTypePenalty("builder_systems", "SYSTEM_OPERATOR");
    expect(penalty).toBeLessThan(0);
    expect(penalty).toBeGreaterThan(-2.0);
  });

  it("no penalty when user mode is null", () => {
    const { penalty } = getRoleTypePenalty(null, "SYSTEM_SELLER");
    expect(penalty).toBe(0);
  });

  it("no penalty when role type is null", () => {
    const { penalty } = getRoleTypePenalty("builder_systems", null);
    expect(penalty).toBe(0);
  });
});

// ─── End-to-End Chip Suppression Regression Tests ───────────

describe("evaluateWorkMode — chip suppression end-to-end", () => {
  it("sales job with 'sales' avoided: score <= 3.5 regardless of raw score", () => {
    const prefs: WorkPreferencesInput = {
      primaryMode: "builder_systems",
      avoidedModes: ["sales_execution"],
    };
    // Even with a high raw score of 8.5 (keyword overlap inflation)
    const result = evaluateWorkMode(8.5, CHRIS_RESUME, CHRIS_PROMPTS, INSIDE_SALES_JOB, prefs);
    expect(result.postScore).toBeLessThanOrEqual(3.5);
    expect(result.chipSuppression.suppressed).toBe(true);
  });

  it("ops job with 'ops' avoided: score <= 4.0", () => {
    const prefs: WorkPreferencesInput = {
      primaryMode: "builder_systems",
      avoidedModes: ["operational_execution"],
    };
    const result = evaluateWorkMode(7.5, CHRIS_RESUME, CHRIS_PROMPTS, OPS_COORDINATOR_JOB, prefs);
    expect(result.postScore).toBeLessThanOrEqual(4.0);
  });

  it("compatible builder job is NOT suppressed even when sales is avoided", () => {
    const prefs: WorkPreferencesInput = {
      primaryMode: "builder_systems",
      avoidedModes: ["sales_execution"],
    };
    const result = evaluateWorkMode(8.5, CHRIS_RESUME, CHRIS_PROMPTS, SYSTEMS_PRODUCT_JOB, prefs);
    expect(result.chipSuppression.suppressed).toBe(false);
    expect(result.postScore).toBe(8.5); // untouched
  });

  it("Chris fixture: Product Designer ~9.9 preserved (no chip suppression)", () => {
    // No avoidedModes set — Chris with a builder/systems job at high raw score
    const result = evaluateWorkMode(9.9, CHRIS_RESUME, CHRIS_PROMPTS, SYSTEMS_PRODUCT_JOB);
    expect(result.postScore).toBe(9.9);
    expect(result.chipSuppression.suppressed).toBe(false);
    expect(result.roleTypePenalty).toBe(0);
    expect(result.workModeAdjustment).toBe(0);
  });

  it("scores are deterministic across repeated runs", () => {
    const prefs: WorkPreferencesInput = {
      primaryMode: "builder_systems",
      avoidedModes: ["sales_execution"],
    };
    const results: number[] = [];
    for (let i = 0; i < 10; i++) {
      const r = evaluateWorkMode(7.3, CHRIS_RESUME, CHRIS_PROMPTS, INSIDE_SALES_JOB, prefs);
      results.push(r.postScore);
    }
    // All 10 runs must produce identical score
    const unique = [...new Set(results)];
    expect(unique).toHaveLength(1);
  });

  it("sales-ops hybrid: suppressed when sales avoided", () => {
    const prefs: WorkPreferencesInput = {
      primaryMode: "builder_systems",
      avoidedModes: ["sales_execution"],
    };
    const result = evaluateWorkMode(7.5, CHRIS_RESUME, CHRIS_PROMPTS, SALES_OPS_HYBRID_JOB, prefs);
    expect(result.postScore).toBeLessThanOrEqual(3.5);
  });

  it("no suppression without workPreferences (backward compat)", () => {
    // Existing behavior preserved when chips not set
    const result = evaluateWorkMode(7.3, CHRIS_RESUME, CHRIS_PROMPTS, INSIDE_SALES_JOB);
    expect(result.chipSuppression.suppressed).toBe(false);
    expect(result.chipSuppressionAdjustment).toBe(0);
    // Role-type penalty still applies passively
    expect(result.roleTypePenalty).toBeLessThan(0);
  });
});
