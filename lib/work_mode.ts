// lib/work_mode.ts
//
// Dominant Work Mode classification + weighted scoring adjustments.
//
// Detects the dominant work mode for both user profiles and jobs,
// computes proportional negative adjustments for mode mismatch,
// and applies an execution-intensity layer for grind-heavy roles.

// ─── Types ──────────────────────────────────────────────────

export type WorkMode =
  | "builder_systems"
  | "sales_execution"
  | "operational_execution"
  | "analytical_investigative"
  | "creative_ideation";

export type WorkModeCompatibility = "compatible" | "adjacent" | "conflicting";

export type WorkModeClassification = {
  mode: WorkMode | null;
  scores: Record<WorkMode, number>;
  topMatches: string[];
  confidence: "high" | "low" | "none";
};

export type ExecutionIntensityResult = {
  score: number;           // 0 = no intensity signals, higher = more grind-heavy
  adjustment: number;      // negative adjustment to apply (0 or negative)
  triggers: string[];      // matched trigger labels
  reason: string | null;   // human-readable explanation
};

export type WorkModeResult = {
  userMode: WorkModeClassification;
  jobMode: WorkModeClassification;
  compatibility: WorkModeCompatibility;
  executionIntensity: ExecutionIntensityResult;
  preScore: number;
  workModeAdjustment: number;
  executionIntensityAdjustment: number;
  postScore: number;
  adjustmentReason: string | null;
};

// ─── Mode Trigger Patterns ──────────────────────────────────
// Each mode has an array of { pattern, weight, label } triggers.
// Weight 2 = strong/specific signal, weight 1 = general signal.

type Trigger = { pattern: RegExp; weight: number; label: string };

const BUILDER_SYSTEMS_TRIGGERS: Trigger[] = [
  { pattern: /\bproduct develop(ment|er|ing)\b/i, weight: 2, label: "product development" },
  { pattern: /\bsystem(s)? design\b/i, weight: 2, label: "system design" },
  { pattern: /\barchitect(ure|ing)?\b/i, weight: 2, label: "architecture" },
  { pattern: /\binfrastructure\b/i, weight: 2, label: "infrastructure" },
  { pattern: /\b(SOP|SOPs|standard operating procedure)\b/i, weight: 2, label: "SOP" },
  { pattern: /\bworkflow(s)?\b/i, weight: 1, label: "workflow" },
  { pattern: /\bautomat(e|ed|ion|ing)\b/i, weight: 2, label: "automation" },
  { pattern: /\bplatform\b/i, weight: 1, label: "platform" },
  { pattern: /\bengineering\b/i, weight: 1, label: "engineering" },
  { pattern: /\bimplement(ation|ing|ed)?\b/i, weight: 1, label: "implementation" },
  { pattern: /\b(deploy|deployment)\b/i, weight: 2, label: "deploy" },
  { pattern: /\bintegrat(e|ion|ing|ed)\b/i, weight: 1, label: "integration" },
  { pattern: /\b(CI\/CD|devops|dev ops)\b/i, weight: 2, label: "CI/CD" },
  { pattern: /\bproduct manage(r|ment)\b/i, weight: 2, label: "product management" },
  { pattern: /\b(roadmap|sprint|agile|scrum)\b/i, weight: 1, label: "agile/roadmap" },
  { pattern: /\b(full[- ]stack|backend|frontend|software)\b/i, weight: 1, label: "software" },
  { pattern: /\b(prototype|MVP|proof of concept)\b/i, weight: 2, label: "prototype/MVP" },
  { pattern: /\bbuild(ing|t|s)? (tools|systems|apps|applications|software|platform)\b/i, weight: 2, label: "building tools/systems" },
  { pattern: /\b(technical lead|tech lead)\b/i, weight: 2, label: "tech lead" },
  { pattern: /\bprocess improvement\b/i, weight: 1, label: "process improvement" },
];

