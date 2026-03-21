#!/usr/bin/env node
/**
 * Adjacent Searches Interaction Model — Validation Script
 *
 * Validates the calm-default BST behavior contract:
 * - Exactly 3 suggestions when enough valid terms exist
 * - Section collapsed by default
 * - Pulse/glow only for attention (no auto-expand)
 * - adjacentUserOpened session flag prevents re-pulse after manual open
 * - Debug logging when fewer than 3 valid terms
 * - No popup/banner behavior reintroduced
 * - Session dedup and self-suggestion suppression intact
 *
 * Usage: node analysis/adjacent_interaction_validation.js
 */

const fs = require("fs");
const path = require("path");

let pass = 0;
let fail = 0;
const results = [];

function assert(label, condition, detail) {
  if (condition) {
    pass++;
    results.push({ label, status: "PASS" });
  } else {
    fail++;
    results.push({ label, status: "FAIL", detail });
  }
}

const src = fs.readFileSync(path.join(__dirname, "..", "extension", "content_linkedin.js"), "utf8");

// ═══════════════════════════════════════════════════════════════
// 1. ADJACENT_TARGET_COUNT constant
// ═══════════════════════════════════════════════════════════════

assert(
  "1.01 — ADJACENT_TARGET_COUNT is defined as 3",
  src.includes("var ADJACENT_TARGET_COUNT = 3"),
  "Missing ADJACENT_TARGET_COUNT = 3 constant"
);

// ═══════════════════════════════════════════════════════════════
// 2. getAdjacentSearchTerms targets exactly 3
// ═══════════════════════════════════════════════════════════════

assert(
  "2.01 — getAdjacentSearchTerms caps at ADJACENT_TARGET_COUNT",
  src.includes("terms.slice(0, ADJACENT_TARGET_COUNT)"),
  "Must use ADJACENT_TARGET_COUNT as cap"
);

assert(
  "2.02 — Loop break at ADJACENT_TARGET_COUNT",
  src.includes("terms.length < ADJACENT_TARGET_COUNT"),
  "Nearby roles loop must break at ADJACENT_TARGET_COUNT"
);

assert(
  "2.03 — Self-suggestion suppression intact",
  src.includes('if (normQuery) seen[normQuery] = true'),
  "Current query must still be excluded"
);

assert(
  "2.04 — Session dedup intact (bstSearchedQueries)",
  /getAdjacentSearchTerms[\s\S]*?bstSearchedQueries/.test(src),
  "Already-searched queries must still be excluded"
);

assert(
  "2.05 — Old slice(0, 5) cap removed",
  !src.includes("terms.slice(0, 5)"),
  "Old 5-term cap should be replaced by ADJACENT_TARGET_COUNT"
);

assert(
  "2.06 — Old break at 5 removed",
  !src.includes("terms.length >= 5"),
  "Old 5-term break should be replaced by ADJACENT_TARGET_COUNT"
);

// ═══════════════════════════════════════════════════════════════
// 3. Debug logging for fewer than 3 terms
// ═══════════════════════════════════════════════════════════════

assert(
  "3.01 — Debug log with candidate pool and filter stats",
  src.includes('"[Caliber][Adjacent] term selection: "') &&
  src.includes("selected="),
  "Must log candidate pool stats and filter breakdown"
);

assert(
  "3.02 — Filtered reasons tracked (selfSuppressed)",
  src.includes("filtered.selfSuppressed") && src.includes("selfSuppressed++"),
  "Must track and log self-suppression count"
);

assert(
  "3.03 — Filtered reasons tracked (alreadySearched)",
  src.includes("filtered.alreadySearched") && src.includes("alreadySearched++"),
  "Must track and log already-searched count"
);

assert(
  "3.04 — Filtered reasons tracked (duplicate)",
  src.includes("filtered.duplicate") && src.includes("duplicate++"),
  "Must track and log duplicate count"
);

assert(
  "3.05 — Filtered reasons tracked (sanitizeFail)",
  src.includes("filtered.sanitizeFail") && src.includes("sanitizeFail++"),
  "Must track and log sanitize-fail count"
);

