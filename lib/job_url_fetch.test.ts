// lib/job_url_fetch.test.ts — Tests for provider-aware job data fetching
//
// Tests cover:
//   - extractJsonLdFromHtml (synchronous, no mocking needed)
//   - fetchJobFromUrl routing (mocked fetch + classification)
//   - Restricted board immediate rejection
//   - ATS API response handling
//   - Unknown URL JSON-LD fallback

import { extractJsonLdFromHtml, fetchJobFromUrl } from "@/lib/job_url_fetch";
import { INGEST_MIN_TEXT_CHARS } from "@/lib/job_ingest_validation";

// ─── extractJsonLdFromHtml ────────────────────────────────────

describe("extractJsonLdFromHtml", () => {
  const minText = "x".repeat(INGEST_MIN_TEXT_CHARS + 10);

  it("extracts a valid JobPosting from JSON-LD", () => {
    const html = `
      <html><head>
        <script type="application/ld+json">
        {
          "@type": "JobPosting",
          "title": "Software Engineer",
          "description": "${minText}",
          "hiringOrganization": { "name": "Acme Inc" },
          "jobLocation": { "address": { "addressLocality": "Austin", "addressRegion": "TX" } }
        }
        </script>
      </head><body></body></html>
    `;
    const result = extractJsonLdFromHtml(html, "https://example.com/jobs/1");
    expect(result).not.toBeNull();
    expect(result!.title).toBe("Software Engineer");
    expect(result!.company).toBe("Acme Inc");
    expect(result!.location).toBe("Austin, TX");
    expect(result!.sourceUrl).toBe("https://example.com/jobs/1");
    expect(result!.jobText.length).toBeGreaterThanOrEqual(INGEST_MIN_TEXT_CHARS);
  });

  it("returns null when no JSON-LD script tags exist", () => {
    const html = "<html><head></head><body>Hello</body></html>";
    expect(extractJsonLdFromHtml(html, "https://example.com")).toBeNull();
  });

  it("returns null when JSON-LD is not a JobPosting", () => {
    const html = `
      <html><head>
        <script type="application/ld+json">
        { "@type": "Organization", "name": "Acme" }
        </script>
      </head></html>
    `;
    expect(extractJsonLdFromHtml(html, "https://example.com")).toBeNull();
  });

  it("returns null when description is too short", () => {
    const html = `
      <html><head>
        <script type="application/ld+json">
        { "@type": "JobPosting", "title": "SWE", "description": "Short." }
        </script>
      </head></html>
    `;
    expect(extractJsonLdFromHtml(html, "https://example.com")).toBeNull();
  });

  it("handles @graph wrapper", () => {
    const html = `
      <html><head>
        <script type="application/ld+json">
        {
          "@graph": [
            { "@type": "WebPage", "name": "Jobs" },
            { "@type": "JobPosting", "title": "PM", "description": "${minText}", "hiringOrganization": "BigCo" }
          ]
        }
        </script>
      </head></html>
    `;
    const result = extractJsonLdFromHtml(html, "https://example.com/pm");
    expect(result).not.toBeNull();
    expect(result!.title).toBe("PM");
    expect(result!.company).toBe("BigCo");
  });

  it("handles array of JSON-LD objects", () => {
    const html = `
      <html><head>
        <script type="application/ld+json">
        [
          { "@type": "Organization", "name": "Acme" },
          { "@type": "JobPosting", "title": "Designer", "description": "${minText}", "hiringOrganization": { "name": "Acme" } }
        ]
        </script>
      </head></html>
    `;
    const result = extractJsonLdFromHtml(html, "https://example.com/d");
    expect(result).not.toBeNull();
    expect(result!.title).toBe("Designer");
  });

  it("strips HTML from description", () => {
    const longDesc = "<p>" + "This is a solid role. ".repeat(20) + "</p>";
    const html = `
      <html><head>
        <script type="application/ld+json">
        { "@type": "JobPosting", "title": "QA", "description": "${longDesc.replace(/"/g, '\\"')}", "hiringOrganization": { "name": "Co" } }
        </script>
      </head></html>
    `;
    const result = extractJsonLdFromHtml(html, "https://example.com/qa");
    expect(result).not.toBeNull();
    expect(result!.jobText).not.toMatch(/<p>/);
  });

  it("skips invalid JSON in ld+json block gracefully", () => {
    const html = `
      <html><head>
        <script type="application/ld+json">{ broken json!! }</script>
        <script type="application/ld+json">
        { "@type": "JobPosting", "title": "BE", "description": "${minText}", "hiringOrganization": { "name": "Co" } }
        </script>
      </head></html>
    `;
    const result = extractJsonLdFromHtml(html, "https://example.com/be");
    expect(result).not.toBeNull();
    expect(result!.title).toBe("BE");
  });

  it("handles missing hiringOrganization", () => {
    const html = `
      <html><head>
        <script type="application/ld+json">
        { "@type": "JobPosting", "title": "Role", "description": "${minText}" }
        </script>
      </head></html>
    `;
    const result = extractJsonLdFromHtml(html, "https://example.com");
    expect(result).not.toBeNull();
    expect(result!.company).toBe("");
  });

  it("uses 'name' field if 'title' is missing", () => {
    const html = `
      <html><head>
        <script type="application/ld+json">
        { "@type": "JobPosting", "name": "Fallback Name", "description": "${minText}", "hiringOrganization": { "name": "Co" } }
        </script>
      </head></html>
    `;
    const result = extractJsonLdFromHtml(html, "https://example.com");
    expect(result).not.toBeNull();
    expect(result!.title).toBe("Fallback Name");
  });
});