const SALES_EXECUTION_TRIGGERS: Trigger[] = [
  // Transactional / quota-driven sales
  { pattern: /\bquota\b/i, weight: 2, label: "quota" },
  { pattern: /\bcommission\b/i, weight: 2, label: "commission" },
  { pattern: /\bcold call(s|ing)?\b/i, weight: 2, label: "cold calling" },
  { pattern: /\boutbound\b/i, weight: 2, label: "outbound" },
  { pattern: /\binbound leads?\b/i, weight: 1, label: "inbound leads" },
  { pattern: /\bprospect(s|ing)?\b/i, weight: 2, label: "prospecting" },
  { pattern: /\bclose deals?\b/i, weight: 2, label: "close deals" },
  { pattern: /\bclosing\b/i, weight: 1, label: "closing" },
  { pattern: /\bpipeline generation\b/i, weight: 2, label: "pipeline generation" },
  { pattern: /\b(revenue|sales) target\b/i, weight: 2, label: "revenue/sales target" },
  { pattern: /\b(hunting|hunter)\b/i, weight: 2, label: "hunting" },
  { pattern: /\b(upsell|cross[- ]sell)\b/i, weight: 2, label: "upsell/cross-sell" },
  { pattern: /\b(BDR|SDR)\b/i, weight: 2, label: "BDR/SDR" },
  { pattern: /\baccount executive\b/i, weight: 2, label: "account executive" },
  { pattern: /\binside sales\b/i, weight: 2, label: "inside sales" },
  { pattern: /\bsales cycle\b/i, weight: 2, label: "sales cycle" },
  { pattern: /\bobjection handling\b/i, weight: 2, label: "objection handling" },
  { pattern: /\bterritory\b/i, weight: 1, label: "territory" },
  { pattern: /\bdialer\b/i, weight: 2, label: "dialer" },
  { pattern: /\b(sales rep|sales representative)\b/i, weight: 2, label: "sales rep" },
  { pattern: /\bquota[- ]carry(ing)?\b/i, weight: 2, label: "quota-carrying" },
  { pattern: /\bnew business\b/i, weight: 1, label: "new business" },
  { pattern: /\bsales (team|org|organization)\b/i, weight: 1, label: "sales org" },
  { pattern: /\b(book|booking)(s|ing)? (meeting|appointment|demo)\b/i, weight: 2, label: "booking meetings" },
  // Relationship-driven B2B sales / partnerships
  { pattern: /\bbusiness development\b/i, weight: 2, label: "business development" },
  { pattern: /\bpartnership(s)?\b/i, weight: 2, label: "partnerships" },
  { pattern: /\bsponsor(ship|ships|ing)\b/i, weight: 2, label: "sponsorship" },
  { pattern: /\baccount (manag|growth|develop)/i, weight: 2, label: "account management" },
  { pattern: /\brelationship (develop|build|manag)/i, weight: 2, label: "relationship development" },
  { pattern: /\bclient (acqui|develop|grow|retent)/i, weight: 2, label: "client development" },
  { pattern: /\brevenue (generat|own|driv|growth)/i, weight: 2, label: "revenue generation" },
  { pattern: /\bpipeline (own|manag|build|develop)/i, weight: 2, label: "pipeline ownership" },
  { pattern: /\bpartner (lifecycle|relat|manag)/i, weight: 2, label: "partner management" },
  { pattern: /\boutside sales\b/i, weight: 2, label: "outside sales" },
  { pattern: /\b(sales|selling) strateg/i, weight: 1, label: "sales strategy" },
  { pattern: /\bclient retention\b/i, weight: 1, label: "client retention" },
  { pattern: /\bsales experience\b/i, weight: 1, label: "sales experience" },
];

const OPERATIONAL_EXECUTION_TRIGGERS: Trigger[] = [
  { pattern: /\bcoordinat(e|ion|or|ing)\b/i, weight: 1, label: "coordination" },
  { pattern: /\bschedul(e|ing)\b/i, weight: 1, label: "scheduling" },
  { pattern: /\bdata entry\b/i, weight: 2, label: "data entry" },
  { pattern: /\badministrative\b/i, weight: 2, label: "administrative" },
  { pattern: /\border processing\b/i, weight: 2, label: "order processing" },
  { pattern: /\binventory\b/i, weight: 1, label: "inventory" },
  { pattern: /\blogistics\b/i, weight: 2, label: "logistics" },
  { pattern: /\bdispatch\b/i, weight: 2, label: "dispatch" },
  { pattern: /\btransactional\b/i, weight: 2, label: "transactional" },
  { pattern: /\bclerical\b/i, weight: 2, label: "clerical" },
  { pattern: /\bbookkeeping\b/i, weight: 2, label: "bookkeeping" },
  { pattern: /\bpayroll\b/i, weight: 2, label: "payroll" },
  { pattern: /\binvoic(e|ing)\b/i, weight: 1, label: "invoicing" },
  { pattern: /\bprocurement\b/i, weight: 2, label: "procurement" },
  { pattern: /\b(ERP)\b/i, weight: 1, label: "ERP" },
  { pattern: /\b(ticketing|help desk|helpdesk)\b/i, weight: 2, label: "ticketing/help desk" },
  { pattern: /\bcustomer (support|service)\b/i, weight: 1, label: "customer support" },
  { pattern: /\bonboarding\b/i, weight: 1, label: "onboarding" },
  { pattern: /\bfiling\b/i, weight: 1, label: "filing" },
  { pattern: /\boffice manage(r|ment)\b/i, weight: 2, label: "office management" },
];

