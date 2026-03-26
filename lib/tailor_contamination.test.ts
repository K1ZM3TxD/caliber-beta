/**
 * lib/tailor_contamination.test.ts
 *
 * Regression tests for cross-user resume contamination in the tailor flow.
 *
 * Bug: When the Chrome extension's `caliberSessionId` is stale (e.g. from a
 * previous user's calibration), pipeline entries and tailor preps are saved
 * with that stale sessionId. A subsequent tailor generation then loads the
 * wrong user's resume.
 *
 * Fix: `app/api/pipeline/tailor/route.ts` now uses the `caliber_sessionId`
 * cookie as the primary source for resume session lookup, overriding the
 * potentially-stale sessionId stored in the pipeline entry / prep file.
 *
 * These tests validate two invariants:
 * 1. `tailorPrepFindByJob` is scoped by sessionId — a stale sessionId cannot
 *    leak into a lookup that expects a different session.
 * 2. The resolved resume sessionId is the cookie value, not the entry/prep
 *    sessionId, when the cookie is present.
 */

import fs from "fs";
import path from "path";
import { tailorPrepSave, tailorPrepFindByJob } from "./tailor_store";

// ── test data ──────────────────────────────────────────────────────────────

// Track created prep file IDs for cleanup
const createdPrepIds: string[] = [];

const DATA_DIR = process.env.VERCEL === "1" || process.env.VERCEL
  ? "/tmp/.caliber-tailor"
  : path.join(process.cwd(), ".caliber-tailor");

afterAll(() => {
  // Clean up test prep files written to the real .caliber-tailor/ directory
  for (const id of createdPrepIds) {
    const file = path.join(DATA_DIR, `prep_${id}.json`);
    try { fs.unlinkSync(file); } catch { /* already gone */ }
  }
});

// ── tests ──────────────────────────────────────────────────────────────────

const FABIO_SESSION = "sess_fabio_cntm_abc123";
const JEN_SESSION   = "sess_jen_cntm_xyz789";
const JEN_JOB_URL   = "https://www.linkedin.com/jobs/view/test99999999/";
const JEN_JOB_TITLE = "Partnerships Manager";
const JEN_COMPANY   = "Acme Corp";
const JEN_JOB_TEXT  = "We are hiring a Partnerships Manager to build strategic alliances...";

describe("tailorPrepFindByJob — sessionId isolation", () => {
  let jenPrepId: string;

  beforeAll(() => {
    // Save Jen's job prep using JEN's session (correct scenario)
    const prep = tailorPrepSave({
      sessionId: JEN_SESSION,
      jobTitle: JEN_JOB_TITLE,
      company: JEN_COMPANY,
      jobUrl: JEN_JOB_URL,
      jobText: JEN_JOB_TEXT,
      score: 8.1,
    });
    jenPrepId = prep.id;
    createdPrepIds.push(jenPrepId);
  });

  it("returns Jen's prep when looked up with Jen's sessionId", () => {
    const found = tailorPrepFindByJob(JEN_SESSION, JEN_JOB_URL);
    expect(found).not.toBeNull();
    expect(found!.id).toBe(jenPrepId);
    expect(found!.sessionId).toBe(JEN_SESSION);
    expect(found!.jobTitle).toBe(JEN_JOB_TITLE);
  });

  it("returns null when looked up with Fabio's (stale) sessionId", () => {
    // This is the contamination vector: if the entry.sessionId is fabioId
    // (stale extension caliberSessionId), prep lookup MUST return null so
    // the system cannot inadvertently fall through to Fabio's resume.
    const found = tailorPrepFindByJob(FABIO_SESSION, JEN_JOB_URL);
    expect(found).toBeNull();
  });

  it("returns null for unknown sessionId", () => {
    const found = tailorPrepFindByJob("sess_unknown_never_exists", JEN_JOB_URL);
    expect(found).toBeNull();
  });
});

