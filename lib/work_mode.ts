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
  roleType: RoleType | null;
  chipSuppression: ChipSuppressionResult;
  preScore: number;
  workModeAdjustment: number;
  executionIntensityAdjustment: number;
  chipSuppressionAdjustment: number;
  roleTypePenalty: number;
  postScore: number;
  adjustmentReason: string | null;
};

// ─── Role-Type Classification ───────────────────────────────
// Coarse role archetype that maps to chip intent.
// SYSTEM_BUILDER: creates/designs/architects systems
// SYSTEM_OPERATOR: runs/coordinates/maintains operational processes
// SYSTEM_SELLER: drives revenue/pipeline/quota

export type RoleType = "SYSTEM_BUILDER" | "SYSTEM_OPERATOR" | "SYSTEM_SELLER";

export type ChipSuppressionResult = {
  suppressed: boolean;
  adjustment: number;
  reason: string | null;
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
  { pattern: /\bworkflow\s+automat(e|ed|ion|ing)\b/i, weight: 2, label: "workflow automation" },
  { pattern: /\bautomat(e|ed|ion|ing)\b/i, weight: 2, label: "automation" },
  { pattern: /\bplatform\s+(engineering|development|architecture)\b/i, weight: 2, label: "platform engineering" },
  { pattern: /\bengineering\b/i, weight: 1, label: "engineering" },
  { pattern: /\b(deploy|deployment)\b/i, weight: 2, label: "deploy" },
  { pattern: /\bsystem(s)?\s+integrat(e|ion|ing|ed)\b/i, weight: 2, label: "system integration" },
  { pattern: /\b(CI\/CD|devops|dev ops)\b/i, weight: 2, label: "CI/CD" },
  { pattern: /\bproduct manage(r|ment)\b/i, weight: 2, label: "product management" },
  { pattern: /\b(roadmap|sprint|agile|scrum)\b/i, weight: 1, label: "agile/roadmap" },
  { pattern: /\b(full[- ]stack|backend|frontend|software)\b/i, weight: 1, label: "software" },
  { pattern: /\b(prototype|MVP|proof of concept)\b/i, weight: 2, label: "prototype/MVP" },
  { pattern: /\bbuild(ing|t|s)? (tools|systems|apps|applications|software|platform)\b/i, weight: 2, label: "building tools/systems" },
  { pattern: /\b(technical lead|tech lead)\b/i, weight: 2, label: "tech lead" },
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

// ─── Role-Type Classifier ───────────────────────────────────
// Classifies a job into a coarse role archetype based on keyword density.
// Uses strong-signal keywords only — avoids generic terms that create
// false positives (e.g., "strategy" alone does NOT trigger SYSTEM_BUILDER).

type RoleTypePattern = { pattern: RegExp; weight: number; label: string };

const SELLER_PATTERNS: RoleTypePattern[] = [
  { pattern: /\bclose\s+(deals?|business|sales)\b/i, weight: 3, label: "close deals" },
  { pattern: /\bpipeline\s+(generation|management|development)\b/i, weight: 3, label: "pipeline generation" },
  { pattern: /\b(revenue|sales)\s+target\b/i, weight: 3, label: "revenue target" },
  { pattern: /\bquota[- ]?carry(ing)?\b/i, weight: 3, label: "quota-carrying" },
  { pattern: /\bquota\b/i, weight: 2, label: "quota" },
  { pattern: /\bcold call(s|ing)?\b/i, weight: 3, label: "cold calling" },
  { pattern: /\boutbound (call|dial|prospect)/i, weight: 3, label: "outbound prospecting" },
  { pattern: /\bcommission[- ]?(based|only|driven|structure)\b/i, weight: 3, label: "commission-driven" },
  { pattern: /\b(BDR|SDR)\b/i, weight: 3, label: "BDR/SDR" },
  { pattern: /\baccount executive\b/i, weight: 3, label: "account executive" },
  { pattern: /\binside sales\b/i, weight: 3, label: "inside sales" },
  { pattern: /\bsales cycle\b/i, weight: 2, label: "sales cycle" },
  { pattern: /\b(hunting|hunter)\b/i, weight: 2, label: "hunting" },
  { pattern: /\b(upsell|cross[- ]sell)\b/i, weight: 2, label: "upsell/cross-sell" },
  { pattern: /\bprospect(s|ing)?\b/i, weight: 2, label: "prospecting" },
  { pattern: /\bsales (rep|representative)\b/i, weight: 3, label: "sales rep" },
  { pattern: /\bnew business\b/i, weight: 1, label: "new business" },
];

const OPERATOR_PATTERNS: RoleTypePattern[] = [
  { pattern: /\bproject\s+manag(er|ement|ing)\b/i, weight: 3, label: "project management" },
  { pattern: /\bcoordinat(e|ion|or|ing)\b/i, weight: 2, label: "coordination" },
  { pattern: /\bdelivery\s+own(er|ership)\b/i, weight: 3, label: "delivery ownership" },
  { pattern: /\border\s+processing\b/i, weight: 3, label: "order processing" },
  { pattern: /\blogistics\b/i, weight: 2, label: "logistics" },
  { pattern: /\bdispatch\b/i, weight: 2, label: "dispatch" },
  { pattern: /\badministrative\b/i, weight: 2, label: "administrative" },
  { pattern: /\bschedul(e|ing)\b/i, weight: 2, label: "scheduling" },
  { pattern: /\bdata entry\b/i, weight: 3, label: "data entry" },
  { pattern: /\bprocurement\b/i, weight: 2, label: "procurement" },
  { pattern: /\binventory\b/i, weight: 2, label: "inventory" },
  { pattern: /\bpayroll\b/i, weight: 3, label: "payroll" },
  { pattern: /\bbookkeeping\b/i, weight: 3, label: "bookkeeping" },
  { pattern: /\boffice\s+manage(r|ment)\b/i, weight: 3, label: "office management" },
  { pattern: /\btransactional\b/i, weight: 2, label: "transactional" },
  { pattern: /\b(ticketing|help\s*desk)\b/i, weight: 2, label: "ticketing" },
  { pattern: /\bcustomer\s+(support|service)\b/i, weight: 2, label: "customer support" },
];

const BUILDER_PATTERNS: RoleTypePattern[] = [
  { pattern: /\bproduct\s+develop(ment|er|ing)\b/i, weight: 3, label: "product development" },
  { pattern: /\bsystem(s)?\s+design\b/i, weight: 3, label: "system design" },
  { pattern: /\barchitect(ure|ing)?\b/i, weight: 3, label: "architecture" },
  { pattern: /\binfrastructure\b/i, weight: 2, label: "infrastructure" },
  { pattern: /\b(SOP|SOPs|standard\s+operating\s+procedure)\b/i, weight: 2, label: "SOP" },
  { pattern: /\bautomat(e|ed|ion|ing)\b/i, weight: 2, label: "automation" },
  { pattern: /\b(deploy|deployment)\b/i, weight: 2, label: "deploy" },
  { pattern: /\b(CI\/CD|devops)\b/i, weight: 3, label: "CI/CD" },
  { pattern: /\bproduct\s+manage(r|ment)\b/i, weight: 2, label: "product management" },
  { pattern: /\b(prototype|MVP|proof\s+of\s+concept)\b/i, weight: 3, label: "prototype/MVP" },
  { pattern: /\bbuild(ing|t|s)?\s+(tools|systems|apps|applications|software|platform)\b/i, weight: 3, label: "building tools/systems" },
  { pattern: /\b(technical\s+lead|tech\s+lead)\b/i, weight: 3, label: "tech lead" },
  { pattern: /\b(full[- ]stack|backend|frontend)\b/i, weight: 2, label: "software dev" },
  { pattern: /\bplatform\s+engineer/i, weight: 3, label: "platform engineering" },
];

const ROLE_TYPE_THRESHOLD = 4; // minimum score to classify

export function classifyRoleType(jobText: string): RoleType | null {
  const sellerScore = scorePatterns(jobText, SELLER_PATTERNS);
  const operatorScore = scorePatterns(jobText, OPERATOR_PATTERNS);
  const builderScore = scorePatterns(jobText, BUILDER_PATTERNS);

  const max = Math.max(sellerScore, operatorScore, builderScore);
  if (max < ROLE_TYPE_THRESHOLD) return null;

  // Deterministic tie-breaking: seller > operator > builder (severity order)
  if (sellerScore === max && sellerScore >= ROLE_TYPE_THRESHOLD) return "SYSTEM_SELLER";
  if (operatorScore === max && operatorScore >= ROLE_TYPE_THRESHOLD) return "SYSTEM_OPERATOR";
  if (builderScore === max && builderScore >= ROLE_TYPE_THRESHOLD) return "SYSTEM_BUILDER";
  return null;
}

function scorePatterns(text: string, patterns: RoleTypePattern[]): number {
  let total = 0;
  for (const p of patterns) {
    if (p.pattern.test(text)) total += p.weight;
  }
  return total;
}

// ─── Chip-Based Suppression ─────────────────────────────────
// When a user has explicitly avoided a mode via chips, and the job's
// dominant mode or role type matches that avoided mode, apply a hard cap.
// This is the user's stated intent — it overrides text-based classification.

// Map chip avoidedModes strings to the role types and work modes they suppress
const AVOIDED_MODE_TO_ROLE_TYPES: Record<string, RoleType[]> = {
  sales_execution: ["SYSTEM_SELLER"],
  operational_execution: ["SYSTEM_OPERATOR"],
  builder_systems: ["SYSTEM_BUILDER"],
};

const AVOIDED_MODE_TO_WORK_MODES: Record<string, WorkMode[]> = {
  sales_execution: ["sales_execution"],
  operational_execution: ["operational_execution"],
  builder_systems: ["builder_systems"],
};

// Hard caps when chip suppression fires
const CHIP_SUPPRESSION_CAPS: Record<string, number> = {
  sales_execution: 3.5,        // sales with "sales" avoided → ≤ 3.5
  operational_execution: 4.0,  // ops with "ops" avoided → ≤ 4.0
  builder_systems: 4.0,        // builder with "builder" avoided → ≤ 4.0
};

export type WorkPreferencesInput = {
  primaryMode?: string;
  preferredModes?: string[];
  avoidedModes?: string[];
} | null | undefined;

export function applyChipSuppression(
  score: number,
  jobMode: WorkModeClassification,
  roleType: RoleType | null,
  workPreferences: WorkPreferencesInput,
): ChipSuppressionResult {
  if (!workPreferences?.avoidedModes || workPreferences.avoidedModes.length === 0) {
    return { suppressed: false, adjustment: 0, reason: null };
  }

  for (const avoided of workPreferences.avoidedModes) {
    const matchingRoleTypes = AVOIDED_MODE_TO_ROLE_TYPES[avoided] || [];
    const matchingWorkModes = AVOIDED_MODE_TO_WORK_MODES[avoided] || [];

    const roleTypeMatch = roleType && matchingRoleTypes.includes(roleType);
    const workModeMatch = jobMode.mode && matchingWorkModes.includes(jobMode.mode) && jobMode.confidence !== "none";

    if (roleTypeMatch || workModeMatch) {
      const cap = CHIP_SUPPRESSION_CAPS[avoided] ?? 4.0;
      if (score > cap) {
        const adjustment = cap - score;
        return {
          suppressed: true,
          adjustment,
          reason: `Chip suppression: "${avoided}" is in avoidedModes, ` +
            `job classified as ${roleType ? `roleType=${roleType}` : `mode=${jobMode.mode}`}. ` +
            `Score capped from ${round1(score)} to ${cap}.`,
        };
      }
    }
  }

  return { suppressed: false, adjustment: 0, reason: null };
}

// ─── Role-Type Mismatch Penalty ─────────────────────────────
// When the user's dominant chip intent (primaryMode) is a builder type
// but the job is a seller or operator, apply an additional penalty even
// without explicit avoidedModes. This catches implicit mismatches.

const ROLE_TYPE_PENALTY_MAP: Record<string, Record<RoleType, number>> = {
  builder_systems: {
    SYSTEM_BUILDER: 0,
    SYSTEM_OPERATOR: -1.0,
    SYSTEM_SELLER: -2.0,
  },
  sales_execution: {
    SYSTEM_BUILDER: -1.5,
    SYSTEM_OPERATOR: -0.5,
    SYSTEM_SELLER: 0,
  },
  operational_execution: {
    SYSTEM_BUILDER: -0.5,
    SYSTEM_OPERATOR: 0,
    SYSTEM_SELLER: -1.0,
  },
  analytical_investigative: {
    SYSTEM_BUILDER: 0,
    SYSTEM_OPERATOR: -1.0,
    SYSTEM_SELLER: -2.0,
  },
  creative_ideation: {
    SYSTEM_BUILDER: 0,
    SYSTEM_OPERATOR: -1.0,
    SYSTEM_SELLER: -1.5,
  },
};

export function getRoleTypePenalty(
  userMode: WorkMode | null,
  roleType: RoleType | null,
): { penalty: number; reason: string | null } {
  if (!userMode || !roleType) return { penalty: 0, reason: null };

  const map = ROLE_TYPE_PENALTY_MAP[userMode];
  if (!map) return { penalty: 0, reason: null };

  const penalty = map[roleType] ?? 0;
  if (penalty === 0) return { penalty: 0, reason: null };

  return {
    penalty,
    reason: `Role-type mismatch: user=${userMode}, job roleType=${roleType}. Penalty: ${penalty}.`,
  };
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
  workPreferences?: WorkPreferencesInput,
): WorkModeResult {
  const userMode = classifyUserWorkMode(resumeText, promptAnswers);
  const jobMode = classifyJobWorkMode(jobText);
  const compatibility = getWorkModeCompatibility(userMode.mode, jobMode.mode);

  // Role-type classification (coarse archetype)
  const roleType = classifyRoleType(jobText);

  // Work mode adjustment (proportional penalty for mismatch)
  const { adjustment: wmAdj, reason: wmReason } = applyWorkModeAdjustment(
    rawScore, compatibility, userMode, jobMode,
  );

  // Execution intensity adjustment (grind-heavy role penalty)
  const executionIntensity = detectExecutionIntensity(jobText);
  const eiAdj = executionIntensity.adjustment;

  // When both adjustments fire, dampen intensity to avoid double-counting.
  const dampedEiAdj = (compatibility === "conflicting" && eiAdj < 0) ? eiAdj * 0.5 : eiAdj;

  // Role-type mismatch penalty (implicit chip enforcement)
  const { penalty: rtPenalty, reason: rtReason } = getRoleTypePenalty(userMode.mode, roleType);
  // Dampen role-type penalty when work mode adjustment already applied
  const dampedRtPenalty = (wmAdj < 0 && rtPenalty < 0) ? rtPenalty * 0.5 : rtPenalty;

  // Compose pre-chip score
  const preChipScore = round1(Math.max(0, Math.min(10, rawScore + wmAdj + dampedEiAdj + dampedRtPenalty)));

  // Chip-based suppression (hard cap from user's explicit avoidedModes)
  const chipSuppression = applyChipSuppression(preChipScore, jobMode, roleType, workPreferences);
  const chipAdj = chipSuppression.adjustment;

  const postScore = round1(Math.max(0, Math.min(10, preChipScore + chipAdj)));

  // Build composite reason
  const reasons: string[] = [];
  if (wmReason) reasons.push(wmReason);
  if (executionIntensity.reason) reasons.push(executionIntensity.reason);
  if (rtReason) reasons.push(rtReason);
  if (chipSuppression.reason) reasons.push(chipSuppression.reason);
  const adjustmentReason = reasons.length > 0 ? reasons.join(" | ") : null;

  return {
    userMode,
    jobMode,
    compatibility,
    executionIntensity,
    roleType,
    chipSuppression,
    preScore: rawScore,
    workModeAdjustment: wmAdj,
    executionIntensityAdjustment: dampedEiAdj,
    chipSuppressionAdjustment: chipAdj,
    roleTypePenalty: dampedRtPenalty,
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
  SELLER_PATTERNS,
  OPERATOR_PATTERNS,
  BUILDER_PATTERNS,
  CHIP_SUPPRESSION_CAPS,
  ROLE_TYPE_PENALTY_MAP,
  classifyRoleType,
  applyChipSuppression,
  getRoleTypePenalty,
};
