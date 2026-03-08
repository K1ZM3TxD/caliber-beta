// background.js — Caliber service worker (proxies API calls for content scripts)

importScripts("env.js");

// Locked base URL from environment config — no fallback between prod/dev
const API_BASE = CALIBER_ENV.API_BASE;
let resolvedBase = API_BASE;

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === "CALIBER_FIT_API") {
    ensureSessionThenFit(msg.jobText)
      .then((data) => sendResponse({ ok: true, data }))
      .catch((err) => sendResponse({ ok: false, error: err.message }));
    return true; // keep channel open for async
  }
  if (msg.type === "CALIBER_SESSION_DISCOVER") {
    discoverSession()
      .then((info) => sendResponse({ ok: true, ...info }))
      .catch((err) => sendResponse({ ok: false, error: err.message }));
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
  const storedId = store.caliberSessionId;

  // Single locked endpoint — no fallback between prod/dev
  const result = await trySessionEndpoint(storedId);
  if (result.ok) {
    if (result.sessionId) {
      await chrome.storage.local.set({ caliberSessionId: result.sessionId });
    }
    return { sessionId: result.sessionId, profileComplete: result.profileComplete, state: result.state };
  }

  // No endpoint had a session — if we have a stored id, use it optimistically
  if (storedId) {
    return { sessionId: storedId, profileComplete: true, state: "UNKNOWN" };
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

  let resp = await fetch(API_BASE + "/api/extension/fit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  // If session not found (401), try restoring from backup and retry once
  if (resp.status === 401 && sessionId) {
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
