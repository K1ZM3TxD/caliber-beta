// background.js — Caliber service worker (proxies API calls for content scripts)

const API_BASE = "https://www.caliber-app.com";

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === "CALIBER_FIT_API") {
    handleFitAPI(msg.jobText)
      .then((data) => sendResponse({ ok: true, data }))
      .catch((err) => sendResponse({ ok: false, error: err.message }));
    return true; // keep channel open for async
  }
});

async function handleFitAPI(jobText) {
  const store = await chrome.storage.local.get(["caliberSessionId"]);
  const body = { jobText };
  if (store.caliberSessionId) body.sessionId = store.caliberSessionId;

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
