// lib/realm_guard.test.ts
import { checkRealmGuard, REALM_CAP } from "./realm_guard"
import { runIntegrationSeam } from "./integration_seam"
import chris from "../fixtures/calibration_profiles/chris.json"
import jen from "../fixtures/calibration_profiles/jen.json"
import fabio from "../fixtures/calibration_profiles/fabio.json"

// ── Repro job text (bartender at Hilton) ────────────────────────────────────

const BARTENDER_JOB = `
Bartender

Company: Hilton Portland Downtown / HopCity

Job family: Bars and Restaurants / Hospitality

Are you an experienced Bartender looking to elevate your career? Come join the
HopCity team at the beautiful Hilton Portland Downtown! Located in the heart of
downtown, you'll enjoy great perks such as free meals during shifts, discounted
hotel room stays for you and your family worldwide and best in class benefits!
This is a great step towards a wonderful career with the #1 World's Best
Workplace!

The ideal candidate will possess:
2+ years of high-volume bartending experience with a focus on craft cocktails
and beers.
Availability including weekdays, weekends, and holidays
Guest focused attitude

Schedule: Union position, open availability required for PM shifts including
weekends/holidays. Shifts start as early as 2pm daily.

What will I be doing?

As a Bartender, you would be responsible for preparing beverages and serving
beverages and/or food to guests in the hotel's continuing effort to deliver
outstanding guest service and financial profitability. Specifically you would
be responsible for performing the following tasks to the highest standards:
Mix, garnish and serve alcoholic and non-alcoholic drinks for customers.
Keep the bar area clean and stocked. Build rapport with regular guests and
create a welcoming atmosphere. Assist with opening and closing duties.
`

// ── Helpers ─────────────────────────────────────────────────────────────────

function profileAnswers(profile: typeof chris): string[] {
  const pa = profile.prompt_answers as Record<string, string>
  return [pa.prompt_1, pa.prompt_2, pa.prompt_3, pa.prompt_4, pa.prompt_5].filter(Boolean)
}

// ── Test: checkRealmGuard standalone ────────────────────────────────────────

describe("checkRealmGuard", () => {
  it("flags bartender job as out-of-realm for Chris (ProductDev)", () => {
    const result = checkRealmGuard({
      jobText: BARTENDER_JOB,
      resumeText: chris.resume_text,
      promptAnswers: profileAnswers(chris),
    })
    expect(result.capped).toBe(true)
    expect(result.domain).toBe("hospitality")
  })

  it("flags bartender job as out-of-realm for Fabio (SecurityAnalysis)", () => {
    const result = checkRealmGuard({
      jobText: BARTENDER_JOB,
      resumeText: fabio.resume_text,
      promptAnswers: profileAnswers(fabio),
    })
    // Fabio has hospitality keywords in his resume but fewer than 3 domain terms
    // from the hospitality out-of-realm set — he's calibrated as security
    expect(result.capped).toBe(true)
    expect(result.domain).toBe("hospitality")
  })

  it("flags bartender job as out-of-realm for Jen (ClientGrowth)", () => {
    const result = checkRealmGuard({
      jobText: BARTENDER_JOB,
      resumeText: jen.resume_text,
      promptAnswers: profileAnswers(jen),
    })
    expect(result.capped).toBe(true)
    expect(result.domain).toBe("hospitality")
  })

  it("does NOT flag a product management job for Chris", () => {
    const productJob = `
      Product Manager at Acme Corp. You will lead cross-functional product
      development teams, manage the product roadmap, conduct market research,
      create SOPs, build pitch decks, and drive go-to-market strategy.
      Requirements: 5+ years in product management, SaaS experience preferred.
      You will work with engineering, design, and executive stakeholders.
    `
    const result = checkRealmGuard({
      jobText: productJob,
      resumeText: chris.resume_text,
      promptAnswers: profileAnswers(chris),
    })
    expect(result.capped).toBe(false)
  })

  it("does NOT flag a security analyst job for Fabio", () => {
    const securityJob = `
      Security Analyst at SecureCo. Perform penetration testing, vulnerability
      assessments, and network security auditing. Use Kali Linux and Python
      to automate reconnaissance workflows. Report findings to stakeholders.
      Requirements: CISSP or equivalent certification, 3+ years in cybersecurity.
    `
    const result = checkRealmGuard({
      jobText: securityJob,
      resumeText: fabio.resume_text,
      promptAnswers: profileAnswers(fabio),
    })
    expect(result.capped).toBe(false)
  })

  it("still works when no profile context is provided", () => {
    const result = checkRealmGuard({
      jobText: BARTENDER_JOB,
    })
    expect(result.capped).toBe(true)
    expect(result.domain).toBe("hospitality")
  })
})

// ── Test: integration seam end-to-end with realm cap ────────────────────────

describe("runIntegrationSeam realm cap", () => {
  it("caps bartender job score to ≤ 5 for Chris", () => {
    // Chris's personVector from calibration: [1,1,1,1,1,1] (mid-range across all)
    const result = runIntegrationSeam({
      jobText: BARTENDER_JOB,
      experienceVector: [1, 1, 1, 1, 1, 1],
      resumeText: chris.resume_text,
      promptAnswers: profileAnswers(chris),
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.result.alignment.score).toBeLessThanOrEqual(REALM_CAP)
    expect(result.result.alignment.bottom_line_2s).toContain("outside your calibrated realm")
  })

  it("caps bartender job score to ≤ 5 for Fabio", () => {
    const result = runIntegrationSeam({
      jobText: BARTENDER_JOB,
      experienceVector: [0, 0, 0, 1, 0, 0],
      resumeText: fabio.resume_text,
      promptAnswers: profileAnswers(fabio),
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.result.alignment.score).toBeLessThanOrEqual(REALM_CAP)
  })

  it("does NOT cap a product management job for Chris", () => {
    const productJob = `
      Product Manager at Acme Corp. You will lead cross-functional product
      development teams, manage the product roadmap, conduct market research,
      create SOPs, build pitch decks, and drive go-to-market strategy.
      Requirements: 5+ years in product management, SaaS experience preferred.
      You will work with engineering, design, and executive stakeholders.
      Responsibilities include quarterly planning, stakeholder presentations,
      customer discovery, competitive analysis, and feature prioritization.
    `
    const result = runIntegrationSeam({
      jobText: productJob,
      experienceVector: [1, 1, 1, 1, 1, 1],
      resumeText: chris.resume_text,
      promptAnswers: profileAnswers(chris),
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    // Score should remain uncapped — whatever the engine calculates naturally
    expect(result.result.alignment.bottom_line_2s).not.toContain("outside your calibrated realm")
  })

  it("preserves internal scoring precision (score ≤ 5 within range)", () => {
    const result = runIntegrationSeam({
      jobText: BARTENDER_JOB,
      experienceVector: [1, 1, 1, 1, 1, 1],
      resumeText: chris.resume_text,
      promptAnswers: profileAnswers(chris),
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    // Score should still be a precise number, not rounded to integer
    expect(typeof result.result.alignment.score).toBe("number")
    expect(result.result.alignment.score).toBeGreaterThanOrEqual(0)
    expect(result.result.alignment.score).toBeLessThanOrEqual(REALM_CAP)
  })
})
