// lib/job_url_fetch.ts — Provider-aware job data fetching
//
// Fetches job data from supported providers using their public APIs or
// structured data endpoints. Does NOT do generic HTML scraping.
//
// Supported fetch paths:
//   1. ATS public APIs (Greenhouse, Lever, Ashby, SmartRecruiters)
//   2. JSON-LD extraction from page HTML (employer career sites)
//
// Restricted paths (fail immediately):
//   - LinkedIn, Indeed — server-side fetch not permitted

import { classifyProvider, providerLabel, type ProviderClassification } from "@/lib/job_url_provider";
import { INGEST_MIN_TEXT_CHARS } from "@/lib/job_ingest_validation";

// ─── Fetch Result Types ───────────────────────────────────────

export interface FetchedJobData {
  title: string;
  company: string;
  location?: string;
  jobText: string;          // Plain text job description (HTML stripped)
  sourceUrl: string;
  fetchSource: "ats_api" | "jsonld";
  providerName: string;     // Human-readable e.g. "Greenhouse", "Employer JSON-LD"
}

export type UrlFetchResult =
  | { ok: true; data: FetchedJobData; classification: ProviderClassification }
  | { ok: false; error: string; classification: ProviderClassification; retryWithPaste: boolean };

// ─── HTML → plain text ───────────────────────────────────────

