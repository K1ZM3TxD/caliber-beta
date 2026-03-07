// background.js — Caliber service worker (proxies API calls for content scripts)

const API_BASE = "https://www.caliber-app.com";

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
    // Direct handoff from caliber-app.com content script
    const sid = msg.sessionId;
    if (sid && typeof sid === "string") {
      chrome.storage.local.set({ caliberSessionId: sid });
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
async function discoverSession() {
  // 1. Check chrome.storage.local first (set by content_caliber.js handoff or prior discovery)
  const store = await chrome.storage.local.get(["caliberSessionId"]);
  const storedId = store.caliberSessionId;

  // 2. If we have a stored sessionId, try to verify it via the session endpoint
  if (storedId) {
    try {
      const resp = await fetch(API_BASE + "/api/extension/session?sessionId=" + encodeURIComponent(storedId));
      if (resp.ok) {
        const data = await resp.json();
        if (data.ok) {
          return { sessionId: data.sessionId, profileComplete: data.profileComplete, state: data.state };
        }
      }
    } catch {
      // Session endpoint unreachable — use stored sessionId optimistically.
      // The fit API will validate it server-side anyway.
      return { sessionId: storedId, profileComplete: true, state: "UNKNOWN" };
    }
  }

  // 3. Fall back to server's latest session (discovery)
  try {
    const resp = await fetch(API_BASE + "/api/extension/session");
    if (resp.ok) {
      const data = await resp.json();
      if (data.ok && data.sessionId) {
        await chrome.storage.local.set({ caliberSessionId: data.sessionId });
        return {
          sessionId: data.sessionId,
          profileComplete: data.profileComplete,
          state: data.state,
        };
      }
    }
  } catch { /* session endpoint not available */ }

  // 4. If we have a stored sessionId but couldn't verify, use it anyway
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

async function callFitAPI(jobText, sessionId) {
  const body = { jobText };
  if (sessionId) body.sessionId = sessionId;

  const resp = await fetch(API_BASE + "/api/extension/fit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const data = await resp.json();
  if (!resp.ok) throw new Error(data.error || "API error " + resp.status);

  if (data.calibrationId) {
    await chrome.storage.local.set({ caliberSessionId: data.calibrationId });
  }

  return data;
}
