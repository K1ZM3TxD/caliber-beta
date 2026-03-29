// lib/job_source_adapter.test.ts — Tests for Job Source Adapter layer
//
// Covers: adapter validation, normalization, provenance attachment,
// canonicalization entry, multi-source convergence into same canonical contract.

import {
  type JobSourceType,
  type TrustLevel,
  type NormalizedJobPayload,
  type CanonicalizationContext,
  sourceTypeToTextSource,
  canonicalizeAndWrite,
  registerAdapter,
  getAdapter,
  getRegisteredSourceTypes,
} from "./job_source_adapter";

import {
  extensionSidecardAdapter,
  extensionPipelineAdapter,
  userImportAdapter,
  atsApiAdapter,
  employerJsonLdAdapter,
  licensedFeedAdapter,
  type ExtensionSidecardRaw,
  type ExtensionPipelineRaw,
  type UserImportRaw,
  type AtsApiRaw,
  type EmployerJsonLdRaw,
  type LicensedFeedRaw,
} from "./job_source_adapters";

// ─── Fixtures ─────────────────────────────────────────────────

const LONG_JOB_TEXT = "A".repeat(250); // well above 200-char gate
const SHORT_JOB_TEXT = "Too short.";

const SAMPLE_LINKEDIN_URL = "https://www.linkedin.com/jobs/view/software-engineer-at-acme-123456789/";
const SAMPLE_INDEED_URL = "https://www.indeed.com/viewjob?jk=abc123def&from=web";
const SAMPLE_GENERIC_URL = "https://careers.example.com/jobs/senior-eng-42";

// ─── Extension Sidecard Adapter ───────────────────────────────

describe("extensionSidecardAdapter", () => {
  it("has correct source metadata", () => {
    expect(extensionSidecardAdapter.sourceType).toBe("extension_sidecard");
    expect(extensionSidecardAdapter.trustLevel).toBe("user_verified");
    expect(extensionSidecardAdapter.defaultRights.canScore).toBe(true);
    expect(extensionSidecardAdapter.defaultRights.canStore).toBe(true);
    expect(extensionSidecardAdapter.defaultRights.canTailor).toBe(true);
  });

  it("validates valid input", () => {
    const raw: ExtensionSidecardRaw = {
      sourceUrl: SAMPLE_LINKEDIN_URL,
      title: "Software Engineer",
      company: "Acme",
      jobText: LONG_JOB_TEXT,
    };
    expect(extensionSidecardAdapter.validate(raw)).toEqual({ ok: true });
  });

  it("rejects missing sourceUrl", () => {
    const raw = { sourceUrl: "", title: "", company: "", jobText: LONG_JOB_TEXT };
    const result = extensionSidecardAdapter.validate(raw);
    expect(result.ok).toBe(false);
  });

  it("rejects short jobText", () => {
    const raw = { sourceUrl: SAMPLE_LINKEDIN_URL, title: "", company: "", jobText: SHORT_JOB_TEXT };
    const result = extensionSidecardAdapter.validate(raw);
    expect(result.ok).toBe(false);
  });

  it("normalizes with provenance", () => {
    const raw: ExtensionSidecardRaw = {
      sourceUrl: SAMPLE_LINKEDIN_URL,
      title: "Software Engineer",
      company: "Acme",
      location: "San Francisco, CA",
      jobText: LONG_JOB_TEXT,
    };
    const payload = extensionSidecardAdapter.normalize(raw);

    expect(payload.sourceUrl).toBe(SAMPLE_LINKEDIN_URL);
    expect(payload.title).toBe("Software Engineer");
    expect(payload.company).toBe("Acme");
    expect(payload.location).toBe("San Francisco, CA");
    expect(payload.jobText).toBe(LONG_JOB_TEXT);
    expect(payload.provenance.sourceType).toBe("extension_sidecard");
    expect(payload.provenance.trustLevel).toBe("user_verified");
    expect(payload.provenance.rights.canScore).toBe(true);
    expect(payload.provenance.acquiredAt).toBeTruthy();
  });
});

// ─── Extension Pipeline Adapter ───────────────────────────────

