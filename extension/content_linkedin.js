// content_linkedin.js — LinkedIn job description extractor + persistent Caliber panel
// Injected on linkedin.com/jobs/* pages

(function () {
  const API_BASE = "https://www.caliber-app.com";
  const PANEL_HOST_ID = "caliber-panel-host";
  const PANEL_VERSION = "0.3.5";
  console.log("[caliber] content_linkedin.js v" + PANEL_VERSION + " loaded");

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
    ".jobs-description-content",
    ".jobs-box__html-content",
    ".jobs-description__container",
    ".jobs-description",
    ".jobs-unified-description__content",
    // Search results split-pane containers
    ".jobs-search__job-details--wrapper",
    ".jobs-search__job-details",
    ".scaffold-layout__detail",
    // Wildcard selectors resilient to class renames
    '[class*="jobs-description"]',
    '[class*="job-details"]',
    '[class*="job-description"]',
    '[class*="jobs-search__job-details"]',
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
    var bestText = "";
    var bestSource = "";

    // Phase 1 — CSS selectors (precise + wildcard)
    for (var i = 0; i < JOB_DESCRIPTION_SELECTORS.length; i++) {
      var sel = JOB_DESCRIPTION_SELECTORS[i];
      var els = document.querySelectorAll(sel);
      for (var j = 0; j < els.length; j++) {
        var el = els[j];
        if (!el) continue;
        var t = (el.innerText || "").trim();
        if (t.length < MIN_EXTRACT_CHARS) t = (el.textContent || "").trim();
        if (t.length > bestText.length) {
          bestText = t;
          bestSource = "P1:" + sel;
        }
      }
    }
    if (bestText.length >= MIN_EXTRACT_CHARS) {
      console.log("[caliber] P1 extracted " + bestText.length + " chars via: " + bestSource);
      return bestText.replace(/\s+/g, " ");
    }
    console.log("[caliber] P1 selectors: best=" + bestText.length + " chars");

    // Phase 2 — "About the job" / heading text anchor walk
    var anchorPhrases = ["about the job", "job description", "description",
                         "position overview", "responsibilities", "qualifications",
                         "what you'll do", "the role", "role overview", "job summary"];
    var anchorCandidates = document.querySelectorAll("h1, h2, h3, h4, h5, h6, span, div, p, strong, b");
    for (var a = 0; a < anchorCandidates.length; a++) {
      var node = anchorCandidates[a];
      if (node.children && node.children.length > 10) continue;
      var nt = (node.textContent || "").trim().toLowerCase();
      for (var p = 0; p < anchorPhrases.length; p++) {
        if (nt === anchorPhrases[p] || nt === anchorPhrases[p] + ":" ||
            nt.startsWith(anchorPhrases[p] + " ")) {
          var container = node.parentElement;
          for (var up = 0; up < 10 && container; up++) {
            var ct = (container.innerText || "").trim();
            if (ct.length < MIN_EXTRACT_CHARS) ct = (container.textContent || "").trim();
            if (ct.length > MIN_SCORE_CHARS) {
              console.log("[caliber] P2 anchor '" + anchorPhrases[p] + "' walk(" + up + ")=" + ct.length + " chars");
              return ct.replace(/\s+/g, " ");
            }
            container = container.parentElement;
          }
        }
      }
    }
    console.log("[caliber] P2 anchor scan: no match");

    // Phase 3 — broad container scan (sections, articles, job-related classes)
    var main = document.querySelector('[role="main"]') || document.body;
    var broadSels = main.querySelectorAll(
      "section, article, [role='main'], [role='region'], " +
      "[class*='jobs'], [class*='detail'], [class*='scaffold'], " +
      "[class*='job-view'], [class*='description'], " +
      "div > ul, div > ol, div > p"
    );
    for (var k = 0; k < broadSels.length; k++) {
      var st = (broadSels[k].innerText || "").trim();
      if (st.length > bestText.length) {
        bestText = st;
        bestSource = "P3:broad-scan";
      }
    }
    if (bestText.length >= MIN_EXTRACT_CHARS) {
      console.log("[caliber] P3 extracted " + bestText.length + " chars via " + bestSource);
      return bestText.replace(/\s+/g, " ");
    }
    console.log("[caliber] P3 broad scan: best=" + bestText.length + " chars");

    // Phase 4 — nuclear: scan ALL divs for the longest text block on the page
    // Skip tiny elements and navigation-like containers
    var allDivs = document.querySelectorAll("div, section, article, main, aside");
    var nuclearText = "";
    var nuclearSource = "";
    for (var d = 0; d < allDivs.length; d++) {
      var div = allDivs[d];
      var dt = (div.innerText || "").trim();
      // Skip if this looks like the entire page or is too huge (likely body-level)
      if (dt.length > 15000) continue;
      // We want the longest block that's at least MIN_SCORE_CHARS
      if (dt.length > nuclearText.length && dt.length >= MIN_SCORE_CHARS) {
        nuclearText = dt;
        nuclearSource = div.tagName + (div.className ? "." + String(div.className).substring(0, 60) : "");
      }
    }
    if (nuclearText.length >= MIN_SCORE_CHARS) {
      console.log("[caliber] P4 nuclear: " + nuclearText.length + " chars from " + nuclearSource);
      return nuclearText.replace(/\s+/g, " ");
    }
    console.log("[caliber] P4 nuclear scan: best=" + nuclearText.length + " chars from " + allDivs.length + " elements");

    // Phase 5 — user selection fallback
    var userSel = window.getSelection();
    if (userSel && userSel.toString().trim().length >= MIN_EXTRACT_CHARS) {
      console.log("[caliber] P5 user selection: " + userSel.toString().trim().length + " chars");
      return userSel.toString().trim().replace(/\s+/g, " ");
    }

    // Diagnostic dump: log what we see on the page
    console.log("[caliber] ALL PHASES FAILED. Page URL:", location.href);
    console.log("[caliber] body.innerText length:", (document.body.innerText || "").length);
    console.log("[caliber] #job-details exists:", !!document.querySelector("#job-details"));
    console.log("[caliber] [class*=description] count:", document.querySelectorAll('[class*="description"]').length);
    console.log("[caliber] [class*=jobs] count:", document.querySelectorAll('[class*="jobs"]').length);
    if (bestText.length > 0) {
      console.log("[caliber] best candidate was " + bestText.length + " chars via " + bestSource);
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
  let lastWatchedUrl = location.href;
  let detailObserver = null;
  let detailDebounce = null;
  let observerTarget = null;
  let bodyGuard = null;
  let navScoreTimer = null;

  // ─── Panel Creation ───────────────────────────────────────

  function getOrCreatePanel() {
    // Re-append if LinkedIn's SPA removed our host from the DOM
    if (panelHost && !document.body.contains(panelHost)) {
      document.body.appendChild(panelHost);
      var pe = shadow.querySelector('.cb-panel');
      if (pe) pe.style.animation = 'none';
    }
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

    // Disable entry animation after it plays so re-appends don't flicker
    setTimeout(function() {
      if (shadow) {
        var pe = shadow.querySelector('.cb-panel');
        if (pe) pe.style.animation = 'none';
      }
    }, 300);

    // Guard: watch for LinkedIn removing our host and re-append instantly
    if (!bodyGuard) {
      bodyGuard = new MutationObserver(function(muts) {
        if (!panelHost || !active) return;
        for (var i = 0; i < muts.length; i++) {
          var removed = muts[i].removedNodes;
          for (var j = 0; j < removed.length; j++) {
            if (removed[j] === panelHost) {
              document.body.appendChild(panelHost);
              var pe2 = shadow.querySelector('.cb-panel');
              if (pe2) pe2.style.animation = 'none';
              return;
            }
          }
        }
      });
      bodyGuard.observe(document.body, { childList: true });
    }

    shadow.getElementById("cb-close").addEventListener("click", deactivatePanel);
    shadow.getElementById("cb-recalc").addEventListener("click", () => scoreCurrentJob(true));
    shadow.getElementById("cb-retry").addEventListener("click", () => scoreCurrentJob(true));

    return shadow;
  }

  function removePanel() {
    if (bodyGuard) { bodyGuard.disconnect(); bodyGuard = null; }
    if (panelHost && panelHost.parentNode) panelHost.parentNode.removeChild(panelHost);
    panelHost = null;
    shadow = null;
  }

  // ─── Decision Label ───────────────────────────────────────

  function getDecision(score) {
    if (score >= 7.5) return { label: "Strong Fit", cls: "cb-decision-strong" };
    if (score >= 5) return { label: "Stretch", cls: "cb-decision-stretch" };
    return { label: "Skip", cls: "cb-decision-skip" };
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
    // If results are already showing, overlay a loading indicator instead of hiding
    var resultsEl = shadow.getElementById("cb-results");
    var loadingEl = shadow.getElementById("cb-loading");
    var overlayEl = shadow.getElementById("cb-rescore-overlay");
    if (resultsEl && resultsEl.style.display !== "none") {
      // Keep results visible, show overlay
      if (overlayEl) {
        overlayEl.querySelector(".cb-overlay-text").textContent = msg || "Rescoring\u2026";
        overlayEl.style.display = "";
      }
      if (loadingEl) loadingEl.style.display = "none";
    } else {
      // No previous results — show normal loading
      shadow.getElementById("cb-loading-text").textContent = msg || "Computing fit score\u2026";
      if (overlayEl) overlayEl.style.display = "none";
      setPanelState("cb-loading");
    }
  }

  function hideOverlay() {
    if (!shadow) return;
    var overlayEl = shadow.getElementById("cb-rescore-overlay");
    if (overlayEl) overlayEl.style.display = "none";
  }

  function showError(msg) {
    getOrCreatePanel();
    hideOverlay();
    shadow.getElementById("cb-error-msg").textContent = msg;
    setPanelState("cb-error");
  }

  function showResults(data) {
    getOrCreatePanel();
    hideOverlay();

    console.log("[caliber] showResults v" + PANEL_VERSION, JSON.stringify(data).substring(0, 500));

    var score = Number(data.score_0_to_10) || 0;
    var decision = getDecision(score);

    // Score + decision label
    var scoreEl = shadow.getElementById("cb-score");
    scoreEl.textContent = data.score_0_to_10;
    scoreEl.style.color = score >= 7.5 ? "#4ADE80" : score >= 5 ? "#FBBF24" : "#EF4444";

    var decEl = shadow.getElementById("cb-decision");
    decEl.textContent = decision.label;
    decEl.className = "cb-decision " + decision.cls;

    // Supports
    renderList(shadow.getElementById("cb-supports"), data.supports_fit || []);

    // Stretch factors
    renderList(shadow.getElementById("cb-stretch"), data.stretch_factors || []);

    // Bottom line
    shadow.getElementById("cb-bottomline").textContent = data.bottom_line_2s || "";

    // Nearby roles (only for stretch/skip)
    var nearbySection = shadow.getElementById("cb-nearby-section");
    var nearbyList = shadow.getElementById("cb-nearby");
    if (score < 7.5 && data.nearby_roles && data.nearby_roles.length > 0) {
      nearbySection.style.display = "";
      nearbyList.innerHTML = "";
      for (var i = 0; i < data.nearby_roles.length; i++) {
        var role = data.nearby_roles[i];
        var li = document.createElement("li");
        var link = document.createElement("a");
        link.textContent = role.title;
        link.href = "https://www.linkedin.com/jobs/search/?keywords=" + encodeURIComponent(role.title);
        link.target = "_self";
        link.className = "cb-nearby-link";
        li.appendChild(link);
        nearbyList.appendChild(li);
      }
    } else {
      nearbySection.style.display = "none";
    }

    // Caliber link
    var linkEl = shadow.getElementById("cb-link");
    if (data.calibrationId) {
      linkEl.href = API_BASE + "/calibration?calibrationId=" + data.calibrationId;
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

      if (!force && text === lastScoredText) { hideOverlay(); return; }
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

  // ─── SPA Navigation Hooks ─────────────────────────────────

  var navHooksInstalled = false;
  function installNavHooks() {
    if (navHooksInstalled) return;
    navHooksInstalled = true;
    var origPush = history.pushState;
    var origReplace = history.replaceState;
    function onNav() {
      if (!active) return;
      if (location.href === lastWatchedUrl) return;
      lastWatchedUrl = location.href;
      lastScoredText = "";
      console.debug("[Caliber] SPA nav detected, will re-score");
      // Instant visual feedback: show overlay on existing results
      if (shadow && !scoring) showLoading("Updating\u2026");
      clearTimeout(navScoreTimer);
      navScoreTimer = setTimeout(function() {
        if (active && !scoring) scoreCurrentJob(true);
      }, 600);
    }
    history.pushState = function() { origPush.apply(this, arguments); onNav(); };
    history.replaceState = function() { origReplace.apply(this, arguments); onNav(); };
    window.addEventListener("popstate", onNav);
  }

  // ─── Job Change Detection ─────────────────────────────────

  function startWatching() {
    if (watchInterval) return;
    installNavHooks();
    // Poll: text changes + fallback URL check
    watchInterval = setInterval(function () {
      if (!active) return;
      // Periodically re-attach observer if LinkedIn replaced the detail pane
      tryObserveDetailPane();
      if (scoring) return;
      // Fallback URL check (nav hooks handle most SPA changes)
      if (location.href !== lastWatchedUrl) {
        lastWatchedUrl = location.href;
        lastScoredText = "";
        console.debug("[Caliber] URL poll fallback, re-scoring");
        scoreCurrentJob(true);
        return;
      }
      var text = extractJobText();
      if (text && text.length >= MIN_SCORE_CHARS && text !== lastScoredText) {
        scoreCurrentJob(false);
      }
    }, 2000);

    // MutationObserver on the detail pane for faster job-switch detection
    tryObserveDetailPane();
  }

  function tryObserveDetailPane() {
    // Re-attach if LinkedIn replaced the detail pane container
    if (detailObserver && observerTarget && !document.body.contains(observerTarget)) {
      detailObserver.disconnect();
      detailObserver = null;
      observerTarget = null;
      console.debug("[Caliber] detail pane target removed, will re-attach");
    }
    if (detailObserver) return;
    var target =
      document.querySelector(".scaffold-layout__detail") ||
      document.querySelector(".jobs-search__job-details") ||
      document.querySelector("#job-details") ||
      document.querySelector('[class*="jobs-search__job-details"]');
    if (!target) {
      console.debug("[Caliber] no detail pane found for MutationObserver, relying on poll");
      return;
    }
    observerTarget = target;
    detailObserver = new MutationObserver(function () {
      if (!active || scoring) return;
      clearTimeout(detailDebounce);
      detailDebounce = setTimeout(function () {
        var text = extractJobText();
        if (text && text.length >= MIN_SCORE_CHARS && text !== lastScoredText) {
          console.debug("[Caliber] detail pane mutation detected, re-scoring");
          scoreCurrentJob(false);
        }
      }, 1000);
    });
    detailObserver.observe(target, { childList: true, subtree: true });
    console.debug("[Caliber] MutationObserver attached to detail pane");
  }

  function stopWatching() {
    if (watchInterval) { clearInterval(watchInterval); watchInterval = null; }
    if (detailObserver) { detailObserver.disconnect(); detailObserver = null; }
    observerTarget = null;
    clearTimeout(detailDebounce);
    clearTimeout(navScoreTimer);
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
    '    <span class="cb-logo">Caliber <small style="font-size:9px;color:#666;font-weight:400">v' + PANEL_VERSION + '</small></span>',
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
    '    <div id="cb-rescore-overlay" class="cb-overlay" style="display:none">',
    '      <div class="cb-spinner cb-spinner-sm"></div>',
    '      <span class="cb-overlay-text">Rescoring\u2026</span>',
    '    </div>',
    '    <div class="cb-hero">',
    '      <div class="cb-score-row">',
    '        <span id="cb-score" class="cb-score-num">\u2014</span>',
    '        <span class="cb-score-of">/10</span>',
    '      </div>',
    '      <div id="cb-decision" class="cb-decision"></div>',
    '    </div>',
    '    <div class="cb-section">',
    '      <div class="cb-sec-title">\u2713 Supports the fit</div>',
    '      <ul id="cb-supports" class="cb-bullets"></ul>',
    '    </div>',
    '    <div class="cb-section">',
    '      <div class="cb-sec-title">\u26a0 Stretch factors</div>',
    '      <ul id="cb-stretch" class="cb-bullets cb-stretch"></ul>',
    '    </div>',
    '    <div class="cb-section">',
    '      <div class="cb-sec-title">Bottom line</div>',
    '      <p id="cb-bottomline" class="cb-bltext"></p>',
    '    </div>',
    '    <div id="cb-nearby-section" class="cb-section cb-nearby-section" style="display:none">',
    '      <div class="cb-sec-title">\u2192 Better nearby roles</div>',
    '      <ul id="cb-nearby" class="cb-nearby-list"></ul>',
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
    "  width: 350px; max-height: 520px; overflow-y: auto;",
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
    "  padding: 10px 16px; border-bottom: 1px solid rgba(255,255,255,0.06);",
    "}",
    ".cb-logo { font-size: 15px; font-weight: 700; letter-spacing: -0.02em; }",
    ".cb-close-btn {",
    "  background: none; border: none; color: #888; font-size: 20px;",
    "  cursor: pointer; padding: 0 4px; line-height: 1;",
    "}",
    ".cb-close-btn:hover { color: #F2F2F2; }",
    ".cb-body { padding: 14px 16px; position: relative; }",
    ".cb-spinner {",
    "  width: 24px; height: 24px;",
    "  border: 3px solid rgba(242,242,242,0.12);",
    "  border-top-color: #4ADE80; border-radius: 50%;",
    "  animation: cb-spin 0.7s linear infinite;",
    "  margin: 12px auto 10px;",
    "}",
    ".cb-spinner-sm { width: 16px; height: 16px; border-width: 2px; margin: 0; }",
    "@keyframes cb-spin { to { transform: rotate(360deg); } }",
    ".cb-status { text-align: center; color: #AFAFAF; font-size: 13px; }",
    ".cb-error-icon {",
    "  width: 32px; height: 32px; border-radius: 50%;",
    "  background: rgba(239,68,68,0.15); color: #EF4444;",
    "  display: flex; align-items: center; justify-content: center;",
    "  font-weight: 700; font-size: 16px; margin: 8px auto;",
    "}",
    ".cb-overlay {",
    "  position: absolute; inset: 0; z-index: 10;",
    "  background: rgba(11,11,11,0.75); border-radius: 12px;",
    "  display: flex; align-items: center; justify-content: center; gap: 8px;",
    "}",
    ".cb-overlay-text { font-size: 13px; color: #AFAFAF; }",
    ".cb-hero {",
    "  display: flex; align-items: center; gap: 12px;",
    "  margin-bottom: 12px; padding-bottom: 10px;",
    "  border-bottom: 1px solid rgba(255,255,255,0.06);",
    "}",
    ".cb-score-row {",
    "  display: flex; align-items: baseline; gap: 1px;",
    "}",
    ".cb-score-num { font-size: 34px; font-weight: 800; letter-spacing: -0.03em; }",
    ".cb-score-of { font-size: 14px; font-weight: 500; color: #888; }",
    ".cb-decision {",
    "  font-size: 14px; font-weight: 700; padding: 3px 10px; border-radius: 6px;",
    "  letter-spacing: 0.01em;",
    "}",
    ".cb-decision-strong { background: rgba(74,222,128,0.15); color: #4ADE80; }",
    ".cb-decision-stretch { background: rgba(251,191,36,0.15); color: #FBBF24; }",
    ".cb-decision-skip { background: rgba(239,68,68,0.15); color: #EF4444; }",
    ".cb-section { margin-bottom: 10px; }",
    ".cb-sec-title {",
    "  font-size: 11px; font-weight: 600; text-transform: uppercase;",
    "  letter-spacing: 0.04em; color: #888; margin-bottom: 3px;",
    "}",
    ".cb-bullets { list-style: none; }",
    ".cb-bullets li {",
    "  position: relative; padding-left: 14px;",
    "  font-size: 13px; color: #CFCFCF; margin-bottom: 2px; line-height: 1.4;",
    "}",
    ".cb-bullets li::before {",
    "  content: '\\2022'; position: absolute; left: 0; color: #4ADE80; font-weight: 700;",
    "}",
    ".cb-stretch li::before { color: #FBBF24; }",
    ".cb-bltext { font-size: 13px; color: #CFCFCF; line-height: 1.4; }",
    ".cb-nearby-section {",
    "  background: rgba(255,255,255,0.03); border-radius: 8px;",
    "  padding: 10px 12px; margin-top: 2px;",
    "}",
    ".cb-nearby-section .cb-sec-title { color: #60A5FA; }",
    ".cb-nearby-list { list-style: none; }",
    ".cb-nearby-list li {",
    "  padding: 4px 0; font-size: 13px;",
    "}",
    ".cb-nearby-link {",
    "  color: #93C5FD; text-decoration: none; cursor: pointer;",
    "  border-bottom: 1px solid rgba(147,197,253,0.25);",
    "  transition: color 0.15s, border-color 0.15s;",
    "}",
    ".cb-nearby-link:hover { color: #BFDBFE; border-color: #BFDBFE; }",
    ".cb-actions { display: flex; gap: 8px; margin-top: 12px; }",
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
