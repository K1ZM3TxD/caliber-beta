// content_linkedin.js — LinkedIn job description extractor + persistent Caliber panel
// Injected on linkedin.com/jobs/* pages

(function () {
  const API_BASE = "https://www.caliber-app.com";
  const PANEL_HOST_ID = "caliber-panel-host";

  // ─── Job Text Extraction ──────────────────────────────────

  function extractJobText() {
    const selectors = [
      ".jobs-description__content",
      ".jobs-description-content__text",
      ".jobs-box__html-content",
      "#job-details",
      'article[data-job-id]',
      ".job-view-layout .description__text",
    ];
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el && el.innerText && el.innerText.trim().length > 100) {
        return el.innerText.trim().replace(/\s+/g, " ");
      }
    }
    const sel = window.getSelection();
    if (sel && sel.toString().trim().length > 100) {
      return sel.toString().trim().replace(/\s+/g, " ");
    }
    return null;
  }

  function extractWithRetry(retries, delayMs) {
    return new Promise((resolve) => {
      function attempt(remaining) {
        const text = extractJobText();
        if (text || remaining <= 0) { resolve(text); return; }
        setTimeout(() => attempt(remaining - 1), delayMs);
      }
      attempt(retries);
    });
  }

  // ─── Panel State ──────────────────────────────────────────

  let panelHost = null;
  let shadow = null;
  let active = false;
  let scoring = false;
  let lastScoredText = "";
  let watchInterval = null;

  // ─── Panel Creation ───────────────────────────────────────

  function getOrCreatePanel() {
    if (shadow) return shadow;

    panelHost = document.createElement("div");
    panelHost.id = PANEL_HOST_ID;
    panelHost.style.cssText =
      "position:fixed!important;bottom:20px!important;right:20px!important;" +
      "z-index:2147483647!important;";

    shadow = panelHost.attachShadow({ mode: "closed" });

    const style = document.createElement("style");
    style.textContent = PANEL_CSS;
    shadow.appendChild(style);

    const wrapper = document.createElement("div");
    wrapper.innerHTML = PANEL_HTML;
    shadow.appendChild(wrapper.firstElementChild);

    document.body.appendChild(panelHost);

    shadow.getElementById("cb-close").addEventListener("click", deactivatePanel);
    shadow.getElementById("cb-recalc").addEventListener("click", () => scoreCurrentJob(true));
    shadow.getElementById("cb-retry").addEventListener("click", () => scoreCurrentJob(true));

    return shadow;
  }

  function removePanel() {
    if (panelHost && panelHost.parentNode) panelHost.parentNode.removeChild(panelHost);
    panelHost = null;
    shadow = null;
  }

  // ─── Panel State Rendering ────────────────────────────────

  function setPanelState(stateId) {
    for (const id of ["cb-loading", "cb-error", "cb-results"]) {
      const el = shadow.getElementById(id);
      if (el) el.style.display = (id === stateId) ? "" : "none";
    }
  }

  function showLoading(msg) {
    getOrCreatePanel();
    shadow.getElementById("cb-loading-text").textContent = msg || "Computing fit score\u2026";
    setPanelState("cb-loading");
  }

  function showError(msg) {
    getOrCreatePanel();
    shadow.getElementById("cb-error-msg").textContent = msg;
    setPanelState("cb-error");
  }

  function showResults(data) {
    getOrCreatePanel();

    const scoreEl = shadow.getElementById("cb-score");
    const score = Number(data.score_0_to_10) || 0;
    scoreEl.textContent = data.score_0_to_10;
    scoreEl.style.color = score >= 7 ? "#4ADE80" : score >= 4 ? "#FBBF24" : "#EF4444";

    renderList(shadow.getElementById("cb-supports"), data.supports_fit || []);
    renderList(shadow.getElementById("cb-stretch"), data.stretch_factors || []);

    shadow.getElementById("cb-bottomline").textContent = data.bottom_line_2s || "";

    const link = shadow.getElementById("cb-link");
    if (data.calibrationId) {
      link.href = API_BASE + "/calibration?calibrationId=" + data.calibrationId;
    }

    setPanelState("cb-results");
  }

  function renderList(ul, items) {
    ul.innerHTML = "";
    for (const text of items) {
      const li = document.createElement("li");
      li.textContent = text;
      ul.appendChild(li);
    }
  }

  // ─── API Call via Background Service Worker ───────────────

  async function scoreCurrentJob(force) {
    if (scoring) return;
    scoring = true;
    try {
      showLoading("Checking calibration session\u2026");

      // Discover/verify session before attempting to score
      const sessionInfo = await new Promise((resolve, reject) => {
        chrome.runtime.sendMessage(
          { type: "CALIBER_SESSION_DISCOVER" },
          (response) => {
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message));
            } else if (!response || !response.ok) {
              reject(new Error((response && response.error) || "No active Caliber session found."));
            } else {
              resolve(response);
            }
          }
        );
      });

      if (!sessionInfo.profileComplete) {
        showError("Calibration incomplete. Finish the calibration prompts on caliber-app.com first.");
        return;
      }

      showLoading("Extracting job description\u2026");

      const text = await extractWithRetry(6, 800);
      if (!text || text.length < 200) {
        showError(
          text
            ? "Job description too short. Highlight more text and click Recalculate."
            : "Couldn\u2019t detect the job description on this page."
        );
        return;
      }

      if (!force && text === lastScoredText) return;
      lastScoredText = text;

      showLoading("Computing fit score\u2026");

      const data = await new Promise((resolve, reject) => {
        chrome.runtime.sendMessage(
          { type: "CALIBER_FIT_API", jobText: text },
          (response) => {
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message));
            } else if (!response || !response.ok) {
              reject(new Error((response && response.error) || "API error"));
            } else {
              resolve(response.data);
            }
          }
        );
      });

      showResults(data);
    } catch (err) {
      showError(err.message || "Something went wrong.");
    } finally {
      scoring = false;
    }
  }

  // ─── Job Change Detection ─────────────────────────────────

  function startWatching() {
    if (watchInterval) return;
    watchInterval = setInterval(function () {
      if (!active || scoring) return;
      var text = extractJobText();
      if (text && text.length >= 200 && text !== lastScoredText) {
        scoreCurrentJob(false);
      }
    }, 3000);
  }

  function stopWatching() {
    if (watchInterval) { clearInterval(watchInterval); watchInterval = null; }
  }

  // ─── Activation / Deactivation ────────────────────────────

  function activatePanel() {
    if (active) { scoreCurrentJob(true); return; }
    active = true;
    chrome.storage.local.set({ caliberPanelEnabled: true });
    scoreCurrentJob(true);
    startWatching();
  }

  function deactivatePanel() {
    active = false;
    chrome.storage.local.set({ caliberPanelEnabled: false });
    stopWatching();
    removePanel();
    lastScoredText = "";
  }

  // Auto-activate if previously enabled
  chrome.storage.local.get(["caliberPanelEnabled"], function (data) {
    if (data.caliberPanelEnabled) activatePanel();
  });

  // ─── Message Handler ──────────────────────────────────────

  chrome.runtime.onMessage.addListener(function (msg, _sender, sendResponse) {
    if (msg.type === "EXTRACT_JOB_TEXT") {
      extractWithRetry(5, 600).then(function (text) { sendResponse({ text }); });
      return true;
    }
    if (msg.type === "ACTIVATE_PANEL") {
      activatePanel();
      sendResponse({ activated: true });
      return false;
    }
  });

  // ─── Panel Markup & Styles ────────────────────────────────

  var PANEL_HTML = [
    '<div class="cb-panel">',
    '  <div class="cb-header">',
    '    <span class="cb-logo">Caliber</span>',
    '    <button id="cb-close" class="cb-close-btn" aria-label="Close">\u00d7</button>',
    '  </div>',
    '  <div id="cb-loading" class="cb-body">',
    '    <div class="cb-spinner"></div>',
    '    <p id="cb-loading-text" class="cb-status">Computing fit score\u2026</p>',
    '  </div>',
    '  <div id="cb-error" class="cb-body" style="display:none">',
    '    <div class="cb-error-icon">!</div>',
    '    <p id="cb-error-msg" class="cb-status"></p>',
    '    <button id="cb-retry" class="cb-btn cb-btn-s">Recalculate</button>',
    '  </div>',
    '  <div id="cb-results" class="cb-body" style="display:none">',
    '    <div class="cb-score-row">',
    '      <span id="cb-score" class="cb-score-num">\u2014</span>',
    '      <span class="cb-score-of">/10</span>',
    '    </div>',
    '    <div class="cb-section">',
    '      <div class="cb-sec-title">Supports the fit</div>',
    '      <ul id="cb-supports" class="cb-bullets"></ul>',
    '    </div>',
    '    <div class="cb-section">',
    '      <div class="cb-sec-title">Stretch factors</div>',
    '      <ul id="cb-stretch" class="cb-bullets cb-stretch"></ul>',
    '    </div>',
    '    <div class="cb-section">',
    '      <div class="cb-sec-title">Bottom line</div>',
    '      <p id="cb-bottomline" class="cb-bltext"></p>',
    '    </div>',
    '    <div class="cb-actions">',
    '      <button id="cb-recalc" class="cb-btn cb-btn-s">Recalculate</button>',
    '      <a id="cb-link" href="#" target="_blank" class="cb-btn cb-btn-p">Open in Caliber</a>',
    '    </div>',
    '  </div>',
    '</div>'
  ].join("\n");

  var PANEL_CSS = [
    "*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }",
    ".cb-panel {",
    "  width: 340px; max-height: 480px; overflow-y: auto;",
    "  background: #0B0B0B; color: #F2F2F2; border-radius: 12px;",
    "  box-shadow: 0 8px 32px rgba(0,0,0,0.45);",
    "  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;",
    "  font-size: 14px; line-height: 1.5;",
    "  border: 1px solid rgba(255,255,255,0.08);",
    "  animation: cb-enter 0.2s ease-out;",
    "}",
    "@keyframes cb-enter {",
    "  from { opacity: 0; transform: translateY(12px); }",
    "  to   { opacity: 1; transform: translateY(0); }",
    "}",
    ".cb-panel::-webkit-scrollbar { width: 6px; }",
    ".cb-panel::-webkit-scrollbar-track { background: transparent; }",
    ".cb-panel::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.15); border-radius: 3px; }",
    ".cb-header {",
    "  display: flex; align-items: center; justify-content: space-between;",
    "  padding: 12px 16px; border-bottom: 1px solid rgba(255,255,255,0.06);",
    "}",
    ".cb-logo { font-size: 16px; font-weight: 700; letter-spacing: -0.02em; }",
    ".cb-close-btn {",
    "  background: none; border: none; color: #888; font-size: 20px;",
    "  cursor: pointer; padding: 0 4px; line-height: 1;",
    "}",
    ".cb-close-btn:hover { color: #F2F2F2; }",
    ".cb-body { padding: 16px; }",
    ".cb-spinner {",
    "  width: 24px; height: 24px;",
    "  border: 3px solid rgba(242,242,242,0.12);",
    "  border-top-color: #4ADE80; border-radius: 50%;",
    "  animation: cb-spin 0.7s linear infinite;",
    "  margin: 12px auto 10px;",
    "}",
    "@keyframes cb-spin { to { transform: rotate(360deg); } }",
    ".cb-status { text-align: center; color: #AFAFAF; font-size: 13px; }",
    ".cb-error-icon {",
    "  width: 32px; height: 32px; border-radius: 50%;",
    "  background: rgba(239,68,68,0.15); color: #EF4444;",
    "  display: flex; align-items: center; justify-content: center;",
    "  font-weight: 700; font-size: 16px; margin: 8px auto;",
    "}",
    ".cb-score-row {",
    "  display: flex; align-items: baseline; justify-content: center;",
    "  gap: 2px; margin: 4px 0 14px;",
    "}",
    ".cb-score-num { font-size: 38px; font-weight: 800; letter-spacing: -0.03em; }",
    ".cb-score-of { font-size: 16px; font-weight: 500; color: #888; }",
    ".cb-section { margin-bottom: 12px; }",
    ".cb-sec-title {",
    "  font-size: 11px; font-weight: 600; text-transform: uppercase;",
    "  letter-spacing: 0.04em; color: #888; margin-bottom: 4px;",
    "}",
    ".cb-bullets { list-style: none; }",
    ".cb-bullets li {",
    "  position: relative; padding-left: 14px;",
    "  font-size: 13px; color: #CFCFCF; margin-bottom: 3px; line-height: 1.4;",
    "}",
    ".cb-bullets li::before {",
    "  content: '\\2022'; position: absolute; left: 0; color: #4ADE80; font-weight: 700;",
    "}",
    ".cb-stretch li::before { color: #FBBF24; }",
    ".cb-bltext { font-size: 13px; color: #CFCFCF; line-height: 1.5; }",
    ".cb-actions { display: flex; gap: 8px; margin-top: 14px; }",
    ".cb-btn {",
    "  flex: 1; padding: 7px 10px; border: none; border-radius: 6px;",
    "  font-size: 13px; font-weight: 600; cursor: pointer;",
    "  text-align: center; text-decoration: none;",
    "  display: inline-flex; align-items: center; justify-content: center;",
    "  transition: opacity 0.15s;",
    "}",
    ".cb-btn:hover { opacity: 0.85; }",
    ".cb-btn-p { background: #F2F2F2; color: #0B0B0B; }",
    ".cb-btn-s {",
    "  background: rgba(242,242,242,0.10); color: #F2F2F2;",
    "  border: 1px solid rgba(242,242,242,0.16);",
    "}"
  ].join("\n");
})();
