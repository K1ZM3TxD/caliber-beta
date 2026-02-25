// scripts/job_ingest_lexical_smoke.ts
// Deterministic lexical coverage tests for job_ingest.ts

import { ingestJob, type JobIngestDimensionKey } from "../lib/job_ingest"

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(`FAIL: ${msg}`)
}

function assertDimensionHasEvidence(
  result: ReturnType<typeof ingestJob>,
  dim: JobIngestDimensionKey,
  minEvidence = 1
): void {
  const evidence = result.dimensionEvidence[dim].evidence
  assert(
    evidence.length >= minEvidence,
    `Expected ${dim} to have at least ${minEvidence} evidence, got ${evidence.length}: ${JSON.stringify(evidence)}`
  )
}

// WillScot-like Portfolio Sales Manager JD excerpt
const WILLSCOT_JD = `
Portfolio Sales Manager

About the Role:
This position is responsible for driving revenue growth across our assigned product lines and territory.
The Portfolio Sales Manager will manage a portfolio of products including modular space solutions,
portable storage, and value-added products and services.

What You'll Be Doing:
- Develop and execute account-specific sales strategies for your assigned territory
- Cross-sell and upsell across the full product portfolio to maximize revenue per account
- Build relationships across vertical markets including construction, education, and healthcare
- Partner with branch teams to ensure seamless customer experience
- Manage and grow relationships with national accounts

Requirements:
- 5+ years of B2B sales experience, preferably in a multi-site or regional capacity
- Experience managing a product portfolio or multiple product lines
- Demonstrated ability to work cross-functionally with operations and branch management
- Track record of quota attainment and revenue growth

Additional duties as required to support team and company objectives.
`

// Enterprise sales JD with clear structure signals
const ENTERPRISE_SALES_JD = `
Enterprise Account Executive

The Enterprise Account Executive is responsible for developing and closing new business
within our enterprise segment. You will manage a territory of Fortune 500 accounts.

Key Responsibilities:
- Develop territory plans for your assigned accounts
- Build and maintain executive relationships across multiple stakeholders
- Drive revenue through consultative selling and portfolio expansion
- Cross-sell complementary solutions to maximize account value

This role operates within our nationwide sales organization supporting regional branch networks.
Thousands of employees across the organization support our customers daily.

Other duties as assigned based on business needs.
`

// Mid-market JD with moderate signals
const MIDMARKET_JD = `
Sales Development Representative

We're scaling our sales team! You will be responsible for generating pipeline
through outbound prospecting.

What you will be doing:
- Execute outbound campaigns across your assigned territory
- Qualify inbound leads and route to Account Executives
- Track metrics in Salesforce and report weekly progress
- Partner with marketing on demand generation initiatives

This is a regional role supporting our multi-location expansion strategy.
`

function testWillScotJD(): void {
  console.log("TEST: WillScot-like JD should pass dimension coverage...")
  
  const result = ingestJob(WILLSCOT_JD)
  
  // Assert all 6 dimensions are covered (no throw)
  assert(result.roleVector.length === 6, "Should produce 6-dim role vector")
  
  // Assert the 3 target dimensions have evidence
  assertDimensionHasEvidence(result, "structuralMaturity")
  assertDimensionHasEvidence(result, "roleAmbiguity")
  assertDimensionHasEvidence(result, "breadthVsDepth")
  
  console.log("  ✓ structuralMaturity evidence:", result.dimensionEvidence.structuralMaturity.evidence)
  console.log("  ✓ roleAmbiguity evidence:", result.dimensionEvidence.roleAmbiguity.evidence)
  console.log("  ✓ breadthVsDepth evidence:", result.dimensionEvidence.breadthVsDepth.evidence)
  
  console.log("OK: WillScot-like JD passed dimension coverage")
}

