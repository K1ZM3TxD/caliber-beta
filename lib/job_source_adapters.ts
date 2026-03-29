// lib/job_source_adapters.ts — Concrete source adapter implementations
//
// Each adapter maps a specific ingestion source into NormalizedJobPayload.
// Current adapters cover existing trusted paths + stubs for planned sources.

import type {
  JobSourceAdapter,
  NormalizedJobPayload,
  AdapterValidationResult,
  ProcessingRights,
  JobProvenance,
} from "@/lib/job_source_adapter";
import { registerAdapter } from "@/lib/job_source_adapter";
import { INGEST_MIN_TEXT_CHARS } from "@/lib/job_ingest_validation";

// ─── Shared Constants ─────────────────────────────────────────

const FULL_RIGHTS: ProcessingRights = {
  canScore: true,
  canStore: true,
  canDisplay: true,
  canTailor: true,
};

const SCORE_AND_STORE_ONLY: ProcessingRights = {
  canScore: true,
  canStore: true,
  canDisplay: true,
  canTailor: false,  // Tailoring rights depend on source licensing
};

function makeProvenance(
  adapter: { sourceType: string; sourceName: string; trustLevel: string; defaultRights: ProcessingRights },
  rawRef?: string,
): JobProvenance {
  return {
    sourceType: adapter.sourceType as JobProvenance["sourceType"],
    sourceName: adapter.sourceName,
    trustLevel: adapter.trustLevel as JobProvenance["trustLevel"],
    rights: adapter.defaultRights,
    acquiredAt: new Date().toISOString(),
    rawRef,
  };
}

// ─── Extension Sidecard Adapter ───────────────────────────────
// Maps the existing extension sidecard scoring flow.
// Raw input: the payload from CALIBER_FIT_API message via /api/extension/fit.

export interface ExtensionSidecardRaw {
  sourceUrl: string;
  title: string;
  company: string;
  location?: string;
  jobText: string;
}

export const extensionSidecardAdapter: JobSourceAdapter<ExtensionSidecardRaw> = {
  sourceType: "extension_sidecard",
  sourceName: "Browser Extension Sidecard",
  trustLevel: "user_verified",
  defaultRights: FULL_RIGHTS,

  validate(raw: ExtensionSidecardRaw): AdapterValidationResult {
    if (!raw.sourceUrl || typeof raw.sourceUrl !== "string") {
      return { ok: false, reason: "sourceUrl is required." };
    }
    if (!raw.jobText || raw.jobText.length < INGEST_MIN_TEXT_CHARS) {
      return { ok: false, reason: `jobText must be at least ${INGEST_MIN_TEXT_CHARS} characters.` };
    }
    return { ok: true };
  },

  normalize(raw: ExtensionSidecardRaw): NormalizedJobPayload {
    return {
      sourceUrl: raw.sourceUrl,
      title: raw.title || "",
      company: raw.company || "",
      location: raw.location,
      jobText: raw.jobText,
      provenance: makeProvenance(this),
    };
  },
};

// ─── Extension Pipeline Adapter ───────────────────────────────
// Maps the existing extension pipeline save flow.
// Raw input: the payload from CALIBER_PIPELINE_SAVE message via /api/pipeline.

export interface ExtensionPipelineRaw {
  jobUrl: string;
  jobTitle: string;
  company: string;
  location?: string;
  jobText: string;
}

export const extensionPipelineAdapter: JobSourceAdapter<ExtensionPipelineRaw> = {
  sourceType: "extension_pipeline",
  sourceName: "Browser Extension Pipeline Save",
  trustLevel: "user_verified",
  defaultRights: FULL_RIGHTS,

  validate(raw: ExtensionPipelineRaw): AdapterValidationResult {
    if (!raw.jobUrl || typeof raw.jobUrl !== "string") {
      return { ok: false, reason: "jobUrl is required." };
    }
    if (!raw.jobText || raw.jobText.length < INGEST_MIN_TEXT_CHARS) {
      return { ok: false, reason: `jobText must be at least ${INGEST_MIN_TEXT_CHARS} characters.` };
    }
    return { ok: true };
  },

  normalize(raw: ExtensionPipelineRaw): NormalizedJobPayload {
    return {
      sourceUrl: raw.jobUrl,
      title: raw.jobTitle || "",
      company: raw.company || "",
      location: raw.location,
      jobText: raw.jobText,
      provenance: makeProvenance(this),
    };
  },
};

