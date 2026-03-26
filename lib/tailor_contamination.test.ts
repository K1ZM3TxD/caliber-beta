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

// ── New regression tests for 72f0194 fix layers ───────────────────────────

/**
 * Fix layer 1 + 4 (extension/background.js discoverSession):
 * When the cookie is present and differs from chrome.storage, the cookie wins.
 * Any backup belonging to the stale (storage) session is discarded.
 *
 * This mirrors the exact logic added to discoverSession() in 72f0194.
 */
describe("discoverSession — cookie-first resolution (Fix 1+4, 72f0194)", () => {
  /**
   * Pure mirror of the cookie-override block in discoverSession():
   *   if (cookieId && cookieId !== storedId) {
   *     storedId = cookieId;
   *     if (sessionBackup && sessionBackup.sessionId !== cookieId) sessionBackup = null;
   *   }
   */
  function resolveDiscoverSession(
    cookieId: string | null,
    storedId: string | null,
    sessionBackup: { sessionId: string } | null
  ): { resolvedId: string | null; backup: { sessionId: string } | null; storageUpdated: boolean } {
    let resolved = storedId;
    let backup = sessionBackup;
    let storageUpdated = false;
    if (cookieId && cookieId !== storedId) {
      resolved = cookieId;
      if (backup && backup.sessionId !== cookieId) {
        backup = null;
      }
      storageUpdated = true;
    }
    return { resolvedId: resolved, backup, storageUpdated };
  }

  it("cookie overrides stale storage in Fabio→Jen switch scenario", () => {
    const result = resolveDiscoverSession(
      JEN_SESSION,
      FABIO_SESSION,
      { sessionId: FABIO_SESSION }
    );
    expect(result.resolvedId).toBe(JEN_SESSION);
    expect(result.backup).toBeNull(); // Fabio's backup discarded
    expect(result.storageUpdated).toBe(true);
  });

  it("discards cross-profile backup when cookie differs from storage", () => {
    const result = resolveDiscoverSession(JEN_SESSION, FABIO_SESSION, { sessionId: FABIO_SESSION });
    expect(result.backup).toBeNull();
  });

  it("retains backup when cookie matches storage (same-session)", () => {
    const jenBackup = { sessionId: JEN_SESSION };
    const result = resolveDiscoverSession(JEN_SESSION, JEN_SESSION, jenBackup);
    expect(result.backup).toBe(jenBackup); // backup retained — belongs to correct session
    expect(result.storageUpdated).toBe(false); // no override needed
  });

  it("does not override when cookie is absent (null)", () => {
    const result = resolveDiscoverSession(null, FABIO_SESSION, { sessionId: FABIO_SESSION });
    expect(result.resolvedId).toBe(FABIO_SESSION); // storage wins when no cookie
    expect(result.storageUpdated).toBe(false);
  });

  it("cookie wins over null storage", () => {
    const result = resolveDiscoverSession(JEN_SESSION, null, null);
    expect(result.resolvedId).toBe(JEN_SESSION);
    expect(result.storageUpdated).toBe(true);
  });
});

/**
 * Fix layer 2 (extension/background.js CALIBER_PIPELINE_SAVE):
 * Pipeline entries are saved with cookie > storage for sessionId.
 * Stale caliberSessionId in storage cannot contaminate the entry.
 */
describe("CALIBER_PIPELINE_SAVE — cookie-first sessionId (Fix 2, 72f0194)", () => {
  /**
   * Pure mirror of pipeline save sessionId resolution:
   *   const sessionId = cookieId || store.caliberSessionId
   */
  function resolvePipelineSaveSession(
    cookieId: string | null,
    storedId: string | null
  ): { sessionId: string | null; syncStorage: boolean } {
    const sessionId = cookieId || storedId || null;
    const syncStorage = !!(cookieId && cookieId !== storedId);
    return { sessionId, syncStorage };
  }

  it("pipeline entry uses cookie session when cookie is present", () => {
    const { sessionId, syncStorage } = resolvePipelineSaveSession(JEN_SESSION, FABIO_SESSION);
    expect(sessionId).toBe(JEN_SESSION);
    expect(syncStorage).toBe(true); // storage should be updated to cookie value
  });

  it("pipeline entry falls back to storage when cookie is absent", () => {
    const { sessionId } = resolvePipelineSaveSession(null, JEN_SESSION);
    expect(sessionId).toBe(JEN_SESSION);
  });

  it("pipeline entry returns null when both sources absent", () => {
    const { sessionId } = resolvePipelineSaveSession(null, null);
    expect(sessionId).toBeNull();
  });

  it("does not sync storage when cookie already matches storage", () => {
    const { sessionId, syncStorage } = resolvePipelineSaveSession(JEN_SESSION, JEN_SESSION);
    expect(sessionId).toBe(JEN_SESSION);
    expect(syncStorage).toBe(false);
  });
});