// ═══════════════════════════════════════════════════════════════
// 4. adjacentUserOpened session flag
// ═══════════════════════════════════════════════════════════════

assert(
  "4.01 — adjacentUserOpened variable declared",
  src.includes("var adjacentUserOpened = false"),
  "Missing adjacentUserOpened session flag"
);

assert(
  "4.02 — adjacentUserOpened set on adjacent section toggle click",
  /cb-adjacent-section[\s\S]*?adjacentUserOpened\s*=\s*true/.test(src),
  "Adjacent section toggle must set adjacentUserOpened = true"
);

assert(
  "4.03 — Attention suppressed when adjacentUserOpened",
  /updateAdjacentTermsPulse[\s\S]*?adjacentUserOpened[\s\S]*?shouldHighlight\s*=\s*false/.test(src),
  "Attention function must check adjacentUserOpened and suppress highlight"
);

// ═══════════════════════════════════════════════════════════════
// 5. Section collapsed by default
// ═══════════════════════════════════════════════════════════════

assert(
  "5.01 — Adjacent section is always visible (permanent line item)",
  src.includes('id="cb-adjacent-section">') && !src.includes('id="cb-adjacent-section" style="display:none"'),
  "Section must be always visible in sidecard stack"
);

assert(
  "5.02 — No auto-show/auto-expand in updateAdjacentTermsModule",
  (() => {
    // Extract updateAdjacentTermsModule function body
    const match = src.match(/function updateAdjacentTermsModule\(data\)\s*\{[\s\S]*?\n  \}/);
    if (!match) return false;
    const fnBody = match[0];
    // Must NOT contain any classList.add("cb-open") or style.display = "" for the section
    return !fnBody.includes('classList.add("cb-open")') &&
           !fnBody.includes("section.style.display = \"\"") &&
           !fnBody.includes("section.style.display = ''");
  })(),
  "updateAdjacentTermsModule must never expand the section"
);

assert(
  "5.03 — No auto-show/auto-expand in updateAdjacentTermsPulse",
  (() => {
    const match = src.match(/function updateAdjacentTermsPulse\(\)\s*\{[\s\S]*?\n  \}/);
    if (!match) return false;
    const fnBody = match[0];
    return !fnBody.includes('classList.add("cb-open")') &&
           !fnBody.includes("section.style.display = \"\"") &&
           !fnBody.includes("section.style.display = ''");
  })(),
  "updateAdjacentTermsPulse must never expand the section"
);

// ═══════════════════════════════════════════════════════════════
// 6. Pulse/glow only (no banner/popup)
// ═══════════════════════════════════════════════════════════════

assert(
  "6.01 — showPrescanBSTBanner still disabled",
  (() => {
    const match = src.match(/function showPrescanBSTBanner\([^)]*\)\s*\{[\s\S]*?\n  \}/);
    if (!match) return false;
    const fnBody = match[0];
    // Should have an early return before any banner display logic
    const firstReturn = fnBody.indexOf("return;");
    const firstDisplay = fnBody.indexOf("style.display");
    return firstReturn > 0 && (firstDisplay === -1 || firstReturn < firstDisplay);
  })(),
  "showPrescanBSTBanner must remain disabled with early return"
);

assert(
  "6.02 — Adjacent attention animation is finite (not infinite)",
  src.includes("cb-adjacent-glow") && (() => {
    // Check that the cb-adjacent-attention animation uses finite count
    const attentionMatch = src.match(/cb-adjacent-attention[^}]*animation[^;]*;/);
    return attentionMatch && !attentionMatch[0].includes("infinite");
  })(),
  "Adjacent attention animation must be finite (not infinite loop)"
);

assert(
  "6.03 — Attention class is cb-adjacent-attention (in-stack highlight)",
  src.includes('classList.add("cb-adjacent-attention")'),
  "Attention must use section class, not header badge"
);

// ═══════════════════════════════════════════════════════════════
// 7. No interruptive behavior
// ═══════════════════════════════════════════════════════════════

