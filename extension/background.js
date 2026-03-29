// background.js — Caliber service worker (proxies API calls for content scripts)

importScripts("env.js");

// Locked base URL from environment config — no fallback between prod/dev
const API_BASE = CALIBER_ENV.API_BASE;
let resolvedBase = API_BASE;

// Derive the Caliber origin from the API_BASE URL (e.g. "https://www.caliber-app.com")
const CALIBER_ORIGIN = new URL(API_BASE).origin;

// ─── Proactive Session Handoff on Install/Startup ───────────
// After fresh install, extension refresh, or browser restart, content scripts
// are NOT re-injected into existing tabs. We must proactively inject into any
// open Caliber tabs to get the session handoff without requiring a user reload.

async function injectIntoCaliberTabs() {
  try {
    const tabs = await chrome.tabs.query({ url: CALIBER_ORIGIN + "/*" });
    for (const tab of tabs) {
      if (!tab.id) continue;
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ["env.js", "content_caliber.js"],
        });
      } catch { /* tab may be restricted or discarded */ }
    }
  } catch { /* query may fail if permissions not yet granted */ }
}

// Also inject content scripts into already-open job board tabs so they can
// score jobs immediately without requiring a manual page reload.
async function injectIntoJobTabs() {
  const targets = [
    { url: "https://www.linkedin.com/jobs/*", files: ["env.js", "content_linkedin.js"] },
    { url: "https://www.indeed.com/*", files: ["env.js", "content_indeed.js"] },
  ];
  for (const { url, files } of targets) {
    try {
      const tabs = await chrome.tabs.query({ url });
      for (const tab of tabs) {
        if (!tab.id) continue;
        try {
          await chrome.scripting.executeScript({ target: { tabId: tab.id }, files });
        } catch { /* tab may be restricted */ }
      }
    } catch { /* query failure */ }
  }
}

/**
 * Notify all open LinkedIn job tabs that a calibration session is now available.
 * Called after successful session handoff or discovery so content scripts can
 * start/restart badge scoring without waiting for periodic retry.
 */
async function notifyLinkedInTabsSessionReady() {
  try {
    const tabs = await chrome.tabs.query({ url: "https://www.linkedin.com/jobs/*" });
    for (const tab of tabs) {
      if (!tab.id) continue;
      try {
        chrome.tabs.sendMessage(tab.id, { type: "CALIBER_SESSION_READY" });
        console.debug("[Caliber][bg][session] notified LinkedIn tab " + tab.id + " of session ready");
      } catch { /* tab may not have content script */ }
    }
  } catch { /* query failure */ }
}

chrome.runtime.onInstalled.addListener(() => { injectIntoCaliberTabs(); injectIntoJobTabs(); });
chrome.runtime.onStartup.addListener(() => { injectIntoCaliberTabs(); injectIntoJobTabs(); });

/**
 * Probe open Caliber tabs for the session cookie by injecting a small script.
 * Returns { sessionId, sessionBackup } or null if no tab has a session.
 * Used as a fallback when chrome.storage.local has no session and the server
 * API is unreachable or returns no session.
 */