describe("extensionPipelineAdapter", () => {
  it("has correct source metadata", () => {
    expect(extensionPipelineAdapter.sourceType).toBe("extension_pipeline");
    expect(extensionPipelineAdapter.trustLevel).toBe("user_verified");
  });

  it("validates valid input", () => {
    const raw: ExtensionPipelineRaw = {
      jobUrl: SAMPLE_LINKEDIN_URL,
      jobTitle: "PM",
      company: "Corp",
      jobText: LONG_JOB_TEXT,
    };
    expect(extensionPipelineAdapter.validate(raw)).toEqual({ ok: true });
  });

  it("rejects missing jobUrl", () => {
    const raw = { jobUrl: "", jobTitle: "", company: "", jobText: LONG_JOB_TEXT };
    expect(extensionPipelineAdapter.validate(raw).ok).toBe(false);
  });

  it("normalizes pipeline raw into canonical shape", () => {
    const raw: ExtensionPipelineRaw = {
      jobUrl: SAMPLE_INDEED_URL,
      jobTitle: "Data Analyst",
      company: "DataCo",
      jobText: LONG_JOB_TEXT,
    };
    const payload = extensionPipelineAdapter.normalize(raw);

    expect(payload.sourceUrl).toBe(SAMPLE_INDEED_URL);
    expect(payload.title).toBe("Data Analyst");
    expect(payload.company).toBe("DataCo");
    expect(payload.provenance.sourceType).toBe("extension_pipeline");
  });
});

// ─── User Import Adapter ──────────────────────────────────────

describe("userImportAdapter", () => {
  it("has correct source metadata", () => {
    expect(userImportAdapter.sourceType).toBe("user_import");
    expect(userImportAdapter.trustLevel).toBe("user_verified");
    expect(userImportAdapter.defaultRights.canTailor).toBe(true);
  });

  it("validates valid input", () => {
    const raw: UserImportRaw = { url: SAMPLE_GENERIC_URL, jobText: LONG_JOB_TEXT };
    expect(userImportAdapter.validate(raw)).toEqual({ ok: true });
  });

  it("rejects non-http URL", () => {
    const raw: UserImportRaw = { url: "ftp://files.example.com/job", jobText: LONG_JOB_TEXT };
    const result = userImportAdapter.validate(raw);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain("https://");
  });

  it("rejects invalid URL", () => {
    const raw: UserImportRaw = { url: "not a url", jobText: LONG_JOB_TEXT };
    expect(userImportAdapter.validate(raw).ok).toBe(false);
  });

  it("normalizes user import", () => {
    const raw: UserImportRaw = {
      url: SAMPLE_GENERIC_URL,
      jobText: LONG_JOB_TEXT,
      title: "Senior Eng",
      company: "CoolCo",
    };
    const payload = userImportAdapter.normalize(raw);

    expect(payload.sourceUrl).toBe(SAMPLE_GENERIC_URL);
    expect(payload.title).toBe("Senior Eng");
    expect(payload.provenance.sourceType).toBe("user_import");
    expect(payload.provenance.sourceName).toContain("User Import");
  });
});

// ─── ATS API Adapter ──────────────────────────────────────────

describe("atsApiAdapter", () => {
  it("has api_structured trust level", () => {
    expect(atsApiAdapter.trustLevel).toBe("api_structured");
  });

  it("restricts tailor rights by default", () => {
    expect(atsApiAdapter.defaultRights.canTailor).toBe(false);
    expect(atsApiAdapter.defaultRights.canScore).toBe(true);
    expect(atsApiAdapter.defaultRights.canStore).toBe(true);
  });

  it("validates valid ATS input", () => {
    const raw: AtsApiRaw = {
      apiSource: "lever",
      externalId: "abc-123",
      jobUrl: "https://jobs.lever.co/acme/abc-123",
      title: "Backend Engineer",
      company: "Acme Corp",
      description: LONG_JOB_TEXT,
    };
    expect(atsApiAdapter.validate(raw)).toEqual({ ok: true });
  });

  it("rejects missing apiSource", () => {
    const raw = {
      apiSource: "",
      externalId: "x",
      jobUrl: "https://example.com",
      title: "Eng",
      company: "",
      description: LONG_JOB_TEXT,
    };
    expect(atsApiAdapter.validate(raw).ok).toBe(false);
  });

  it("strips HTML from descriptions", () => {
    const raw: AtsApiRaw = {
      apiSource: "greenhouse",
      externalId: "42",
      jobUrl: "https://boards.greenhouse.io/acme/jobs/42",
      title: "Frontend Engineer",
      company: "Acme",
      description: `<div><p>We are looking for a Frontend Engineer.</p><ul><li>React expertise</li><li>TypeScript ${"experience ".repeat(20)}</li></ul></div>`,
    };
    const payload = atsApiAdapter.normalize(raw);

    expect(payload.jobText).not.toContain("<");
    expect(payload.jobText).toContain("Frontend Engineer");
    expect(payload.provenance.sourceName).toContain("greenhouse");
    expect(payload.provenance.rawRef).toBe("greenhouse:42");
  });
});

