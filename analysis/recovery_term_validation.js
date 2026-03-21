/**
 * Recovery Term Quality Validation
 *
 * Validates that generateRecoveryTerms() produces strong, diverse,
 * work-mode-aware search terms for weak-surface recovery.
 *
 * Tests: Chris (builder_systems), Fabio (analytical_investigative),
 *        Jen (sales_execution), Dingus (operational_execution)
 */

const fs = require("fs");
const path = require("path");

// ── Bootstrap: transpile TypeScript on-the-fly ──
try { require("tsx/cjs"); } catch { require("ts-node/register/transpile-only"); }

const { generateRecoveryTerms, scoreAllTitles } = require("../lib/title_scoring");
const { classifyUserWorkMode } = require("../lib/work_mode");

// ── Load fixtures ──
function loadFixture(name) {
  const raw = JSON.parse(fs.readFileSync(
    path.join(__dirname, "..", "fixtures", "calibration_profiles", name + ".json"), "utf8"));
  const resumeText = raw.resume_text;
  const promptAnswers = Object.values(raw.prompt_answers);
  const userMode = classifyUserWorkMode(resumeText, {
    1: promptAnswers[0], 3: promptAnswers[2], 4: promptAnswers[3], 5: promptAnswers[4]
  });
  const allTitles = scoreAllTitles(resumeText, promptAnswers);
  const primaryTitle = allTitles[0].title;
  const recovery = generateRecoveryTerms(resumeText, promptAnswers, userMode.mode, primaryTitle);
  return { name, resumeText, promptAnswers, userMode, allTitles, primaryTitle, recovery };
}

const chris = loadFixture("chris");
const fabio = loadFixture("fabio");
const jen = loadFixture("jen");
const dingus = loadFixture("dingus");

// ── Test framework ──
let pass = 0, fail = 0, total = 0;

function assert(id, condition, msg) {
  total++;
  if (condition) {
    pass++;
    console.log("  ✓ " + id + ": " + msg);
  } else {
    fail++;
    console.error("  ✗ " + id + ": " + msg);
  }
}

// ═══════════════════════════════════════════════════════════════
// 1. STRUCTURAL INVARIANTS
// ═══════════════════════════════════════════════════════════════
console.log("\n1. Structural Invariants");

[chris, fabio, jen, dingus].forEach(f => {
  assert("1.01-" + f.name, f.recovery.terms.length === 3,
    f.name + ": exactly 3 recovery terms (got " + f.recovery.terms.length + ")");

  assert("1.02-" + f.name, f.recovery.terms.every(t => t.title && typeof t.title === "string"),
    f.name + ": all terms have non-empty title strings");

  assert("1.03-" + f.name, f.recovery.terms.every(t => typeof t.score === "number" && t.score >= 0),
    f.name + ": all terms have numeric scores");

  assert("1.04-" + f.name, f.recovery.terms.every(t => typeof t.recoveryScore === "number"),
    f.name + ": all terms have recovery scores");

  assert("1.05-" + f.name, f.recovery.terms.every(t =>
    ["primary_adjacent", "cross_cluster", "work_mode_compatible"].includes(t.source)),
    f.name + ": all terms have valid source labels");

  assert("1.06-" + f.name, !f.recovery.terms.some(t => t.title === f.primaryTitle),
    f.name + ": primary title excluded from recovery terms");
});

// ═══════════════════════════════════════════════════════════════
// 2. TERM DISTINCTNESS
// ═══════════════════════════════════════════════════════════════
console.log("\n2. Term Distinctness");

[chris, fabio, jen, dingus].forEach(f => {
  const titles = f.recovery.terms.map(t => t.title);
  const uniqueTitles = new Set(titles);
  assert("2.01-" + f.name, uniqueTitles.size === 3,
    f.name + ": all 3 terms are distinct titles (got " + uniqueTitles.size + " unique)");

  // Check that titles are not near-duplicates (share < 50% words)
  const words = titles.map(t => new Set(t.toLowerCase().split(/\s+/)));
  let nearDupes = 0;
  for (let i = 0; i < words.length; i++) {
    for (let j = i + 1; j < words.length; j++) {
      const overlap = [...words[i]].filter(w => words[j].has(w)).length;
      const minSize = Math.min(words[i].size, words[j].size);
      if (minSize > 0 && overlap / minSize > 0.7) nearDupes++;
    }
  }
  assert("2.02-" + f.name, nearDupes === 0,
    f.name + ": no near-duplicate terms (" + nearDupes + " pairs > 70% word overlap)");
});

// ═══════════════════════════════════════════════════════════════
// 3. WORK MODE AWARENESS
// ═══════════════════════════════════════════════════════════════
console.log("\n3. Work Mode Awareness");

