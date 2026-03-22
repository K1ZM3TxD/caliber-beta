// analysis/tailor_quality_validation.js
// Deterministic validation of tailor output quality and hallucination guardrails.
// Usage: node analysis/tailor_quality_validation.js
// No external APIs required. Uses fixed fixtures evaluated against inline canned outputs.

'use strict';

// ═══════════════════════════════════════════════════════════════════════════════
// FIXTURES — RESUMES
// ═══════════════════════════════════════════════════════════════════════════════

const RESUME_JEN = `
Jen Smith
Owner/Operator, Platform Sales

- Built and managed a small business focused on customer service and platform-based sales.
- Developed client relationships and managed day-to-day operations to ensure client satisfaction.
- Responsible for sales, marketing, and customer support in SMB-facing roles.
- Applied consultative selling approach to drive repeat business and retention.
`.trim();

const RESUME_ALEX = `
Alex Lee
Retail Sales Associate

- Provided customer service and managed POS transactions in a high-volume retail setting.
- Assisted customers with product selection and resolved service inquiries.
- Maintained store displays and managed inventory restocking.
- No experience in software, SaaS, technical sales, or quota-carrying environments.
`.trim();

// ═══════════════════════════════════════════════════════════════════════════════
// FIXTURES — JOB DEFINITIONS
// ═══════════════════════════════════════════════════════════════════════════════

const JOB_WEAK_JEN = {
  name: 'JEN_WEAK',
  label: 'Jen x SDR @ GrindCo (score 6.3 — weak/adjacent)',
  resume: RESUME_JEN,
  jobTitle: 'Sales Development Representative',
  company: 'GrindCo',
  score: 6.3,
  jd: 'Seeking a high-energy SDR to drive outbound sales. Quota-carrying experience required. Technical sales or SaaS background preferred. CRM proficiency expected.',
  // JD terms present in the resume (safe to echo)
  groundedJdTerms: [],
  // JD terms absent from the resume (forbidden in output)
  forbiddenJdTerms: ['quota', 'SaaS', 'outbound', 'SDR', 'CRM', 'technical sales', 'engineering-driven'],
  // Resume phrases that must survive into tailored output (grounding check)
  requiredGrounding: ['customer service', 'platform', 'client relationship', 'sales'],
};

const JOB_STRONG_JEN = {
  name: 'JEN_STRONG',
  label: 'Jen x Consultative Sales @ TechBridge (score 7.2 — strong)',
  resume: RESUME_JEN,
  jobTitle: 'Consultative Sales Specialist',
  company: 'TechBridge',
  score: 7.2,
  jd: 'Looking for a consultative sales specialist to drive platform adoption among SMB clients. Experience in platform sales and client relationship management required. Owner/operator background is a strong plus.',
  groundedJdTerms: ['consultative', 'platform', 'SMB', 'client relationship', 'owner'],
  forbiddenJdTerms: ['enterprise', 'quota', 'SaaS', 'technical sales', 'engineering-driven'],
  requiredGrounding: ['consultative', 'platform', 'client relationship', 'SMB'],
};

const JOB_WEAK_ALEX = {
  name: 'ALEX_WEAK',
  label: 'Alex x Enterprise SaaS AE @ Cloudify (score 5.8 — weak/mismatched)',
  resume: RESUME_ALEX,
  jobTitle: 'Enterprise SaaS Account Executive',
  company: 'Cloudify',
  score: 5.8,
  jd: 'Seeking an AE to sell SaaS solutions to enterprise clients. Quota-carrying and technical sales background required. Experience with CRM and enterprise software preferred.',
  groundedJdTerms: [],
  forbiddenJdTerms: ['enterprise', 'SaaS', 'quota', 'technical sales', 'CRM', 'account executive'],
  requiredGrounding: ['customer service', 'retail'],
};

// ═══════════════════════════════════════════════════════════════════════════════
// CANNED TAILOR OUTPUTS
// Clean outputs are expected to PASS evaluation.
// Hallucinating outputs are expected to FAIL evaluation (detection test).
// ═══════════════════════════════════════════════════════════════════════════════

