// content_linkedin.js — LinkedIn job description extractor + persistent Caliber panel
// Injected on linkedin.com/jobs/* pages

(function () {
  const API_BASE = "https://www.caliber-app.com";
  const PANEL_HOST_ID = "caliber-panel-host";

  // ─── Job Text Extraction ──────────────────────────────────

  // Minimum text length to consider extraction successful
  var MIN_EXTRACT_CHARS = 80;
  // Minimum text length to send to the scoring API
  var MIN_SCORE_CHARS = 150;

  var JOB_DESCRIPTION_SELECTORS = [
    // Primary LinkedIn job detail selectors (2025-2026)
    "#job-details",
    ".jobs-description-content__text",
    ".jobs-description__content",
    ".jobs-box__html-content",
    ".jobs-description",
    // Wildcard selectors resilient to class renames
    '[class*="jobs-description"]',
    '[class*="job-details"]',
    '[class*="job-description"]',
    // Fallback: article containers
    'article[data-job-id]',
    ".job-view-layout .description__text",
  ];

  // Selectors for the LinkedIn "...more" / "Show more" expand button
  var SHOW_MORE_SELECTORS = [
    '.jobs-description__content button[aria-label*="more"]',
    '.jobs-description button[aria-label*="more"]',
    '[class*="jobs-description"] button[aria-label*="more"]',
    '[class*="jobs-description"] footer button',
    '#job-details ~ button',
    '#job-details ~ footer button',
    'button[aria-label="Show more"]',
    'button[aria-label="show more"]',
    // LinkedIn sometimes uses a link-style "...show more"
    '[class*="jobs-description"] [class*="show-more"]',
    '[class*="job-details"] [class*="show-more"]',
  ];

  /**
   * Try to click the "...more" / "Show more" button to expand the job description.
   * Returns true if a button was found and clicked.
   */
  function tryExpandDescription() {
    for (var i = 0; i < SHOW_MORE_SELECTORS.length; i++) {
      var btn = document.querySelector(SHOW_MORE_SELECTORS[i]);
      if (btn && btn.offsetParent !== null) { // visible
        try {
          btn.click();
          console.log("[caliber] expanded job description via:", SHOW_MORE_SELECTORS[i]);
          return true;
        } catch (e) {
          console.warn("[caliber] expand click failed:", e);
        }
      }
    }
    return false;
  }

  /** Synchronous: try to extract job text from the DOM right now. */
  function extractJobText() {
    // Try each selector, collecting the best (longest) match
    var bestText = "";
    var bestSource = "";

    for (var i = 0; i < JOB_DESCRIPTION_SELECTORS.length; i++) {
      var sel = JOB_DESCRIPTION_SELECTORS[i];
      var els = document.querySelectorAll(sel);
      for (var j = 0; j < els.length; j++) {
        var el = els[j];
        if (el && el.innerText) {
          var t = el.innerText.trim();
          if (t.length > bestText.length) {
            bestText = t;
            bestSource = sel;
          }
        }
      }
    }

    if (bestText.length >= MIN_EXTRACT_CHARS) {
      console.log("[caliber] extracted " + bestText.length + " chars via: " + bestSource);
      return bestText.replace(/\s+/g, " ");
    }

    // Last resort: find the longest text block in the main content area
    var main = document.querySelector('[role="main"]') || document.body;
    var allSections = main.querySelectorAll("section, div > ul, div > ol, div > p");
    for (var k = 0; k < allSections.length; k++) {
      var st = (allSections[k].innerText || "").trim();
      if (st.length > bestText.length) {
        bestText = st;
        bestSource = "main-content-scan";
      }
    }
    if (bestText.length >= MIN_EXTRACT_CHARS) {
      console.log("[caliber] extracted " + bestText.length + " chars via: " + bestSource);
      return bestText.replace(/\s+/g, " ");
    }

    // User selection fallback
    var userSel = window.getSelection();
    if (userSel && userSel.toString().trim().length >= MIN_EXTRACT_CHARS) {
      console.log("[caliber] extracted from user selection");
      return userSel.toString().trim().replace(/\s+/g, " ");
    }

    // Log what we did find for debugging
    if (bestText.length > 0) {
      console.log("[caliber] container found but text too short (" + bestText.length + " chars, need " + MIN_EXTRACT_CHARS + ") via: " + bestSource);
    } else {
      console.log("[caliber] no description container found on page");
    }
    return null;
  }

  /**
   * Wait for the job description to appear in the DOM.
   * Uses MutationObserver + tries expanding collapsed descriptions.
   * Returns extracted text or null on timeout.
   */
  function waitForJobDescription(timeoutMs) {
    timeoutMs = timeoutMs || 8000;
    return new Promise(function (resolve) {
      // Check immediately — element may already exist
      var immediate = extractJobText();
      if (immediate) { resolve(immediate); return; }

      var settled = false;
      var expandAttempted = false;

      function settle(value) {
        if (settled) return;
        settled = true;
        if (observer) observer.disconnect();
        clearTimeout(timer);
        clearTimeout(expandTimer);
        resolve(value);
      }

      // After 1.5s, try clicking "...more" to expand collapsed descriptions
      var expandTimer = setTimeout(function () {
        if (settled) return;
        if (!expandAttempted) {
          expandAttempted = true;
          var didExpand = tryExpandDescription();
          if (didExpand) {
            // Give DOM 500ms to update after expand click, then re-check
            setTimeout(function () {
              if (settled) return;
              var text = extractJobText();
              if (text) settle(text);
            }, 500);
          }
        }
      }, 1500);

      // Timeout fallback — final attempt including one more expand try
      var timer = setTimeout(function () {
        if (!expandAttempted) {
          expandAttempted = true;
          tryExpandDescription();
        }
        // Small delay after final expand attempt
        setTimeout(function () { settle(extractJobText()); }, 300);
      }, timeoutMs);

      // Observe DOM for new nodes
      var observer = new MutationObserver(function () {
        var text = extractJobText();
        if (text) settle(text);
      });
      observer.observe(document.body, { childList: true, subtree: true });
    });
  }

  /** Legacy wrapper kept for the message handler (popup asks for text). */
  function extractWithRetry(retries, delayMs) {
    return waitForJobDescription(retries * delayMs);
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

      const text = await waitForJobDescription(8000);
      if (!text || text.length < MIN_SCORE_CHARS) {
        if (!text) {
          console.log("[caliber] extraction failed: no text found after 8s wait");
          showError("Couldn\u2019t detect the job description on this page. Try scrolling down or clicking the job again.");
        } else {
          console.log("[caliber] extraction too short for scoring: " + text.length + " chars (need " + MIN_SCORE_CHARS + ")");
          showError("Job description too short (" + text.length + " chars). Try expanding \u2018Show more\u2019 or highlight more text.");
        }
        return;
      }
      console.log("[caliber] scoring with " + text.length + " chars");

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
    // Watch for job navigation: when the URL or description content changes, re-score.
    var lastUrl = location.href;
    watchInterval = setInterval(function () {
      if (!active || scoring) return;
      var urlChanged = location.href !== lastUrl;
      if (urlChanged) lastUrl = location.href;
      var text = extractJobText();
      if (text && text.length >= MIN_SCORE_CHARS && (text !== lastScoredText || urlChanged)) {
        scoreCurrentJob(false);
      }
    }, 2000);
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