// ─── User Import Adapter ──────────────────────────────────────
// Maps the /api/jobs/ingest user-directed paste flow.
// Raw input: validated URL + text from the /jobs page form.

export interface UserImportRaw {
  url: string;
  jobText: string;
  title?: string;
  company?: string;
}

export const userImportAdapter: JobSourceAdapter<UserImportRaw> = {
  sourceType: "user_import",
  sourceName: "User Import (URL + Text Paste)",
  trustLevel: "user_verified",
  defaultRights: FULL_RIGHTS,

  validate(raw: UserImportRaw): AdapterValidationResult {
    if (!raw.url || typeof raw.url !== "string") {
      return { ok: false, reason: "Job URL is required." };
    }
    try {
      const parsed = new URL(raw.url);
      if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
        return { ok: false, reason: "Job URL must be https:// or http://." };
      }
    } catch {
      return { ok: false, reason: "Job URL is not a valid URL." };
    }
    if (!raw.jobText || raw.jobText.length < INGEST_MIN_TEXT_CHARS) {
      return { ok: false, reason: `Job text must be at least ${INGEST_MIN_TEXT_CHARS} characters.` };
    }
    return { ok: true };
  },

  normalize(raw: UserImportRaw): NormalizedJobPayload {
    return {
      sourceUrl: raw.url,
      title: raw.title || "",
      company: raw.company || "",
      jobText: raw.jobText,
      provenance: makeProvenance(this),
    };
  },
};

// ─── ATS API Adapter ──────────────────────────────────────────
// For future ATS/job-board public API ingestion (e.g., Lever, Greenhouse).
// Raw input: structured API response with job metadata.

export interface AtsApiRaw {
  apiSource: string;       // e.g., "lever", "greenhouse"
  externalId: string;      // ATS-specific job ID
  jobUrl: string;
  title: string;
  company: string;
  location?: string;
  description: string;     // HTML or plain text job description
}

export const atsApiAdapter: JobSourceAdapter<AtsApiRaw> = {
  sourceType: "ats_api",
  sourceName: "ATS Public API",
  trustLevel: "api_structured",
  defaultRights: SCORE_AND_STORE_ONLY,

  validate(raw: AtsApiRaw): AdapterValidationResult {
    if (!raw.jobUrl || typeof raw.jobUrl !== "string") {
      return { ok: false, reason: "jobUrl is required." };
    }
    if (!raw.title || typeof raw.title !== "string") {
      return { ok: false, reason: "Job title is required from ATS API." };
    }
    if (!raw.description || raw.description.length < INGEST_MIN_TEXT_CHARS) {
      return { ok: false, reason: `Job description must be at least ${INGEST_MIN_TEXT_CHARS} characters.` };
    }
    if (!raw.apiSource) {
      return { ok: false, reason: "apiSource identifier is required." };
    }
    return { ok: true };
  },

  normalize(raw: AtsApiRaw): NormalizedJobPayload {
    // Strip HTML tags if the description contains markup
    const plainText = raw.description.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();

    return {
      sourceUrl: raw.jobUrl,
      title: raw.title,
      company: raw.company || "",
      location: raw.location,
      jobText: plainText,
      provenance: makeProvenance(
        { ...this, sourceName: `ATS API (${raw.apiSource})` },
        `${raw.apiSource}:${raw.externalId}`,
      ),
    };
  },
};

// ─── Employer JSON-LD Adapter ─────────────────────────────────
// For future ingestion from employer-published JobPosting structured data.
// Raw input: a parsed schema.org/JobPosting JSON-LD object.

export interface EmployerJsonLdRaw {
  pageUrl: string;
  jsonLd: {
    "@type"?: string;
    title?: string;
    description?: string;
    hiringOrganization?: { name?: string } | string;
    jobLocation?: { address?: { addressLocality?: string; addressRegion?: string } };
    [key: string]: unknown;
  };
}

