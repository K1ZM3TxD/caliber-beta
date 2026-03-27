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
  executionEvidence: ExecutionEvidenceResult;
  preScore: number;
  workModeAdjustment: number;
  executionIntensityAdjustment: number;
  chipSuppressionAdjustment: number;
  executionEvidenceAdjustment: number;
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

export type ExecutionEvidenceCategory = "domain_locked" | "stack_execution" | "integration_platform" | "clearance_required" | "specialist_craft";

export type ExecutionEvidenceResult = {
  triggered: boolean;
  categories: ExecutionEvidenceCategory[];
  signals: string[];
  missingEvidence: string[];
  cap: number | null;
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
  // Require a tech-domain adjective so "green infrastructure" / "water infrastructure"
  // in physical/construction jobs does NOT trigger builder_systems.
  { pattern: /\b(cloud|it|software|data|platform|network|digital)\s+infrastructure\b/i, weight: 2, label: "infrastructure" },
  { pattern: /\b(SOP|SOPs|standard operating procedure)\b/i, weight: 2, label: "SOP" },
  { pattern: /\bworkflow\s+automat(e|ed|ion|ing)\b/i, weight: 2, label: "workflow automation" },
  { pattern: /\bautomat(e|ed|ion|ing)\b/i, weight: 2, label: "automation" },
  { pattern: /\bplatform\s+(engineering|development|architecture)\b/i, weight: 2, label: "platform engineering" },
  // Require a tech-domain qualifier so "construction management, engineering" in
  // education requirements does NOT trigger builder_systems.
  { pattern: /\b(software|platform|data|systems?|reliability|cloud|devops)\s+engineer(ing|s)?\b/i, weight: 1, label: "engineering" },
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
  // Construction / field operations domain signals
  { pattern: /\bconstruction\s+manage(r|ment)\b/i, weight: 2, label: "construction management" },
  { pattern: /\bsubcontractors?\b/i, weight: 2, label: "subcontractors" },
  { pattern: /\bOSHA\b/, weight: 2, label: "OSHA" },
  { pattern: /\bgrant\s+writ(ing|e|ten)\b/i, weight: 2, label: "grant writing" },
  { pattern: /\bpermit(s|ting)?\b/i, weight: 1, label: "permits" },
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
  // Construction / field operations domain signals
  { pattern: /\bconstruction\s+manage(r|ment)\b/i, weight: 3, label: "construction management" },
  { pattern: /\bsubcontractors?\b/i, weight: 2, label: "subcontractors" },
  { pattern: /\bOSHA\b/, weight: 2, label: "OSHA" },
  { pattern: /\bgrant\s+writ(ing|e|ten)\b/i, weight: 2, label: "grant writing" },
  { pattern: /\bpermit(s|ting)?\b/i, weight: 1, label: "permits" },
];