// ─── Employer JSON-LD Adapter ─────────────────────────────────

describe("employerJsonLdAdapter", () => {
  it("has api_structured trust level", () => {
    expect(employerJsonLdAdapter.trustLevel).toBe("api_structured");
  });

  it("validates valid JSON-LD input", () => {
    const raw: EmployerJsonLdRaw = {
      pageUrl: "https://careers.megacorp.com/swe",
      jsonLd: {
        "@type": "JobPosting",
        title: "SWE",
        description: LONG_JOB_TEXT,
        hiringOrganization: { name: "MegaCorp" },
      },
    };
    expect(employerJsonLdAdapter.validate(raw)).toEqual({ ok: true });
  });

  it("rejects wrong @type", () => {
    const raw: EmployerJsonLdRaw = {
      pageUrl: "https://example.com",
      jsonLd: { "@type": "Article", description: LONG_JOB_TEXT },
    };
    const result = employerJsonLdAdapter.validate(raw);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain("JobPosting");
  });

  it("normalizes JSON-LD with structured location", () => {
    const raw: EmployerJsonLdRaw = {
      pageUrl: "https://careers.megacorp.com/swe",
      jsonLd: {
        "@type": "JobPosting",
        title: "Software Engineer",
        description: LONG_JOB_TEXT,
        hiringOrganization: { name: "MegaCorp" },
        jobLocation: {
          address: { addressLocality: "Austin", addressRegion: "TX" },
        },
      },
    };
    const payload = employerJsonLdAdapter.normalize(raw);

    expect(payload.title).toBe("Software Engineer");
    expect(payload.company).toBe("MegaCorp");
    expect(payload.location).toBe("Austin, TX");
    expect(payload.provenance.sourceType).toBe("employer_jsonld");
  });

  it("handles string hiringOrganization", () => {
    const raw: EmployerJsonLdRaw = {
      pageUrl: "https://example.com",
      jsonLd: {
        "@type": "JobPosting",
        title: "PM",
        description: LONG_JOB_TEXT,
        hiringOrganization: "SmallCo",
      },
    };
    const payload = employerJsonLdAdapter.normalize(raw);
    expect(payload.company).toBe("SmallCo");
  });
});

// ─── Licensed Feed Adapter ────────────────────────────────────

describe("licensedFeedAdapter", () => {
  it("has feed_unverified trust level", () => {
    expect(licensedFeedAdapter.trustLevel).toBe("feed_unverified");
  });

  it("validates valid feed input", () => {
    const raw: LicensedFeedRaw = {
      feedId: "feed-001",
      feedName: "TechJobs Daily",
      jobUrl: "https://techjobs.example.com/42",
      title: "DevOps Engineer",
      company: "CloudCo",
      description: LONG_JOB_TEXT,
    };
    expect(licensedFeedAdapter.validate(raw)).toEqual({ ok: true });
  });

  it("rejects missing feedId", () => {
    const raw = {
      feedId: "",
      feedName: "X",
      jobUrl: "https://example.com",
      title: "",
      company: "",
      description: LONG_JOB_TEXT,
    };
    expect(licensedFeedAdapter.validate(raw).ok).toBe(false);
  });

  it("normalizes with feed-specific provenance", () => {
    const raw: LicensedFeedRaw = {
      feedId: "feed-001",
      feedName: "TechJobs Daily",
      jobUrl: "https://techjobs.example.com/42",
      title: "DevOps Engineer",
      company: "CloudCo",
      description: `<b>DevOps role</b> requiring ${"Kubernetes and Docker experience ".repeat(8)}`,
    };
    const payload = licensedFeedAdapter.normalize(raw);

    expect(payload.jobText).not.toContain("<b>");
    expect(payload.provenance.sourceName).toContain("TechJobs Daily");
    expect(payload.provenance.rawRef).toBe("feed-001:https://techjobs.example.com/42");
    expect(payload.provenance.trustLevel).toBe("feed_unverified");
  });

  it("allows per-feed rights override", () => {
    const raw: LicensedFeedRaw = {
      feedId: "feed-premium",
      feedName: "Premium Feed",
      jobUrl: "https://premium.example.com/1",
      title: "Eng",
      company: "PremCo",
      description: LONG_JOB_TEXT,
      rights: { canTailor: true },
    };
    const payload = licensedFeedAdapter.normalize(raw);

    // Default canTailor is false, but per-feed override sets it true
    expect(payload.provenance.rights.canTailor).toBe(true);
    // Other defaults preserved
    expect(payload.provenance.rights.canScore).toBe(true);
    expect(payload.provenance.rights.canStore).toBe(true);
  });
});

