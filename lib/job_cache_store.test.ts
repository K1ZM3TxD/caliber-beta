// lib/job_cache_store.test.ts — Unit tests for job cache store

import { buildCanonicalKey, detectPlatform, buildCachedFitResponse, sortKnownJobs, filterKnownJobs } from "./job_cache_store";
import type { KnownJobEntry } from "./job_cache_store";

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

// ─── buildCachedFitResponse ───────────────────────────────────────────────────

function makeKnownJobEntry(overrides: Partial<KnownJobEntry["scoreCache"]["scorePayload"]> = {}): KnownJobEntry {
  return {
    job: {
      id: "job-1",
      canonicalKey: "linkedin:job:1234567890",
      platform: "linkedin",
      sourceUrl: "https://www.linkedin.com/jobs/view/1234567890/",
      title: "Staff Engineer",
      company: "Acme Corp",
      location: "Remote",
      textWordCount: 400,
      textSource: "sidecard_full",
      createdAt: "2024-01-15T10:00:00.000Z",
      updatedAt: "2024-01-15T10:00:00.000Z",
    },
    scoreCache: {
      id: "cache-1",
      jobId: "job-1",
      sessionId: "sess-abc",
      score: 7.5,
      scorePayload: {
        score: 7.5,
        supportsFit: ["Backend ownership", "Distributed systems exp"],
        stretchFactors: ["Needs staff-level scope examples"],
        hrcBand: "High",
        hrcReason: "Strong technical match, limited scope signals",
        workModeCompat: "compatible",
        roleType: "IC",
        calibrationTitle: "Staff Engineer @ Series B",
        ...overrides,
      },
      scoringModel: "gpt-4o",
      textSource: "sidecard_full",
      scoredAt: "2024-01-15T10:05:00.000Z",
    },
  };
}

describe("buildCachedFitResponse", () => {
  it("maps score correctly", () => {
    const result = buildCachedFitResponse(makeKnownJobEntry());
    expect(result.score_0_to_10).toBe(7.5);
  });

  it("maps supportsFit → supports_fit and stretchFactors → stretch_factors", () => {
    const result = buildCachedFitResponse(makeKnownJobEntry());
    expect(result.supports_fit).toEqual(["Backend ownership", "Distributed systems exp"]);
    expect(result.stretch_factors).toEqual(["Needs staff-level scope examples"]);
  });

  it("maps HRC band and reason", () => {
    const result = buildCachedFitResponse(makeKnownJobEntry());
    expect(result.hiring_reality_check.band).toBe("High");
    expect(result.hiring_reality_check.reason).toBe("Strong technical match, limited scope signals");
    expect(result.hiring_reality_check.execution_evidence_gap).toBeNull();
  });

  it("maps calibration_title", () => {
    const result = buildCachedFitResponse(makeKnownJobEntry());
    expect(result.calibration_title).toBe("Staff Engineer @ Series B");
  });

  it("always sets _fromCache: true", () => {
    const result = buildCachedFitResponse(makeKnownJobEntry());
    expect(result._fromCache).toBe(true);
  });

  it("sets _cachedAt from scoreCache.scoredAt", () => {
    const result = buildCachedFitResponse(makeKnownJobEntry());
    expect(result._cachedAt).toBe("2024-01-15T10:05:00.000Z");
  });

  it("returns empty arrays for nearby_roles and recovery_terms", () => {
    const result = buildCachedFitResponse(makeKnownJobEntry());
    expect(result.nearby_roles).toEqual([]);
    expect(result.recovery_terms).toEqual([]);
  });

  it("returns empty string for bottom_line_2s", () => {
    const result = buildCachedFitResponse(makeKnownJobEntry());
    expect(result.bottom_line_2s).toBe("");
  });

  it("handles null hrcBand gracefully", () => {
    const result = buildCachedFitResponse(makeKnownJobEntry({ hrcBand: null }));
    expect(result.hiring_reality_check.band).toBeNull();
  });

  it("handles empty supportsFit array", () => {
    const result = buildCachedFitResponse(makeKnownJobEntry({ supportsFit: [] }));
    expect(result.supports_fit).toEqual([]);
  });
});

// ─── sortKnownJobs ────────────────────────────────────────────────────────────