const BUILDER_PATTERNS: RoleTypePattern[] = [
  { pattern: /\bproduct\s+develop(ment|er|ing)\b/i, weight: 3, label: "product development" },
  { pattern: /\bsystem(s)?\s+design\b/i, weight: 3, label: "system design" },
  { pattern: /\barchitect(ure|ing)?\b/i, weight: 3, label: "architecture" },
  // Same tech-domain guard as BUILDER_SYSTEMS_TRIGGERS
  { pattern: /\b(cloud|it|software|data|platform|network|digital)\s+infrastructure\b/i, weight: 2, label: "infrastructure" },
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

// ─── Execution Evidence Guardrail ────────────────────────────
// Detects execution-heavy requirements in the JD (domain-locked
// platform experience or stack-specific coding depth) and checks
// whether the user profile contains explicit evidence of that
// execution depth. If evidence is missing, final score is capped
// to prevent over-scoring on directionally-aligned but
// execution-gapped roles.

type EcosystemDef = {
  name: string;
  jobPatterns: { pattern: RegExp; weight: number; label: string }[];
  evidencePattern: RegExp;
  threshold: number;
};

const DOMAIN_LOCKED_ECOSYSTEMS: EcosystemDef[] = [
  {
    name: "Salesforce",
    jobPatterns: [
      { pattern: /\bsalesforce\b/i, weight: 2, label: "Salesforce" },
      { pattern: /\bCPQ\b/i, weight: 3, label: "CPQ" },
      { pattern: /\b[Aa]pex\b/, weight: 3, label: "Apex" },
      { pattern: /\bSOQL\b/, weight: 3, label: "SOQL" },
      { pattern: /\b(lightning|LWC)\b/i, weight: 2, label: "Lightning/LWC" },
      { pattern: /\bquote[- ]?to[- ]?cash\b/i, weight: 3, label: "quote-to-cash" },
      { pattern: /\b(sales cloud|service cloud)\b/i, weight: 2, label: "Sales/Service Cloud" },
    ],
    evidencePattern: /\b(salesforce|CPQ|apex|SOQL|lightning|LWC|quote[- ]?to[- ]?cash|sales cloud|service cloud)\b/i,
    threshold: 4,
  },
  {
    name: "SAP",
    jobPatterns: [
      { pattern: /\bSAP\b/, weight: 2, label: "SAP" },
      { pattern: /\bABAP\b/i, weight: 3, label: "ABAP" },
      { pattern: /\bS\/4\s*HANA\b/i, weight: 3, label: "S/4HANA" },
      { pattern: /\bHANA\b/, weight: 2, label: "HANA" },
      { pattern: /\bSAP\s+(MM|SD|FI|CO|PP|HCM|BW)\b/, weight: 3, label: "SAP module" },
    ],
    evidencePattern: /\b(SAP|ABAP|S\/4\s*HANA|HANA)\b/i,
    threshold: 4,
  },
  {
    name: "Oracle",
    jobPatterns: [
      { pattern: /\boracle\b/i, weight: 2, label: "Oracle" },
      { pattern: /\bPL\/SQL\b/i, weight: 3, label: "PL/SQL" },
      { pattern: /\boracle\s+(ERP|HCM|Cloud|E-Business|Fusion)\b/i, weight: 3, label: "Oracle platform" },
    ],
    evidencePattern: /\b(oracle|PL\/SQL)\b/i,
    threshold: 4,
  },
  {
    name: "ServiceNow",
    jobPatterns: [
      { pattern: /\bServiceNow\b/i, weight: 3, label: "ServiceNow" },
      { pattern: /\bITSM\b/, weight: 2, label: "ITSM" },
      { pattern: /\bITOM\b/, weight: 2, label: "ITOM" },
    ],
    evidencePattern: /\b(ServiceNow|ITSM|ITOM)\b/i,
    threshold: 4,
  },
  {
    name: "Workday",
    jobPatterns: [
      { pattern: /\bWorkday\b/i, weight: 3, label: "Workday" },
      { pattern: /\bWorkday\s+(HCM|Financials|Integration)\b/i, weight: 3, label: "Workday module" },
    ],
    evidencePattern: /\bWorkday\b/i,
    threshold: 4,
  },
  {
    name: "NetSuite",
    jobPatterns: [
      { pattern: /\bNetSuite\b/i, weight: 3, label: "NetSuite" },
      { pattern: /\bSuiteScript\b/i, weight: 3, label: "SuiteScript" },
      { pattern: /\bSuiteFlow\b/i, weight: 2, label: "SuiteFlow" },
    ],
    evidencePattern: /\b(NetSuite|SuiteScript|SuiteFlow)\b/i,
    threshold: 4,
  },
  {
    name: "Dynamics 365",
    jobPatterns: [
      { pattern: /\bDynamics\s*365\b/i, weight: 3, label: "Dynamics 365" },
      { pattern: /\bD365\b/, weight: 3, label: "D365" },
      { pattern: /\bMicrosoft\s+Dynamics\b/i, weight: 2, label: "Microsoft Dynamics" },
    ],
    evidencePattern: /\b(Dynamics\s*365|D365|Microsoft\s+Dynamics)\b/i,
    threshold: 4,
  },
  {
    name: "cryptocurrency/blockchain",
    jobPatterns: [
      { pattern: /\bcryptocurrency\s+platform/i, weight: 3, label: "cryptocurrency platforms" },
      { pattern: /\bblockchain\s+security\b/i, weight: 3, label: "blockchain security" },
      { pattern: /\bdigital\s+asset\s+secur/i, weight: 2, label: "digital asset security" },
      { pattern: /\bblockchain\b/i, weight: 2, label: "blockchain" },
      { pattern: /\bweb3\b/i, weight: 2, label: "web3" },
      { pattern: /\bsmart\s+contract\b/i, weight: 2, label: "smart contract" },
      { pattern: /\bDeFi\b/i, weight: 2, label: "DeFi" },
      { pattern: /\bcrypto\s+exchange\b/i, weight: 2, label: "crypto exchange" },
    ],
    // Evidence must cite blockchain/web3 domain work — generic "cryptography" or "CryptoHack" (classical crypto puzzles) intentionally excluded.
    evidencePattern: /\b(blockchain|web3|DeFi|smart\s+contract|cryptocurrency\s+platform|crypto\s+exchange|on[- ]chain|token\s+audit)\b/i,
    threshold: 4,
  },
];

// ─── Stack/Tool Execution Detection ─────────────────────────

type StackPattern = { pattern: RegExp; weight: number; label: string };

const STACK_EXECUTION_JOB_PATTERNS: StackPattern[] = [
  // Programming languages
  { pattern: /\bpython\b/i, weight: 2, label: "Python" },
  { pattern: /\bjava\b/i, weight: 2, label: "Java" },
  { pattern: /\bjavascript\b/i, weight: 2, label: "JavaScript" },
  { pattern: /\btypescript\b/i, weight: 2, label: "TypeScript" },
  { pattern: /\bC\+\+\b/, weight: 2, label: "C++" },
  { pattern: /\bC#\b/, weight: 2, label: "C#" },
  { pattern: /\bgolang\b/i, weight: 2, label: "Golang" },
  { pattern: /\brust\b/i, weight: 2, label: "Rust" },
  { pattern: /\bruby\b/i, weight: 2, label: "Ruby" },
  { pattern: /\bPHP\b/i, weight: 2, label: "PHP" },
  { pattern: /\bswift\b/i, weight: 2, label: "Swift" },
  { pattern: /\bkotlin\b/i, weight: 2, label: "Kotlin" },
  { pattern: /\bscala\b/i, weight: 2, label: "Scala" },
  // Frameworks
  { pattern: /\breact\b/i, weight: 2, label: "React" },
  { pattern: /\bangular\b/i, weight: 2, label: "Angular" },
  { pattern: /\bvue(\.?js)?\b/i, weight: 2, label: "Vue" },
  { pattern: /\bdjango\b/i, weight: 2, label: "Django" },
  { pattern: /\bflask\b/i, weight: 2, label: "Flask" },
  { pattern: /\bspring\s*boot\b/i, weight: 2, label: "Spring Boot" },
  { pattern: /\b(\.NET|dotnet|ASP\.NET)\b/i, weight: 2, label: ".NET" },
  { pattern: /\brails\b/i, weight: 2, label: "Rails" },
  { pattern: /\bnode\.?js\b/i, weight: 2, label: "Node.js" },
  { pattern: /\blaravel\b/i, weight: 2, label: "Laravel" },
  { pattern: /\bnext\.?js\b/i, weight: 2, label: "Next.js" },
  // Coding execution context
  { pattern: /\bwrite\s+code\b/i, weight: 3, label: "write code" },
  { pattern: /\bhands[- ]on\s+(coding|programming)\b/i, weight: 3, label: "hands-on coding" },
  { pattern: /\bcode\s+review\b/i, weight: 2, label: "code review" },
  { pattern: /\bcontribute\s+to\s+(the\s+)?codebase\b/i, weight: 3, label: "contribute to codebase" },
  { pattern: /\balgorithm(s|ic)?\b/i, weight: 2, label: "algorithms" },
  { pattern: /\bdata\s+structures?\b/i, weight: 2, label: "data structures" },
  { pattern: /\bproduction\s+code\b/i, weight: 3, label: "production code" },
];

const STACK_EXECUTION_THRESHOLD = 4;

// Evidence: any coding-specific signal in user profile indicates
// the user has execution depth in some stack. Presence of ANY
// specific language/framework/coding activity term counts.
const STACK_EVIDENCE_PATTERN =
  /\b(python|java|javascript|typescript|C\+\+|C#|golang|rust|ruby|PHP|swift|kotlin|scala|react|angular|vue|django|flask|spring|dotnet|\.NET|rails|node\.?js|laravel|next\.?js|software\s+engineer|software\s+developer|full[- ]stack\s+develop|frontend\s+develop|backend\s+develop|programmer|coding|wrote\s+code|code\s+review)\b/i;

// ─── Integration Platform Depth Detection ────────────────────
// Fires when a job explicitly requires iPaaS/no-code integration platform expertise
// (Zapier, Workato, MuleSoft, etc.) — a depth tier not captured by stack_execution.
// Generic "workflow automation" intentionally excluded; must name a specific platform or role.

const INTEGRATION_PLATFORM_JOB_PATTERNS: StackPattern[] = [
  // Named iPaaS / no-code platforms
  { pattern: /\bzapier\b/i, weight: 3, label: "Zapier" },
  { pattern: /\bworkato\b/i, weight: 3, label: "Workato" },
  { pattern: /\btray\.io\b/i, weight: 2, label: "Tray.io" },
  { pattern: /\bboomi\b/i, weight: 3, label: "Boomi" },
  { pattern: /\bmulesoft\b/i, weight: 3, label: "MuleSoft" },
  { pattern: /\bn8n\b/i, weight: 2, label: "n8n" },
  { pattern: /\biPaaS\b/i, weight: 3, label: "iPaaS" },
  { pattern: /\bintegromat\b/i, weight: 2, label: "Integromat" },
  { pattern: /\bmake\.com\b/i, weight: 2, label: "Make.com" },
  // Role-title requirements (job demands prior integration engineering experience)
  { pattern: /\bintegration\s+engineer/i, weight: 2, label: "integration engineer" },
  { pattern: /\bpartner\s+engineer/i, weight: 2, label: "partner engineer" },
  { pattern: /\bprofessional\s+services\s+engineer/i, weight: 2, label: "professional services engineer" },
  { pattern: /\btechnical\s+solutions\s+engineer/i, weight: 2, label: "technical solutions engineer" },
  // No-code / low-code integration platform context
  { pattern: /\bno[- ]code\s+(integration|platform|tool)/i, weight: 2, label: "no-code integration" },
  { pattern: /\blow[- ]code\s+(integration|platform|tool)/i, weight: 2, label: "low-code integration" },
];

const INTEGRATION_PLATFORM_THRESHOLD = 5;

// User evidence: explicitly named a no-code/iPaaS platform OR held an integration engineering role.
// "workflow automation" alone is too generic and intentionally excluded.
const INTEGRATION_PLATFORM_EVIDENCE_PATTERN =
  /\b(zapier|workato|tray\.io|boomi|mulesoft|n8n|iPaaS|make\.com|integromat|integration\s+engineer|partner\s+engineer|professional\s+services\s+engineer|connector\s+(platform|build)|no[- ]code\s+(integration|platform))\b/i;

// ── Government clearance patterns ────────────────────────────────────────────
// Fires when a JD explicitly requires an active government security clearance.
// TS/SCI alone (weight 4) exceeds the threshold of 3.
const CLEARANCE_JOB_PATTERNS: { pattern: RegExp; weight: number; label: string }[] = [
  { pattern: /\bTS\/SCI\b/, weight: 4, label: "TS/SCI" },
  { pattern: /\btop\s+secret\b/i, weight: 3, label: "Top Secret" },
  { pattern: /\bDoD\s+8570\b/i, weight: 3, label: "DoD 8570" },
  { pattern: /\bDoD\s+8140\b/i, weight: 3, label: "DoD 8140" },
  { pattern: /\bsecret\s+clearance\b/i, weight: 2, label: "secret clearance" },
  { pattern: /\bsecurity\s+clearance\b/i, weight: 2, label: "security clearance" },
  { pattern: /\bactive\s+clearance\b/i, weight: 2, label: "active clearance" },
  { pattern: /\bpublic\s+trust\b/i, weight: 2, label: "public trust" },
];

const CLEARANCE_THRESHOLD = 3;

// User evidence: explicitly mentions a clearance status, DoD affiliation, or classified environment.
// Generic "cybersecurity" alone is intentionally excluded.
const CLEARANCE_EVIDENCE_PATTERN =
  /\b(clearance|TS\/SCI|top\s+secret|secret\s+clearance|DoD|classified|COMSEC|EMSEC)\b/i;

const EXECUTION_EVIDENCE_CAP = 7.0;
// Lower cap for specialist craft domains: adjacent builder/systems overlap is insufficient;
// these roles require years of domain-embedded hands-on practice.
const SPECIALIST_CRAFT_CAP = 5.5;

// ─── Specialist Craft Domain Detection ─────────────────────
// Fires when a job explicitly requires deep specialist knowledge in a narrow
// technical domain where being "adjacent" (builder who automates things) is
// insufficient. Roles require years of domain-embedded hands-on training:
//   - Motion control / robotics / real-time systems (PLC, servo, ROS, FPGA, RTOS)
//   - Healthcare integration substrate (Epic, HL7, FHIR)
//   - Construction estimating (quantity takeoff, preconstruction, RSMeans)
// Reuses EcosystemDef shape for consistency.

const SPECIALIST_CRAFT_DOMAINS: EcosystemDef[] = [
  {
    name: "motion control / robotics / real-time systems",
    jobPatterns: [
      { pattern: /\bmotion\s+control\b/i, weight: 3, label: "motion control" },
      { pattern: /\bmotion\s+expert\b/i, weight: 3, label: "motion expert" },
      { pattern: /\bservo\b/i, weight: 3, label: "servo" },
      { pattern: /\bPLC\b/, weight: 3, label: "PLC" },
      { pattern: /\bsemiconductor\s+(metrology|equipment|process|manufacturing|inspection)\b/i, weight: 3, label: "semiconductor equipment" },
      { pattern: /\bEtherCAT\b/i, weight: 3, label: "EtherCAT" },
      { pattern: /\bstep[- ]and[- ]settle\b/i, weight: 3, label: "step-and-settle" },
      { pattern: /\b(CNC|G-code)\b/i, weight: 2, label: "CNC/G-code" },
      { pattern: /\bembedded\s+(motor|servo|motion|drive)\b/i, weight: 3, label: "embedded motor/drive" },
      { pattern: /\bmotor\s+drive\b/i, weight: 2, label: "motor drive" },
      { pattern: /\bROS2?\b/, weight: 3, label: "ROS" },
      { pattern: /\brobotic\s+(arm|system)\b/i, weight: 2, label: "robotic arm/system" },
      { pattern: /\brobotics?\s+integrat/i, weight: 3, label: "robotics integration" },
      { pattern: /\bindustrial\s+robot(ics?)?\b/i, weight: 3, label: "industrial robotics" },
      { pattern: /\bFPGA\b/, weight: 3, label: "FPGA" },
      { pattern: /\bRTOS\b/i, weight: 3, label: "RTOS" },
      { pattern: /\breal[- ]time\s+(control|OS|operating\s+system|system)\b/i, weight: 2, label: "real-time system" },
      { pattern: /\bSCADA\b/i, weight: 3, label: "SCADA" },
    ],
    evidencePattern: /\b(motion\s+control|servo|PLC|EtherCAT|step[- ]and[- ]settle|CNC|G-code|motor\s+drive|semiconductor\s+(metrology|equipment|process)|embedded\s+(motor|servo|motion|drive)|ROS2?|robotic\s+(arm|system)|robotics?\s+integrat|industrial\s+robot|FPGA|RTOS|SCADA)\b/i,
    threshold: 4,
  },
  {
    name: "healthcare integration substrate",
    jobPatterns: [
      { pattern: /\bEpic\b/, weight: 3, label: "Epic" },
      { pattern: /\bHL7\b/i, weight: 3, label: "HL7" },
      { pattern: /\bFHIR\b/i, weight: 3, label: "FHIR" },
      { pattern: /\bEHR\s+integrat/i, weight: 3, label: "EHR integration" },
      { pattern: /\bEMR\s+integrat/i, weight: 3, label: "EMR integration" },
      { pattern: /\bhealthcare\s+integrat/i, weight: 2, label: "healthcare integration" },
      { pattern: /\bCerner\b/i, weight: 3, label: "Cerner" },
      { pattern: /\bhealthcare\s+informatics\b/i, weight: 2, label: "healthcare informatics" },
      { pattern: /\bclinical\s+data\s+integrat/i, weight: 2, label: "clinical data integration" },
    ],
    evidencePattern: /\b(Epic|HL7|FHIR|EHR|EMR|Cerner|healthcare\s+integrat|clinical\s+data\s+integrat|healthcare\s+informatics)\b/i,
    threshold: 4,
  },
  {
    name: "construction estimating",
    jobPatterns: [
      { pattern: /\bpreconstruction\b/i, weight: 3, label: "preconstruction" },
      { pattern: /\bquantity\s+(takeoff|survey)\b/i, weight: 3, label: "quantity takeoff" },
      { pattern: /\btakeoff\b/i, weight: 2, label: "takeoff" },
      { pattern: /\bRSMeans\b/i, weight: 3, label: "RSMeans" },
      { pattern: /\bProEst\b/i, weight: 3, label: "ProEst" },
      { pattern: /\bPlanSwift\b/i, weight: 3, label: "PlanSwift" },
      { pattern: /\bconstruction\s+estimat(or|ing|e)\b/i, weight: 3, label: "construction estimating" },
      { pattern: /\bcost\s+estimat(or|ing)\b/i, weight: 2, label: "cost estimating" },
      { pattern: /\bbid\s+preparation\b/i, weight: 3, label: "bid preparation" },
    ],
    evidencePattern: /\b(preconstruction|quantity\s+(takeoff|survey)|takeoff|RSMeans|ProEst|PlanSwift|construction\s+estimat(or|ing|e))\b/i,
    threshold: 4,
  },
];

export function detectExecutionEvidenceGap(
  score: number,
  jobText: string,
  userEvidenceText: string,
): ExecutionEvidenceResult {
  const noTrigger: ExecutionEvidenceResult = {
    triggered: false, categories: [], signals: [],
    missingEvidence: [], cap: null, adjustment: 0, reason: null,
  };

  // Score is already at or below the lowest cap we'd ever apply — skip all checks.
  if (score <= SPECIALIST_CRAFT_CAP) return noTrigger;

  const categories: ExecutionEvidenceCategory[] = [];
  const allSignals: string[] = [];
  const missing: string[] = [];

  // domain_locked, stack_execution, integration_platform, and clearance all cap at
  // EXECUTION_EVIDENCE_CAP (7.0). A score already ≤ 7.0 after prior pipeline
  // adjustments cannot be further reduced by a 7.0 cap — only specialist_craft
  // (cap 5.5) has effect in the 5.5–7.0 range.
  const runHighCapChecks = score > EXECUTION_EVIDENCE_CAP;

  if (runHighCapChecks) {
  // ── Domain-locked ecosystem check ─────────────────────
  for (const eco of DOMAIN_LOCKED_ECOSYSTEMS) {
    let ecoScore = 0;
    const ecoSignals: string[] = [];
    for (const p of eco.jobPatterns) {
      if (p.pattern.test(jobText)) {
        ecoScore += p.weight;
        ecoSignals.push(p.label);
      }
    }
    if (ecoScore >= eco.threshold) {
      // JD requires this ecosystem — check user evidence
      if (!eco.evidencePattern.test(userEvidenceText)) {
        categories.push("domain_locked");
        allSignals.push(...ecoSignals);
        missing.push(`${eco.name} ecosystem`);
      }
    }
  }

  // ── Stack/tool execution check ────────────────────────
  let stackScore = 0;
  const stackSignals: string[] = [];
  for (const p of STACK_EXECUTION_JOB_PATTERNS) {
    if (p.pattern.test(jobText)) {
      stackScore += p.weight;
      stackSignals.push(p.label);
    }
  }
  if (stackScore >= STACK_EXECUTION_THRESHOLD) {
    if (!STACK_EVIDENCE_PATTERN.test(userEvidenceText)) {
      categories.push("stack_execution");
      allSignals.push(...stackSignals);
      missing.push("coding/stack execution evidence");
    }
  }

  // ── Integration platform depth check ─────────────────
  // Fires when JD explicitly requires iPaaS/no-code platform expertise and user lacks it.
  let integrationPlatformScore = 0;
  const integrationPlatformSignals: string[] = [];
  for (const p of INTEGRATION_PLATFORM_JOB_PATTERNS) {
    if (p.pattern.test(jobText)) {
      integrationPlatformScore += p.weight;
      integrationPlatformSignals.push(p.label);
    }
  }
  if (integrationPlatformScore >= INTEGRATION_PLATFORM_THRESHOLD) {
    if (!INTEGRATION_PLATFORM_EVIDENCE_PATTERN.test(userEvidenceText)) {
      categories.push("integration_platform");
      allSignals.push(...integrationPlatformSignals);
      missing.push("integration platform experience");
    }
  }

  // ── Government clearance check ────────────────────────────
  // Fires when JD requires an active security clearance and user lacks clearance evidence.
  let clearanceScore = 0;
  const clearanceSignals: string[] = [];
  for (const p of CLEARANCE_JOB_PATTERNS) {
    if (p.pattern.test(jobText)) {
      clearanceScore += p.weight;
      clearanceSignals.push(p.label);
    }
  }
  if (clearanceScore >= CLEARANCE_THRESHOLD) {
    if (!CLEARANCE_EVIDENCE_PATTERN.test(userEvidenceText)) {
      categories.push("clearance_required");
      allSignals.push(...clearanceSignals);
      missing.push("government security clearance");
    }
  }

  } // end runHighCapChecks

  // ── Specialist craft domain check ─────────────────────────────────────────
  // Runs whenever score > SPECIALIST_CRAFT_CAP (5.5), independent of the 7.0
  // gate. Even when prior adjustments have pulled the score into the 5.5–7.0
  // range, a profile lacking direct craft evidence must not exceed 5.5.
  for (const domain of SPECIALIST_CRAFT_DOMAINS) {
    let craftScore = 0;
    const craftSignals: string[] = [];
    for (const p of domain.jobPatterns) {
      if (p.pattern.test(jobText)) {
        craftScore += p.weight;
        craftSignals.push(p.label);
      }
    }
    if (craftScore >= domain.threshold) {
      if (!domain.evidencePattern.test(userEvidenceText)) {
        categories.push("specialist_craft");
        allSignals.push(...craftSignals);
        missing.push(`${domain.name} specialist experience`);
      }
    }
  }

  if (categories.length === 0) return noTrigger;

  // Use a lower cap for specialist craft: domain gap is fundamental, not just a tool gap.
  const cap = categories.includes("specialist_craft") ? SPECIALIST_CRAFT_CAP : EXECUTION_EVIDENCE_CAP;
  const adjustment = round1(cap - score);
  const reason =
    `Execution evidence guardrail: categories=[${categories.join(", ")}], ` +
    `signals=[${allSignals.join(", ")}], ` +
    `missing=[${missing.join(", ")}]. ` +
    `Score capped from ${round1(score)} to ${cap}.`;

  return {
    triggered: true,
    categories,
    signals: allSignals,
    missingEvidence: missing,
    cap,
    adjustment,
    reason,
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

  let postScore = round1(Math.max(0, Math.min(10, preChipScore + chipAdj)));

  // Execution evidence guardrail (final layer — domain/stack evidence check)
  const userEvidenceText = [resumeText || "", ...([1, 3, 4, 5].map(k => promptAnswers[k] || ""))].join("\n");
  const executionEvidence = detectExecutionEvidenceGap(postScore, jobText, userEvidenceText);
  const eeAdj = executionEvidence.adjustment;
  postScore = round1(Math.max(0, Math.min(10, postScore + eeAdj)));

  // Build composite reason
  const reasons: string[] = [];
  if (wmReason) reasons.push(wmReason);
  if (executionIntensity.reason) reasons.push(executionIntensity.reason);
  if (rtReason) reasons.push(rtReason);
  if (chipSuppression.reason) reasons.push(chipSuppression.reason);
  if (executionEvidence.reason) reasons.push(executionEvidence.reason);
  const adjustmentReason = reasons.length > 0 ? reasons.join(" | ") : null;

  return {
    userMode,
    jobMode,
    compatibility,
    executionIntensity,
    roleType,
    chipSuppression,
    executionEvidence,
    preScore: rawScore,
    workModeAdjustment: wmAdj,
    executionIntensityAdjustment: dampedEiAdj,
    chipSuppressionAdjustment: chipAdj,
    executionEvidenceAdjustment: eeAdj,
    roleTypePenalty: dampedRtPenalty,
    postScore,
    adjustmentReason,
  };
}

// ─── Work Reality Summary ───────────────────────────────────
// Generates a 1–2 sentence executive summary of what the job is
// actually about in practice — the dominant operating mode, the
// kind of work the user would live in day-to-day, and why that
// work reality does or does not align with their profile.
//
// Intentionally NOT a fit-arithmetic recap. The score, HRC,
// Supports Fit, and Stretch Factors cover that surface.
// This function answers: "what is the lived work of this role?"

export function generateWorkRealitySummary(wm: WorkModeResult): string {
  const { jobMode, userMode, compatibility, roleType, executionIntensity, executionEvidence } = wm;

  // ── Specialist craft: narrow domain execution ─────────────
  if (executionEvidence.triggered && executionEvidence.categories.includes("specialist_craft")) {
    const domain = executionEvidence.missingEvidence[0]?.replace(" specialist experience", "") ?? "a specialized domain";
    return `This is a narrow specialist execution role centered on ${domain}. The day-to-day requires deep domain-embedded hands-on expertise, not broad systems or problem-solving experience.`;
  }

  // ── Domain-locked platform role ───────────────────────────
  if (executionEvidence.triggered && executionEvidence.categories.includes("domain_locked")) {
    const platform = executionEvidence.missingEvidence[0]?.replace(" ecosystem", "") ?? "a specific platform";
    return `This role is built around deep ${platform} implementation and configuration work. The day-to-day is platform-specific execution within a controlled ecosystem, not cross-domain systems design.`;
  }

  // ── Role type drives primary framing ─────────────────────

  if (roleType === "SYSTEM_SELLER") {
    if (executionIntensity.score >= 6) {
      return "This is a high-volume commercial execution role. The day-to-day centers on outbound prospecting, dialing activity, and pipeline pressure — not building, designing, or problem-solving.";
    }
    if (compatibility === "conflicting") {
      return "This is a commercially driven, pipeline-pressure role. The day-to-day centers on prospecting, objection handling, and closing — not building or designing systems.";
    }
    if (compatibility === "adjacent") {
      return "This role blends relationship management with commercial accountability. Revenue targets and pipeline ownership sit at the center of the work.";
    }
    return "This is a direct commercial execution role. Success depends on prospecting discipline, deal velocity, and consistent closing.";
  }

  if (roleType === "SYSTEM_OPERATOR") {
    if (compatibility === "conflicting") {
      return "This is a coordination and process-execution role. The day-to-day is scheduling, logistics, and operational throughput — not building or designing.";
    }
    if (compatibility === "adjacent") {
      return "This role demands operational discipline and structured process ownership. The work is execution-heavy with a broad coordination surface.";
    }
    return "This is an operational coordination role. The day-to-day is managing workflows, logistics, and cross-functional execution.";
  }

  if (roleType === "SYSTEM_BUILDER") {
    if (executionEvidence.triggered && executionEvidence.categories.includes("stack_execution")) {
      return "This is a hands-on software engineering role. The day-to-day is writing, reviewing, and shipping production code in a specific stack — not generalist systems thinking or product strategy.";
    }
    if (executionEvidence.triggered && executionEvidence.categories.includes("integration_platform")) {
      return "This is a technical integration role with a specific iPaaS or no-code platform at its core. The day-to-day centers on building and maintaining integrations within that platform ecosystem.";
    }
    if (compatibility === "compatible") {
      if (executionIntensity.score >= 6) {
        return "This is a hands-on technical role with a high-output delivery pace. The work centers on building, shipping, and iterating at speed.";
      }
      return "This role centers on building and designing systems. The day-to-day involves meaningful architecture, product development, or technical delivery.";
    }
    if (compatibility === "adjacent") {
      return "This is a technical or product-building role. There is functional overlap with your profile, but some domain or execution context does not map directly to your demonstrated pattern.";
    }
    return "This is a builder or product development role. The work involves system design, technical delivery, and hands-on execution.";
  }

  // ── Fallback: classify by job work mode ───────────────────
  const jMode = jobMode.mode;
  if (jMode === "sales_execution") {
    return "This role is rooted in commercial execution. The dominant work pattern is pipeline management, outbound activity, and revenue generation.";
  }
  if (jMode === "operational_execution") {
    return "This role is rooted in operational execution. The dominant work pattern is process management, coordination, and throughput consistency.";
  }
  if (jMode === "analytical_investigative") {
    return "This role is rooted in analysis and investigation. The dominant work pattern is structured research, threat or data analysis, and evidence-based decision making.";
  }
  if (jMode === "creative_ideation") {
    return "This role is primarily creative in nature. The dominant work pattern is concept development, brand expression, and content or design ideation.";
  }
  if (jMode === "builder_systems") {
    return "This role centers on building and systems thinking. The day-to-day involves design, development, and delivering structured technical or product work.";
  }

  // Final fallback
  const uMode = userMode.mode;
  if (compatibility === "conflicting" && uMode) {
    return "The operating mode this role demands does not closely match your demonstrated work pattern. The day-to-day would require a significant shift in how you spend your time.";
  }
  return "The day-to-day demands of this role center on work that partially overlaps with your demonstrated pattern.";
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
  DOMAIN_LOCKED_ECOSYSTEMS,
  STACK_EXECUTION_JOB_PATTERNS,
  STACK_EXECUTION_THRESHOLD,
  STACK_EVIDENCE_PATTERN,
  INTEGRATION_PLATFORM_JOB_PATTERNS,
  INTEGRATION_PLATFORM_THRESHOLD,
  INTEGRATION_PLATFORM_EVIDENCE_PATTERN,
  CLEARANCE_JOB_PATTERNS,
  CLEARANCE_THRESHOLD,
  CLEARANCE_EVIDENCE_PATTERN,
  EXECUTION_EVIDENCE_CAP,
  SPECIALIST_CRAFT_CAP,
  SPECIALIST_CRAFT_DOMAINS,
  detectExecutionEvidenceGap,
};