async function probeCaliberTabsForSession() {
  try {
    const tabs = await chrome.tabs.query({ url: CALIBER_ORIGIN + "/*" });
    for (const tab of tabs) {
      if (!tab.id) continue;
      try {
        const results = await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: () => {
            // Read session cookie
            const m = document.cookie.match(/(?:^|; )caliber_sessionId=([^;]*)/);
            const sessionId = m ? decodeURIComponent(m[1]) : null;
            if (!sessionId) return null;
            // Read session backup from localStorage
            let sessionBackup = null;
            try {
              const raw = localStorage.getItem("caliber_session_backup");
              if (raw) sessionBackup = JSON.parse(raw);
            } catch { /* ignore */ }
            return { sessionId, sessionBackup };
          },
        });
        const result = results && results[0] && results[0].result;
        if (result && result.sessionId) return result;
      } catch { /* tab may be restricted */ }
    }
  } catch { /* query failure */ }
  return null;
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === "CALIBER_FIT_API") {
    const sessionId = msg.sessionId || null;
    const fitOptions = msg.sourceUrl
      ? { sourceUrl: msg.sourceUrl, title: msg.title || undefined, company: msg.company || undefined }
      : {};
    console.debug("[Caliber][bg] CALIBER_FIT_API received (" + (msg.jobText || "").length + " chars, session=" + (sessionId || "discover") + ")");
    const fitFn = sessionId
      ? callFitAPI(msg.jobText, sessionId, fitOptions)
      : ensureSessionThenFit(msg.jobText, fitOptions);
    fitFn
      .then((data) => {
        console.debug("[Caliber][bg] sidecard score complete: " + (data.score_0_to_10 || "?"));
        sendResponse({ ok: true, data });
      })
      .catch((err) => {
        console.error("[Caliber][bg] sidecard score failed: " + err.message);
        sendResponse({ ok: false, error: err.message });
      });
    return true;
  }
  if (msg.type === "CALIBER_FEEDBACK") {
    // Enrich feedback with sessionId (tagged with signal condition) for surface linkage
    (async () => {
      try {
        const store = await chrome.storage.local.get(["caliberSessionId", "caliberSignalPreference"]);
        if (store.caliberSessionId) {
          const condition = store.caliberSignalPreference === "yes" ? "signal_on" : "signal_off";
          msg.payload.sessionId = store.caliberSessionId + "::" + condition;
        }
      } catch { /* swallow */ }
      fetch(API_BASE + "/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(msg.payload),
        signal: AbortSignal.timeout(5000),
      })
        .then((r) => r.json())
        .then((data) => sendResponse({ ok: true, data }))
        .catch((err) => sendResponse({ ok: false, error: err.message }));
    })();
    return true;
  }
  if (msg.type === "CALIBER_TELEMETRY") {
    // Enrich payload with sessionId (tagged with signal condition), signalPreference,
    // and optional experiment labels (fixture/chips/query_set) from storage.
    (async () => {
      try {
        const store = await chrome.storage.local.get([
          "caliberSessionId",
          "caliberSignalPreference",
          "caliberExperimentMeta",
        ]);
        if (store.caliberSessionId) {
          const condition = store.caliberSignalPreference === "yes" ? "signal_on" : "signal_off";
          msg.payload.sessionId = store.caliberSessionId + "::" + condition;
        }
        if (store.caliberSignalPreference) msg.payload.signalPreference = store.caliberSignalPreference;
        // Merge experiment labels (fixture, chips, query_set, etc.) into meta if set
        if (store.caliberExperimentMeta && typeof store.caliberExperimentMeta === "object") {
          msg.payload.meta = Object.assign({}, msg.payload.meta || {}, store.caliberExperimentMeta);
        }
      } catch { /* swallow */ }
      fetch(API_BASE + "/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(msg.payload),
        signal: AbortSignal.timeout(5000),
      }).catch(() => {});
    })();
    sendResponse({ ok: true });
    return true;
  }
  if (msg.type === "CALIBER_SESSION_DISCOVER") {
    (async () => {
      try {
        const info = await discoverSession();
        // Attach persisted calibration title + nearby roles so content scripts
        // have them before the first scoring batch completes.
        const stored = await chrome.storage.local.get(["caliberCalibrationTitle", "caliberNearbyRoles"]);
        sendResponse({
          ok: true,
          ...info,
          calibrationTitle: stored.caliberCalibrationTitle || "",
          nearbyRoles: Array.isArray(stored.caliberNearbyRoles) ? stored.caliberNearbyRoles : [],
        });
      } catch (err) {
        sendResponse({ ok: false, error: err.message });
      }
    })();
    return true;
  }
  if (msg.type === "CALIBER_PIPELINE_CHECK") {
    (async () => {
      try {
        const store = await chrome.storage.local.get(["caliberSessionId"]);
        const sessionId = store.caliberSessionId;
        if (!sessionId) { sendResponse({ ok: true, exists: false }); return; }
        const url = API_BASE + "/api/pipeline?sessionId=" + encodeURIComponent(sessionId) + "&jobUrl=" + encodeURIComponent(msg.jobUrl || "");
        const resp = await fetch(url, { signal: AbortSignal.timeout(4000) });
        const data = await resp.json();
        sendResponse({ ok: true, exists: !!data.exists, entry: data.entry || null });
      } catch {
        sendResponse({ ok: true, exists: false });
      }
    })();
    return true;
  }
  if (msg.type === "CALIBER_PIPELINE_SAVE") {
    (async () => {
      try {
        // Prefer cookie over stale storage — prevents saving pipeline entries with
        // a cross-profile sessionId that would cause contamination at tailor time.
        const cookieId = await readSessionCookie();
        const store = await chrome.storage.local.get(["caliberSessionId"]);
        const sessionId = cookieId || store.caliberSessionId;
        if (cookieId && cookieId !== store.caliberSessionId) {
          // Keep storage in sync so subsequent operations (scoring, etc.) are consistent.
          await chrome.storage.local.set({ caliberSessionId: cookieId });
        }
        if (!sessionId) { sendResponse({ ok: false, error: "No session" }); return; }
        const resp = await fetch(API_BASE + "/api/pipeline", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId,
            jobTitle: String(msg.jobTitle || "").slice(0, 200),
            company: String(msg.company || "").slice(0, 200),
            jobUrl: String(msg.jobUrl || "").slice(0, 2000),
            score: typeof msg.score === "number" ? msg.score : 0,
            stage: "strong_match",
            ...(msg.jobText ? { jobText: String(msg.jobText).slice(0, 15000) } : {}),
          }),
          signal: AbortSignal.timeout(5000),
        });
        const data = await resp.json();
        console.debug("[Caliber][bg][pipeline] save response — http=" + resp.status + ", ok=" + !!data.ok +
          (data.error ? ", error=" + data.error : "") +
          ", jobTitle=\"" + String(msg.jobTitle || "").slice(0, 40) + "\"");
        sendResponse({ ok: !!data.ok, entry: data.entry || null, alreadyExists: !!data.entry && !!data.entry.createdAt, error: data.error || null, httpStatus: resp.status });
      } catch (err) {
        sendResponse({ ok: false, error: err.message });
      }
    })();
    return true;
  }
  if (msg.type === "CALIBER_PRESCAN_BATCH") {
    (async () => {
      try {
        // Discover session once for the whole batch
        const info = await discoverSession();
        if (!info.sessionId || !info.profileComplete) {
          console.warn("[Caliber][bg][prescan] no active session for batch — sessionId: " +
            (info.sessionId || "(none)") + ", profileComplete: " + !!info.profileComplete);
          sendResponse({ ok: false, error: "No active calibration session.", errorType: "no_session", results: [] });
          return;
        }
        console.debug("[Caliber][bg][prescan] session ready: " + info.sessionId + ", profileComplete: " + info.profileComplete);
        const results = [];
        const jobs = Array.isArray(msg.jobs) ? msg.jobs : [];
        console.debug("[Caliber][bg][prescan] scoring batch of " + jobs.length + " jobs");
        for (const job of jobs) {
          try {
            const data = await callFitAPI(job.jobText, info.sessionId, { prescan: true });
            // Forensic: dump first result's full API response keys
            if (results.length === 0) {
              console.warn("[Caliber][bg][prescan][FORENSIC] first API response keys: " +
                Object.keys(data).join(", ") + " | score_0_to_10=" + data.score_0_to_10 +
                " | hrc=" + (data.hiring_reality_check ? data.hiring_reality_check.band : "none") +
                " | debug_signals=" + JSON.stringify(data.debug_signals || null));
            }
            results.push({
              title: job.title || "",
              score: data.score_0_to_10 || 0,
              calibrationTitle: data.calibration_title || "",
              nearbyRoles: data.nearby_roles || [],
              recoveryTerms: data.recovery_terms || [],
              hrcBand: (data.hiring_reality_check && data.hiring_reality_check.band) || null,
              debugSignals: data.debug_signals || null,
              ok: true,
            });
            console.debug("[Caliber][bg][prescan] scored: " + (job.title || "?") + " → " + (data.score_0_to_10 || 0));
          } catch (err) {
            results.push({ title: job.title || "", score: 0, ok: false, error: err.message });
            console.warn("[Caliber][bg][prescan] item error: " + (job.title || "?") + " → " + err.message);
          }
        }
        console.debug("[Caliber][bg][prescan] batch complete: " + results.filter(r => r.ok).length + "/" + results.length + " succeeded");
        sendResponse({ ok: true, results });
      } catch (err) {
        console.error("[Caliber][bg][prescan] batch failed: " + err.message);
        sendResponse({ ok: false, error: err.message, results: [] });
      }
    })();
    return true;
  }
  if (msg.type === "CALIBER_SCORE_HISTORY_PUSH") {
    (async () => {
      try {
        const store = await chrome.storage.local.get(["caliberRecentScores"]);
        const history = Array.isArray(store.caliberRecentScores) ? store.caliberRecentScores : [];
        history.push({
          score: Number(msg.score) || 0,
          title: String(msg.title || "").slice(0, 200),
          nearbyRoles: Array.isArray(msg.nearbyRoles) ? msg.nearbyRoles.slice(0, 5) : [],
          calibrationTitle: String(msg.calibrationTitle || "").slice(0, 200),
          surfaceKey: String(msg.surfaceKey || "").slice(0, 500),
          ts: Date.now(),
        });
        // Keep only the most recent 10 entries
        const trimmed = history.slice(-10);
        await chrome.storage.local.set({ caliberRecentScores: trimmed });
        sendResponse({ ok: true, history: trimmed });
      } catch (err) {
        sendResponse({ ok: false, error: err.message });
      }
    })();
    return true;
  }
  if (msg.type === "CALIBER_SCORE_HISTORY_CLEAR") {
    (async () => {
      try {
        await chrome.storage.local.remove("caliberRecentScores");
        sendResponse({ ok: true });
      } catch (err) {
        sendResponse({ ok: false, error: err.message });
      }
    })();
    return true;
  }
  if (msg.type === "CALIBER_SCORE_HISTORY_GET") {
    (async () => {
      try {
        const store = await chrome.storage.local.get(["caliberRecentScores"]);
        sendResponse({ ok: true, history: Array.isArray(store.caliberRecentScores) ? store.caliberRecentScores : [] });
      } catch (err) {
        sendResponse({ ok: false, history: [] });
      }
    })();
    return true;
  }
  if (msg.type === "CALIBER_PRESCAN_STATE_SAVE") {
    (async () => {
      try {
        const surfaceKey = String(msg.surfaceKey || "").trim().toLowerCase();
        const entry = {
          surfaceKey: surfaceKey,
          query: String(msg.query || "").trim().toLowerCase(),
          done: true,
          weakCount: Number(msg.weakCount) || 0,
          scoredCount: Number(msg.scoredCount) || 0,
          suggestedTitle: msg.suggestedTitle || null,
          suggestionShown: !!msg.suggestionShown,
          surfaceBanner: msg.surfaceBanner || null,
          ts: Date.now(),
        };
        await chrome.storage.local.set({ caliberPrescanState: entry });
        sendResponse({ ok: true });
      } catch (err) {
        sendResponse({ ok: false, error: err.message });
      }
    })();
    return true;
  }
  if (msg.type === "CALIBER_PRESCAN_STATE_GET") {
    (async () => {
      try {
        const store = await chrome.storage.local.get(["caliberPrescanState"]);
        sendResponse({ ok: true, state: store.caliberPrescanState || null });
      } catch (err) {
        sendResponse({ ok: false, state: null });
      }
    })();
    return true;
  }
  if (msg.type === "CALIBER_PRESCAN_STATE_CLEAR") {
    chrome.storage.local.remove("caliberPrescanState");
    sendResponse({ ok: true });
    return false;
  }
  if (msg.type === "CALIBER_OPEN_PIPELINE") {
    var url = API_BASE + "/pipeline";
    if (msg.highlightId) url += "?highlight=" + encodeURIComponent(msg.highlightId);
    chrome.tabs.create({ url: url });
    sendResponse({ ok: true });
    return false;
  }
  if (msg.type === "CALIBER_SESSION_HANDOFF") {
    // Direct handoff from caliber web app content script
    const sid = msg.sessionId;
    if (sid && typeof sid === "string") {
      const toStore = { caliberSessionId: sid };
      // Persist full session backup for server-side restoration
      if (msg.sessionBackup && typeof msg.sessionBackup === "object" && msg.sessionBackup.sessionId === sid) {
        toStore.caliberSessionBackup = msg.sessionBackup;
        // Extract calibration title + nearby roles from session backup so they
        // are available immediately (before any scoring API calls complete).
        try {
          const titleRec = msg.sessionBackup.synthesis && msg.sessionBackup.synthesis.titleRecommendation;
          const primaryTitle = (titleRec && titleRec.primary_title && titleRec.primary_title.title) || "";
          const adjTitles = (titleRec && Array.isArray(titleRec.adjacent_titles)) ? titleRec.adjacent_titles : [];
          // Fall back to all title candidates when adjacent_titles is empty
          const allTitles = (titleRec && Array.isArray(titleRec.titles)) ? titleRec.titles : [];
          const titlePool = adjTitles.length > 0
            ? adjTitles
            : allTitles.filter(t => t.title !== primaryTitle);
          if (primaryTitle) {
            toStore.caliberCalibrationTitle = primaryTitle;
            toStore.caliberNearbyRoles = titlePool.slice(0, 3).map(t => ({ title: t.title || "" }));
            console.debug("[Caliber][bg][session] extracted calibration title from backup: \"" + primaryTitle +
              "\", nearbyRoles: " + toStore.caliberNearbyRoles.length);
          }
        } catch (e) {
          console.debug("[Caliber][bg][session] unable to extract calibration title from backup: " + e.message);
        }
      }
      chrome.storage.local.set(toStore);
      console.debug("[Caliber][bg][session] handoff stored: " + sid);
      // Notify LinkedIn tabs that session is now available
      notifyLinkedInTabsSessionReady();
      sendResponse({ ok: true });
    } else {
      sendResponse({ ok: false });
    }
    return false;
  }
});