function testEnterpriseSalesJD(): void {
  console.log("TEST: Enterprise Sales JD should pass dimension coverage...")
  
  const result = ingestJob(ENTERPRISE_SALES_JD)
  
  assert(result.roleVector.length === 6, "Should produce 6-dim role vector")
  
  assertDimensionHasEvidence(result, "structuralMaturity")
  assertDimensionHasEvidence(result, "roleAmbiguity")
  assertDimensionHasEvidence(result, "breadthVsDepth")
  
  console.log("  ✓ structuralMaturity evidence:", result.dimensionEvidence.structuralMaturity.evidence)
  console.log("  ✓ roleAmbiguity evidence:", result.dimensionEvidence.roleAmbiguity.evidence)
  console.log("  ✓ breadthVsDepth evidence:", result.dimensionEvidence.breadthVsDepth.evidence)
  
  console.log("OK: Enterprise Sales JD passed dimension coverage")
}

function testMidMarketJD(): void {
  console.log("TEST: Mid-market JD should pass dimension coverage...")
  
  const result = ingestJob(MIDMARKET_JD)
  
  assert(result.roleVector.length === 6, "Should produce 6-dim role vector")
  
  assertDimensionHasEvidence(result, "structuralMaturity")
  assertDimensionHasEvidence(result, "roleAmbiguity")
  assertDimensionHasEvidence(result, "breadthVsDepth")
  
  console.log("  ✓ structuralMaturity evidence:", result.dimensionEvidence.structuralMaturity.evidence)
  console.log("  ✓ roleAmbiguity evidence:", result.dimensionEvidence.roleAmbiguity.evidence)
  console.log("  ✓ breadthVsDepth evidence:", result.dimensionEvidence.breadthVsDepth.evidence)
  
  console.log("OK: Mid-market JD passed dimension coverage")
}

function testSpecificPatterns(): void {
  console.log("TEST: Specific pattern matches...")
  
  // Test portfolio/territory patterns (breadthVsDepth) - needs all 6 dims
  const portfolioJD = `
    Senior Portfolio Sales Manager
    
    This role manages a product portfolio across multiple territories.
    You will cross-sell and upsell to maximize account value.
    Experience with vertical markets required.
    
    What you'll be doing:
    - Partner with cross-functional stakeholders including sales and marketing
    - Drive revenue growth and pipeline development
    - Report to the Director of Sales
    
    Join our enterprise sales organization.
  `
  const r1 = ingestJob(portfolioJD)
  assertDimensionHasEvidence(r1, "breadthVsDepth")
  console.log("  ✓ Portfolio/territory patterns work:", r1.dimensionEvidence.breadthVsDepth.evidence)
  
  // Test structural maturity patterns - needs all 6 dims
  const structureJD = `
    Regional Sales Representative
    
    Join our nationwide sales organization supporting regional operations.
    This multi-site role supports branch management across locations.
    We have thousands of employees serving customers daily.
    
    Responsibilities include:
    - Manage your territory and product portfolio
    - Manage customer relationships and drive revenue
    - Partner with marketing and cross-functional teams
    - Support sales strategy execution
    
    You will report to the Regional Sales Director.
  `
  const r2 = ingestJob(structureJD)
  assertDimensionHasEvidence(r2, "structuralMaturity")
  console.log("  ✓ Scale/structure patterns work:", r2.dimensionEvidence.structuralMaturity.evidence)
  
  // Test roleAmbiguity patterns - needs all 6 dims
  const ambiguityJD = `
    Account Executive - Enterprise Sales
    
    What you'll be doing:
    - Drive sales results across your assigned territory
    - Partner with internal stakeholders across marketing and product
    - Manage customer relationships to maximize revenue
    
    Additional duties as required based on business needs.
    This position is responsible for overall account growth.
    
    Join our scaling enterprise sales team.
    You will report to the VP of Sales.
  `
  const r3 = ingestJob(ambiguityJD)
  assertDimensionHasEvidence(r3, "roleAmbiguity")
  console.log("  ✓ Role ambiguity patterns work:", r3.dimensionEvidence.roleAmbiguity.evidence)
  
  console.log("OK: Specific pattern tests passed")
}

async function main(): Promise<void> {
  try {
    testWillScotJD()
    testEnterpriseSalesJD()
    testMidMarketJD()
    testSpecificPatterns()
    console.log("\n✅ All job_ingest lexical coverage tests passed")
  } catch (e) {
    console.error(e)
    process.exit(1)
  }
}

main()