// Jen / Weak job — clean, grounded, conservative
const OUTPUT_JEN_WEAK_CLEAN = `
Jen Smith
Owner/Operator, Platform Sales

SUMMARY
Customer-service-focused sales professional with direct experience building a
platform-based sales operation and managing client relationships in SMB markets.
Consistent record of driving repeat business through a consultative approach.

EXPERIENCE
Owner/Operator, Platform Sales
- Built and managed a small business focused on customer service and platform-based sales.
- Developed and maintained client relationships, ensuring day-to-day satisfaction.
- Managed sales, marketing, and customer support functions across all accounts.
- Applied consultative selling to improve client retention and repeat revenue.
`.trim();

// Jen / Weak job — hallucinating: borrows JD vocabulary not in resume
const OUTPUT_JEN_WEAK_HALLUCINATING = `
Jen Smith
SaaS SDR / Outbound Sales

SUMMARY
High-energy SaaS sales professional with quota-carrying experience and expertise in
technical sales and CRM pipeline management. Proven outbound SDR track record.

EXPERIENCE
Owner/Operator, Platform Sales
- Generated $500K ARR through SaaS-based outbound sales using Salesforce CRM.
- Maintained a $1.2M/year quota across engineering-driven CRM enterprise accounts.
- Built and managed an SDR team of 5 using CRM automation and technical sales motions.
`.trim();

// Jen / Strong job — elevated, assertive, grounded
const OUTPUT_JEN_STRONG_CLEAN = `
Jen Smith
Consultative Sales Specialist | Platform Sales

SUMMARY
Consultative sales professional with hands-on experience driving platform adoption
among SMB clients. Owner/operator background in platform-based sales with a proven
record of building lasting client relationships and delivering tailored solutions.

EXPERIENCE
Owner/Operator, Platform Sales
- Drove platform adoption among SMB clients through consultative selling strategies.
- Built and maintained strong client relationships, focusing on retention and satisfaction.
- Managed platform sales, marketing, and customer support as owner/operator.
- Applied consultative approach to align platform capabilities with SMB client needs.
`.trim();

// Alex / Weak job — clean, conservative, stays in lane
const OUTPUT_ALEX_WEAK_CLEAN = `
Alex Lee
Retail Sales Associate

SUMMARY
Customer-focused retail sales professional with direct experience in customer service,
POS transaction management, and product presentation in a high-volume retail environment.

EXPERIENCE
Retail Sales Associate
- Provided customer service and managed POS transactions in a high-volume retail setting.
- Guided customers through product selection and resolved service inquiries efficiently.
- Maintained store displays to support a consistent and positive client experience.
`.trim();

// Alex / Weak job — hallucinating: fabricates SaaS/enterprise background
const OUTPUT_ALEX_WEAK_HALLUCINATING = `
Alex Lee
Enterprise SaaS Account Executive

SUMMARY
Enterprise SaaS account executive with quota-carrying track record and technical
sales expertise. CRM-driven pipeline management and enterprise client management.

EXPERIENCE
Retail Sales Associate
- Managed enterprise SaaS accounts with $750K annual quota achievement.
- Sold complex technical solutions to mid-market and enterprise CRM clients.
- Built outbound pipeline of 40+ enterprise accounts using Salesforce CRM.
`.trim();

// ═══════════════════════════════════════════════════════════════════════════════
// EVALUATION ENGINE
// ═══════════════════════════════════════════════════════════════════════════════

// Patterns signaling fabricated metric claims — applied to all outputs globally.
const FABRICATION_PATTERNS = [
  /\$[\d,]+[KMkBM]?/,                      // dollar amounts: $500K, $1.2M
  /\b\d+[KMB]\s*(ARR|MRR|revenue|quota)/i, // ARR/MRR values
  /\b\d+\s*(SDR|AE|rep)s?\b/i,             // headcount claims: 5 SDRs, 40+ AE
];

/**
 * Guardrail check: returns violations where forbidden terms appear in output
 * but are absent from the source resume. Also detects fabricated metric patterns.
 */