/**
 * Discover the active calibration session from the server.
 * Returns { sessionId, profileComplete, state } or throws.
 */
/**
 * Read the caliber_sessionId cookie directly via the cookies API.
 * Works even when no Caliber tab is open.
 */
async function readSessionCookie() {
  try {
    const cookie = await chrome.cookies.get({
      url: CALIBER_ORIGIN + "/",
      name: "caliber_sessionId",
    });
    return cookie && cookie.value ? cookie.value : null;
  } catch { return null; }
}

/**
 * Try to fetch a session from the server.
 * When a session backup is provided and the server doesn't have the session,
 * sends it inline via POST so the Lambda can import it on the spot (avoids
 * the Vercel multi-Lambda race where PUT and GET hit different instances).
 * Returns { ok, sessionId, profileComplete, state } or { ok: false }.
 */
async function trySessionEndpoint(storedId, sessionBackup) {
  // Stage 1: POST with inline backup — lets the server import if needed
  if (storedId && sessionBackup) {
    try {
      const resp = await fetch(API_BASE + "/api/extension/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: storedId, sessionBackup }),
        signal: AbortSignal.timeout(5000),
      });
      console.debug("[Caliber][bg][session] stage1 POST: http=" + resp.status);
      if (resp.ok) {
        const data = await resp.json();
        if (data.ok && data.sessionId && data.profileComplete) {
          return { ok: true, sessionId: data.sessionId, profileComplete: true, state: data.state };
        }
        console.debug("[Caliber][bg][session] stage1 POST: data.ok=" + data.ok +
          ", data.sessionId=" + !!data.sessionId + ", profileComplete=" + data.profileComplete);
      }
    } catch (e1) { console.warn("[Caliber][bg][session] stage1 POST failed: " + e1.message); }
  }

  // Stage 2: GET with stored sessionId
  if (storedId) {
    try {
      const resp = await fetch(API_BASE + "/api/extension/session?sessionId=" + encodeURIComponent(storedId), { signal: AbortSignal.timeout(5000) });
      console.debug("[Caliber][bg][session] stage2 GET(id): http=" + resp.status);
      if (resp.ok) {
        const data = await resp.json();
        if (data.ok && data.profileComplete) {
          return { ok: true, sessionId: data.sessionId, profileComplete: true, state: data.state };
        }
        console.debug("[Caliber][bg][session] stage2 GET(id): data.ok=" + data.ok + ", profileComplete=" + data.profileComplete);
      }
    } catch (e2) { console.warn("[Caliber][bg][session] stage2 GET(id) failed: " + e2.message); }
  }

  // Stage 3: GET latest session — critical fallback, use generous timeout
  try {
    console.debug("[Caliber][bg][session] stage3 GET(latest) → " + API_BASE + "/api/extension/session");
    const resp = await fetch(API_BASE + "/api/extension/session", { signal: AbortSignal.timeout(8000) });
    console.debug("[Caliber][bg][session] stage3 GET(latest): http=" + resp.status);
    if (resp.ok) {
      const data = await resp.json();
      if (data.ok && data.sessionId) {
        console.debug("[Caliber][bg][session] stage3 resolved: " + data.sessionId + " (profileComplete=" + data.profileComplete + ")");
        return { ok: true, sessionId: data.sessionId, profileComplete: data.profileComplete, state: data.state };
      }
      console.warn("[Caliber][bg][session] stage3 GET(latest): server responded but no session — data.ok=" + data.ok);
    }
  } catch (e3) { console.warn("[Caliber][bg][session] stage3 GET(latest) failed: " + e3.message); }

  return { ok: false };
}