function htmlToPlainText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/?(p|div|li|h[1-6]|tr)[^>]*>/gi, "\n")
    .replace(/<[^>]*>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// ─── Fetch timeout helper ─────────────────────────────────────

const FETCH_TIMEOUT_MS = 10_000;

async function fetchWithTimeout(url: string, init?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

// ─── ATS API Fetchers ─────────────────────────────────────────

async function fetchGreenhouse(boardToken: string, jobId: string, originalUrl: string): Promise<UrlFetchResult> {
  // Greenhouse public API: https://boards-api.greenhouse.io/v1/boards/{board_token}/jobs/{id}
  const apiUrl = `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(boardToken)}/jobs/${encodeURIComponent(jobId)}`;
  const classification: ProviderClassification = { kind: "ats", provider: "greenhouse", boardToken, jobId, originalUrl };

  try {
    const res = await fetchWithTimeout(apiUrl, {
      headers: { "Accept": "application/json" },
    });
    if (!res.ok) {
      return { ok: false, error: `Greenhouse API returned ${res.status}. The job may no longer be posted.`, classification, retryWithPaste: true };
    }
    const data = await res.json();
    const title = data.title ?? "";
    const company = data.company?.name ?? boardToken;
    const location = data.location?.name ?? undefined;
    const rawContent = data.content ?? "";
    const jobText = htmlToPlainText(rawContent);

    if (jobText.length < INGEST_MIN_TEXT_CHARS) {
      return { ok: false, error: `Greenhouse job description too short (${jobText.length} chars). The listing may be incomplete.`, classification, retryWithPaste: true };
    }

    return {
      ok: true,
      data: { title, company, location, jobText, sourceUrl: originalUrl, fetchSource: "ats_api", providerName: "Greenhouse" },
      classification,
    };
  } catch (err: any) {
    const msg = err?.name === "AbortError" ? "Request timed out." : (err?.message ?? "Network error.");
    return { ok: false, error: `Greenhouse fetch failed: ${msg}`, classification, retryWithPaste: true };
  }
}

async function fetchLever(boardToken: string, jobId: string, originalUrl: string): Promise<UrlFetchResult> {
  // Lever public postings API: https://api.lever.co/v0/postings/{company}/{id}
  const apiUrl = `https://api.lever.co/v0/postings/${encodeURIComponent(boardToken)}/${encodeURIComponent(jobId)}`;
  const classification: ProviderClassification = { kind: "ats", provider: "lever", boardToken, jobId, originalUrl };

  try {
    const res = await fetchWithTimeout(apiUrl, {
      headers: { "Accept": "application/json" },
    });
    if (!res.ok) {
      return { ok: false, error: `Lever API returned ${res.status}. The job may no longer be posted.`, classification, retryWithPaste: true };
    }
    const data = await res.json();
    const title = data.text ?? "";
    const company = data.categories?.team ?? boardToken;
    const location = data.categories?.location ?? undefined;

    // Lever returns description as HTML in `descriptionPlain` (plain) or `description` (HTML)
    const rawContent = data.descriptionPlain ?? htmlToPlainText(data.description ?? "");
    // Also include lists content
    const listsText = (data.lists ?? [])
      .map((list: { text: string; content: string }) => `${list.text}\n${htmlToPlainText(list.content)}`)
      .join("\n\n");
    const jobText = [rawContent, listsText].filter(Boolean).join("\n\n").trim();

    if (jobText.length < INGEST_MIN_TEXT_CHARS) {
      return { ok: false, error: `Lever job description too short (${jobText.length} chars). The listing may be incomplete.`, classification, retryWithPaste: true };
    }

    return {
      ok: true,
      data: { title, company, location, jobText, sourceUrl: originalUrl, fetchSource: "ats_api", providerName: "Lever" },
      classification,
    };
  } catch (err: any) {
    const msg = err?.name === "AbortError" ? "Request timed out." : (err?.message ?? "Network error.");
    return { ok: false, error: `Lever fetch failed: ${msg}`, classification, retryWithPaste: true };
  }
}

async function fetchAshby(boardToken: string, jobId: string, originalUrl: string): Promise<UrlFetchResult> {
  // Ashby public API: POST https://api.ashbyhq.com/posting-api/job-board/{board}/job/{id}
  // Also try: GET https://jobs.ashbyhq.com/api/non-user-graphql with jobPosting query
  // Simpler approach: fetch the posting page and extract JSON-LD (Ashby renders it server-side)
  const classification: ProviderClassification = { kind: "ats", provider: "ashby", boardToken, jobId, originalUrl };

  try {
    // Ashby posting pages include JSON-LD. Fetch page HTML and extract.
    const res = await fetchWithTimeout(originalUrl, {
      headers: { "Accept": "text/html", "User-Agent": "Caliber/1.0 (job-indexer)" },
    });
    if (!res.ok) {
      return { ok: false, error: `Ashby page returned ${res.status}. The job may no longer be posted.`, classification, retryWithPaste: true };
    }
    const html = await res.text();
    const jsonLdResult = extractJsonLdFromHtml(html, originalUrl);
    if (jsonLdResult) {
      return {
        ok: true,
        data: { ...jsonLdResult, fetchSource: "ats_api", providerName: "Ashby" },
        classification,
      };
    }

    return { ok: false, error: "Could not extract job data from Ashby page. Paste the full job description instead.", classification, retryWithPaste: true };
  } catch (err: any) {
    const msg = err?.name === "AbortError" ? "Request timed out." : (err?.message ?? "Network error.");
    return { ok: false, error: `Ashby fetch failed: ${msg}`, classification, retryWithPaste: true };
  }
}

async function fetchSmartRecruiters(boardToken: string, jobId: string, originalUrl: string): Promise<UrlFetchResult> {
  // SmartRecruiters public API: https://api.smartrecruiters.com/v1/companies/{company}/postings/{id}
  const apiUrl = `https://api.smartrecruiters.com/v1/companies/${encodeURIComponent(boardToken)}/postings/${encodeURIComponent(jobId)}`;
  const classification: ProviderClassification = { kind: "ats", provider: "smartrecruiters", boardToken, jobId, originalUrl };

  try {
    const res = await fetchWithTimeout(apiUrl, {
      headers: { "Accept": "application/json" },
    });
    if (!res.ok) {
      return { ok: false, error: `SmartRecruiters API returned ${res.status}. The job may no longer be posted.`, classification, retryWithPaste: true };
    }
    const data = await res.json();
    const title = data.name ?? "";
    const company = data.company?.name ?? boardToken;

    const loc = data.location;
    const location = loc
      ? [loc.city, loc.region, loc.country].filter(Boolean).join(", ")
      : undefined;

    // SmartRecruiters provides job description in `jobAd.sections.jobDescription.text` (HTML)
    const sections = data.jobAd?.sections ?? {};
    const parts: string[] = [];
    for (const key of ["jobDescription", "qualifications", "additionalInformation"]) {
      const section = sections[key];
      if (section?.text) {
        parts.push(htmlToPlainText(section.text));
      }
    }
    const jobText = parts.join("\n\n").trim();

    if (jobText.length < INGEST_MIN_TEXT_CHARS) {
      return { ok: false, error: `SmartRecruiters job description too short (${jobText.length} chars). The listing may be incomplete.`, classification, retryWithPaste: true };
    }

    return {
      ok: true,
      data: { title, company, location, jobText, sourceUrl: originalUrl, fetchSource: "ats_api", providerName: "SmartRecruiters" },
      classification,
    };
  } catch (err: any) {
    const msg = err?.name === "AbortError" ? "Request timed out." : (err?.message ?? "Network error.");
    return { ok: false, error: `SmartRecruiters fetch failed: ${msg}`, classification, retryWithPaste: true };
  }
}

// ─── JSON-LD Extraction from HTML ─────────────────────────────

/**
 * Extract JobPosting JSON-LD from page HTML.
 * Returns normalized job data if found, null otherwise.
 */
export function extractJsonLdFromHtml(html: string, pageUrl: string): Omit<FetchedJobData, "fetchSource" | "providerName"> | null {
  // Find all <script type="application/ld+json"> blocks
  const scriptRegex = /<script[^>]+type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match;

  while ((match = scriptRegex.exec(html)) !== null) {
    try {
      const raw = JSON.parse(match[1]);
      // Handle both single objects and arrays (some pages wrap in @graph)
      const candidates: any[] = Array.isArray(raw) ? raw : (raw["@graph"] ? raw["@graph"] : [raw]);

      for (const obj of candidates) {
        if (obj["@type"] === "JobPosting" && typeof obj.description === "string") {
          const description = htmlToPlainText(obj.description);
          if (description.length < INGEST_MIN_TEXT_CHARS) continue;

          const org = obj.hiringOrganization;
          const company = typeof org === "string" ? org : (org?.name ?? "");

          const loc = obj.jobLocation;
          let location: string | undefined;
          if (loc) {
            const addr = loc.address ?? loc;
            location = [addr.addressLocality, addr.addressRegion].filter(Boolean).join(", ") || undefined;
          }

          return {
            title: obj.title ?? obj.name ?? "",
            company,
            location,
            jobText: description,
            sourceUrl: pageUrl,
          };
        }
      }
    } catch {
      // Invalid JSON in this script block — skip
    }
  }

  return null;
}

// ─── JSON-LD Page Fetch ───────────────────────────────────────

async function fetchJsonLdFromPage(url: string): Promise<UrlFetchResult> {
  const classification: ProviderClassification = { kind: "unknown", originalUrl: url };

  try {
    const res = await fetchWithTimeout(url, {
      headers: {
        "Accept": "text/html",
        "User-Agent": "Caliber/1.0 (job-indexer)",
      },
    });
    if (!res.ok) {
      return { ok: false, error: `Page returned ${res.status}. Could not load the job posting.`, classification, retryWithPaste: true };
    }

    const contentType = res.headers.get("content-type") ?? "";
    if (!contentType.includes("text/html") && !contentType.includes("application/xhtml")) {
      return { ok: false, error: "URL did not return an HTML page. Paste the full job description instead.", classification, retryWithPaste: true };
    }

    const html = await res.text();

    // Safety: limit HTML size we process (10MB max)
    if (html.length > 10_000_000) {
      return { ok: false, error: "Page is too large to process. Paste the full job description instead.", classification, retryWithPaste: true };
    }

    const jsonLdResult = extractJsonLdFromHtml(html, url);
    if (jsonLdResult) {
      return {
        ok: true,
        data: { ...jsonLdResult, fetchSource: "jsonld", providerName: "Employer JSON-LD" },
        classification,
      };
    }

    return { ok: false, error: "No structured job data found on this page. Paste the full job description text to score this job.", classification, retryWithPaste: true };
  } catch (err: any) {
    const msg = err?.name === "AbortError" ? "Request timed out." : (err?.message ?? "Network error.");
    return { ok: false, error: `Could not fetch page: ${msg}`, classification, retryWithPaste: true };
  }
}

// ─── Main Entry Point ─────────────────────────────────────────

/**
 * Attempt provider-aware fetch of job data from a URL.
 *
 * Routing:
 *   1. Classify URL into provider
 *   2. If restricted (LinkedIn/Indeed) → fail immediately with explanation
 *   3. If known ATS → use public API
 *   4. If unknown → attempt JSON-LD extraction from page HTML
 *
 * Returns fetched job data on success, or an error with guidance on failure.
 */
export async function fetchJobFromUrl(url: string): Promise<UrlFetchResult> {
  const classification = classifyProvider(url);

  switch (classification.kind) {
    case "restricted":
      return {
        ok: false,
        error: classification.reason,
        classification,
        retryWithPaste: true,
      };

    case "ats":
      switch (classification.provider) {
        case "greenhouse":
          return fetchGreenhouse(classification.boardToken, classification.jobId, classification.originalUrl);
        case "lever":
          return fetchLever(classification.boardToken, classification.jobId, classification.originalUrl);
        case "ashby":
          return fetchAshby(classification.boardToken, classification.jobId, classification.originalUrl);
        case "smartrecruiters":
          return fetchSmartRecruiters(classification.boardToken, classification.jobId, classification.originalUrl);
      }
      break; // unreachable, but satisfies TS

    case "unknown":
      return fetchJsonLdFromPage(classification.originalUrl);
  }

  // Fallback (should not reach here)
  return {
    ok: false,
    error: "Unrecognized URL format. Paste the full job description to score this job.",
    classification: { kind: "unknown", originalUrl: url },
    retryWithPaste: true,
  };
}