const ANALYTICAL_INVESTIGATIVE_TRIGGERS: Trigger[] = [
  { pattern: /\banalyz(e|ing|ed)\b/i, weight: 1, label: "analyze" },
  { pattern: /\banalysis\b/i, weight: 1, label: "analysis" },
  { pattern: /\banalytical\b/i, weight: 1, label: "analytical" },
  { pattern: /\binvestigat(e|ion|ive|ing)\b/i, weight: 2, label: "investigation" },
  { pattern: /\bresearch(er|ing)?\b/i, weight: 1, label: "research" },
  { pattern: /\bassessment\b/i, weight: 1, label: "assessment" },
  { pattern: /\bdiagnostic\b/i, weight: 2, label: "diagnostic" },
  { pattern: /\bforensic\b/i, weight: 2, label: "forensic" },
  { pattern: /\bpenetration test(ing|er)?\b/i, weight: 2, label: "penetration testing" },
  { pattern: /\bvulnerabilit(y|ies)\b/i, weight: 2, label: "vulnerability" },
  { pattern: /\brisk analysis\b/i, weight: 2, label: "risk analysis" },
  { pattern: /\bdata analy(st|sis|tics)\b/i, weight: 2, label: "data analysis" },
  { pattern: /\broot cause\b/i, weight: 2, label: "root cause" },
  { pattern: /\bstatistical\b/i, weight: 2, label: "statistical" },
  { pattern: /\bmodeling\b/i, weight: 1, label: "modeling" },
  { pattern: /\binsight(s)?\b/i, weight: 1, label: "insight" },
  { pattern: /\bintelligence\b/i, weight: 1, label: "intelligence" },
  { pattern: /\bsecurity analy(st|sis)\b/i, weight: 2, label: "security analysis" },
  { pattern: /\bthreat\b/i, weight: 1, label: "threat" },
  { pattern: /\baudit(ing|or)?\b/i, weight: 1, label: "audit" },
  { pattern: /\bcybersecurity\b/i, weight: 2, label: "cybersecurity" },
  { pattern: /\b(red team|blue team|SOC)\b/i, weight: 2, label: "red/blue team" },
];

const CREATIVE_IDEATION_TRIGGERS: Trigger[] = [
  { pattern: /\bcreative direction\b/i, weight: 2, label: "creative direction" },
  { pattern: /\bbrand(ing)?\b/i, weight: 1, label: "branding" },
  { pattern: /\bcontent creat(ion|or|ing)\b/i, weight: 2, label: "content creation" },
  { pattern: /\bcopywriting\b/i, weight: 2, label: "copywriting" },
  { pattern: /\bideation\b/i, weight: 2, label: "ideation" },
  { pattern: /\bcampaign\b/i, weight: 1, label: "campaign" },
  { pattern: /\bvisual design\b/i, weight: 2, label: "visual design" },
  { pattern: /\bUX design\b/i, weight: 2, label: "UX design" },
  { pattern: /\bstorytelling\b/i, weight: 2, label: "storytelling" },
  { pattern: /\bmarketing creative\b/i, weight: 2, label: "marketing creative" },
  { pattern: /\bconcept develop(ment|ing)\b/i, weight: 2, label: "concept development" },
  { pattern: /\bgraphic design(er)?\b/i, weight: 2, label: "graphic design" },
  { pattern: /\bart direction\b/i, weight: 2, label: "art direction" },
  { pattern: /\bcontent strategy\b/i, weight: 2, label: "content strategy" },
  { pattern: /\bcreative brief\b/i, weight: 2, label: "creative brief" },
  { pattern: /\bdesign thinking\b/i, weight: 2, label: "design thinking" },
  { pattern: /\bmarketing operat(ion|or|ions)\b/i, weight: 1, label: "marketing operations" },
  { pattern: /\benablement\b/i, weight: 1, label: "enablement" },
];

