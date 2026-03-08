// content_caliber.js — Runs on the Caliber web app to hand off sessionId to the extension.
// Reads the caliber_sessionId cookie and forwards it to the background worker.

(function () {
  function readCookie(name) {
    var m = document.cookie.match(new RegExp("(?:^|; )" + name + "=([^;]*)"));
    return m ? decodeURIComponent(m[1]) : null;
  }

  function handoff() {
    var sessionId = readCookie("caliber_sessionId");
    if (!sessionId) return;

    // Send sessionId + the base URL of this Caliber instance
    var baseUrl = window.location.origin;
    chrome.runtime.sendMessage(
      { type: "CALIBER_SESSION_HANDOFF", sessionId: sessionId, baseUrl: baseUrl },
      function () {
        // Ignore response / errors — best-effort handoff
        if (chrome.runtime.lastError) { /* noop */ }
      }
    );
  }

  // Run immediately on page load
  handoff();

  // Also watch for the cookie to appear after SPA navigation / calibration completion.
  // The calibration page sets the cookie via JS, so poll briefly.
  var attempts = 0;
  var maxAttempts = 30; // 30s of polling
  var interval = setInterval(function () {
    attempts++;
    handoff();
    if (attempts >= maxAttempts) clearInterval(interval);
  }, 1000);

  // Listen for custom event from the calibration page (explicit handoff signal)
  window.addEventListener("caliber:session-ready", function (e) {
    var detail = e.detail || {};
    if (detail.sessionId) {
      chrome.runtime.sendMessage(
        { type: "CALIBER_SESSION_HANDOFF", sessionId: detail.sessionId },
        function () { if (chrome.runtime.lastError) { /* noop */ } }
      );
    }
  });
})();