async function discoverSession() {
  console.debug("[Caliber][bg][session] discoverSession() invoked");

  // ── Step 0: Read the session cookie first ────────────────────
  // The caliber_sessionId cookie is set directly by the calibration page at
  // session-create time and always reflects the current user's active session.
  // Reading it FIRST prevents stale chrome.storage from causing cross-profile
  // contamination when a previous user's sessionId lingers in storage.
  const cookieId = await readSessionCookie();

  const store = await chrome.storage.local.get(["caliberSessionId", "caliberSessionBackup"]);
  let storedId = store.caliberSessionId;
  let sessionBackup = store.caliberSessionBackup || null;
  console.debug("[Caliber][bg][session] stored sessionId: " + (storedId || "(none)") +
    ", hasBackup: " + !!sessionBackup + ", cookieId: " + (cookieId || "(none)"));

  // If the cookie is present and differs from storage, the cookie wins.
  // Discard any backup that belongs to the old (potentially cross-profile) session.
  if (cookieId && cookieId !== storedId) {
    console.debug("[Caliber][bg][session] cookie overrides stale storage: " +
      cookieId + " (was " + (storedId || "none") + ")");
    storedId = cookieId;
    if (sessionBackup && sessionBackup.sessionId !== cookieId) {
      sessionBackup = null;
      console.debug("[Caliber][bg][session] discarded backup from different session");
    }
    await chrome.storage.local.set({ caliberSessionId: cookieId });
  }

  // If no stored session, probe open Caliber tabs FIRST (before server discovery).
  // This handles the fresh-install race: extension installed while Caliber tab is
  // already open, but content script injection hasn't completed yet.
  if (!storedId) {
    const probed = await probeCaliberTabsForSession();
    if (probed && probed.sessionId) {
      const toStore = { caliberSessionId: probed.sessionId };
      if (probed.sessionBackup && typeof probed.sessionBackup === "object" && probed.sessionBackup.sessionId === probed.sessionId) {
        toStore.caliberSessionBackup = probed.sessionBackup;
        sessionBackup = probed.sessionBackup;
      }
      await chrome.storage.local.set(toStore);
      storedId = probed.sessionId;

      // Best-effort: restore backup to server so the API works immediately
      if (probed.sessionBackup) {
        try {
          await fetch(API_BASE + "/api/calibration", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ session: probed.sessionBackup }),
            signal: AbortSignal.timeout(5000),
          });
        } catch { /* best-effort restore */ }
      }
    }
  }

  // Single locked endpoint — sends backup inline via POST so the Vercel Lambda
  // can import it without a separate PUT (avoids multi-Lambda mismatch).
  const result = await trySessionEndpoint(storedId, sessionBackup);
  if (result.ok && result.profileComplete) {
    if (result.sessionId) {
      await chrome.storage.local.set({ caliberSessionId: result.sessionId });
    }
    console.debug("[Caliber][bg][session] discoverSession resolved via trySessionEndpoint: " + result.sessionId);
    return { sessionId: result.sessionId, profileComplete: result.profileComplete, state: result.state };
  }
  if (result.ok && !result.profileComplete) {
    console.debug("[Caliber][bg][session] trySessionEndpoint returned ok but profileComplete=false — continuing fallback");
  } else {
    console.warn("[Caliber][bg][session] trySessionEndpoint returned ok=false (storedId=" + (storedId || "none") + ")");
  }

  // Server doesn't have the session — try restoring from local backup.
  // SAFETY: only restore when the cookie confirms this session belongs to the
  // current user.  Without the cookie we cannot distinguish a stale
  // (cross-profile) backup from a legitimately evicted session, so we skip
  // restoration to prevent re-injecting another user's profile.
  if (storedId && cookieId === storedId) {
    const backup = sessionBackup;
    if (backup && backup.sessionId === storedId) {
      try {
        const restoreResp = await fetch(API_BASE + "/api/calibration", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ session: backup }),
          signal: AbortSignal.timeout(5000),
        });
        if (restoreResp.ok) {
          // Retry session endpoint now that we've restored
          const retry = await trySessionEndpoint(storedId, backup);
          if (retry.ok && retry.profileComplete) {
            return { sessionId: retry.sessionId, profileComplete: true, state: retry.state };
          }
        }
      } catch { /* restore failed — fall through */ }
    }
  } else if (storedId && !cookieId) {
    console.debug("[Caliber][bg][session] skipping backup restore: no cookie to confirm session ownership");
  }

  // Last resort: probe Caliber tabs one more time (handles race with fresh install)
  const lateProbe = await probeCaliberTabsForSession();
  if (lateProbe && lateProbe.sessionId) {
    const toStore = { caliberSessionId: lateProbe.sessionId };
    if (lateProbe.sessionBackup && typeof lateProbe.sessionBackup === "object" && lateProbe.sessionBackup.sessionId === lateProbe.sessionId) {
      toStore.caliberSessionBackup = lateProbe.sessionBackup;
    }
    await chrome.storage.local.set(toStore);
    // Restore to server
    if (lateProbe.sessionBackup) {
      try {
        await fetch(API_BASE + "/api/calibration", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ session: lateProbe.sessionBackup }),
          signal: AbortSignal.timeout(5000),
        });
      } catch { /* best-effort */ }
    }
    return { sessionId: lateProbe.sessionId, profileComplete: true, state: "UNKNOWN" };
  }

  // Final fallback: use the session cookie read at the start of this function.
  // (Requires the "cookies" permission in manifest.json.)
  if (cookieId) {
    await chrome.storage.local.set({ caliberSessionId: cookieId });

    // Best-effort: try to fetch the full session from the server to cache as backup
    try {
      const fetchResp = await fetch(API_BASE + "/api/calibration?sessionId=" + encodeURIComponent(cookieId), {
        signal: AbortSignal.timeout(5000),
      });
      if (fetchResp.ok) {
        const fetchData = await fetchResp.json();
        if (fetchData.ok && fetchData.session) {
          await chrome.storage.local.set({ caliberSessionBackup: fetchData.session });
        }
      }
    } catch { /* best-effort — server may not have the session on this Lambda */ }

    // Return optimistic — callFitAPI will send inline backup if available
    return { sessionId: cookieId, profileComplete: true, state: "UNKNOWN" };
  }

  throw new Error("No active Caliber session. Complete your profile on Caliber first. (API_BASE=" + API_BASE + ")");
}

