// background.js — Caliber service worker (proxies API calls for content scripts)

const API_ENDPOINTS = [
  "https://www.caliber-app.com",  // production first
  "http://localhost:3000",         // local dev fallback
];

// Resolved base URL — set once a working endpoint is found
let resolvedBase = null;

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
    // Direct handoff from caliber-app.com or codespace content script
    const sid = msg.sessionId;
    const base = msg.baseUrl;
    if (sid && typeof sid === "string") {
      chrome.storage.local.set({ caliberSessionId: sid });
      // Store the base URL so we can reach this Caliber instance later
      if (base && typeof base === "string") {
        chrome.storage.local.set({ caliberBaseUrl: base });
        resolvedBase = base;
      }
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
async function trySessionEndpoint(base, storedId) {
  // Try stored sessionId first
  if (storedId) {
    try {
      const resp = await fetch(base + "/api/extension/session?sessionId=" + encodeURIComponent(storedId), { signal: AbortSignal.timeout(3000) });
      if (resp.ok) {
        const data = await resp.json();
        if (data.ok && data.profileComplete) {
          return { ok: true, sessionId: data.sessionId, profileComplete: true, state: data.state, base };
        }
      }
    } catch { /* endpoint unreachable or timeout */ }
  }

  // Try latest session
  try {
    const resp = await fetch(base + "/api/extension/session", { signal: AbortSignal.timeout(3000) });
    if (resp.ok) {
      const data = await resp.json();
      if (data.ok && data.sessionId) {
        return { ok: true, sessionId: data.sessionId, profileComplete: data.profileComplete, state: data.state, base };
      }
    }
  } catch { /* endpoint unreachable */ }

  return { ok: false };
}

async function discoverSession() {
  const store = await chrome.storage.local.get(["caliberSessionId", "caliberBaseUrl"]);
  const storedId = store.caliberSessionId;
  const storedBase = store.caliberBaseUrl;

  // Build endpoint list: stored base URL first (from content script handoff), then defaults
  const endpoints = [...API_ENDPOINTS];
  if (storedBase && !endpoints.includes(storedBase)) {
    endpoints.unshift(storedBase);
  }

  // Try each endpoint in order; use the first one that has a valid session
  for (const base of endpoints) {
    const result = await trySessionEndpoint(base, storedId);
    if (result.ok) {
      resolvedBase = result.base;
      if (result.sessionId) {
        await chrome.storage.local.set({ caliberSessionId: result.sessionId });
      }
      return { sessionId: result.sessionId, profileComplete: result.profileComplete, state: result.state };
    }
  }

  // No endpoint had a session — if we have a stored id, use it optimistically
  if (storedId) {
    resolvedBase = storedBase || API_ENDPOINTS[0];
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

async function callFitAPI(jobText, sessionId) {
  const base = resolvedBase || API_ENDPOINTS[0];
  const body = { jobText };
  if (sessionId) body.sessionId = sessionId;

  // Try the resolved base first, then fall back to other endpoints
  const bases = [base, ...API_ENDPOINTS.filter(b => b !== base)];

  for (const url of bases) {
    try {
      const resp = await fetch(url + "/api/extension/fit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await resp.json();
      if (!resp.ok) {
        // If this endpoint explicitly says no session, try the next one
        if (resp.status === 401 && bases.indexOf(url) < bases.length - 1) continue;
        throw new Error(data.error || "API error " + resp.status);
      }

      resolvedBase = url;
      if (data.calibrationId) {
        await chrome.storage.local.set({ caliberSessionId: data.calibrationId });
      }
      return data;
    } catch (err) {
      // Network error — try next endpoint
      if (bases.indexOf(url) < bases.length - 1) continue;
      throw err;
    }
  }
}