const MODE_TRIGGERS: Record<WorkMode, Trigger[]> = {
  builder_systems: BUILDER_SYSTEMS_TRIGGERS,
  sales_execution: SALES_EXECUTION_TRIGGERS,
  operational_execution: OPERATIONAL_EXECUTION_TRIGGERS,
  analytical_investigative: ANALYTICAL_INVESTIGATIVE_TRIGGERS,
  creative_ideation: CREATIVE_IDEATION_TRIGGERS,
};

// ─── Structural vs Execution Discriminator ──────────────────
// Catches roles that trigger builder_systems via ambiguous vocabulary
// (infrastructure, workflow, engineering, process improvement) but
// where the daily work is coordination/management, not creation.
//
// Applied ONLY to job classification. When execution-management signals
// dominate structural (system-building) signals, reclassifies the job
// from builder_systems to operational_execution so the compatibility
// map applies the correct penalty.

// Structural: hands-on technical system creation/design. These signals
// almost never appear in construction, coordination, or PM roles.
const STRUCTURAL_SIGNALS: Trigger[] = [
  { pattern: /\bsystem(s)? design\b/i, weight: 2, label: "system design" },
  { pattern: /\barchitect(ure|ing)\b/i, weight: 2, label: "architecture" },
  { pattern: /\b(prototype|MVP|proof of concept)\b/i, weight: 2, label: "prototype/MVP" },
  { pattern: /\b(CI\/CD|devops|dev ops)\b/i, weight: 2, label: "CI/CD" },
  { pattern: /\b(technical lead|tech lead)\b/i, weight: 2, label: "tech lead" },
  { pattern: /\b(full[- ]stack|backend|frontend)\b/i, weight: 2, label: "software dev" },
  { pattern: /\b(deploy|deployment)\b/i, weight: 2, label: "deployment" },
  { pattern: /\bcod(e|ing|er)\b/i, weight: 2, label: "coding" },
  { pattern: /\b(API|REST|GraphQL|microservice)/i, weight: 2, label: "API/services" },
  { pattern: /\bSaaS\b/i, weight: 1, label: "SaaS" },
  { pattern: /\bsoftware (develop|engineer)/i, weight: 2, label: "software development" },
  { pattern: /\bautomat(e|ed|ion|ing)\b/i, weight: 1, label: "automation" },
  { pattern: /\b(SOP|SOPs|standard operating procedure)\b/i, weight: 1, label: "SOP creation" },
  { pattern: /\bproduct develop(ment|er|ing)\b/i, weight: 2, label: "product development" },
  { pattern: /\b(agile|scrum|sprint)\b/i, weight: 1, label: "agile/scrum" },
];