export const employerJsonLdAdapter: JobSourceAdapter<EmployerJsonLdRaw> = {
  sourceType: "employer_jsonld",
  sourceName: "Employer JobPosting JSON-LD",
  trustLevel: "api_structured",
  defaultRights: SCORE_AND_STORE_ONLY,

  validate(raw: EmployerJsonLdRaw): AdapterValidationResult {
    if (!raw.pageUrl || typeof raw.pageUrl !== "string") {
      return { ok: false, reason: "pageUrl is required." };
    }
    const ld = raw.jsonLd;
    if (!ld || typeof ld !== "object") {
      return { ok: false, reason: "jsonLd object is required." };
    }
    if (ld["@type"] !== "JobPosting") {
      return { ok: false, reason: `Expected @type "JobPosting", got "${ld["@type"]}".` };
    }
    if (!ld.description || typeof ld.description !== "string" || ld.description.length < INGEST_MIN_TEXT_CHARS) {
      return { ok: false, reason: `Job description must be at least ${INGEST_MIN_TEXT_CHARS} characters.` };
    }
    return { ok: true };
  },

  normalize(raw: EmployerJsonLdRaw): NormalizedJobPayload {
    const ld = raw.jsonLd;
    const description = (ld.description ?? "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();

    const org = ld.hiringOrganization;
    const company = typeof org === "string" ? org : (org?.name ?? "");

    const loc = ld.jobLocation?.address;
    const location = loc
      ? [loc.addressLocality, loc.addressRegion].filter(Boolean).join(", ")
      : undefined;

    return {
      sourceUrl: raw.pageUrl,
      title: ld.title ?? "",
      company,
      location: location || undefined,
      jobText: description,
      provenance: makeProvenance(this),
    };
  },
};

// ─── Licensed Feed Adapter ────────────────────────────────────
// For future licensed bulk data feeds. Restrictive rights by default
// until per-feed licensing terms are configured.

export interface LicensedFeedRaw {
  feedId: string;
  feedName: string;
  jobUrl: string;
  title: string;
  company: string;
  location?: string;
  description: string;
  rights?: Partial<ProcessingRights>;  // Per-feed override
}

export const licensedFeedAdapter: JobSourceAdapter<LicensedFeedRaw> = {
  sourceType: "licensed_feed",
  sourceName: "Licensed Data Feed",
  trustLevel: "feed_unverified",
  defaultRights: SCORE_AND_STORE_ONLY,

  validate(raw: LicensedFeedRaw): AdapterValidationResult {
    if (!raw.feedId || typeof raw.feedId !== "string") {
      return { ok: false, reason: "feedId is required." };
    }
    if (!raw.jobUrl || typeof raw.jobUrl !== "string") {
      return { ok: false, reason: "jobUrl is required." };
    }
    if (!raw.description || raw.description.length < INGEST_MIN_TEXT_CHARS) {
      return { ok: false, reason: `Job description must be at least ${INGEST_MIN_TEXT_CHARS} characters.` };
    }
    return { ok: true };
  },

  normalize(raw: LicensedFeedRaw): NormalizedJobPayload {
    const plainText = raw.description.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();

    // Merge per-feed rights override with defaults
    const rights = raw.rights
      ? { ...this.defaultRights, ...raw.rights }
      : this.defaultRights;

    return {
      sourceUrl: raw.jobUrl,
      title: raw.title || "",
      company: raw.company || "",
      location: raw.location,
      jobText: plainText,
      provenance: {
        sourceType: this.sourceType,
        sourceName: `Licensed Feed (${raw.feedName})`,
        trustLevel: this.trustLevel,
        rights,
        acquiredAt: new Date().toISOString(),
        rawRef: `${raw.feedId}:${raw.jobUrl}`,
      },
    };
  },
};

// ─── Registration ─────────────────────────────────────────────
// Register all concrete adapters on module load.

registerAdapter(extensionSidecardAdapter);
registerAdapter(extensionPipelineAdapter);
registerAdapter(userImportAdapter);
registerAdapter(atsApiAdapter);
registerAdapter(employerJsonLdAdapter);
registerAdapter(licensedFeedAdapter);
