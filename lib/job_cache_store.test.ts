// lib/job_cache_store.test.ts — Unit tests for job cache store

import { buildCanonicalKey, detectPlatform } from "./job_cache_store";

describe("detectPlatform", () => {
  it("detects linkedin", () => {
    expect(detectPlatform("https://www.linkedin.com/jobs/view/1234567")).toBe("linkedin");
    expect(detectPlatform("https://linkedin.com/jobs/view/1234567")).toBe("linkedin");
  });

  it("detects indeed", () => {
    expect(detectPlatform("https://www.indeed.com/viewjob?jk=abc123")).toBe("indeed");
    expect(detectPlatform("https://indeed.com/viewjob?jk=xyz")).toBe("indeed");
  });

  it("defaults to web", () => {
    expect(detectPlatform("https://jobs.lever.co/company/12345")).toBe("web");
    expect(detectPlatform("https://greenhouse.io/jobs/123")).toBe("web");
  });
});

describe("buildCanonicalKey", () => {
  describe("LinkedIn", () => {
    it("extracts numeric ID from direct /jobs/view/{id} path", () => {
      expect(buildCanonicalKey("https://www.linkedin.com/jobs/view/1234567890/")).toBe(
        "linkedin:job:1234567890"
      );
    });

    it("extracts numeric ID from slug /jobs/view/{slug}-{id}", () => {
      expect(
        buildCanonicalKey("https://www.linkedin.com/jobs/view/senior-engineer-at-acme-1234567890")
      ).toBe("linkedin:job:1234567890");
    });

    it("extracts numeric ID from ?currentJobId param", () => {
      expect(
        buildCanonicalKey(
          "https://www.linkedin.com/jobs/search/?currentJobId=9876543210&keywords=engineer"
        )
      ).toBe("linkedin:job:9876543210");
    });

    it("deduplicate: same job with different URL formats → same key", () => {
      const slug = buildCanonicalKey(
        "https://www.linkedin.com/jobs/view/senior-product-manager-9876543210"
      );
      const direct = buildCanonicalKey(
        "https://www.linkedin.com/jobs/view/9876543210"
      );
      const query = buildCanonicalKey(
        "https://www.linkedin.com/jobs/search/?currentJobId=9876543210"
      );
      expect(slug).toBe(direct);
      expect(slug).toBe(query);
    });
  });

  describe("Indeed", () => {
    it("extracts jk param", () => {
      expect(buildCanonicalKey("https://www.indeed.com/viewjob?jk=abc123def456")).toBe(
        "indeed:job:abc123def456"
      );
    });

    it("extracts vjk param as fallback", () => {
      expect(buildCanonicalKey("https://www.indeed.com/viewjob?vjk=xyz789")).toBe(
        "indeed:job:xyz789"
      );
    });

    it("prefers jk over vjk", () => {
      expect(
        buildCanonicalKey("https://www.indeed.com/viewjob?jk=jk1&vjk=vjk2")
      ).toBe("indeed:job:jk1");
    });

    it("deduplicate: same jk with different qs params → same key", () => {
      const a = buildCanonicalKey("https://www.indeed.com/viewjob?jk=abc123&from=serp");
      const b = buildCanonicalKey("https://www.indeed.com/viewjob?jk=abc123&from=desktop");
      expect(a).toBe(b);
    });
  });

  describe("Generic / web", () => {
    it("strips tracking params", () => {
      const withTracking = buildCanonicalKey(
        "https://jobs.lever.co/acme/123?utm_source=linkedin&utm_medium=job_board"
      );
      const withoutTracking = buildCanonicalKey("https://jobs.lever.co/acme/123");
      expect(withTracking).toBe(withoutTracking);
    });

    it("strips trailing slash", () => {
      const a = buildCanonicalKey("https://greenhouse.io/jobs/123456/");
      const b = buildCanonicalKey("https://greenhouse.io/jobs/123456");
      expect(a).toBe(b);
    });

    it("strips fbclid and gclid", () => {
      const a = buildCanonicalKey(
        "https://jobs.example.com/role?fbclid=abc&gclid=xyz"
      );
      const b = buildCanonicalKey("https://jobs.example.com/role");
      expect(a).toBe(b);
    });

    it("produces url: prefixed key", () => {
      const key = buildCanonicalKey("https://jobs.ashbyhq.com/company/role-id");
      expect(key).toMatch(/^url:/);
    });
  });
});