// Execution-management: managing/coordinating/supervising work done by others.
// Presence of these signals without structural signals indicates the builder
// vocabulary is contextual (construction, logistics) not technical creation.
const EXECUTION_MANAGEMENT_SIGNALS: Trigger[] = [
  { pattern: /\bproject manage(r|ment)\b/i, weight: 2, label: "project management" },
  { pattern: /\bconstruction\b/i, weight: 2, label: "construction" },
  { pattern: /\bbudget (management|tracking|oversight|performance)\b/i, weight: 2, label: "budget management" },
  { pattern: /\bstakeholder (management|coordination|communication)\b/i, weight: 2, label: "stakeholder management" },
  { pattern: /\b(status|progress) report(s|ing)?\b/i, weight: 2, label: "status/progress reporting" },
  { pattern: /\bvendor (management|coordination|relations)\b/i, weight: 2, label: "vendor management" },
  { pattern: /\bclient (management|relations|communication)\b/i, weight: 2, label: "client management" },
  { pattern: /\bsubcontract(or|ing|ors)\b/i, weight: 2, label: "subcontractor management" },
  { pattern: /\bchange order(s)?\b/i, weight: 2, label: "change orders" },
  { pattern: /\b(permit|inspection)(s|ing)?\b/i, weight: 2, label: "permits/inspections" },
  { pattern: /\bsite (manage|supervis|superintendent)/i, weight: 2, label: "site management" },
  { pattern: /\b(RFP|RFI|RFQ)\b/i, weight: 2, label: "RFP/RFI" },
  { pattern: /\bresource allocation\b/i, weight: 2, label: "resource allocation" },
  { pattern: /\bpreconstruction\b/i, weight: 2, label: "preconstruction" },
  { pattern: /\bprogram manage(r|ment)\b/i, weight: 2, label: "program management" },
  { pattern: /\bproject coordinat(or|ion)\b/i, weight: 2, label: "project coordination" },
  { pattern: /\bregulatory compliance\b/i, weight: 2, label: "regulatory compliance" },
  { pattern: /\bsafety (compliance|management|program)\b/i, weight: 2, label: "safety compliance" },
  { pattern: /\boversee(ing|s)?\b/i, weight: 1, label: "overseeing" },
  { pattern: /\bsupervis(e|ion|ing|or)\b/i, weight: 1, label: "supervision" },
];

// Minimum execution score to trigger reclassification
const EXECUTION_DOMINANCE_THRESHOLD = 4;

export type DiscriminatorResult = {
  applied: boolean;
  structuralScore: number;
  executionScore: number;
  structuralTriggers: string[];
  executionTriggers: string[];
};

function applyExecutionDiscriminator(
  text: string,
  classification: WorkModeClassification,
): { classification: WorkModeClassification; discriminator: DiscriminatorResult } {
  let structuralScore = 0;
  let executionScore = 0;
  const structuralTriggers: string[] = [];
  const executionTriggers: string[] = [];

  for (const trigger of STRUCTURAL_SIGNALS) {
    if (trigger.pattern.test(text)) {
      structuralScore += trigger.weight;
      structuralTriggers.push(trigger.label);
    }
  }

  for (const trigger of EXECUTION_MANAGEMENT_SIGNALS) {
    if (trigger.pattern.test(text)) {
      executionScore += trigger.weight;
      executionTriggers.push(trigger.label);
    }
  }

  const shouldReclassify =
    executionScore >= EXECUTION_DOMINANCE_THRESHOLD &&
    executionScore > structuralScore;

  if (shouldReclassify) {
    return {
      classification: {
        mode: "operational_execution",
        scores: classification.scores,
        topMatches: executionTriggers,
        confidence: classification.confidence,
      },
      discriminator: {
        applied: true,
        structuralScore,
        executionScore,
        structuralTriggers,
        executionTriggers,
      },
    };
  }

  return {
    classification,
    discriminator: {
      applied: false,
      structuralScore,
      executionScore,
      structuralTriggers,
      executionTriggers,
    },
  };
}

// ─── Compatibility Map ──────────────────────────────────────
// Deterministic mapping: COMPATIBILITY_MAP[userMode][jobMode]

const COMPATIBILITY_MAP: Record<WorkMode, Record<WorkMode, WorkModeCompatibility>> = {
  builder_systems: {
    builder_systems: "compatible",
    sales_execution: "conflicting",
    operational_execution: "adjacent",
    analytical_investigative: "adjacent",
    creative_ideation: "adjacent",
  },
  sales_execution: {
    builder_systems: "conflicting",
    sales_execution: "compatible",
    operational_execution: "adjacent",
    analytical_investigative: "conflicting",
    creative_ideation: "conflicting",
  },
  operational_execution: {
    builder_systems: "adjacent",
    sales_execution: "adjacent",
    operational_execution: "compatible",
    analytical_investigative: "conflicting",
    creative_ideation: "adjacent",
  },
  analytical_investigative: {
    builder_systems: "adjacent",
    sales_execution: "conflicting",
    operational_execution: "conflicting",
    analytical_investigative: "compatible",
    creative_ideation: "conflicting",
  },
  creative_ideation: {
    builder_systems: "adjacent",
    sales_execution: "conflicting",
    operational_execution: "adjacent",
    analytical_investigative: "conflicting",
    creative_ideation: "compatible",
  },
};

