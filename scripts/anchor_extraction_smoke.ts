// scripts/anchor_extraction_smoke.ts
// Deterministic tests for anchor extraction filtering

import { extractLexicalAnchors } from "../lib/anchor_extraction"

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(`FAIL: ${msg}`)
}

function assertNotInAnchors(
  result: ReturnType<typeof extractLexicalAnchors>,
  bannedTerms: string[]
): void {
  const allTerms = result.combined.map(x => x.term)
  for (const banned of bannedTerms) {
    assert(
      !allTerms.includes(banned),
      `Expected "${banned}" to be filtered out, but found in anchors: ${JSON.stringify(allTerms)}`
    )
  }
}

function assertInAnchors(
  result: ReturnType<typeof extractLexicalAnchors>,
  expectedTerms: string[]
): void {
  const allTerms = result.combined.map(x => x.term)
  for (const expected of expectedTerms) {
    assert(
      allTerms.includes(expected),
      `Expected "${expected}" to be in anchors, but not found. Got: ${JSON.stringify(allTerms)}`
    )
  }
}

function testBoilerplateFiltering(): void {
  console.log("TEST: Boilerplate terms should be filtered out...")
  
  const input = {
    resumeText: `
      managed managed managed improved improved routing routing measurement measurement
      business business experience experience university university communication communication
      developed developed maintained maintained building building understanding understanding
    `,
    promptAnswersText: `
      routing measurement improved
    `
  }
  
  const result = extractLexicalAnchors(input)
  
  // These boilerplate terms should be filtered out
  const bannedTerms = [
    "business",
    "experience",
    "university",
    "communication",
    "developed",
    "maintained",
    "building",
    "understanding",
    "managed"
  ]
  
  assertNotInAnchors(result, bannedTerms)
  
  // These specific terms should remain
  assertInAnchors(result, ["routing", "measurement", "improved"])
  
  console.log("  ✓ Boilerplate terms filtered:", bannedTerms.join(", "))
  console.log("  ✓ Specific terms preserved:", result.combined.map(x => x.term).join(", "))
  console.log("OK: Boilerplate filtering works")
}

function testDeterministicOrdering(): void {
  console.log("TEST: Anchor ordering should be deterministic...")
  
  const input = {
    resumeText: `
      optimization optimization optimization
      implementation implementation implementation
      routing routing
      measurement measurement
      segmentation segmentation
    `,
    promptAnswersText: ""
  }
  
  // Run twice to verify determinism
  const result1 = extractLexicalAnchors(input)
  const result2 = extractLexicalAnchors(input)
  
  assert(
    JSON.stringify(result1) === JSON.stringify(result2),
    `Results should be identical across runs`
  )
  
  // Verify ordering: count desc, then term asc
  const terms = result1.combined
  for (let i = 1; i < terms.length; i++) {
    const prev = terms[i - 1]
    const curr = terms[i]
    
    if (prev.count === curr.count) {
      assert(
        prev.term <= curr.term,
        `Terms with same count should be sorted alphabetically: ${prev.term} vs ${curr.term}`
      )
    } else {
      assert(
        prev.count > curr.count,
        `Terms should be sorted by count desc: ${prev.term}(${prev.count}) vs ${curr.term}(${curr.count})`
      )
    }
  }
  
  console.log("  ✓ Ordering is deterministic:", terms.map(x => `${x.term}(${x.count})`).join(", "))
  console.log("OK: Deterministic ordering preserved")
}

function testMinimumCountThreshold(): void {
  console.log("TEST: Terms with count < 2 should be filtered...")
  
  const input = {
    resumeText: `
      optimization optimization optimization
      singleterm
    `,
    promptAnswersText: ""
  }
  
  const result = extractLexicalAnchors(input)
  
  assertInAnchors(result, ["optimization"])
  assertNotInAnchors(result, ["singleterm"])
  
  console.log("  ✓ Count threshold enforced")
  console.log("OK: Minimum count threshold works")
}

function testVerbNounClassification(): void {
  console.log("TEST: Verbs and nouns should be classified correctly...")
  
  const input = {
    resumeText: `
      optimization optimization documentation documentation
      implementing implementing architecting architecting
    `,
    promptAnswersText: ""
  }
  
  const result = extractLexicalAnchors(input)
  
  // Check verbs (end in -ing)
  const verbTerms = result.verbs.map(x => x.term)
  assert(verbTerms.includes("implementing"), "implementing should be a verb")
  assert(verbTerms.includes("architecting"), "architecting should be a verb")
  
  // Check nouns (end in -tion)
  const nounTerms = result.nouns.map(x => x.term)
  assert(nounTerms.includes("optimization"), "optimization should be a noun")
  assert(nounTerms.includes("documentation"), "documentation should be a noun")
  
  console.log("  ✓ Verbs:", verbTerms.join(", "))
  console.log("  ✓ Nouns:", nounTerms.join(", "))
  console.log("OK: Verb/noun classification works")
}

function testRealWorldResume(): void {
  console.log("TEST: Real-world resume excerpt should produce clean anchors...")
  
  const input = {
    resumeText: `
      Senior Software Engineer with 8 years of experience.
      Led cross-functional teams building distributed systems.
      Expert in TypeScript, React, Node.js.
      Strong focus on system architecture and mentoring junior developers.
      Previously worked on payment processing systems at scale.
      
      Education: Stanford University, Computer Science
      
      Skills: Excellent communication, proven leadership, strong understanding
      of business requirements and technical implementation.
    `,
    promptAnswersText: `
      I design systems architecture and lead teams to build scalable distributed solutions.
      I focus on clear ownership, routing decisions, and measurement of outcomes.
    `
  }
  
  const result = extractLexicalAnchors(input)
  const allTerms = result.combined.map(x => x.term)
  
  // These generic terms should NOT appear
  const bannedTerms = [
    "experience",
    "university",
    "communication",
    "understanding",
    "business",
    "building",
    "worked"
  ]
  
  assertNotInAnchors(result, bannedTerms)
  
  console.log("  ✓ Filtered out generic terms")
  console.log("  ✓ Remaining anchors:", allTerms.join(", "))
  console.log("OK: Real-world resume produces clean anchors")
}

function testAllBanlistedTerms(): void {
  console.log("TEST: All explicitly banlisted terms should be filtered...")
  
  // Test a subset of critical banlist terms
  const criticalBanlist = [
    "business", "experience", "university", "communication", "excellence",
    "developed", "maintained", "managed", "managing", "studied", "taking",
    "understanding", "building", "professional", "skills", "team", "project",
    "worked", "working", "company", "organization", "successfully", "achieved"
  ]
  
  // Create input with each term repeated 3 times
  const repeatedTerms = criticalBanlist.map(t => `${t} ${t} ${t}`).join(" ")
  
  const input = {
    resumeText: repeatedTerms,
    promptAnswersText: ""
  }
  
  const result = extractLexicalAnchors(input)
  
  assertNotInAnchors(result, criticalBanlist)
  
  console.log("  ✓ All critical banlist terms filtered:", criticalBanlist.length, "terms")
  console.log("OK: Banlist enforcement complete")
}

async function main(): Promise<void> {
  try {
    testBoilerplateFiltering()
    testDeterministicOrdering()
    testMinimumCountThreshold()
    testVerbNounClassification()
    testRealWorldResume()
    testAllBanlistedTerms()
    console.log("\n✅ All anchor extraction tests passed")
  } catch (e) {
    console.error(e)
    process.exit(1)
  }
}

main()
