// lib/hiring_reality_check.ts
// MVP Hiring Reality Check: estimates likelihood of passing employer's initial screening filter.
// Uses weighted requirement categories rather than simple match counting.

export type ScreeningBand = "High" | "Possible" | "Unlikely";

export interface HiringRealityCheckResult {
  band: ScreeningBand;
  reason: string;
}

// ── Requirement extraction helpers ──────────────────────────────────────────

interface ExtractedRequirements {
  hardCredentials: string[];   // licenses, clearances, certifications
  domainRequirements: string[];// specific industry/domain experience
  yearsRequirements: string[]; // years-of-experience mentions
  educationRequirements: string[]; // degree requirements
}

const HARD_CREDENTIAL_PATTERNS: RegExp[] = [
  /\b(?:licensed|license|licensure)\b/i,
  /\b(?:certified|certification|certificate)\b/i,
  /\b(?:clearance|security\s+clearance|ts\/sci|secret\s+clearance|public\s+trust)\b/i,
  /\b(?:CPA|CFA|PMP|PE|RN|LPN|CISSP|CCNA|CCNP|CISM|CISA|AWS\s+Certified|Azure\s+Certified)\b/,
  /\b(?:bar\s+admission|admitted\s+to\s+the\s+bar|JD|Juris\s+Doctor)\b/i,
  /\b(?:board\s+certified|board\s+eligible)\b/i,
  /\b(?:registered\s+nurse|registered\s+dietitian|registered\s+pharmacist)\b/i,
  /\b(?:Series\s+[0-9]+|FINRA)\b/i,
  /\b(?:CDL|commercial\s+driver)\b/i,
];

const DOMAIN_PATTERNS: RegExp[] = [
  /\b(?:healthcare|clinical|medical|pharmaceutical|biotech|life\s*sciences?)\b/i,
  /\b(?:fintech|financial\s+services?|banking|capital\s+markets?|insurance)\b/i,
  /\b(?:defense|aerospace|government|federal|DoD|military)\b/i,
  /\b(?:real\s+estate|construction|manufacturing|supply\s+chain|logistics)\b/i,
  /\b(?:e-?commerce|retail|CPG|consumer\s+packaged\s+goods)\b/i,
  /\b(?:energy|oil\s+and\s+gas|utilities|renewable)\b/i,
  /\b(?:telecom|telecommunications)\b/i,
  /\b(?:legal|law\s+firm|compliance)\b/i,
  /\b(?:education|edtech|higher\s+ed|K-?12)\b/i,
  /\b(?:media|entertainment|gaming|adtech)\b/i,
  /\b(?:cybersecurity|information\s+security|infosec)\b/i,
  /\b(?:SaaS|enterprise\s+software|B2B|cloud\s+platform)\b/i,
];

const YEARS_PATTERN = /(\d+)\+?\s*(?:years?|yrs?)\s+(?:of\s+)?(?:experience|exp)/i;
const YEARS_CONTEXT_PATTERN = /(?:minimum|at\s+least|require[ds]?|must\s+have)\s+(\d+)\+?\s*(?:years?|yrs?)/i;