// ─── Cross-Source Convergence ─────────────────────────────────
// Prove that multiple source types produce the same canonical contract shape.

describe("cross-source canonical convergence", () => {
  const allPayloads: { source: string; payload: NormalizedJobPayload }[] = [];

  beforeAll(() => {
    allPayloads.push({
      source: "extension_sidecard",
      payload: extensionSidecardAdapter.normalize({
        sourceUrl: SAMPLE_LINKEDIN_URL,
        title: "SWE",
        company: "Acme",
        jobText: LONG_JOB_TEXT,
      }),
    });
    allPayloads.push({
      source: "extension_pipeline",
      payload: extensionPipelineAdapter.normalize({
        jobUrl: SAMPLE_LINKEDIN_URL,
        jobTitle: "SWE",
        company: "Acme",
        jobText: LONG_JOB_TEXT,
      }),
    });
    allPayloads.push({
      source: "user_import",
      payload: userImportAdapter.normalize({
        url: SAMPLE_GENERIC_URL,
        jobText: LONG_JOB_TEXT,
        title: "SWE",
        company: "Acme",
      }),
    });
    allPayloads.push({
      source: "ats_api",
      payload: atsApiAdapter.normalize({
        apiSource: "lever",
        externalId: "x1",
        jobUrl: "https://jobs.lever.co/acme/x1",
        title: "SWE",
        company: "Acme",
        description: LONG_JOB_TEXT,
      }),
    });
    allPayloads.push({
      source: "employer_jsonld",
      payload: employerJsonLdAdapter.normalize({
        pageUrl: "https://careers.acme.com/swe",
        jsonLd: {
          "@type": "JobPosting",
          title: "SWE",
          description: LONG_JOB_TEXT,
          hiringOrganization: { name: "Acme" },
        },
      }),
    });
    allPayloads.push({
      source: "licensed_feed",
      payload: licensedFeedAdapter.normalize({
        feedId: "f1",
        feedName: "TestFeed",
        jobUrl: "https://feed.example.com/1",
        title: "SWE",
        company: "Acme",
        description: LONG_JOB_TEXT,
      }),
    });
  });

  it("all payloads have the same structural shape", () => {
    const requiredKeys = ["sourceUrl", "title", "company", "jobText", "provenance"];
    const provenanceKeys = ["sourceType", "sourceName", "trustLevel", "rights", "acquiredAt"];

    for (const { source, payload } of allPayloads) {
      for (const key of requiredKeys) {
        expect(payload).toHaveProperty(key);
      }
      for (const key of provenanceKeys) {
        expect(payload.provenance).toHaveProperty(key);
      }
      // All have string sourceUrl
      expect(typeof payload.sourceUrl).toBe("string");
      // All have string jobText
      expect(typeof payload.jobText).toBe("string");
      // All have valid provenance
      expect(typeof payload.provenance.sourceType).toBe("string");
      expect(typeof payload.provenance.trustLevel).toBe("string");
      expect(typeof payload.provenance.rights.canScore).toBe("boolean");
    }
  });

  it("all six source types are represented", () => {
    const types = allPayloads.map((p) => p.payload.provenance.sourceType);
    expect(types).toContain("extension_sidecard");
    expect(types).toContain("extension_pipeline");
    expect(types).toContain("user_import");
    expect(types).toContain("ats_api");
    expect(types).toContain("employer_jsonld");
    expect(types).toContain("licensed_feed");
  });

  it("trust levels are correctly distributed", () => {
    const byTrust = allPayloads.reduce((acc, { payload }) => {
      acc[payload.provenance.trustLevel] = (acc[payload.provenance.trustLevel] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // 3 user-verified (extension sidecard, pipeline, user import)
    expect(byTrust["user_verified"]).toBe(3);
    // 2 api_structured (ats, jsonld)
    expect(byTrust["api_structured"]).toBe(2);
    // 1 feed_unverified (licensed feed)
    expect(byTrust["feed_unverified"]).toBe(1);
  });
});

// ─── textSource Bridge ────────────────────────────────────────

describe("sourceTypeToTextSource", () => {
  it("maps extension_sidecard to sidecard_full", () => {
    expect(sourceTypeToTextSource("extension_sidecard")).toBe("sidecard_full");
  });

  it("maps extension_pipeline to pipeline_save", () => {
    expect(sourceTypeToTextSource("extension_pipeline")).toBe("pipeline_save");
  });

  it("maps user_import to sidecard_full", () => {
    expect(sourceTypeToTextSource("user_import")).toBe("sidecard_full");
  });

  it("maps ats_api to sidecard_full", () => {
    expect(sourceTypeToTextSource("ats_api")).toBe("sidecard_full");
  });

  it("maps employer_jsonld to sidecard_full", () => {
    expect(sourceTypeToTextSource("employer_jsonld")).toBe("sidecard_full");
  });

  it("maps licensed_feed to sidecard_full", () => {
    expect(sourceTypeToTextSource("licensed_feed")).toBe("sidecard_full");
  });
});

// ─── Adapter Registry ─────────────────────────────────────────

describe("adapter registry", () => {
  it("all six adapters are registered", () => {
    // Adapters registered by module import side-effect
    const types = getRegisteredSourceTypes();
    expect(types).toContain("extension_sidecard");
    expect(types).toContain("extension_pipeline");
    expect(types).toContain("user_import");
    expect(types).toContain("ats_api");
    expect(types).toContain("employer_jsonld");
    expect(types).toContain("licensed_feed");
  });

  it("getAdapter returns correct adapter", () => {
    const adapter = getAdapter("user_import");
    expect(adapter).toBeDefined();
    expect(adapter!.sourceType).toBe("user_import");
  });

  it("getAdapter returns undefined for unknown type", () => {
    const adapter = getAdapter("nonexistent" as JobSourceType);
    expect(adapter).toBeUndefined();
  });
});

// ─── Canonicalization Entry ───────────────────────────────────
// canonicalizeAndWrite calls through to writeTrustedScore which requires
// a database. We test the validation/rights gates without DB.

describe("canonicalizeAndWrite — rights gates", () => {
  const mockScorePayload = {
    score: 7.5,
    supportsFit: ["Strong React experience"],
    stretchFactors: ["No backend experience"],
    hrcBand: "Possible",
    hrcReason: "Skills match",
    workModeCompat: "compatible",
    roleType: "SYSTEM_BUILDER",
    calibrationTitle: "Frontend Engineer",
  };

  const ctx: CanonicalizationContext = {
    sessionId: "test-session-1",
    score: 7.5,
    scorePayload: mockScorePayload,
  };

  it("rejects payload with canStore=false", async () => {
    const payload: NormalizedJobPayload = {
      sourceUrl: "https://example.com/job/1",
      title: "Eng",
      company: "Co",
      jobText: LONG_JOB_TEXT,
      provenance: {
        sourceType: "licensed_feed",
        sourceName: "Restricted Feed",
        trustLevel: "feed_unverified",
        rights: { canScore: true, canStore: false, canDisplay: true, canTailor: false },
        acquiredAt: new Date().toISOString(),
      },
    };

    const result = await canonicalizeAndWrite(payload, ctx);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain("storage rights");
  });

  it("rejects payload with canScore=false", async () => {
    const payload: NormalizedJobPayload = {
      sourceUrl: "https://example.com/job/2",
      title: "Eng",
      company: "Co",
      jobText: LONG_JOB_TEXT,
      provenance: {
        sourceType: "licensed_feed",
        sourceName: "Display-Only Feed",
        trustLevel: "feed_unverified",
        rights: { canScore: false, canStore: true, canDisplay: true, canTailor: false },
        acquiredAt: new Date().toISOString(),
      },
    };

    const result = await canonicalizeAndWrite(payload, ctx);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain("scoring rights");
  });

  it("rejects payload with jobText too short", async () => {
    const payload: NormalizedJobPayload = {
      sourceUrl: "https://example.com/job/3",
      title: "Eng",
      company: "Co",
      jobText: SHORT_JOB_TEXT,
      provenance: {
        sourceType: "user_import",
        sourceName: "User Import",
        trustLevel: "user_verified",
        rights: { canScore: true, canStore: true, canDisplay: true, canTailor: true },
        acquiredAt: new Date().toISOString(),
      },
    };

    const result = await canonicalizeAndWrite(payload, ctx);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain("too short");
  });
});