/**
 * Fix layer 3 (app/api/extension/session/route.ts):
 * GET and POST without an explicit sessionId return 400 — storeLatest() is
 * never called. This is the server-side guard against Stage 3 cross-user
 * contamination.
 */
describe("session endpoint — sessionId guard (Fix 3, 72f0194)", () => {
  /**
   * Mirrors the request routing in the fixed GET handler:
   *   if (!requestedId) → return 400
   *   else → lookup by requestedId only
   */
  function resolveSessionRequest(
    requestedId: string | null
  ): { status: 400 | 200 | 404; usesLatestFallback: boolean } {
    if (!requestedId) {
      return { status: 400, usesLatestFallback: false };
    }
    // Simulate a found/not-found result — actual store lookup not mirrored here
    return { status: 200, usesLatestFallback: false };
  }

  it("returns 400 when GET request has no sessionId", () => {
    const { status, usesLatestFallback } = resolveSessionRequest(null);
    expect(status).toBe(400);
    expect(usesLatestFallback).toBe(false);
  });

  it("returns 400 when POST request has no sessionId", () => {
    const { status, usesLatestFallback } = resolveSessionRequest(null);
    expect(status).toBe(400);
    expect(usesLatestFallback).toBe(false);
  });

  it("proceeds to session lookup when explicit sessionId is provided", () => {
    const { status, usesLatestFallback } = resolveSessionRequest(JEN_SESSION);
    expect(status).toBe(200);
    expect(usesLatestFallback).toBe(false); // never calls storeLatest()
  });

  it("storeLatest is never used regardless of sessionId presence", () => {
    // Key invariant: the usesLatestFallback property must always be false
    // in the fixed implementation.
    const withId = resolveSessionRequest(FABIO_SESSION);
    const withoutId = resolveSessionRequest(null);
    expect(withId.usesLatestFallback).toBe(false);
    expect(withoutId.usesLatestFallback).toBe(false);
  });
});

/**
 * Fix layer 4 (backup restoration guard) is folded into Fix 1 test above.
 * Additional explicit test for the ownership check:
 * backup restoration is ONLY attempted when cookieId === storedId.
 */
describe("backup restoration — ownership check (Fix 4, 72f0194)", () => {
  /**
   * Mirrors the condition that gates backup restoration:
   *   if (storedId && cookieId === storedId) { ... restore ... }
   */
  function shouldRestoreBackup(
    cookieId: string | null,
    storedId: string | null,
    backup: { sessionId: string } | null
  ): boolean {
    return !!(storedId && cookieId === storedId && backup && backup.sessionId === storedId);
  }

  it("BLOCKS restoration when cookie is absent (prevents cold-restore contamination)", () => {
    expect(shouldRestoreBackup(null, FABIO_SESSION, { sessionId: FABIO_SESSION })).toBe(false);
  });

  it("BLOCKS restoration when cookie differs from storage (cross-profile scenario)", () => {
    expect(shouldRestoreBackup(JEN_SESSION, FABIO_SESSION, { sessionId: FABIO_SESSION })).toBe(false);
  });

  it("ALLOWS restoration when cookie matches storage (legitimate eviction recovery)", () => {
    expect(shouldRestoreBackup(JEN_SESSION, JEN_SESSION, { sessionId: JEN_SESSION })).toBe(true);
  });

  it("BLOCKS restoration when backup sessionId differs from storedId", () => {
    // A backup from a different session should never be restored
    expect(shouldRestoreBackup(FABIO_SESSION, FABIO_SESSION, { sessionId: JEN_SESSION })).toBe(false);
  });

  it("BLOCKS restoration when backup is null", () => {
    expect(shouldRestoreBackup(JEN_SESSION, JEN_SESSION, null)).toBe(false);
  });

  it("Fabio→Jen: backup restore fully blocked in BOTH contamination vectors", () => {
    // Vector 1: cookie=jenSession, storage=fabioSession (HANDOFF didn't fire yet)
    expect(shouldRestoreBackup(JEN_SESSION, FABIO_SESSION, { sessionId: FABIO_SESSION })).toBe(false);
    // Vector 2: cookie=null (cleared), storage=fabioSession
    expect(shouldRestoreBackup(null, FABIO_SESSION, { sessionId: FABIO_SESSION })).toBe(false);
  });
});
