// background.js — Caliber service worker (proxies API calls for content scripts)

importScripts("env.js");

// Locked base URL from environment config — no fallback between prod/dev
const API_BASE = CALIBER_ENV.API_BASE;
let resolvedBase = API_BASE;

// Derive the Caliber origin from the API_BASE URL (e.g. "http://localhost:3000")
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
    ensureSessionThenFit(msg.jobText)
      .then((data) => sendResponse({ ok: true, data }))
      .catch((err) => sendResponse({ ok: false, error: err.message }));
    return true;
  }
  if (msg.type === "CALIBER_FEEDBACK") {
    fetch(API_BASE + "/api/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(msg.payload),
      signal: AbortSignal.timeout(5000),
    })
      .then((r) => r.json())
      .then((data) => sendResponse({ ok: true, data }))
      .catch((err) => sendResponse({ ok: false, error: err.message }));
    return true;
  }
  if (msg.type === "CALIBER_SESSION_DISCOVER") {
    discoverSession()
      .then((info) => sendResponse({ ok: true, ...info }))
      .catch((err) => sendResponse({ ok: false, error: err.message }));
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
  if (msg.type === "CALIBER_OPEN_PIPELINE") {
    chrome.tabs.create({ url: API_BASE + "/pipeline" });
    sendResponse({ ok: true });
    return false;
  }
  if (msg.type === "CALIBER_TAILOR_PREPARE") {
    (async () => {
      try {
        // Get session ID
        const store = await chrome.storage.local.get(["caliberSessionId"]);
        const sessionId = store.caliberSessionId;
        if (!sessionId) throw new Error("No Caliber session. Complete calibration first.");

        const resp = await fetch(API_BASE + "/api/tailor/prepare", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId,
            jobTitle: msg.jobTitle || "",
            company: msg.company || "",
            jobUrl: msg.jobUrl || "",
            jobText: msg.jobText || "",
            score: msg.score || 0,
          }),
        });
        const data = await resp.json();
        if (!data.ok) throw new Error(data.error || "Prepare failed");

        // Open the tailor page
        chrome.tabs.create({ url: API_BASE + "/tailor?id=" + encodeURIComponent(data.prepareId) });
        sendResponse({ ok: true });
      } catch (err) {
        sendResponse({ ok: false, error: err.message });
      }
    })();
    return true;
  }
  if (msg.type === "CALIBER_SESSION_HANDOFF") {
    // Direct handoff from caliber web app content script
    const sid = msg.sessionId;
    if (sid && typeof sid === "string") {
      const toStore = { caliberSessionId: sid };
      // Persist full session backup for server-side restoration
      if (msg.sessionBackup && typeof msg.sessionBackup === "object" && msg.sessionBackup.sessionId === sid) {
        toStore.caliberSessionBackup = msg.sessionBackup;
      }
      chrome.storage.local.set(toStore);
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
 * Try to fetch a session from a specific base URL.
 * Returns { ok, sessionId, profileComplete, state, base } or { ok: false }.
 */
async function trySessionEndpoint(storedId) {
  // Try stored sessionId first
  if (storedId) {
    try {
      const resp = await fetch(API_BASE + "/api/extension/session?sessionId=" + encodeURIComponent(storedId), { signal: AbortSignal.timeout(3000) });
      if (resp.ok) {
        const data = await resp.json();
        if (data.ok && data.profileComplete) {
          return { ok: true, sessionId: data.sessionId, profileComplete: true, state: data.state };
        }
      }
    } catch { /* endpoint unreachable or timeout */ }
  }

  // Try latest session
  try {
    const resp = await fetch(API_BASE + "/api/extension/session", { signal: AbortSignal.timeout(3000) });
    if (resp.ok) {
      const data = await resp.json();
      if (data.ok && data.sessionId) {
        return { ok: true, sessionId: data.sessionId, profileComplete: data.profileComplete, state: data.state };
      }
    }
  } catch { /* endpoint unreachable */ }

  return { ok: false };
}

async function discoverSession() {
  const store = await chrome.storage.local.get(["caliberSessionId"]);
  let storedId = store.caliberSessionId;

  // If no stored session, probe open Caliber tabs FIRST (before server discovery).
  // This handles the fresh-install race: extension installed while Caliber tab is
  // already open, but content script injection hasn't completed yet.
  if (!storedId) {
    const probed = await probeCaliberTabsForSession();
    if (probed && probed.sessionId) {
      const toStore = { caliberSessionId: probed.sessionId };
      if (probed.sessionBackup && typeof probed.sessionBackup === "object" && probed.sessionBackup.sessionId === probed.sessionId) {
        toStore.caliberSessionBackup = probed.sessionBackup;
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
            signal: AbortSignal.timeout(3000),
          });
        } catch { /* best-effort restore */ }
      }
    }
  }

  // Single locked endpoint — no fallback between prod/dev
  const result = await trySessionEndpoint(storedId);
  if (result.ok) {
    if (result.sessionId) {
      await chrome.storage.local.set({ caliberSessionId: result.sessionId });
    }
    return { sessionId: result.sessionId, profileComplete: result.profileComplete, state: result.state };
  }

  // Server doesn't have the session — try restoring from local backup
  if (storedId) {
    const backupStore = await chrome.storage.local.get(["caliberSessionBackup"]);
    const backup = backupStore.caliberSessionBackup;
    if (backup && backup.sessionId === storedId) {
      try {
        const restoreResp = await fetch(API_BASE + "/api/calibration", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ session: backup }),
          signal: AbortSignal.timeout(3000),
        });
        if (restoreResp.ok) {
          // Retry session endpoint now that we've restored
          const retry = await trySessionEndpoint(storedId);
          if (retry.ok) {
            return { sessionId: retry.sessionId, profileComplete: retry.profileComplete, state: retry.state };
          }
        }
      } catch { /* restore failed — fall through to optimistic */ }
    }
    // Optimistic fallback — session may still work via inline backup in callFitAPI
    return { sessionId: storedId, profileComplete: true, state: "UNKNOWN" };
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
          signal: AbortSignal.timeout(3000),
        });
      } catch { /* best-effort */ }
    }
    return { sessionId: lateProbe.sessionId, profileComplete: true, state: "UNKNOWN" };
  }

  throw new Error("No active Caliber session. Complete your profile on Caliber first.");
}

/**
 * Ensure we have a valid session, then call the fit API.
 */
async function ensureSessionThenFit(jobText) {
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

  return callFitAPI(jobText, sessionId);
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

async function callFitAPI(jobText, sessionId) {
  const body = { jobText };
  if (sessionId) body.sessionId = sessionId;

  // Include session backup inline for serverless resilience — avoids
  // multi-Lambda mismatch where restore PUT and fit POST hit different instances.
  const backupStore = await chrome.storage.local.get(["caliberSessionBackup"]);
  if (backupStore.caliberSessionBackup && backupStore.caliberSessionBackup.sessionId === sessionId) {
    body.sessionBackup = backupStore.caliberSessionBackup;
  }

  let resp = await fetch(API_BASE + "/api/extension/fit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  // If session not found (401) and we didn't have inline backup, try restoring separately
  if (resp.status === 401 && sessionId && !body.sessionBackup) {
    const restored = await tryRestoreSession(sessionId);
    if (restored) {
      resp = await fetch(API_BASE + "/api/extension/fit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    }
  }

  const data = await resp.json();
  if (!resp.ok) {
    throw new Error(data.error || "API error " + resp.status);
  }

  if (data.calibrationId) {
    await chrome.storage.local.set({ caliberSessionId: data.calibrationId });
  }
  return data;
}