function checkGuardrails(output, resumeText, forbiddenTerms) {
  const violations = [];
  const outputLower = output.toLowerCase();
  const resumeLower = resumeText.toLowerCase();

  for (const term of forbiddenTerms) {
    if (outputLower.includes(term.toLowerCase()) && !resumeLower.includes(term.toLowerCase())) {
      violations.push({ term, reason: 'not grounded in resume' });
    }
  }

  for (const pattern of FABRICATION_PATTERNS) {
    const m = output.match(pattern);
    if (m && !resumeText.match(pattern)) {
      violations.push({ term: m[0], reason: 'fabricated metric/claim' });
    }
  }

  return violations;
}

/**
 * Grounding check: verifies required resume phrases survive into the output.
 */
function checkGrounding(output, requiredGrounding) {
  const outputLower = output.toLowerCase();
  const present = requiredGrounding.filter(p => outputLower.includes(p.toLowerCase()));
  const missing = requiredGrounding.filter(p => !outputLower.includes(p.toLowerCase()));
  return {
    present,
    missing,
    score: requiredGrounding.length > 0 ? present.length / requiredGrounding.length : 1,
  };
}

/**
 * Role alignment: fraction of grounded JD terms (terms present in both JD and resume)
 * that appear in the tailored output. Higher is better for strong-match fixtures.
 */
function computeRoleAlignment(output, groundedJdTerms) {
  if (!groundedJdTerms.length) return { present: [], score: 0, total: 0 };
  const outputLower = output.toLowerCase();
  const present = groundedJdTerms.filter(t => outputLower.includes(t.toLowerCase()));
  return { present, total: groundedJdTerms.length, score: present.length / groundedJdTerms.length };
}

/**
 * Section improvement detection: identifies output sections that contain elevated
 * grounded JD terms (terms present in both resume and job description).
 */
function detectImprovedSections(resumeText, tailoredOutput, groundedJdTerms) {
  if (!groundedJdTerms.length) return [];
  const improved = [];
  const resumeLower = resumeText.toLowerCase();
  for (const section of ['SUMMARY', 'EXPERIENCE', 'SKILLS', 'EDUCATION']) {
    const re = new RegExp(section + '[^\\n]*\\n([\\s\\S]*?)(?=\\n[A-Z]{3,}|$)', 'i');
    const m = tailoredOutput.match(re);
    if (!m) continue;
    const elevated = groundedJdTerms.filter(
      t => m[1].toLowerCase().includes(t.toLowerCase()) && resumeLower.includes(t.toLowerCase())
    );
    if (elevated.length > 0) improved.push({ section, elevatedTerms: elevated });
  }
  return improved;
}

// ═══════════════════════════════════════════════════════════════════════════════
// DISPLAY HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

const BOLD   = '\x1b[1m';
const DIM    = '\x1b[2m';
const GREEN  = '\x1b[32m';
const RED    = '\x1b[31m';
const YELLOW = '\x1b[33m';
const CYAN   = '\x1b[36m';
const RESET  = '\x1b[0m';
const HR     = '\u2500'.repeat(68);

function pass(msg) { console.log('  ' + GREEN + '\u2713 PASS' + RESET + '  ' + msg); }
function fail(msg) { console.log('  ' + RED   + '\u2717 FAIL' + RESET + '  ' + msg); }
function warn(msg) { console.log('  ' + YELLOW + '\u26a0 WARN' + RESET + '  ' + msg); }
function note(msg) { console.log('  ' + CYAN   + '\u2139' + RESET + '       ' + msg); }

// ═══════════════════════════════════════════════════════════════════════════════
// FIXTURE EVALUATOR
// ═══════════════════════════════════════════════════════════════════════════════