function makeEntry(
  id: string,
  score: number,
  scoredAt: string,
  platform: "linkedin" | "indeed" | "web" = "linkedin",
) {
  const base = makeKnownJobEntry({ score });
  return {
    ...base,
    job: { ...base.job, id, canonicalKey: `linkedin:job:${id}`, platform },
    scoreCache: { ...base.scoreCache, score, scoredAt },
  };
}

describe("sortKnownJobs", () => {
  const entries = [
    makeEntry("a", 6.0, "2024-01-15T10:00:00.000Z"),
    makeEntry("b", 9.0, "2024-01-13T10:00:00.000Z"),
    makeEntry("c", 7.5, "2024-01-14T10:00:00.000Z"),
  ];

  it("sort=date returns most-recently-scored first", () => {
    const result = sortKnownJobs(entries, "date");
    expect(result.map((e) => e.job.id)).toEqual(["a", "c", "b"]);
  });

  it("sort=score returns highest score first", () => {
    const result = sortKnownJobs(entries, "score");
    expect(result.map((e) => e.job.id)).toEqual(["b", "c", "a"]);
  });

  it("does not mutate the input array", () => {
    const original = [...entries];
    sortKnownJobs(entries, "score");
    expect(entries).toEqual(original);
  });

  it("handles single-element array for both sorts", () => {
    const single = [makeEntry("x", 8.0, "2024-01-10T00:00:00.000Z")];
    expect(sortKnownJobs(single, "date")).toHaveLength(1);
    expect(sortKnownJobs(single, "score")).toHaveLength(1);
  });

  it("handles empty array", () => {
    expect(sortKnownJobs([], "score")).toEqual([]);
    expect(sortKnownJobs([], "date")).toEqual([]);
  });
});

// ─── filterKnownJobs ──────────────────────────────────────────────────────────

describe("filterKnownJobs", () => {
  const entries = [
    makeEntry("li-1", 8.5, "2024-01-15T10:00:00.000Z", "linkedin"),
    makeEntry("li-2", 5.5, "2024-01-14T10:00:00.000Z", "linkedin"),
    makeEntry("in-1", 7.2, "2024-01-13T10:00:00.000Z", "indeed"),
    makeEntry("in-2", 4.0, "2024-01-12T10:00:00.000Z", "indeed"),
    makeEntry("web-1", 6.8, "2024-01-11T10:00:00.000Z", "web"),
  ];

  it('platform="all" returns all entries', () => {
    expect(filterKnownJobs(entries, "all", 0)).toHaveLength(5);
  });

  it('platform="linkedin" filters to LinkedIn only', () => {
    const result = filterKnownJobs(entries, "linkedin", 0);
    expect(result.map((e) => e.job.id)).toEqual(["li-1", "li-2"]);
  });

  it('platform="indeed" filters to Indeed only', () => {
    const result = filterKnownJobs(entries, "indeed", 0);
    expect(result.map((e) => e.job.id)).toEqual(["in-1", "in-2"]);
  });

  it('platform="web" filters to web only', () => {
    const result = filterKnownJobs(entries, "web", 0);
    expect(result.map((e) => e.job.id)).toEqual(["web-1"]);
  });

  it("minScore=7.0 returns only strong matches", () => {
    const result = filterKnownJobs(entries, "all", 7.0);
    expect(result.map((e) => e.job.id)).toEqual(["li-1", "in-1"]);
  });

  it("platform + minScore combined filter works correctly", () => {
    const result = filterKnownJobs(entries, "linkedin", 7.0);
    expect(result.map((e) => e.job.id)).toEqual(["li-1"]);
  });

  it("minScore=0 returns all (no score restriction)", () => {
    expect(filterKnownJobs(entries, "all", 0)).toHaveLength(5);
  });

  it("minScore exactly at boundary includes the entry", () => {
    const result = filterKnownJobs(entries, "all", 7.2);
    expect(result.some((e) => e.job.id === "in-1")).toBe(true);
  });

  it("returns empty array when no entries match", () => {
    expect(filterKnownJobs(entries, "all", 10.0)).toEqual([]);
  });

  it("does not mutate input array", () => {
    const original = [...entries];
    filterKnownJobs(entries, "linkedin", 7.0);
    expect(entries).toEqual(original);
  });
});