// ─── Weighted Scoring Adjustments ────────────────────────────
// Proportional negative adjustments per compatibility tier.
// These replace the old ceiling/cap system with continuous penalties
// that make bad jobs obviously bad while preserving viable adjacent roles.

const WORK_MODE_ADJUSTMENTS: Record<WorkModeCompatibility, number> = {
  compatible: 0,        // no penalty for same-mode alignment
  adjacent: -0.8,       // mild drag — viable but not ideal daily work
  conflicting: -2.5,    // strong drag — fundamentally misaligned daily work
};

// Legacy constants preserved for _testing export backward compat
const CONFLICTING_CEILING = 6.5;
const ADJACENT_CEILING = 8.5;

// Minimum match count to classify with confidence
const HIGH_CONFIDENCE_THRESHOLD = 4;
const LOW_CONFIDENCE_THRESHOLD = 2;

// ─── Classification Engine ──────────────────────────────────

function classifyText(text: string): WorkModeClassification {
  const scores: Record<WorkMode, number> = {
    builder_systems: 0,
    sales_execution: 0,
    operational_execution: 0,
    analytical_investigative: 0,
    creative_ideation: 0,
  };

  const matchedLabels: Record<WorkMode, string[]> = {
    builder_systems: [],
    sales_execution: [],
    operational_execution: [],
    analytical_investigative: [],
    creative_ideation: [],
  };

  for (const mode of Object.keys(MODE_TRIGGERS) as WorkMode[]) {
    for (const trigger of MODE_TRIGGERS[mode]) {
      if (trigger.pattern.test(text)) {
        scores[mode] += trigger.weight;
        matchedLabels[mode].push(trigger.label);
      }
    }
  }

  // Find the dominant mode
  let topMode: WorkMode | null = null;
  let topScore = 0;
  for (const mode of Object.keys(scores) as WorkMode[]) {
    if (scores[mode] > topScore) {
      topScore = scores[mode];
      topMode = mode;
    }
  }

  // Confidence determination
  let confidence: "high" | "low" | "none" = "none";
  if (topMode && topScore >= HIGH_CONFIDENCE_THRESHOLD) {
    confidence = "high";
  } else if (topMode && topScore >= LOW_CONFIDENCE_THRESHOLD) {
    confidence = "low";
  } else {
    topMode = null;
  }

  const topMatches = topMode ? matchedLabels[topMode] : [];

  return { mode: topMode, scores, topMatches, confidence };
}

// ─── User Classification ────────────────────────────────────
// Uses resume text + positive-signal prompts (1, 3, 4, 5).
// Prompt 2 (drain) is excluded — its signals indicate anti-mode.

export function classifyUserWorkMode(
  resumeText: string,
  promptAnswers: Record<number, string>,
): WorkModeClassification {
  // Concatenate positive-signal sources
  const parts: string[] = [resumeText || ""];
  for (const key of [1, 3, 4, 5]) {
    if (promptAnswers[key]) parts.push(promptAnswers[key]);
  }
  return classifyText(parts.join("\n"));
}

// ─── Job Classification ─────────────────────────────────────

export function classifyJobWorkMode(jobText: string): WorkModeClassification {
  const result = classifyText(jobText);
  // Apply structural vs execution discriminator for builder_systems classifications.
  // Prevents construction PMs, coordinators, and other execution-heavy roles from
  // being misclassified as builder_systems via ambiguous vocabulary overlap.
  if (result.mode === "builder_systems") {
    const { classification } = applyExecutionDiscriminator(jobText, result);
    return classification;
  }
  return result;
}

// ─── Compatibility Lookup ───────────────────────────────────

export function getWorkModeCompatibility(
  userMode: WorkMode | null,
  jobMode: WorkMode | null,
): WorkModeCompatibility {
  // If either mode is unclassified, assume compatible (no penalty)
  if (!userMode || !jobMode) return "compatible";
  return COMPATIBILITY_MAP[userMode][jobMode];
}

// ─── Execution Intensity Detection ──────────────────────────
// Detects grind-heavy role patterns that make daily work draining
// regardless of skill overlap. Produces a weighted intensity score
// that translates to a proportional negative adjustment.

type IntensityTrigger = { pattern: RegExp; weight: number; label: string };