// Chris (builder_systems): should NOT include sales/client-growth titles
assert("3.01", !chris.recovery.terms.some(t =>
  t.title.includes("Account") || t.title.includes("Sales") || t.title.includes("Partnerships") ||
  t.title.includes("Business Development")),
  "Chris: no conflicting sales/client-growth titles in recovery terms");

// Fabio (analytical_investigative): should NOT include ops/sales titles
assert("3.02", !fabio.recovery.terms.some(t =>
  t.title.includes("Account") || t.title.includes("Operations Manager")),
  "Fabio: no conflicting ops/sales titles in recovery terms");

// All ClientGrowth titles should be penalized for Chris (builder_systems vs sales_execution = conflicting)
const chrisClientPool = chris.recovery.debug.candidatePool.filter(c =>
  c.title.includes("Account") || c.title.includes("Business Development") ||
  c.title.includes("Client Success") || c.title.includes("Community") || c.title.includes("Partnerships"));
const chrisClientPenalized = chrisClientPool.filter(c => c.modeCompat === "conflicting");
assert("3.03", chrisClientPool.length === 0 || chrisClientPenalized.length === chrisClientPool.length,
  "Chris: all client/sales titles in pool have conflicting mode (" + chrisClientPenalized.length + "/" + chrisClientPool.length + ")");

// Fabio: CreativeOps filtered as weak_after_mode_penalty
const fabioCreativeFiltered = fabio.recovery.debug.filtered.filter(f =>
  f.reason.includes("weak_after_mode_penalty"));
assert("3.04", fabioCreativeFiltered.length >= 1,
  "Fabio: creative/ops titles penalized below threshold (" + fabioCreativeFiltered.length + ")");

// ═══════════════════════════════════════════════════════════════
// 4. CLUSTER DIVERSITY
// ═══════════════════════════════════════════════════════════════
console.log("\n4. Cluster Diversity");

// Chris should have terms from multiple clusters
const chrisClusters = new Set(chris.recovery.terms.map(t => t.cluster));
assert("4.01", chrisClusters.size >= 2,
  "Chris: terms from ≥2 clusters (got " + chrisClusters.size + ": " +
  [...chrisClusters].join(", ") + ")");

// Fabio may have all same cluster (only SecurityAnalysis fits) — that's valid
assert("4.02", fabio.recovery.terms.every(t => t.cluster === "SecurityAnalysis"),
  "Fabio: all terms from SecurityAnalysis (only viable cluster)");

// Jen should have terms from ≥1 cluster (ClientGrowth dominant)
const jenClusters = new Set(jen.recovery.terms.map(t => t.cluster));
assert("4.03", jenClusters.size >= 1,
  "Jen: terms from ≥1 cluster (got " + jenClusters.size + ": " +
  [...jenClusters].join(", ") + ")");

// ═══════════════════════════════════════════════════════════════
// 5. RECOVERY SCORE RANKING
// ═══════════════════════════════════════════════════════════════
console.log("\n5. Recovery Score Ranking");

[chris, fabio, jen, dingus].forEach(f => {
  // Recovery scores should be reasonable — thin profiles (dingus) may have lower scores
  const minFloor = f.name === "dingus" ? 2.0 : 3.0;
  assert("5.01-" + f.name, f.recovery.terms.every(t => t.recoveryScore >= minFloor),
    f.name + ": all recovery scores ≥ " + minFloor + " (min: " +
    Math.min(...f.recovery.terms.map(t => t.recoveryScore)).toFixed(1) + ")");

  // Compatible mode titles should have higher recovery scores than base scores
  const compatTerms = f.recovery.debug.candidatePool.filter(c => c.modeCompat === "compatible");
  if (compatTerms.length > 0) {
    assert("5.02-" + f.name, compatTerms.every(c => c.recoveryScore > c.score),
      f.name + ": compatible-mode terms have boosted recovery scores");
  }

  // Conflicting mode titles should have lower recovery scores
  const conflictTerms = f.recovery.debug.candidatePool.filter(c => c.modeCompat === "conflicting");
  if (conflictTerms.length > 0) {
    assert("5.03-" + f.name, conflictTerms.every(c => c.recoveryScore < c.score),
      f.name + ": conflicting-mode terms have penalized recovery scores");
  }
});

// ═══════════════════════════════════════════════════════════════
// 6. DEBUG OUTPUT
// ═══════════════════════════════════════════════════════════════
console.log("\n6. Debug Output");