const EDUCATION_PATTERNS: RegExp[] = [
  /\b(?:bachelor'?s?\s+degree|B\.?S\.?|B\.?A\.?|undergraduate\s+degree)\b/i,
  /\b(?:master'?s?\s+degree|M\.?S\.?|M\.?A\.?|MBA|graduate\s+degree)\b/i,
  /\b(?:Ph\.?D\.?|doctorate|doctoral)\b/i,
  /\b(?:degree\s+(?:in|from)|college\s+degree|university\s+degree)\b/i,
];

function extractRequirements(jobText: string): ExtractedRequirements {
  const hardCredentials: string[] = [];
  const domainRequirements: string[] = [];
  const yearsRequirements: string[] = [];
  const educationRequirements: string[] = [];

  // Focus on requirement-like sections if possible
  const reqSection = extractRequirementSection(jobText);
  const textToScan = reqSection || jobText;

  // Strip benefits sections before domain scanning to prevent false signals
  const textForDomain = stripBenefitsSection(textToScan);

  for (const pat of HARD_CREDENTIAL_PATTERNS) {
    const m = textToScan.match(pat);
    if (m) hardCredentials.push(m[0]);
  }

  for (const pat of DOMAIN_PATTERNS) {
    const m = textForDomain.match(pat);
    if (m) domainRequirements.push(m[0]);
  }

  // Post-filter: if "insurance" matched but every occurrence is benefits context
  // (e.g. "health insurance", "insurance benefits"), remove the false signal
  const insuranceIdx = domainRequirements.findIndex(d => /\binsurance\b/i.test(d));
  if (insuranceIdx >= 0 && isInsuranceBenefitsOnly(textToScan)) {
    domainRequirements.splice(insuranceIdx, 1);
  }

  const yearsMatch = textToScan.match(YEARS_PATTERN) || textToScan.match(YEARS_CONTEXT_PATTERN);
  if (yearsMatch) yearsRequirements.push(yearsMatch[0]);

  for (const pat of EDUCATION_PATTERNS) {
    const m = textToScan.match(pat);
    if (m) educationRequirements.push(m[0]);
  }

  return { hardCredentials, domainRequirements, yearsRequirements, educationRequirements };
}

/** Try to isolate the requirements/qualifications section of the job posting. */
function extractRequirementSection(text: string): string | null {
  const markers = [
    /(?:required|minimum)\s+qualifications/i,
    /qualifications/i,
    /requirements/i,
    /what\s+you(?:'ll)?\s+(?:need|bring)/i,
    /must\s+have/i,
  ];
  for (const marker of markers) {
    const idx = text.search(marker);
    if (idx >= 0) {
      // Take up to ~2000 chars after the marker, truncate at any benefits section
      const chunk = text.slice(idx, idx + 2000);
      return stripBenefitsSection(chunk);
    }
  }
  return null;
}

// ── Benefits section filtering ──────────────────────────────────────────────

const BENEFITS_SECTION_MARKERS: RegExp[] = [
  /\n\s*(?:benefits|employee\s+benefits|our\s+benefits)\s*[:\-\n]/i,
  /\n\s*(?:benefits|perks)\s+(?:and|&)\s+(?:benefits|perks)\s*[:\-\n]/i,
  /\n\s*what\s+we\s+offer\b/i,
  /\n\s*compensation\s+(?:and|&)\s+benefits\b/i,
  /\n\s*total\s+rewards?\b/i,
  /\n\s*why\s+(?:work|join)\b/i,
  /\n\s*we\s+offer\s*[:\-\n]/i,
];

/** Strip benefits/perks section text to prevent false domain signals. */
function stripBenefitsSection(text: string): string {
  let cutIdx = text.length;
  for (const marker of BENEFITS_SECTION_MARKERS) {
    const idx = text.search(marker);
    if (idx > 0 && idx < cutIdx) cutIdx = idx;
  }
  return text.slice(0, cutIdx);
}

/**
 * Check if "insurance" only appears in benefits-related phrases, not as a domain
 * requirement. Catches inline benefits language that survives section stripping.
 */
function isInsuranceBenefitsOnly(text: string): boolean {
  let cleaned = text;
  // Remove benefits-context: "health insurance", "dental insurance", etc.
  cleaned = cleaned.replace(
    /\b(?:health|medical|dental|vision|life|disability|supplemental|voluntary|group|pet)\s+insurance\b/gi, " "
  );
  // Remove benefits-context: "insurance benefits", "insurance coverage", etc.
  cleaned = cleaned.replace(
    /\binsurance\s+(?:benefits?|coverage|plans?|options?|packages?|programs?|polic(?:y|ies)|premiums?|enrollment|provided|included|offered|available)\b/gi, " "
  );
  // If "insurance" no longer appears, every mention was benefits-only
  return !/\binsurance\b/i.test(cleaned);
}

// ── Resume matching ─────────────────────────────────────────────────────────

interface MatchResult {
  hardCredentialsMissing: string[];
  domainMissing: string[];
  yearsGap: boolean;       // true if job requires more years than resume shows
  educationMissing: boolean;
  jobYearsRequired: number | null;
  resumeYearsEstimate: number | null;
}

function matchAgainstResume(reqs: ExtractedRequirements, resumeText: string): MatchResult {
  const resumeLower = resumeText.toLowerCase();

  // Check hard credentials
  const hardCredentialsMissing: string[] = [];
  for (const cred of reqs.hardCredentials) {
    const credLower = cred.toLowerCase();
    // Check if resume contains the credential term (fuzzy: check root words)
    const roots = credLower.split(/\s+/).filter(w => w.length > 3);
    const found = roots.length > 0
      ? roots.some(root => resumeLower.includes(root))
      : resumeLower.includes(credLower);
    if (!found) hardCredentialsMissing.push(cred);
  }

  // Check domain requirements
  const domainMissing: string[] = [];
  for (const domain of reqs.domainRequirements) {
    const domainLower = domain.toLowerCase();
    const roots = domainLower.split(/\s+/).filter(w => w.length > 3);
    const found = roots.length > 0
      ? roots.some(root => resumeLower.includes(root))
      : resumeLower.includes(domainLower);
    if (!found) domainMissing.push(domain);
  }

  // Check years of experience
  let jobYearsRequired: number | null = null;
  for (const yr of reqs.yearsRequirements) {
    const m = yr.match(/(\d+)/);
    if (m) { jobYearsRequired = parseInt(m[1], 10); break; }
  }

  let resumeYearsEstimate: number | null = null;
  // Estimate years from resume date ranges
  const dateMatches = resumeText.match(/\b(19|20)\d{2}\b/g);
  if (dateMatches && dateMatches.length >= 2) {
    const years = dateMatches.map(Number).sort((a, b) => a - b);
    resumeYearsEstimate = years[years.length - 1] - years[0];
  }

  const yearsGap = jobYearsRequired !== null && resumeYearsEstimate !== null
    ? resumeYearsEstimate < jobYearsRequired - 1 // Allow 1 year tolerance
    : false;

  // Check education
  let educationMissing = false;
  if (reqs.educationRequirements.length > 0) {
    // Check for any degree mention in resume
    const hasAnyDegree = EDUCATION_PATTERNS.some(p => p.test(resumeText));
    if (!hasAnyDegree) {
      // Also check for common resume degree formats
      const degreeHints = /\b(?:B\.?S\.?|B\.?A\.?|M\.?S\.?|M\.?A\.?|MBA|Ph\.?D|degree|university|college)\b/i;
      educationMissing = !degreeHints.test(resumeText);
    }
  }

  return { hardCredentialsMissing, domainMissing, yearsGap, educationMissing, jobYearsRequired, resumeYearsEstimate };
}

// ── Scoring ─────────────────────────────────────────────────────────────────

export function computeHiringRealityCheck(jobText: string, resumeText: string): HiringRealityCheckResult {
  if (!jobText || !resumeText) {
    return { band: "Possible", reason: "Insufficient data for screening estimate" };
  }

  const reqs = extractRequirements(jobText);
  const match = matchAgainstResume(reqs, resumeText);

  // Weighted penalty system
  // Hard credentials: 40 pts each missing
  // Domain requirements: 30 pts each missing
  // Years gap: 20 pts
  // Education missing: 10 pts (intentionally low per spec)
  let penalty = 0;
  let topReason = "";

  if (match.hardCredentialsMissing.length > 0) {
    penalty += match.hardCredentialsMissing.length * 40;
    topReason = topReason || `Missing required ${match.hardCredentialsMissing[0].toLowerCase()}`;
  }

  if (match.domainMissing.length > 0) {
    penalty += match.domainMissing.length * 30;
    topReason = topReason || `${match.domainMissing[0]} domain requirement`;
  }

  if (match.yearsGap) {
    penalty += 20;
    topReason = topReason || `Requires ${match.jobYearsRequired}+ years experience`;
  }

  if (match.educationMissing) {
    penalty += 10;
    topReason = topReason || "Education requirement not clearly met";
  }

  // Determine band
  let band: ScreeningBand;
  if (penalty === 0) {
    band = "High";
    topReason = "Most core requirements align";
  } else if (penalty <= 25) {
    band = "Possible";
    topReason = topReason || "Minor gaps in stated requirements";
  } else {
    band = "Unlikely";
    // topReason already set from highest-weight miss
  }

  // Special case: education-only gap should not force Unlikely
  if (penalty > 0 && match.hardCredentialsMissing.length === 0 && match.domainMissing.length === 0 && !match.yearsGap) {
    if (band === "Unlikely") band = "Possible";
  }

  return { band, reason: topReason };
}

// Test-only exports
export const _testing = {
  extractRequirements,
  stripBenefitsSection,
  isInsuranceBenefitsOnly,
};