assert(
  "7.01 — No programmatic .click() on adjacent toggle or badge",
  (() => {
    // Ensure no .click() appears near adjacent/bst-badge code (within 200 chars)
    const adjacentClick = src.match(/cb-adjacent[\s\S]{0,200}\.click\(\)|cb-bst-badge[\s\S]{0,200}\.click\(\)/);
    return !adjacentClick;
  })(),
  "Must not programmatically trigger clicks on adjacent section"
);

assert(
  "7.02 — updateAdjacentTermsModule does not reference adjacentUserOpened to expand",
  (() => {
    const match = src.match(/function updateAdjacentTermsModule\(data\)\s*\{[\s\S]*?\n  \}/);
    if (!match) return false;
    const fnBody = match[0];
    // It should NOT contain any expand logic based on adjacentUserOpened
    return !fnBody.includes('adjSection.classList.add("cb-open")');
  })(),
  "updateAdjacentTermsModule must not auto-expand"
);

// ═══════════════════════════════════════════════════════════════
// 8. Surface change resets section (but NOT adjacentUserOpened)
// ═══════════════════════════════════════════════════════════════

assert(
  "8.01 — Surface change resets adjacent section content and attention",
  src.includes('adjSection.classList.remove("cb-open"') && src.includes('adjBody.innerHTML = ""'),
  "Surface change must clear section content and remove attention class"
);

assert(
  "8.02 — adjacentUserOpened is session-scoped (not reset on surface change)",
  (() => {
    // Confirm adjacentUserOpened is only set to false at declaration
    const resetMatches = src.match(/adjacentUserOpened\s*=\s*false/g);
    // Should only appear once (the declaration)
    return resetMatches && resetMatches.length === 1;
  })(),
  "adjacentUserOpened must not reset on surface change — it's a session flag"
);

// ═══════════════════════════════════════════════════════════════
// 9. Nearby roles access hardening
// ═══════════════════════════════════════════════════════════════

assert(
  "9.01 — tryAdd handles both .title property and plain strings",
  src.includes("nearbyRoles[i].title || nearbyRoles[i]"),
  "tryAdd should handle both object and string nearby_roles entries"
);

// ═══════════════════════════════════════════════════════════════
// 10. updateAdjacentTermsModule renders correct count
// ═══════════════════════════════════════════════════════════════

assert(
  "10.01 — Old displayTerms variable removed",
  (() => {
    const match = src.match(/function updateAdjacentTermsModule\(data\)\s*\{[\s\S]*?\n  \}/);
    if (!match) return false;
    return !match[0].includes("displayTerms");
  })(),
  "Old displayTerms intermediate variable should be removed"
);

assert(
  "10.02 — Iterates terms directly (already capped by getAdjacentSearchTerms)",
  (() => {
    const match = src.match(/function updateAdjacentTermsModule\(data\)\s*\{[\s\S]*?\n  \}/);
    if (!match) return false;
    return match[0].includes("i < terms.length");
  })(),
  "Should iterate terms directly, not a sliced copy"
);

// ═══════════════════════════════════════════════════════════════
// SIMULATION: getAdjacentSearchTerms behavior
// ═══════════════════════════════════════════════════════════════

// Extract and evaluate getAdjacentSearchTerms in an isolated scope
const fnMatch = src.match(/var ADJACENT_TARGET_COUNT = 3;[\s\S]*?function getAdjacentSearchTerms\([^)]*\)\s*\{[\s\S]*?\n  \}/);

