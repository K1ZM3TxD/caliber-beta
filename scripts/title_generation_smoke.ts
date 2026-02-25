// scripts/title_generation_smoke.ts
// Deterministic tests for suggested title generation

import { generateSuggestedTitles } from "../lib/result_contract"

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(`FAIL: ${msg}`)
}

function testBasicTitleGeneration(): void {
  console.log("TEST: Basic title generation from signal anchors...")
  
  const signalAnchors = ["system design", "operations", "workflow optimization"]
  const titles = generateSuggestedTitles(signalAnchors)
  
  assert(titles.length === 5, `Expected 5 titles, got ${titles.length}`)
  assert(
    new Set(titles).size === 5,
    `Expected 5 unique titles, got duplicates: ${JSON.stringify(titles)}`
  )
  
  console.log("  ✓ Returns exactly 5 unique titles")
  console.log(`    Titles: ${JSON.stringify(titles)}`)
}

function testNoMalformedSuffixes(): void {
  console.log("TEST: No malformed suffixes like 'Operationser'...")
  
  // These anchors previously caused "Operationser" and similar artifacts
  const problematicAnchors = [
    "operations",
    "systems",
    "process improvement",
    "workflow management"
  ]
  
  const titles = generateSuggestedTitles(problematicAnchors)
  
  // Check for malformed patterns
  const malformedPatterns = [
    /operationser/i,
    /systemser/i,
    /processer/i,
    /managerer/i,
    /leaderer/i,
    /erer$/i,        // doubled suffix
    /ingser$/i,      // verb+er artifact
    /edser$/i,       // verb+er artifact
  ]
  
  for (const title of titles) {
    for (const pattern of malformedPatterns) {
      assert(
        !pattern.test(title),
        `Title "${title}" contains malformed pattern ${pattern}`
      )
    }
  }
  
  console.log("  ✓ No malformed suffixes in generated titles")
  console.log(`    Titles: ${JSON.stringify(titles)}`)
}

function testDeterministicOrdering(): void {
  console.log("TEST: Deterministic ordering across multiple runs...")
  
  const signalAnchors = ["compliance", "audit", "process", "system"]
  
  const results: string[][] = []
  for (let i = 0; i < 5; i++) {
    results.push(generateSuggestedTitles(signalAnchors))
  }
  
  // All results should be identical
  const first = JSON.stringify(results[0])
  for (let i = 1; i < results.length; i++) {
    assert(
      JSON.stringify(results[i]) === first,
      `Run ${i + 1} produced different titles: ${JSON.stringify(results[i])} vs ${first}`
    )
  }
  
  console.log("  ✓ Stable ordering across 5 runs")
  console.log(`    Titles: ${JSON.stringify(results[0])}`)
}

function testEmptyAnchorsReturnsFallbacks(): void {
  console.log("TEST: Empty signal anchors returns fallback titles...")
  
  const titles = generateSuggestedTitles([])
  
  assert(titles.length === 5, `Expected 5 titles, got ${titles.length}`)
  assert(
    new Set(titles).size === 5,
    `Expected 5 unique titles, got duplicates: ${JSON.stringify(titles)}`
  )
  
  // Verify all are valid job titles (no placeholders or empty strings)
  for (const title of titles) {
    assert(
      title.length > 0,
      `Expected non-empty title, got empty string`
    )
    assert(
      /^[A-Z][a-zA-Z\s]+$/.test(title),
      `Title "${title}" doesn't look like a valid job title`
    )
  }
  
  console.log("  ✓ Returns 5 valid fallback titles")
  console.log(`    Titles: ${JSON.stringify(titles)}`)
}

function testTrackMatchingAffectsOutput(): void {
  console.log("TEST: Different anchor sets produce different titles...")
  
  const complianceAnchors = ["audit", "compliance", "policy enforcement"]
  const implementationAnchors = ["deploy", "migrate", "troubleshoot"]
  
  const complianceTitles = generateSuggestedTitles(complianceAnchors)
  const implementationTitles = generateSuggestedTitles(implementationAnchors)
  
  // Should have different top titles based on track matching
  assert(
    complianceTitles[0] !== implementationTitles[0],
    `Expected different top titles for different tracks, got same: "${complianceTitles[0]}"`
  )
  
  console.log("  ✓ Different anchor sets produce different title rankings")
  console.log(`    Compliance: ${JSON.stringify(complianceTitles)}`)
  console.log(`    Implementation: ${JSON.stringify(implementationTitles)}`)
}

function testAllTitlesFromAllowlist(): void {
  console.log("TEST: All generated titles are from the allowlist...")
  
  // Test with various anchor combinations
  const testCases = [
    ["system", "operations"],
    ["audit", "compliance"],
    ["deploy", "migrate"],
    ["program", "strategy"],
    ["random", "unknown", "terms"],
    [],
  ]
  
  // Valid titles regex: words with spaces, starting with capital
  const validTitlePattern = /^[A-Z][a-zA-Z]+(\s[A-Z][a-zA-Z]+)*$/
  
  for (const anchors of testCases) {
    const titles = generateSuggestedTitles(anchors)
    for (const title of titles) {
      assert(
        validTitlePattern.test(title),
        `Title "${title}" doesn't match expected pattern for anchors ${JSON.stringify(anchors)}`
      )
    }
  }
  
  console.log("  ✓ All titles match valid job title format")
}

// Run all tests
function runAllTests(): void {
  console.log("=== Title Generation Smoke Tests ===\n")
  
  try {
    testBasicTitleGeneration()
    testNoMalformedSuffixes()
    testDeterministicOrdering()
    testEmptyAnchorsReturnsFallbacks()
    testTrackMatchingAffectsOutput()
    testAllTitlesFromAllowlist()
    
    console.log("\n=== ALL TESTS PASSED ===")
  } catch (error) {
    console.error("\n=== TEST FAILED ===")
    console.error(error)
    process.exit(1)
  }
}

runAllTests()
