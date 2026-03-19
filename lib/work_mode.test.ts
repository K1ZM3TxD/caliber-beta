// lib/work_mode.test.ts

import {
  classifyUserWorkMode,
  classifyJobWorkMode,
  getWorkModeCompatibility,
  applyWorkModeCeiling,
  evaluateWorkMode,
  _testing,
  type WorkMode,
  type WorkModeClassification,
} from "./work_mode";

const { classifyText, COMPATIBILITY_MAP, CONFLICTING_CEILING, ADJACENT_CEILING } = _testing;

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

// ─── Score Ceiling Tests ────────────────────────────────────

describe("applyWorkModeCeiling", () => {
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

  it("applies ceiling for conflicting modes when score exceeds limit", () => {
    const result = applyWorkModeCeiling(7.8, "conflicting", highUser, highJob);
    expect(result.ceilingApplied).toBe(true);
    expect(result.score).toBe(CONFLICTING_CEILING);
    expect(result.ceilingReason).toContain("Work mode conflict");
  });

  it("does not apply ceiling when score is below threshold", () => {
    const result = applyWorkModeCeiling(5.5, "conflicting", highUser, highJob);
    expect(result.ceilingApplied).toBe(false);
    expect(result.score).toBe(5.5);
  });

  it("does not apply ceiling for compatible modes", () => {
    const result = applyWorkModeCeiling(8.5, "compatible", highUser, highJob);
    expect(result.ceilingApplied).toBe(false);
    expect(result.score).toBe(8.5);
  });

  it("does not apply ceiling for adjacent modes below soft cap", () => {
    const result = applyWorkModeCeiling(8.0, "adjacent", highUser, highJob);
    expect(result.ceilingApplied).toBe(false);
    expect(result.score).toBe(8.0);
  });

  it("applies soft ceiling for adjacent modes above 8.5", () => {
    const result = applyWorkModeCeiling(9.2, "adjacent", highUser, highJob);
    expect(result.ceilingApplied).toBe(true);
    expect(result.score).toBe(ADJACENT_CEILING);
    expect(result.ceilingReason).toContain("Adjacent work modes");
  });

  it("does not apply adjacent ceiling when confidence is none", () => {
    const weakUser: WorkModeClassification = { ...highUser, confidence: "none" };
    const result = applyWorkModeCeiling(9.2, "adjacent", weakUser, highJob);
    expect(result.ceilingApplied).toBe(false);
    expect(result.score).toBe(9.2);
  });

  it("does not apply ceiling when user confidence is none", () => {
    const weakUser: WorkModeClassification = { ...highUser, confidence: "none" };
    const result = applyWorkModeCeiling(7.8, "conflicting", weakUser, highJob);
    expect(result.ceilingApplied).toBe(false);
  });

  it("does not apply ceiling when job confidence is none", () => {
    const weakJob: WorkModeClassification = { ...highJob, confidence: "none" };
    const result = applyWorkModeCeiling(7.8, "conflicting", highUser, weakJob);
    expect(result.ceilingApplied).toBe(false);
  });
});

// ─── End-to-End Regression Tests ────────────────────────────