// ─── fetchJobFromUrl ──────────────────────────────────────────

describe("fetchJobFromUrl", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("rejects LinkedIn URL immediately without fetch", async () => {
    global.fetch = jest.fn();
    const result = await fetchJobFromUrl("https://www.linkedin.com/jobs/view/12345");
    expect(result.ok).toBe(false);
    expect(result.classification).toMatchObject({ kind: "restricted", provider: "linkedin" });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("rejects Indeed URL immediately without fetch", async () => {
    global.fetch = jest.fn();
    const result = await fetchJobFromUrl("https://www.indeed.com/viewjob?jk=abc");
    expect(result.ok).toBe(false);
    expect(result.classification).toMatchObject({ kind: "restricted", provider: "indeed" });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("fetches from Greenhouse API for greenhouse URLs", async () => {
    const minText = "A".repeat(INGEST_MIN_TEXT_CHARS + 10);
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        title: "SWE",
        company: { name: "Acme" },
        location: { name: "Remote" },
        content: `<p>${minText}</p>`,
      }),
    });

    const result = await fetchJobFromUrl("https://boards.greenhouse.io/acme/jobs/12345");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.title).toBe("SWE");
      expect(result.data.company).toBe("Acme");
      expect(result.data.location).toBe("Remote");
      expect(result.data.fetchSource).toBe("ats_api");
      expect(result.data.providerName).toBe("Greenhouse");
    }
    expect(global.fetch).toHaveBeenCalledTimes(1);
    const calledUrl = (global.fetch as jest.Mock).mock.calls[0][0];
    expect(calledUrl).toContain("boards-api.greenhouse.io");
  });

  it("fetches from Lever API for lever URLs", async () => {
    const minText = "B".repeat(INGEST_MIN_TEXT_CHARS + 10);
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        text: "Product Manager",
        categories: { team: "Growth", location: "NYC" },
        descriptionPlain: minText,
        lists: [],
      }),
    });

    const result = await fetchJobFromUrl("https://jobs.lever.co/acme/abcd1234-ef56-7890-abcd-1234567890ab");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.title).toBe("Product Manager");
      expect(result.data.fetchSource).toBe("ats_api");
      expect(result.data.providerName).toBe("Lever");
    }
  });

  it("handles Greenhouse API returning 404", async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 404 });

    const result = await fetchJobFromUrl("https://boards.greenhouse.io/acme/jobs/99999");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/404/);
      expect(result.retryWithPaste).toBe(true);
    }
  });

  it("handles fetch timeout as abort error", async () => {
    global.fetch = jest.fn().mockRejectedValue(Object.assign(new Error("aborted"), { name: "AbortError" }));

    const result = await fetchJobFromUrl("https://boards.greenhouse.io/acme/jobs/123");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/timed out/i);
      expect(result.retryWithPaste).toBe(true);
    }
  });

  it("attempts JSON-LD extraction for unknown URLs", async () => {
    const minText = "C".repeat(INGEST_MIN_TEXT_CHARS + 10);
    const html = `
      <html><head>
        <script type="application/ld+json">
        { "@type": "JobPosting", "title": "Eng", "description": "${minText}", "hiringOrganization": { "name": "XYZ" } }
        </script>
      </head></html>
    `;
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      headers: new Map([["content-type", "text/html; charset=utf-8"]]) as any,
      text: async () => html,
    });

    const result = await fetchJobFromUrl("https://careers.example.com/jobs/42");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.fetchSource).toBe("jsonld");
      expect(result.data.providerName).toBe("Employer JSON-LD");
      expect(result.data.title).toBe("Eng");
    }
  });

  it("returns error when unknown URL has no JSON-LD", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      headers: new Map([["content-type", "text/html"]]) as any,
      text: async () => "<html><body>No structured data here</body></html>",
    });

    const result = await fetchJobFromUrl("https://careers.example.com/jobs/42");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.retryWithPaste).toBe(true);
    }
  });

  it("handles SmartRecruiters API response", async () => {
    const minText = "D".repeat(INGEST_MIN_TEXT_CHARS + 10);
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        name: "DevOps Engineer",
        company: { name: "MegaCorp" },
        location: { city: "SF", region: "CA", country: "US" },
        jobAd: {
          sections: {
            jobDescription: { text: `<p>${minText}</p>` },
            qualifications: { text: "<p>5 years</p>" },
          },
        },
      }),
    });

    const result = await fetchJobFromUrl("https://jobs.smartrecruiters.com/MegaCorp/12345-devops");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.title).toBe("DevOps Engineer");
      expect(result.data.company).toBe("MegaCorp");
      expect(result.data.location).toBe("SF, CA, US");
      expect(result.data.fetchSource).toBe("ats_api");
      expect(result.data.providerName).toBe("SmartRecruiters");
    }
  });
});