describe("tailorPrepFindByJob — stale-sessionId contamination scenario", () => {
  const CONTAMINATED_JOB_URL = "https://www.linkedin.com/jobs/view/test88888888/";
  let fabioContaminatedPrepId: string;

  beforeAll(() => {
    // Simulate the contamination scenario: extension had stale caliberSessionId=fabioId
    // when Jen's job was saved → prep file stored with FABIO's sessionId for JEN's job URL.
    const prep = tailorPrepSave({
      sessionId: FABIO_SESSION,         // BUG: stale session from extension
      jobTitle: JEN_JOB_TITLE,
      company: JEN_COMPANY,
      jobUrl: CONTAMINATED_JOB_URL,
      jobText: "Another Partnerships Manager role...",
      score: 9.4,
    });
    fabioContaminatedPrepId = prep.id;
    createdPrepIds.push(fabioContaminatedPrepId);
  });

  it("contaminated prep is accessible via fabioSessionId (confirming the stale path)", () => {
    const found = tailorPrepFindByJob(FABIO_SESSION, CONTAMINATED_JOB_URL);
    expect(found).not.toBeNull();
    expect(found!.id).toBe(fabioContaminatedPrepId);
    expect(found!.sessionId).toBe(FABIO_SESSION);
  });

  it("contaminated prep is NOT accessible via jenSessionId", () => {
    // Key invariant: even though this prep is for Jen's job URL, looking it up
    // with Jen's sessionId returns null. The tailor route must NOT use a prep
    // whose sessionId doesn't match the authenticated user's session.
    const found = tailorPrepFindByJob(JEN_SESSION, CONTAMINATED_JOB_URL);
    expect(found).toBeNull();
  });
});

describe("resumeSessionId priority: cookie > entry/prep sessionId", () => {
  /**
   * This test documents the core fix in app/api/pipeline/tailor/route.ts:
   * when the caliber_sessionId cookie is present, it takes precedence over
   * the sessionId stored in the pipeline entry or prep file.
   *
   * Since we cannot easily invoke the Next.js route in a unit test context,
   * we validate the selection logic directly as a pure function.
   */

  function resolveResumeSessionId(
    cookieSessionId: string | null,
    prepSessionId: string | null,
    entrySessionId: string | null
  ): string | null {
    // Mirrors the logic in app/api/pipeline/tailor/route.ts POST handler:
    // const resolvedSessionId = prep?.sessionId ?? sessionId;  (sessionId = entrySessionId)
    // const resumeSessionId = cookieSessionId || resolvedSessionId || null;
    const resolvedSessionId = prepSessionId ?? entrySessionId ?? null;
    return cookieSessionId || resolvedSessionId || null;
  }

  it("uses cookie when cookie is present, ignoring stale entry sessionId", () => {
    const result = resolveResumeSessionId(
      JEN_SESSION,   // cookie = Jen's actual current session
      FABIO_SESSION, // prep.sessionId = stale Fabio from extension
      FABIO_SESSION  // entry.sessionId = stale Fabio from extension
    );
    expect(result).toBe(JEN_SESSION);
  });

  it("falls back to prep.sessionId when cookie is absent", () => {
    const result = resolveResumeSessionId(
      null,          // no cookie (e.g. expired or server context)
      JEN_SESSION,   // prep.sessionId = correct Jen session
      null           // entry.sessionId = null (web-created entry)
    );
    expect(result).toBe(JEN_SESSION);
  });

  it("falls back to entry.sessionId when cookie and prep are absent", () => {
    const result = resolveResumeSessionId(
      null,          // no cookie
      null,          // no prep found
      JEN_SESSION    // entry.sessionId = Jen's session
    );
    expect(result).toBe(JEN_SESSION);
  });

  it("returns null when all sources are absent — caller returns 404", () => {
    const result = resolveResumeSessionId(null, null, null);
    expect(result).toBeNull();
  });

  it("Fabio→Jen profile switch: cookie overrides stale prep/entry sessionId", () => {
    // This is the exact scenario that caused the observed contamination:
    // User recalibrated as Jen but extension still had Fabio's caliberSessionId
    // when the pipeline entry was saved.
    const result = resolveResumeSessionId(
      JEN_SESSION,    // cookie reflects Jen's CURRENT calibration
      FABIO_SESSION,  // prep has stale Fabio session (saved during the contamination window)
      FABIO_SESSION   // entry has stale Fabio session (same root cause)
    );
    expect(result).toBe(JEN_SESSION);
    expect(result).not.toBe(FABIO_SESSION);
  });
});