/**
 * Ensure we have a valid session, then call the fit API.
 */
async function ensureSessionThenFit(jobText, fitOptions) {
  // Try to discover/verify session first
  let sessionId;
  try {
    const info = await discoverSession();
    sessionId = info.sessionId;
    if (!info.profileComplete) {
      throw new Error("Profile incomplete. Finish calibration on Caliber first.");
    }
  } catch (err) {
    throw new Error(err.message || "No active Caliber session. Complete your profile on Caliber first.");
  }

  return callFitAPI(jobText, sessionId, fitOptions);
}

/**
 * Attempt to restore a lost session to the server from the locally cached backup.
 * Returns true if the server accepted the restore.
 */
async function tryRestoreSession(sessionId) {
  const store = await chrome.storage.local.get(["caliberSessionBackup"]);
  const backup = store.caliberSessionBackup;
  if (!backup || backup.sessionId !== sessionId) return false;
  try {
    const resp = await fetch(API_BASE + "/api/calibration", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session: backup }),
    });
    return resp.ok;
  } catch { return false; }
}

/**
 * Look up a job in the Canonical Job Cache for the given session.
 * Returns null on miss or any error. Never throws.
 * Maps the cache payload to the same shape as the fit API response so
 * content scripts can use it directly without branching.
 */