const EXECUTION_INTENSITY_TRIGGERS: IntensityTrigger[] = [
  // Outbound calling / prospecting
  { pattern: /\b\d+\+?\s*(outbound\s+)?calls?\s*(per|a)\s*(day|shift)\b/i, weight: 3, label: "high-volume daily calls" },
  { pattern: /\bcold call(s|ing)?\b/i, weight: 2, label: "cold calling" },
  { pattern: /\boutbound (call|dial|prospect)/i, weight: 2, label: "outbound prospecting" },
  { pattern: /\bdialer\b/i, weight: 2, label: "auto-dialer" },
  { pattern: /\bphone[- ]based\b/i, weight: 2, label: "phone-based work" },
  // Quota / commission pressure
  { pattern: /\bquota[- ]carry(ing)?\b/i, weight: 2, label: "quota-carrying" },
  { pattern: /\bcommission[- ]?(based|only|driven|structure)\b/i, weight: 2, label: "commission-driven" },
  { pattern: /\b(OTE|on[- ]target[- ]earnings)\b/i, weight: 1, label: "OTE comp" },
  { pattern: /\buncapped (commission|earning|comp)/i, weight: 2, label: "uncapped commission" },
  // Repetitive high-volume execution
  { pattern: /\bhigh[- ]volume\b/i, weight: 2, label: "high-volume" },
  { pattern: /\bfast[- ]paced (sales|environment|team)\b/i, weight: 1, label: "fast-paced sales" },
  { pattern: /\b(metrics|KPI)[- ]driven\b/i, weight: 1, label: "metrics-driven" },
  { pattern: /\bdaily (activity|metric|target|goal)\b/i, weight: 2, label: "daily activity targets" },
  // Rejection-heavy / thick skin
  { pattern: /\bthick skin\b/i, weight: 3, label: "thick skin required" },
  { pattern: /\bresilien(ce|t)\b.*\b(rejection|no|objection)/i, weight: 2, label: "rejection resilience" },
  { pattern: /\bobjection handling\b/i, weight: 1, label: "objection handling" },
  { pattern: /\brejection\b/i, weight: 1, label: "rejection" },
  // Door-to-door / field canvassing
  { pattern: /\bdoor[- ]to[- ]door\b/i, weight: 3, label: "door-to-door" },
  { pattern: /\bdoor knock(ing|s)?\b/i, weight: 3, label: "door knocking" },
  { pattern: /\bfield (canvass|sales|rep)/i, weight: 2, label: "field canvassing" },
  { pattern: /\bin[- ]person (sales|prospect|canvass)/i, weight: 2, label: "in-person sales" },
  { pattern: /\bwalk[- ]in(s)?\b/i, weight: 1, label: "walk-ins" },
];

// Intensity thresholds for adjustment tiers
const INTENSITY_MILD_THRESHOLD = 3;     // >= 3 intensity score: mild drag
const INTENSITY_HEAVY_THRESHOLD = 6;    // >= 6 intensity score: heavy drag
const INTENSITY_EXTREME_THRESHOLD = 10; // >= 10 intensity score: extreme drag

// Adjustment values per intensity tier
const INTENSITY_ADJUSTMENTS = {
  none: 0,
  mild: -0.5,
  heavy: -1.5,
  extreme: -2.5,
};

export function detectExecutionIntensity(jobText: string): ExecutionIntensityResult {
  let intensityScore = 0;
  const triggers: string[] = [];

  for (const trigger of EXECUTION_INTENSITY_TRIGGERS) {
    if (trigger.pattern.test(jobText)) {
      intensityScore += trigger.weight;
      triggers.push(trigger.label);
    }
  }

  let adjustment = 0;
  let tier = "none";
  if (intensityScore >= INTENSITY_EXTREME_THRESHOLD) {
    adjustment = INTENSITY_ADJUSTMENTS.extreme;
    tier = "extreme";
  } else if (intensityScore >= INTENSITY_HEAVY_THRESHOLD) {
    adjustment = INTENSITY_ADJUSTMENTS.heavy;
    tier = "heavy";
  } else if (intensityScore >= INTENSITY_MILD_THRESHOLD) {
    adjustment = INTENSITY_ADJUSTMENTS.mild;
    tier = "mild";
  }

  const reason = triggers.length > 0
    ? `Execution intensity: ${tier} (score=${intensityScore}, triggers=[${triggers.join(", ")}]). Adjustment: ${adjustment}.`
    : null;

  return { score: intensityScore, adjustment, triggers, reason };
}