function evaluateOutput(fixture, output, expectPass) {
  let passed = 0;
  let failed = 0;

  // 1. Guardrail check
  const violations = checkGuardrails(output, fixture.resume, fixture.forbiddenJdTerms);
  if (violations.length === 0) {
    pass('Guardrails: no forbidden or fabricated terms found');
    passed++;
  } else {
    const detail = violations.map(v => '"' + v.term + '" (' + v.reason + ')').join(', ');
    fail('Guardrails: ' + violations.length + ' violation(s) -> ' + detail);
    failed++;
  }

  // 2. Grounding check
  const grounding = checkGrounding(output, fixture.requiredGrounding);
  const gPct = Math.round(grounding.score * 100);
  if (grounding.score >= 0.6) {
    pass('Grounding: ' + gPct + '% of resume phrases present [' + grounding.present.join(', ') + ']');
    passed++;
  } else {
    fail('Grounding: ' + gPct + '% -- missing: [' + grounding.missing.join(', ') + ']');
    failed++;
  }

  // 3. Unsupported-claims check (subset of guardrail violations: string terms only)
  const unsupported = violations.filter(v => v.reason === 'not grounded in resume').map(v => v.term);
  if (unsupported.length === 0) {
    pass('Unsupported claims: none detected');
    passed++;
  } else {
    fail('Unsupported claims from JD: [' + unsupported.join(', ') + ']');
    failed++;
  }

  // 4. Role-alignment check (strong-match fixtures only)
  let roleAlignmentScore = 0;
  if (fixture.groundedJdTerms.length > 0) {
    const alignment = computeRoleAlignment(output, fixture.groundedJdTerms);
    roleAlignmentScore = alignment.score;
    const aPct = Math.round(alignment.score * 100);
    if (alignment.score >= 0.5) {
      pass('Role alignment: ' + aPct + '% of grounded JD terms present [' + alignment.present.join(', ') + ']');
      passed++;
    } else {
      fail('Role alignment: only ' + aPct + '% -- expected >=50% of grounded terms');
      failed++;
    }
  } else {
    note('Role alignment: N/A -- no grounded JD terms (correct for weak/mismatched fixture)');
  }

  // 5. Section improvement log (informational only)
  const improved = detectImprovedSections(fixture.resume, output, fixture.groundedJdTerms);
  if (improved.length > 0) {
    note('Improved sections: ' + improved.map(s => s.section + ' [+' + s.elevatedTerms.join(', ') + ']').join('; '));
  } else {
    note('Improved sections: none (expected for weak/mismatched role)');
  }

  const passedOverall = failed === 0;
  console.log('');

  if (expectPass === undefined) {
    console.log('  ' + BOLD + (passedOverall ? GREEN + 'PASS' : RED + 'FAIL') + RESET);
  } else {
    const met = passedOverall === expectPass;
    const expected = expectPass ? 'PASS' : 'FAIL';
    const actual   = passedOverall ? 'PASS' : 'FAIL';
    const metStr   = met ? GREEN + 'met' + RESET : RED + 'MISMATCH' + RESET;
    console.log('  ' + BOLD + 'Evaluation result: ' + RESET + actual + '  (expected ' + expected + ': ' + metStr + ')');
  }

  return { passedOverall, roleAlignmentScore };
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════════════

function run() {
  let scenariosPassed = 0;
  let scenariosFailed = 0;
  let jenWeakAlignment  = 0;
  let jenStrongAlignment = 0;

  console.log('');
  console.log(BOLD + 'Tailor Quality Validation' + RESET);
  console.log(DIM  + 'Deterministic fixture-based evaluation -- no external APIs required' + RESET);
  console.log(HR);

  // Run 1: Jen x Weak job, clean output (expect PASS)
  console.log('\n' + BOLD + '[1/5]  ' + JOB_WEAK_JEN.label + RESET);
  console.log(DIM  + '       Output: clean -- expected PASS' + RESET + '\n');
  {
    const r = evaluateOutput(JOB_WEAK_JEN, OUTPUT_JEN_WEAK_CLEAN, true);
    jenWeakAlignment = r.roleAlignmentScore;
    if (r.passedOverall) scenariosPassed++; else scenariosFailed++;
  }

  // Run 2: Jen x Weak job, hallucinating output (expect FAIL -- detection test)
  console.log('\n' + HR);
  console.log('\n' + BOLD + '[2/5]  ' + JOB_WEAK_JEN.label + RESET);
  console.log(DIM  + '       Output: hallucinating -- expected FAIL (detection test)' + RESET + '\n');
  {
    const r = evaluateOutput(JOB_WEAK_JEN, OUTPUT_JEN_WEAK_HALLUCINATING, false);
    // Scenario passes when evaluator correctly detects the bad output
    if (!r.passedOverall) scenariosPassed++; else scenariosFailed++;
  }

  // Run 3: Jen x Strong job, clean elevated output (expect PASS)
  console.log('\n' + HR);
  console.log('\n' + BOLD + '[3/5]  ' + JOB_STRONG_JEN.label + RESET);
  console.log(DIM  + '       Output: clean elevated -- expected PASS' + RESET + '\n');
  {
    const r = evaluateOutput(JOB_STRONG_JEN, OUTPUT_JEN_STRONG_CLEAN, true);
    jenStrongAlignment = r.roleAlignmentScore;
    if (r.passedOverall) scenariosPassed++; else scenariosFailed++;
  }

  // Run 4: Alex x Weak/mismatched job, clean output (expect PASS)
  console.log('\n' + HR);
  console.log('\n' + BOLD + '[4/5]  ' + JOB_WEAK_ALEX.label + RESET);
  console.log(DIM  + '       Output: clean -- expected PASS' + RESET + '\n');
  {
    const r = evaluateOutput(JOB_WEAK_ALEX, OUTPUT_ALEX_WEAK_CLEAN, true);
    if (r.passedOverall) scenariosPassed++; else scenariosFailed++;
  }

  // Run 5: Alex x Weak/mismatched job, hallucinating output (expect FAIL -- detection test)
  console.log('\n' + HR);
  console.log('\n' + BOLD + '[5/5]  ' + JOB_WEAK_ALEX.label + RESET);
  console.log(DIM  + '       Output: hallucinating -- expected FAIL (detection test)' + RESET + '\n');
  {
    const r = evaluateOutput(JOB_WEAK_ALEX, OUTPUT_ALEX_WEAK_HALLUCINATING, false);
    if (!r.passedOverall) scenariosPassed++; else scenariosFailed++;
  }

  // Strength Delta Analysis
  console.log('\n' + HR);
  console.log('\n' + BOLD + 'STRENGTH DELTA ANALYSIS' + RESET);
  console.log(DIM  + 'Measures whether strong-match output is more role-aligned than weak-match output' + RESET + '\n');

  const delta = jenStrongAlignment - jenWeakAlignment;
  console.log('  Jen x Weak  job -- grounded JD term alignment: ' + Math.round(jenWeakAlignment  * 100) + '%');
  console.log('  Jen x Strong job -- grounded JD term alignment: ' + Math.round(jenStrongAlignment * 100) + '%');
  console.log('  Delta: ' + (delta >= 0 ? '+' : '') + Math.round(delta * 100) + 'pp\n');

  if (delta > 0.2) {
    pass('Strength delta >=20pp: strong-match output is meaningfully more role-aligned');
    scenariosPassed++;
  } else if (delta >= 0) {
    warn('Strength delta is low (' + Math.round(delta * 100) + 'pp): marginal improvement only');
  } else {
    fail('Strength delta is negative: weak output scored higher than strong -- check fixture');
    scenariosFailed++;
  }

  // Summary
  console.log('\n' + HR);
  console.log('\n' + BOLD + 'SUMMARY' + RESET);
  console.log('  Fixture evaluations: 5  (3 expect-pass, 2 expect-fail/detection)');
  console.log('  Strength delta check: 1');
  console.log('  Total scenarios:      6\n');
  console.log('  ' + GREEN + 'Passed: ' + scenariosPassed + RESET);
  console.log('  ' + (scenariosFailed > 0 ? RED : '') + 'Failed: ' + scenariosFailed + RESET);
  console.log('');

  if (scenariosFailed === 0) {
    console.log('  ' + BOLD + GREEN + '\u2713  ALL SCENARIOS PASSED' + RESET + '\n');
    process.exitCode = 0;
  } else {
    console.log('  ' + BOLD + RED + '\u2717  ' + scenariosFailed + ' SCENARIO(S) FAILED' + RESET + '\n');
    process.exitCode = 1;
  }
}

run();