describe("evaluateWorkMode — regression scenarios", () => {

  it("Chris (Builder) vs inside-sales job → NOT a strong match (ceiling applied)", () => {
    // Simulating a raw score of 7.3 that inflated from keyword overlap
    const result = evaluateWorkMode(7.3, CHRIS_RESUME, CHRIS_PROMPTS, INSIDE_SALES_JOB);
    expect(result.userMode.mode).toBe("builder_systems");
    expect(result.jobMode.mode).toBe("sales_execution");
    expect(result.compatibility).toBe("conflicting");
    expect(result.ceilingApplied).toBe(true);
    expect(result.postScore).toBeLessThanOrEqual(CONFLICTING_CEILING);
    expect(result.postScore).toBeLessThan(7.0);
  });

  it("Chris (Builder) vs systems/product role → remains high (no ceiling)", () => {
    const result = evaluateWorkMode(8.2, CHRIS_RESUME, CHRIS_PROMPTS, SYSTEMS_PRODUCT_JOB);
    expect(result.userMode.mode).toBe("builder_systems");
    expect(result.jobMode.mode).toBe("builder_systems");
    expect(result.compatibility).toBe("compatible");
    expect(result.ceilingApplied).toBe(false);
    expect(result.postScore).toBe(8.2);
  });

  it("Fabio (Analytical) vs sales job → suppressed (ceiling applied)", () => {
    const result = evaluateWorkMode(7.0, FABIO_RESUME, FABIO_PROMPTS, INSIDE_SALES_JOB);
    expect(result.userMode.mode).toBe("analytical_investigative");
    expect(result.jobMode.mode).toBe("sales_execution");
    expect(result.compatibility).toBe("conflicting");
    expect(result.ceilingApplied).toBe(true);
    expect(result.postScore).toBeLessThan(7.0);
  });

  it("Fabio (Analytical) vs security analyst job → remains high", () => {
    const result = evaluateWorkMode(8.5, FABIO_RESUME, FABIO_PROMPTS, SECURITY_ANALYST_JOB);
    expect(result.userMode.mode).toBe("analytical_investigative");
    expect(result.jobMode.mode).toBe("analytical_investigative");
    expect(result.compatibility).toBe("compatible");
    expect(result.ceilingApplied).toBe(false);
    expect(result.postScore).toBe(8.5);
  });

  it("Jen vs adjacent ops role → may remain viable (not conflicting)", () => {
    const result = evaluateWorkMode(7.2, JEN_RESUME, JEN_PROMPTS, OPS_COORDINATOR_JOB);
    // Jen's mode could be operational_execution or sales_execution
    // Either way, ops job should NOT be conflicting for her
    expect(result.compatibility).not.toBe("conflicting");
    expect(result.ceilingApplied).toBe(false);
    expect(result.postScore).toBe(7.2);
  });

  it("Chris (Builder) vs sales-ops hybrid → conflicting ceiling prevents inflation", () => {
    const result = evaluateWorkMode(7.5, CHRIS_RESUME, CHRIS_PROMPTS, SALES_OPS_HYBRID_JOB);
    expect(result.userMode.mode).toBe("builder_systems");
    expect(result.jobMode.mode).toBe("sales_execution");
    expect(result.compatibility).toBe("conflicting");
    expect(result.ceilingApplied).toBe(true);
    expect(result.postScore).toBeLessThanOrEqual(CONFLICTING_CEILING);
  });

  it("low raw score is not further compressed by ceiling", () => {
    const result = evaluateWorkMode(4.2, CHRIS_RESUME, CHRIS_PROMPTS, INSIDE_SALES_JOB);
    expect(result.compatibility).toBe("conflicting");
    expect(result.ceilingApplied).toBe(false);
    expect(result.postScore).toBe(4.2);
  });
});

// ─── Debug Output Structure ─────────────────────────────────

describe("evaluateWorkMode — debug output", () => {
  it("returns complete debug structure", () => {
    const result = evaluateWorkMode(7.0, CHRIS_RESUME, CHRIS_PROMPTS, INSIDE_SALES_JOB);
    expect(result).toHaveProperty("userMode");
    expect(result).toHaveProperty("jobMode");
    expect(result).toHaveProperty("compatibility");
    expect(result).toHaveProperty("preScore");
    expect(result).toHaveProperty("postScore");
    expect(result).toHaveProperty("ceilingApplied");
    expect(result).toHaveProperty("ceilingReason");
    expect(result.userMode).toHaveProperty("mode");
    expect(result.userMode).toHaveProperty("scores");
    expect(result.userMode).toHaveProperty("topMatches");
    expect(result.userMode).toHaveProperty("confidence");
    expect(result.jobMode).toHaveProperty("mode");
    expect(result.jobMode).toHaveProperty("scores");
    expect(result.ceilingReason).toContain("Work mode conflict");
  });
});
