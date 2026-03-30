// lib/job_url_provider.test.ts — Tests for provider detection / URL classification

import { classifyProvider, providerLabel } from "@/lib/job_url_provider";
import type { KnownProvider, RestrictedProvider } from "@/lib/job_url_provider";

// ─── classifyProvider ─────────────────────────────────────────

describe("classifyProvider", () => {
  // ── Greenhouse ──────────────────────────────────────────────

  it("detects greenhouse URL", () => {
    const result = classifyProvider("https://boards.greenhouse.io/acme/jobs/12345");
    expect(result).toEqual({
      kind: "ats",
      provider: "greenhouse",
      boardToken: "acme",
      jobId: "12345",
      originalUrl: "https://boards.greenhouse.io/acme/jobs/12345",
    });
  });

  it("detects greenhouse EU URL", () => {
    const result = classifyProvider("https://boards.eu.greenhouse.io/acme/jobs/99999");
    expect(result).toMatchObject({ kind: "ats", provider: "greenhouse", boardToken: "acme", jobId: "99999" });
  });

  it("detects greenhouse URL with query params", () => {
    const result = classifyProvider("https://boards.greenhouse.io/acme/jobs/12345?gh_jid=12345");
    expect(result).toMatchObject({ kind: "ats", provider: "greenhouse", jobId: "12345" });
  });

  // ── Lever ───────────────────────────────────────────────────

  it("detects lever URL", () => {
    const result = classifyProvider("https://jobs.lever.co/acme-corp/abcd1234-ef56-7890-abcd-1234567890ab");
    expect(result).toEqual({
      kind: "ats",
      provider: "lever",
      boardToken: "acme-corp",
      jobId: "abcd1234-ef56-7890-abcd-1234567890ab",
      originalUrl: "https://jobs.lever.co/acme-corp/abcd1234-ef56-7890-abcd-1234567890ab",
    });
  });

  it("detects lever URL with trailing path", () => {
    const result = classifyProvider("https://jobs.lever.co/acme/aabbccdd-1122-3344-5566-778899001122/apply");
    expect(result).toMatchObject({ kind: "ats", provider: "lever" });
  });

  // ── Ashby ───────────────────────────────────────────────────

  it("detects ashby URL", () => {
    const result = classifyProvider("https://jobs.ashbyhq.com/acme/abcdef12-3456-7890-abcd-ef1234567890");
    expect(result).toEqual({
      kind: "ats",
      provider: "ashby",
      boardToken: "acme",
      jobId: "abcdef12-3456-7890-abcd-ef1234567890",
      originalUrl: "https://jobs.ashbyhq.com/acme/abcdef12-3456-7890-abcd-ef1234567890",
    });
  });

  // ── SmartRecruiters ─────────────────────────────────────────

  it("detects smartrecruiters URL", () => {
    const result = classifyProvider("https://jobs.smartrecruiters.com/AcmeCorp/12345-software-engineer");
    expect(result).toEqual({
      kind: "ats",
      provider: "smartrecruiters",
      boardToken: "AcmeCorp",
      jobId: "12345-software-engineer",
      originalUrl: "https://jobs.smartrecruiters.com/AcmeCorp/12345-software-engineer",
    });
  });

  // ── Restricted boards ───────────────────────────────────────

  it("rejects linkedin job URL", () => {
    const result = classifyProvider("https://www.linkedin.com/jobs/view/12345");
    expect(result).toMatchObject({ kind: "restricted", provider: "linkedin" });
    expect((result as any).reason).toMatch(/LinkedIn/);
  });

  it("rejects linkedin URL without www", () => {
    const result = classifyProvider("https://linkedin.com/jobs/view/8888");
    expect(result).toMatchObject({ kind: "restricted", provider: "linkedin" });
  });

  it("rejects indeed URL", () => {
    const result = classifyProvider("https://www.indeed.com/viewjob?jk=abc");
    expect(result).toMatchObject({ kind: "restricted", provider: "indeed" });
    expect((result as any).reason).toMatch(/Indeed/);
  });

  it("rejects indeed country subdomain", () => {
    const result = classifyProvider("https://uk.indeed.co.uk/viewjob?jk=abc");
    expect(result).toMatchObject({ kind: "restricted", provider: "indeed" });
  });

  // ── Unknown URLs ────────────────────────────────────────────

  it("classifies unknown career page as unknown", () => {
    const result = classifyProvider("https://careers.example.com/jobs/123");
    expect(result).toEqual({ kind: "unknown", originalUrl: "https://careers.example.com/jobs/123" });
  });

  it("classifies random URL as unknown", () => {
    const result = classifyProvider("https://example.com/foo");
    expect(result).toEqual({ kind: "unknown", originalUrl: "https://example.com/foo" });
  });

  // ── Edge cases ──────────────────────────────────────────────

  it("trims whitespace", () => {
    const result = classifyProvider("  https://boards.greenhouse.io/acme/jobs/111  ");
    expect(result).toMatchObject({ kind: "ats", provider: "greenhouse", jobId: "111" });
  });

  it("is case-insensitive for domain", () => {
    const result = classifyProvider("https://BOARDS.GREENHOUSE.IO/acme/jobs/111");
    expect(result).toMatchObject({ kind: "ats", provider: "greenhouse" });
  });
});

// ─── providerLabel ────────────────────────────────────────────

describe("providerLabel", () => {
  const cases: [KnownProvider | RestrictedProvider, string][] = [
    ["greenhouse", "Greenhouse"],
    ["lever", "Lever"],
    ["ashby", "Ashby"],
    ["smartrecruiters", "SmartRecruiters"],
    ["linkedin", "LinkedIn"],
    ["indeed", "Indeed"],
  ];

  it.each(cases)("returns '%s' → '%s'", (input, expected) => {
    expect(providerLabel(input)).toBe(expected);
  });
});
