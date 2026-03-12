// content_caliber.js — Runs on the Caliber web app to hand off sessionId to the extension.
// Reads the caliber_sessionId cookie and forwards it to the background worker.

(function () {
  // Guard against duplicate injection within the same extension lifecycle.
  // Use the extension ID so that after an extension refresh (new ID/context),
  // a fresh injection is allowed.
  var guardKey = "__CALIBER_CONTENT_CALIBER_" + chrome.runtime.id;
  if (window[guardKey]) return;
  window[guardKey] = true;

  function readCookie(name) {
    var m = document.cookie.match(new RegExp("(?:^|; )" + name + "=([^;]*)"));
    return m ? decodeURIComponent(m[1]) : null;
  }

  function getSessionBackup() {
    try {
      var raw = localStorage.getItem("caliber_session_backup");
      if (raw) return JSON.parse(raw);
    } catch (e) { /* ignore parse errors */ }
    return null;
  }

  function handoff() {
    var sessionId = readCookie("caliber_sessionId");
    if (!sessionId) return;

    var sessionBackup = getSessionBackup();

    // Send sessionId + backup blob to the background worker
    var baseUrl = window.location.origin;
    try {
      chrome.runtime.sendMessage(
        { type: "CALIBER_SESSION_HANDOFF", sessionId: sessionId, baseUrl: baseUrl, sessionBackup: sessionBackup },
        function () {
          // Ignore response / errors — best-effort handoff
          if (chrome.runtime.lastError) { /* noop */ }
        }
      );
    } catch (e) {
      // Extension context invalidated (extension was reloaded/updated).
      // Nothing we can do here — the background's onInstalled handler will
      // re-inject this script and retry.
    }
  }

  // Run immediately on page load
  handoff();

  // Also watch for the cookie to appear after SPA navigation / calibration completion.
  // The calibration page sets the cookie via JS, so poll briefly.
  var attempts = 0;
  var maxAttempts = 1800; // 30 min — generous window for calibration to complete
  var interval = setInterval(function () {
    attempts++;
    handoff();
    if (attempts >= maxAttempts) clearInterval(interval);
  }, 1000);

  // Listen for custom event from the calibration page (explicit handoff signal)
  window.addEventListener("caliber:session-ready", function (e) {
    var detail = e.detail || {};
    if (detail.sessionId) {
      var sessionBackup = getSessionBackup();
      try {
        chrome.runtime.sendMessage(
          { type: "CALIBER_SESSION_HANDOFF", sessionId: detail.sessionId, baseUrl: window.location.origin, sessionBackup: sessionBackup },
          function () { if (chrome.runtime.lastError) { /* noop */ } }
        );
      } catch (ex) { /* extension context invalidated */ }
    }
  });

  // Listen for explicit session probe from the background worker.
  // This handles the case where the background needs the session after
  // extension install/refresh and probeCaliberTabsForSession() injected us.
  chrome.runtime.onMessage.addListener(function (msg, _sender, sendResponse) {
    if (msg.type === "CALIBER_SESSION_PROBE") {
      var sessionId = readCookie("caliber_sessionId");
      var sessionBackup = getSessionBackup();
      sendResponse({ sessionId: sessionId, sessionBackup: sessionBackup });
      // Also trigger a full handoff for good measure
      if (sessionId) handoff();
      return false;
    }
  });
})();