async function lookupJobCacheForSession(sourceUrl, sessionId) {
  const url = API_BASE + "/api/jobs/cache"
    + "?url=" + encodeURIComponent(sourceUrl)
    + "&sessionId=" + encodeURIComponent(sessionId);
  const resp = await fetch(url, { method: "GET", signal: AbortSignal.timeout(3000) });
  if (!resp.ok) return null;
  const data = await resp.json();
  if (!data.ok || !data.score) return null;

  const p = data.score.payload || {};
  return {
    score_0_to_10: data.score.score,
    supports_fit: Array.isArray(p.supportsFit) ? p.supportsFit : [],
    stretch_factors: Array.isArray(p.stretchFactors) ? p.stretchFactors : [],
    bottom_line_2s: "",
    hiring_reality_check: {
      band: p.hrcBand || null,
      reason: p.hrcReason || null,
      execution_evidence_gap: null,
    },
    calibration_title: p.calibrationTitle || "",
    nearby_roles: [],
    recovery_terms: [],
    signal_preference: null,
    debug_signals: null,
    debug_work_mode: null,
    debug_recovery_terms: null,
    _fromCache: true,
    _cachedAt: data.score.scoredAt,
    _textSource: data.score.textSource,
  };
}

async function callFitAPI(jobText, sessionId, options) {
  const isPrescan = !!(options && options.prescan);
  const body = { jobText };
  if (sessionId) body.sessionId = sessionId;
  if (isPrescan) body.prescan = true;
  if (options && options.sourceUrl) body.sourceUrl = String(options.sourceUrl).slice(0, 2000);
  if (options && options.title) body.title = String(options.title).slice(0, 300);
  if (options && options.company) body.company = String(options.company).slice(0, 200);

  // ── Cache-first: instant hydration for already-known jobs (sidecard only) ──
  // Attempt a fast lookup against the Canonical Job Cache before calling the
  // fit API. If the current session already scored this job, return the cached
  // result immediately. Falls through to full scoring on miss, error, or prescan.
  //
  // Safety invariants:
  //   - Only for non-prescan sidecard calls (isPrescan=false)
  //   - Only when sourceUrl is present (needed for canonical key lookup)
  //   - Only reuses score for the *same* sessionId (never cross-session)
  //   - Failure of the cache lookup never blocks fresh scoring
  if (!isPrescan && sessionId && options && options.sourceUrl) {
    try {
      const cacheHit = await lookupJobCacheForSession(options.sourceUrl, sessionId);
      if (cacheHit) {
        console.debug("[Caliber][bg][cache] HIT — returning cached score " + cacheHit.score_0_to_10.toFixed(1) + " for " + options.sourceUrl);
        return cacheHit;
      }
    } catch (cacheErr) {
      // Non-fatal — proceed with fresh scoring
      console.debug("[Caliber][bg][cache] lookup skipped (non-fatal):", cacheErr.message);
    }
  }

  // Include session backup for serverless resilience. Sidecard calls always
  // include it. Prescan calls include it too (avoids 401 → restore → retry
  // cycle on cold Lambdas that don't have the session).
  const backupStore = await chrome.storage.local.get(["caliberSessionBackup"]);
  if (backupStore.caliberSessionBackup && backupStore.caliberSessionBackup.sessionId === sessionId) {
    body.sessionBackup = backupStore.caliberSessionBackup;
  }

  const label = isPrescan ? "prescan" : "sidecard";
  const timeout = isPrescan ? 12000 : 25000;
  console.debug("[Caliber][bg][fetch][" + label + "] POST /api/extension/fit (" + (jobText || "").length + " chars)");

  // Retry with backoff for transient network errors ("Failed to fetch")
  let resp;
  var maxAttempts = isPrescan ? 1 : 3;
  for (var attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      resp = await fetch(API_BASE + "/api/extension/fit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(timeout),
      });
      break; // success — exit retry loop
    } catch (fetchErr) {
      console.warn("[Caliber][bg][fetch][" + label + "] attempt " + attempt + "/" + maxAttempts + " failed: " + fetchErr.message);
      if (attempt >= maxAttempts) {
        throw new Error("Network error: " + fetchErr.message);
      }
      // Backoff: 1.5s, 3s
      await new Promise(r => setTimeout(r, attempt * 1500));
    }
  }

  // If session not found (401), try restoring from backup then retry
  if (resp.status === 401 && sessionId) {
    console.debug("[Caliber][bg][fetch][" + label + "] 401 — attempting session restore");
    const restored = await tryRestoreSession(sessionId);
    if (restored) {
      // Retry with inline backup for resilience
      if (!body.sessionBackup) {
        const backupStore = await chrome.storage.local.get(["caliberSessionBackup"]);
        if (backupStore.caliberSessionBackup && backupStore.caliberSessionBackup.sessionId === sessionId) {
          body.sessionBackup = backupStore.caliberSessionBackup;
        }
      }
      try {
        resp = await fetch(API_BASE + "/api/extension/fit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(timeout),
        });
      } catch (retryErr) {
        console.error("[Caliber][bg][fetch][" + label + "] retry network error: " + retryErr.message);
        throw new Error("Network error on retry: " + retryErr.message);
      }
    }
  }

  let data;
  try {
    data = await resp.json();
  } catch (parseErr) {
    console.error("[Caliber][bg][fetch][" + label + "] response parse error: " + resp.status);
    throw new Error("API returned invalid response (status " + resp.status + ")");
  }

  if (!resp.ok) {
    console.warn("[Caliber][bg][fetch][" + label + "] API error " + resp.status + ": " + (data.error || ""));
    if (resp.status === 401 || /session|pipeline|SUBMIT_JOB/i.test(data.error || "")) {
      throw new Error("No active calibration found. Complete your calibration on Caliber first.");
    }
    throw new Error(data.error || "API error " + resp.status);
  }

  console.debug("[Caliber][bg][fetch][" + label + "] success (score=" + (data.score_0_to_10 || "?") + ")");
  if (data.calibrationId) {
    await chrome.storage.local.set({ caliberSessionId: data.calibrationId });
  }
  if (data.signal_preference) {
    // Don't overwrite manual override from popup toggle
    const store = await chrome.storage.local.get(["caliberSignalOverride"]);
    if (!store.caliberSignalOverride) {
      await chrome.storage.local.set({ caliberSignalPreference: data.signal_preference });
    }
  }
  return data;
}