if (fnMatch) {
  // Build a testable version
  const testCode = `
    var bstSearchedQueries = {};
    var bstSuggestedTitles = {};
    function sanitizeJobTitle(raw) { return raw ? raw.trim() : ""; }
    ${fnMatch[0]}

    // Test 1: 3 nearby roles + calibration title = exactly 3
    var t1 = getAdjacentSearchTerms("Product Manager", [
      { title: "Program Manager" },
      { title: "Project Manager" },
      { title: "Operations Manager" },
      { title: "Technical PM" }
    ], "", []);
    if (t1.length !== 3) throw new Error("T1: expected 3, got " + t1.length);

    // Test 2: self-suppression (calibration title = current query)
    var t2 = getAdjacentSearchTerms("Product Manager", [
      { title: "Program Manager" },
      { title: "Project Manager" },
      { title: "Operations Manager" }
    ], "Product Manager", []);
    if (t2.length !== 3) throw new Error("T2: expected 3, got " + t2.length);

    // Test 3: only 2 valid terms → returns 2 (not padded)
    var t3 = getAdjacentSearchTerms("Product Manager", [
      { title: "Program Manager" }
    ], "", []);
    if (t3.length !== 2) throw new Error("T3: expected 2, got " + t3.length);

    // Test 4: dedup — duplicate nearby roles
    var t4 = getAdjacentSearchTerms("Product Manager", [
      { title: "Program Manager" },
      { title: "Program Manager" },
      { title: "Project Manager" },
    ], "", []);
    if (t4.length !== 3) throw new Error("T4: expected 3, got " + t4.length);

    // Test 5: already-searched queries filtered
    bstSearchedQueries["program manager"] = true;
    var t5 = getAdjacentSearchTerms("Product Manager", [
      { title: "Program Manager" },
      { title: "Project Manager" },
      { title: "Operations Manager" }
    ], "", []);
    if (t5.length !== 3) throw new Error("T5: expected 3, got " + t5.length);
    if (t5.some(function(t) { return t.title === "Program Manager"; })) throw new Error("T5: Program Manager should be filtered");
    bstSearchedQueries = {};

    // Test 6: empty inputs
    var t6 = getAdjacentSearchTerms("", [], "", []);
    if (t6.length !== 0) throw new Error("T6: expected 0, got " + t6.length);

    // Test 7: handles plain string nearby roles (not objects)
    var t7 = getAdjacentSearchTerms("Product Manager", [
      "Program Manager",
      "Project Manager",
      "Operations Manager"
    ], "", []);
    if (t7.length !== 3) throw new Error("T7: expected 3, got " + t7.length);

    // Test 8: never exceeds 3
    var t8 = getAdjacentSearchTerms("Product Manager", [
      { title: "A" }, { title: "B" }, { title: "C" },
      { title: "D" }, { title: "E" }, { title: "F" }
    ], "", []);
    if (t8.length !== 3) throw new Error("T8: expected 3, got " + t8.length);

    "ALL_SIM_PASS";
  `;

  try {
    const result = eval(testCode);
    assert("SIM.01 — 3 roles + calTitle → exactly 3 terms", true);
    assert("SIM.02 — self-suppression → still 3 (from nearby)", true);
    assert("SIM.03 — only 2 valid → returns 2", true);
    assert("SIM.04 — duplicate nearby deduped → 3", true);
    assert("SIM.05 — already-searched filtered", true);
    assert("SIM.06 — empty inputs → 0 terms", true);
    assert("SIM.07 — plain string nearby roles handled", true);
    assert("SIM.08 — never exceeds 3", true);
  } catch (e) {
    const failedTest = e.message.split(":")[0];
    assert("SIM — getAdjacentSearchTerms simulation", false, e.message);
  }
} else {
  assert("SIM — getAdjacentSearchTerms extractable", false, "Could not extract function for simulation");
}

// ═══════════════════════════════════════════════════════════════
// RESULTS
// ═══════════════════════════════════════════════════════════════

console.log("\n╔══════════════════════════════════════════════════════════════╗");
console.log("║     ADJACENT SEARCHES INTERACTION MODEL — VALIDATION       ║");
console.log("╠══════════════════════════════════════════════════════════════╣");

for (const r of results) {
  const icon = r.status === "PASS" ? "✅" : "❌";
  console.log(`║ ${icon} ${r.label}`);
  if (r.detail) console.log(`║    → ${r.detail}`);
}

console.log("╠══════════════════════════════════════════════════════════════╣");
console.log(`║  TOTAL: ${pass + fail}  |  PASS: ${pass}  |  FAIL: ${fail}`);
console.log("╚══════════════════════════════════════════════════════════════╝");

if (fail > 0) {
  console.log(`\n⚠️  ${fail} assertion(s) FAILED.`);
  process.exit(1);
} else {
  console.log(`\n✅  All ${pass} assertions PASSED — adjacent interaction model validated.`);
}