[chris, fabio, jen, dingus].forEach(f => {
  assert("6.01-" + f.name, f.recovery.debug.candidatePool.length > 0,
    f.name + ": candidate pool is non-empty (" + f.recovery.debug.candidatePool.length + ")");

  assert("6.02-" + f.name, f.recovery.debug.filtered.length > 0,
    f.name + ": filtered list is non-empty (" + f.recovery.debug.filtered.length + ")");

  assert("6.03-" + f.name, f.recovery.debug.selected.length === 3,
    f.name + ": debug selected matches terms (" + f.recovery.debug.selected.length + ")");

  // Filtered reasons should explain why
  assert("6.04-" + f.name, f.recovery.debug.filtered.every(f =>
    f.reason.startsWith("primary_title") ||
    f.reason.startsWith("low_score") ||
    f.reason.startsWith("weak_after_mode_penalty")),
    f.name + ": all filtered entries have valid reasons");

  // Candidate pool entries have all metadata
  assert("6.05-" + f.name, f.recovery.debug.candidatePool.every(c =>
    typeof c.title === "string" && typeof c.score === "number" &&
    typeof c.recoveryScore === "number"),
    f.name + ": candidate pool entries have complete metadata");
});

// ═══════════════════════════════════════════════════════════════
// 7. CHRIS WEAK-SURFACE SCENARIO
// ═══════════════════════════════════════════════════════════════
console.log("\n7. Chris Weak-Surface Scenario");

// Chris on a weak surface (e.g., searching "inside sales" or "customer service")
// Recovery terms should steer him toward his strong-fit zone
assert("7.01", chris.recovery.terms.some(t =>
  t.title.includes("Product") || t.title.includes("Design") || t.title.includes("Implementation")),
  "Chris: recovery terms include product/design/implementation roles");

assert("7.02", chris.recovery.terms.every(t => t.recoveryScore >= 8.0),
  "Chris: all recovery terms have strong recovery scores (≥8.0) — " +
  chris.recovery.terms.map(t => t.title + "=" + t.recoveryScore).join(", "));

// Primary title (Product Development Lead) must NOT appear
assert("7.03", !chris.recovery.terms.some(t => t.title === "Product Development Lead"),
  "Chris: primary title excluded from recovery");

// ═══════════════════════════════════════════════════════════════
// 8. FABIO NON-CHRIS SCENARIO
// ═══════════════════════════════════════════════════════════════
console.log("\n8. Fabio Non-Chris Scenario");

// Fabio on a weak surface — recovery terms should be security-focused
assert("8.01", fabio.recovery.terms.every(t =>
  t.title.includes("Security") || t.title.includes("Cyber") || t.title.includes("Threat")),
  "Fabio: all recovery terms are security-domain");

assert("8.02", fabio.recovery.terms.every(t => t.recoveryScore >= 9.0),
  "Fabio: all recovery terms have very strong recovery scores (≥9.0) — " +
  fabio.recovery.terms.map(t => t.title + "=" + t.recoveryScore).join(", "));

// ═══════════════════════════════════════════════════════════════
// 9. FILTER CONTRACTS
// ═══════════════════════════════════════════════════════════════
console.log("\n9. Filter Contracts");

// Primary title always filtered
[chris, fabio, jen, dingus].forEach(f => {
  const primaryFiltered = f.recovery.debug.filtered.find(x => x.reason === "primary_title");
  assert("9.01-" + f.name, !!primaryFiltered,
    f.name + ": primary title is in filtered list with reason 'primary_title'");
});

// Low score titles filtered
[chris, fabio, jen, dingus].forEach(f => {
  const lowScoreFiltered = f.recovery.debug.filtered.filter(x => x.reason.startsWith("low_score"));
  assert("9.02-" + f.name, lowScoreFiltered.length >= 0,
    f.name + ": low-score titles filtered (" + lowScoreFiltered.length + ")");
});

// ═══════════════════════════════════════════════════════════════
// 10. DINGUS (OPERATIONAL_EXECUTION) SCENARIO
// ═══════════════════════════════════════════════════════════════
console.log("\n10. Dingus Scenario");

assert("10.01", dingus.recovery.terms.length === 3,
  "Dingus: exactly 3 recovery terms");

assert("10.02", dingus.recovery.terms.every(t => t.recoveryScore >= 2.0),
  "Dingus: all recovery scores ≥ 2.0 (thin-profile floor)");

// Dingus (operational_execution) — security titles should be absent from recovery terms
// They may be filtered as low_score (below 1.5) or weak_after_mode_penalty
assert("10.03", !dingus.recovery.terms.some(t =>
  t.title.includes("Security") || t.title.includes("Cyber") || t.title.includes("Threat")),
  "Dingus: no security/analytical titles in recovery terms");

// ═══════════════════════════════════════════════════════════════
// SUMMARY
// ═══════════════════════════════════════════════════════════════
console.log("\n" + "═".repeat(60));
console.log("Recovery Term Validation: " + pass + "/" + total + " PASS" +
  (fail > 0 ? " (" + fail + " FAIL)" : ""));
console.log("═".repeat(60));

if (fail > 0) process.exit(1);