// ─── Weighted Score Adjustment ──────────────────────────────

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

export function applyWorkModeAdjustment(
  rawScore: number,
  compatibility: WorkModeCompatibility,
  userMode: WorkModeClassification,
  jobMode: WorkModeClassification,
): { adjustment: number; reason: string | null } {
  // Compatible modes: no adjustment
  if (compatibility === "compatible") {
    return { adjustment: 0, reason: null };
  }

  // Require at least low confidence on BOTH sides to apply any adjustment
  if (userMode.confidence === "none" || jobMode.confidence === "none") {
    return { adjustment: 0, reason: null };
  }

  const adj = WORK_MODE_ADJUSTMENTS[compatibility];
  const reason =
    `Work mode ${compatibility}: user=${userMode.mode} (${userMode.confidence}) ` +
    `vs job=${jobMode.mode} (${jobMode.confidence}). ` +
    `Adjustment: ${adj}.`;

  return { adjustment: adj, reason };
}

// Legacy compat wrapper — calls new adjustment logic
export function applyWorkModeCeiling(
  rawScore: number,
  compatibility: WorkModeCompatibility,
  userMode: WorkModeClassification,
  jobMode: WorkModeClassification,
): { score: number; ceilingApplied: boolean; ceilingReason: string | null } {
  const { adjustment, reason } = applyWorkModeAdjustment(rawScore, compatibility, userMode, jobMode);
  const adjusted = round1(Math.max(0, Math.min(10, rawScore + adjustment)));
  return {
    score: adjusted,
    ceilingApplied: adjustment !== 0,
    ceilingReason: reason,
  };
}

// ─── Full Pipeline ──────────────────────────────────────────

export function evaluateWorkMode(
  rawScore: number,
  resumeText: string,
  promptAnswers: Record<number, string>,
  jobText: string,
): WorkModeResult {
  const userMode = classifyUserWorkMode(resumeText, promptAnswers);
  const jobMode = classifyJobWorkMode(jobText);
  const compatibility = getWorkModeCompatibility(userMode.mode, jobMode.mode);

  // Work mode adjustment (proportional penalty for mismatch)
  const { adjustment: wmAdj, reason: wmReason } = applyWorkModeAdjustment(
    rawScore, compatibility, userMode, jobMode,
  );

  // Execution intensity adjustment (grind-heavy role penalty)
  const executionIntensity = detectExecutionIntensity(jobText);
  const eiAdj = executionIntensity.adjustment;

  // Compose final score: base + work mode adjustment + execution intensity adjustment
  // When both adjustments fire, dampen intensity to avoid double-counting daily-work misalignment.
  // Intensity applies at half strength when work mode is already conflicting.
  const dampedEiAdj = (compatibility === "conflicting" && eiAdj < 0) ? eiAdj * 0.5 : eiAdj;
  const totalAdjustment = wmAdj + dampedEiAdj;
  const postScore = round1(Math.max(0, Math.min(10, rawScore + totalAdjustment)));

  // Build composite reason
  const reasons: string[] = [];
  if (wmReason) reasons.push(wmReason);
  if (executionIntensity.reason) reasons.push(executionIntensity.reason);
  const adjustmentReason = reasons.length > 0 ? reasons.join(" | ") : null;

  return {
    userMode,
    jobMode,
    compatibility,
    executionIntensity,
    preScore: rawScore,
    workModeAdjustment: wmAdj,
    executionIntensityAdjustment: dampedEiAdj,
    postScore,
    adjustmentReason,
  };
}

// ─── Exports for testing ────────────────────────────────────

export const _testing = {
  classifyText,
  COMPATIBILITY_MAP,
  CONFLICTING_CEILING,
  ADJACENT_CEILING,
  MODE_TRIGGERS,
  WORK_MODE_ADJUSTMENTS,
  EXECUTION_INTENSITY_TRIGGERS,
  INTENSITY_ADJUSTMENTS,
  detectExecutionIntensity,
  STRUCTURAL_SIGNALS,
  EXECUTION_MANAGEMENT_SIGNALS,
  EXECUTION_DOMINANCE_THRESHOLD,
  applyExecutionDiscriminator,
};
