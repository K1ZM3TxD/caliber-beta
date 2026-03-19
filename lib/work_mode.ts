// lib/work_mode.ts
//
// Dominant Work Mode classification + score ceiling/compression.
//
// Detects the dominant work mode for both user profiles and jobs,
// then enforces a compatibility rule that prevents false-positive
// strong-match scores when modes conflict.

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

export type WorkModeResult = {
  userMode: WorkModeClassification;
  jobMode: WorkModeClassification;
  compatibility: WorkModeCompatibility;
  preScore: number;
  postScore: number;
  ceilingApplied: boolean;
  ceilingReason: string | null;
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

// ─── Score Governance ───────────────────────────────────────
// Ceilings applied per compatibility tier.

const CONFLICTING_CEILING = 6.5;
const ADJACENT_CEILING = 8.5;
// Compatible: no adjustment

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
  return classifyText(jobText);
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

// ─── Score Governance ───────────────────────────────────────

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

export function applyWorkModeCeiling(
  rawScore: number,
  compatibility: WorkModeCompatibility,
  userMode: WorkModeClassification,
  jobMode: WorkModeClassification,
): { score: number; ceilingApplied: boolean; ceilingReason: string | null } {
  // Compatible modes: no adjustment
  if (compatibility === "compatible") {
    return { score: rawScore, ceilingApplied: false, ceilingReason: null };
  }

  // Require at least low confidence on BOTH sides to enforce any ceiling
  if (userMode.confidence === "none" || jobMode.confidence === "none") {
    return { score: rawScore, ceilingApplied: false, ceilingReason: null };
  }

  // Adjacent modes: mild compression — soft cap at 8.5
  if (compatibility === "adjacent") {
    if (rawScore <= ADJACENT_CEILING) {
      return { score: rawScore, ceilingApplied: false, ceilingReason: null };
    }
    const capped = round1(Math.min(rawScore, ADJACENT_CEILING));
    const reason =
      `Adjacent work modes: user=${userMode.mode} (${userMode.confidence}) ` +
      `vs job=${jobMode.mode} (${jobMode.confidence}). ` +
      `Soft ceiling ${ADJACENT_CEILING} applied (raw=${rawScore}).`;
    return { score: capped, ceilingApplied: true, ceilingReason: reason };
  }

  // Conflicting modes: hard cap at 6.5
  if (rawScore <= CONFLICTING_CEILING) {
    return { score: rawScore, ceilingApplied: false, ceilingReason: null };
  }

  const capped = round1(Math.min(rawScore, CONFLICTING_CEILING));
  const reason =
    `Work mode conflict: user=${userMode.mode} (${userMode.confidence}, score=${userMode.scores[userMode.mode!]}) ` +
    `vs job=${jobMode.mode} (${jobMode.confidence}, score=${jobMode.scores[jobMode.mode!]}). ` +
    `Ceiling ${CONFLICTING_CEILING} applied (raw=${rawScore}).`;

  return { score: capped, ceilingApplied: true, ceilingReason: reason };
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
  const { score, ceilingApplied, ceilingReason } = applyWorkModeCeiling(
    rawScore, compatibility, userMode, jobMode,
  );

  return {
    userMode,
    jobMode,
    compatibility,
    preScore: rawScore,
    postScore: score,
    ceilingApplied,
    ceilingReason,
  };
}

// ─── Exports for testing ────────────────────────────────────

export const _testing = {
  classifyText,
  COMPATIBILITY_MAP,
  CONFLICTING_CEILING,
  ADJACENT_CEILING,
  MODE_TRIGGERS,
};
