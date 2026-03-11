// content_linkedin.js — LinkedIn job description extractor + persistent Caliber panel
// Injected on linkedin.com/jobs/* pages

(function () {
  const API_BASE = CALIBER_ENV.API_BASE;
  const PANEL_HOST_ID = "caliber-panel-host";
  const PANEL_VERSION = "0.6.2";
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

  // ─── Job Metadata Extraction ──────────────────────────────

  var JOB_TITLE_SELECTORS = [
    ".job-details-jobs-unified-top-card__job-title a",
    ".job-details-jobs-unified-top-card__job-title",
    ".jobs-unified-top-card__job-title a",
    ".jobs-unified-top-card__job-title",
    ".t-24.job-details-jobs-unified-top-card__job-title",
    "h1.t-24",
    "h1[class*='job-title']",
    "h2[class*='job-title']",
    ".topcard__title",
    "h1",
  ];

  var COMPANY_NAME_SELECTORS = [
    ".job-details-jobs-unified-top-card__company-name a",
    ".job-details-jobs-unified-top-card__company-name",
    ".jobs-unified-top-card__company-name a",
    ".jobs-unified-top-card__company-name",
    ".topcard__org-name-link",
    "[class*='top-card'] [class*='company-name'] a",
    "[class*='top-card'] [class*='company-name']",
  ];

  var COMPANY_LOGO_SELECTORS = [
    ".job-details-jobs-unified-top-card__company-logo img",
    ".jobs-unified-top-card__company-logo img",
    ".EntityPhoto-square-3 img",
    "[class*='top-card'] img[class*='logo']",
    "[class*='top-card'] img[alt*='logo']",
    "[class*='company-logo'] img",
  ];

  /** Extract job title, company name, and company logo from the LinkedIn DOM. */
  function extractJobMeta() {
    var meta = { title: "", company: "", logoUrl: "" };
    for (var i = 0; i < JOB_TITLE_SELECTORS.length; i++) {
      var el = document.querySelector(JOB_TITLE_SELECTORS[i]);
      if (el) {
        var t = (el.textContent || "").trim();
        if (t.length > 2 && t.length < 200) { meta.title = t; break; }
      }
    }
    for (var j = 0; j < COMPANY_NAME_SELECTORS.length; j++) {
      var el2 = document.querySelector(COMPANY_NAME_SELECTORS[j]);
      if (el2) {
        var c = (el2.textContent || "").trim();
        if (c.length > 1 && c.length < 150) { meta.company = c; break; }
      }
    }
    for (var k = 0; k < COMPANY_LOGO_SELECTORS.length; k++) {
      var img = document.querySelector(COMPANY_LOGO_SELECTORS[k]);
      if (img && img.src && img.src.startsWith("http")) {
        meta.logoUrl = img.src;
        break;
      }
    }
    return meta;
  }

  // ─── Panel State ──────────────────────────────────────────

  let panelHost = null;
  let shadow = null;
  let active = false;
  let scoring = false;
  let lastScoredText = "";
  let lastScoredScore = 0;
  let lastJobMeta = { title: "", company: "", logoUrl: "" };
  let watchInterval = null;
  let lastWatchedUrl = location.href;
  let detailObserver = null;
  let detailDebounce = null;

  // Rolling weak-search detection
  let recentScores = [];       // last 4 entries: { score, nearbyRoles, calibrationTitle }
  let lastSearchQuery = getSearchKeywords();

  // Behavioral signals (per search session)
  let sessionSignals = {
    jobs_viewed: 0,
    scores_below_6: 0,
    highest_score: 0,
    suggest_shown: false,
    suggest_clicked: false,
  };

  // Feedback session guard (one prompt per eval)
  let feedbackGiven = false;
  let lastFeedbackData = null;  // snapshot of last scored result for feedback context

  function resetSessionSignals() {
    sessionSignals = { jobs_viewed: 0, scores_below_6: 0, highest_score: 0, suggest_shown: false, suggest_clicked: false };
    feedbackGiven = false;
    lastFeedbackData = null;
  }

  function getSearchKeywords() {
    try { return new URL(location.href).searchParams.get("keywords") || ""; }
    catch (e) { return ""; }
  }

  // ─── Visible-Job Surface Scoring State ─────────────────────

  var visibleScoreCache = {};       // jobId -> { score, decision }
  var visibleScoringActive = false; // prevents concurrent scoring passes
  var lastVisibleBatchKey = "";     // concatenated jobIds to detect unchanged list
  var visibleBadgeStyleInjected = false;
  var surfaceRescanTimer = null;
  var visibleListObserver = null;

  // ─── Visible Job Card Extraction ──────────────────────────

  var JOB_LIST_CONTAINER_SELECTORS = [
    '.scaffold-layout__list-container',
    '.jobs-search-results-list',
    '.jobs-search__results-list',
    '[class*="jobs-search-results"]',
  ];

  function extractJobIdFromCard(el) {
    var id = el.getAttribute('data-occludable-job-id') || el.getAttribute('data-job-id');
    if (id) return id;
    var parent = el.closest('[data-occludable-job-id]');
    if (parent) return parent.getAttribute('data-occludable-job-id');
    parent = el.closest('[data-job-id]');
    if (parent) return parent.getAttribute('data-job-id');
    var link = el.querySelector('a[href*="/jobs/view/"]');
    if (link) {
      var m = link.href.match(/\/jobs\/view\/(\d+)/);
      if (m) return m[1];
    }
    return null;
  }

  function getVisibleJobCards() {
    var listEl = null;
    for (var s = 0; s < JOB_LIST_CONTAINER_SELECTORS.length; s++) {
      listEl = document.querySelector(JOB_LIST_CONTAINER_SELECTORS[s]);
      if (listEl) break;
    }
    if (!listEl) {
      console.debug('[Caliber] visible-surface: no list container found');
      return [];
    }
    var items = listEl.querySelectorAll('li');
    var cards = [];
    for (var i = 0; i < items.length && cards.length < 12; i++) {
      var li = items[i];
      var jobId = extractJobIdFromCard(li);
      if (!jobId) continue;
      var text = (li.innerText || '').trim();
      if (text.length < 20) continue;
      cards.push({ el: li, jobId: jobId, text: text });
    }
    console.debug('[Caliber] visible-surface: found ' + cards.length + ' cards');
    return cards;
  }

  // ─── Badge Overlay (injected into page DOM) ───────────────

  function injectBadgeStyles() {
    if (visibleBadgeStyleInjected) return;
    visibleBadgeStyleInjected = true;
    var style = document.createElement('style');
    style.setAttribute('data-caliber-surface', '1');
    style.textContent =
      '.cb-vis-badge{position:absolute;top:8px;right:8px;z-index:100;' +
      'background:#111114;border:1px solid rgba(255,255,255,0.15);border-radius:6px;' +
      'padding:2px 7px;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;' +
      'font-size:11px;font-weight:700;line-height:1.3;display:flex;align-items:center;gap:4px;' +
      'pointer-events:none;box-shadow:0 1px 4px rgba(0,0,0,0.4)}' +
      '.cb-vis-badge-logo{font-size:8px;color:#555;font-weight:600;letter-spacing:-0.02em}' +
      '.cb-vis-score-strong{color:#4ADE80}' +
      '.cb-vis-score-stretch{color:#FBBF24}' +
      '.cb-vis-score-skip{color:#EF4444}';
    document.head.appendChild(style);
  }

  function renderBadgeOnCard(cardEl, score) {
    var existing = cardEl.querySelector('.cb-vis-badge');
    if (existing) existing.remove();
    var cs = getComputedStyle(cardEl);
    if (cs.position === 'static') cardEl.style.position = 'relative';
    var badge = document.createElement('div');
    badge.className = 'cb-vis-badge';
    badge.innerHTML = '<span class="cb-vis-badge-logo">C</span>' +
      '<span class="' + (score >= 7.5 ? 'cb-vis-score-strong' : score >= 5 ? 'cb-vis-score-stretch' : 'cb-vis-score-skip') + '">' +
      score + '</span>';
    cardEl.appendChild(badge);
  }

  function removeAllBadges() {
    var badges = document.querySelectorAll('.cb-vis-badge');
    for (var i = 0; i < badges.length; i++) badges[i].remove();
  }

  // ─── Surface Summary (sidecard shadow DOM) ────────────────

  function computeSurfaceStats(cards) {
    var scores = [];
    for (var i = 0; i < cards.length; i++) {
      var c = visibleScoreCache[cards[i].jobId];
      if (c) scores.push(c.score);
    }
    if (scores.length === 0) return null;
    scores.sort(function (a, b) { return a - b; });
    var mid = Math.floor(scores.length / 2);
    var median = scores.length % 2 !== 0
      ? scores[mid]
      : Math.round(((scores[mid - 1] + scores[mid]) / 2) * 10) / 10;
    return {
      median: median,
      top: scores[scores.length - 1],
      strongCount: scores.filter(function (s) { return s >= 7.5; }).length,
      total: scores.length,
    };
  }

  function updateSurfaceSummary(cards) {
    if (!shadow) return;
    var el = shadow.getElementById('cb-surface-summary');
    if (!el) return;
    var stats = computeSurfaceStats(cards);
    if (!stats || stats.total === 0) { el.style.display = 'none'; return; }
    el.style.display = '';
    var medianEl = shadow.getElementById('cb-surface-median');
    var topEl = shadow.getElementById('cb-surface-top');
    var strongEl = shadow.getElementById('cb-surface-strong');
    var countEl = shadow.getElementById('cb-surface-count');
    medianEl.textContent = stats.median.toFixed(1);
    medianEl.style.color = stats.median >= 7.5 ? '#4ADE80' : stats.median >= 5 ? '#FBBF24' : '#EF4444';
    topEl.textContent = stats.top.toFixed(1);
    topEl.style.color = stats.top >= 7.5 ? '#4ADE80' : stats.top >= 5 ? '#FBBF24' : '#EF4444';
    strongEl.textContent = stats.strongCount;
    strongEl.style.color = stats.strongCount > 0 ? '#4ADE80' : '#777';
    if (countEl) countEl.textContent = stats.total + ' scored';
  }

  function showSurfaceScoringState(remaining) {
    if (!shadow) return;
    var el = shadow.getElementById('cb-surface-summary');
    if (!el) return;
    el.style.display = '';
    shadow.getElementById('cb-surface-median').textContent = '\u2026';
    shadow.getElementById('cb-surface-median').style.color = '#555';
    shadow.getElementById('cb-surface-top').textContent = '\u2026';
    shadow.getElementById('cb-surface-top').style.color = '#555';
    shadow.getElementById('cb-surface-strong').textContent = '\u2026';
    shadow.getElementById('cb-surface-strong').style.color = '#555';
    var countEl = shadow.getElementById('cb-surface-count');
    if (countEl) countEl.textContent = 'scoring ' + remaining + ' jobs\u2026';
  }

  // ─── Visible Surface Scoring Pass ─────────────────────────

  function scoreCardViaAPI(cardText) {
    return new Promise(function (resolve, reject) {
      chrome.runtime.sendMessage(
        { type: 'CALIBER_FIT_API', jobText: cardText },
        function (response) {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else if (!response || !response.ok) {
            reject(new Error((response && response.error) || 'Score failed'));
          } else {
            resolve(response.data);
          }
        }
      );
    });
  }

  async function scoreVisibleSurface() {
    if (visibleScoringActive || !active) return;
    var cards = getVisibleJobCards();
    if (cards.length === 0) return;
    var batchKey = cards.map(function (c) { return c.jobId; }).join(',');
    if (batchKey === lastVisibleBatchKey) {
      renderCachedBadges(cards);
      updateSurfaceSummary(cards);
      return;
    }
    var uncached = cards.filter(function (c) { return !visibleScoreCache[c.jobId]; });
    if (uncached.length === 0) {
      lastVisibleBatchKey = batchKey;
      renderCachedBadges(cards);
      updateSurfaceSummary(cards);
      return;
    }
    visibleScoringActive = true;
    lastVisibleBatchKey = batchKey;
    injectBadgeStyles();
    renderCachedBadges(cards);
    showSurfaceScoringState(uncached.length);
    console.debug('[Caliber] visible-surface: scoring ' + uncached.length + ' uncached cards');
    for (var i = 0; i < cards.length; i++) {
      if (!active) break;
      var card = cards[i];
      if (visibleScoreCache[card.jobId]) continue;
      try {
        var result = await scoreCardViaAPI(card.text);
        var rawScore = Number(result.score_0_to_10) || 0;
        var hrc = result.hiring_reality_check;
        var hrcBand = (hrc && hrc.band) ? hrc.band : null;
        var score = applyDomainMismatchGuardrail(rawScore, hrcBand);
        visibleScoreCache[card.jobId] = { score: score, decision: getDecision(score).label };
        renderBadgeOnCard(card.el, score);
      } catch (err) {
        console.warn('[Caliber] visible-surface: card ' + card.jobId + ' failed:', err.message);
      }
      updateSurfaceSummary(cards);
    }
    visibleScoringActive = false;
    console.debug('[Caliber] visible-surface: pass complete');
  }

  function renderCachedBadges(cards) {
    injectBadgeStyles();
    for (var i = 0; i < cards.length; i++) {
      var cached = visibleScoreCache[cards[i].jobId];
      if (cached) renderBadgeOnCard(cards[i].el, cached.score);
    }
  }

  function resetVisibleSurface() {
    visibleScoreCache = {};
    lastVisibleBatchKey = '';
    visibleScoringActive = false;
    if (surfaceRescanTimer) { clearTimeout(surfaceRescanTimer); surfaceRescanTimer = null; }
    removeAllBadges();
    if (shadow) {
      var el = shadow.getElementById('cb-surface-summary');
      if (el) el.style.display = 'none';
    }
  }

  function scheduleVisibleRescan() {
    if (surfaceRescanTimer) clearTimeout(surfaceRescanTimer);
    surfaceRescanTimer = setTimeout(function () { scoreVisibleSurface(); }, 2000);
  }

  function startVisibleSurfaceWatchers() {
    var listEl = null;
    for (var s = 0; s < JOB_LIST_CONTAINER_SELECTORS.length; s++) {
      listEl = document.querySelector(JOB_LIST_CONTAINER_SELECTORS[s]);
      if (listEl) break;
    }
    if (!listEl) {
      setTimeout(startVisibleSurfaceWatchers, 3000);
      return;
    }
    var scrollTarget = listEl.closest('.scaffold-layout__list') ||
                       listEl.closest('[class*="jobs-search"]') ||
                       listEl;
    scrollTarget.addEventListener('scroll', function () {
      scheduleVisibleRescan();
    }, { passive: true });
    if (visibleListObserver) visibleListObserver.disconnect();
    visibleListObserver = new MutationObserver(function () {
      scheduleVisibleRescan();
    });
    visibleListObserver.observe(listEl, { childList: true, subtree: false });
    console.debug('[Caliber] visible-surface: watchers attached');
  }

  function stopVisibleSurfaceWatchers() {
    if (visibleListObserver) { visibleListObserver.disconnect(); visibleListObserver = null; }
    if (surfaceRescanTimer) { clearTimeout(surfaceRescanTimer); surfaceRescanTimer = null; }
  }

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

    // Wire auto-save action buttons
    shadow.getElementById("cb-autosave-tailor").addEventListener("click", function () {
      chrome.runtime.sendMessage({
        type: "CALIBER_TAILOR_PREPARE",
        jobTitle: lastJobMeta.title || "",
        company: lastJobMeta.company || "",
        jobUrl: location.href,
        jobText: lastScoredText || "",
      });
    });
    shadow.getElementById("cb-autosave-pipeline").addEventListener("click", function () {
      chrome.runtime.sendMessage({ type: "CALIBER_OPEN_PIPELINE" });
    });

    // Wire collapsible section toggles
    shadow.querySelectorAll(".cb-collapse-toggle").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var section = btn.closest(".cb-collapsible");
        if (section) section.classList.toggle("cb-open");
      });
    });

    // Wire feedback controls
    shadow.getElementById("cb-fb-up").addEventListener("click", handleThumbsUp);
    shadow.getElementById("cb-fb-down").addEventListener("click", handleThumbsDown);
    shadow.getElementById("cb-fb-bug").addEventListener("click", handleBugReport);
    shadow.getElementById("cb-fb-submit").addEventListener("click", handleFeedbackSubmit);
    shadow.getElementById("cb-fb-cancel").addEventListener("click", handleFeedbackCancel);
    shadow.querySelectorAll(".cb-fb-chip").forEach(function (chip) {
      chip.addEventListener("click", function () {
        chip.classList.toggle("cb-fb-chip-selected");
      });
    });

    // Wire tailor banner button
    shadow.getElementById("cb-tailor-btn").addEventListener("click", function () {
      var btn = shadow.getElementById("cb-tailor-btn");
      // If already in opened state, clicking opens pipeline
      if (btn && btn.dataset.opened === "1") {
        chrome.runtime.sendMessage({ type: "CALIBER_OPEN_PIPELINE" });
        return;
      }
      if (btn) { btn.textContent = "Preparing\u2026"; btn.disabled = true; }
      chrome.runtime.sendMessage({
        type: "CALIBER_TAILOR_PREPARE",
        jobTitle: lastJobMeta.title || "",
        company: lastJobMeta.company || "",
        jobUrl: location.href,
        jobText: lastScoredText || "",
      }, function (resp) {
        if (resp && resp.ok) {
          setTailorBtnOpened(shadow);
        } else {
          if (btn) { btn.textContent = "Tailor resume for this job \u2192"; btn.disabled = false; }
          console.warn("[Caliber] Tailor prepare failed:", resp && resp.error);
        }
      });
    });

    return shadow;
  }

  /**
   * Transition the tailor banner button to "Opened \u2713" state.
   * In this state, clicking opens the pipeline page.
   */
  function setTailorBtnOpened(shadowRoot) {
    var btn = shadowRoot.getElementById("cb-tailor-btn");
    if (!btn) return;
    btn.textContent = "Opened \u2713";
    btn.disabled = false;
    btn.dataset.opened = "1";
    btn.style.cursor = "pointer";
    btn.setAttribute("aria-label", "View pipeline");
  }

  function removePanel() {
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

  // ─── Domain-Mismatch Score Guardrail ─────────────────────
  // Prevents trust-breaking contradictions where an obviously wrong-domain
  // job receives a "Strong Fit" score while Hiring Reality is "Unlikely".
  // Caps the score to the top of the Stretch band so partial overlap can
  // still be acknowledged without producing a false strong-fit signal.
  function applyDomainMismatchGuardrail(score, hrcBand) {
    if (hrcBand === "Unlikely" && score >= 7.5) {
      console.debug("[Caliber] domain-mismatch guardrail: capping score from " + score + " to 6.9 (HRC=Unlikely)");
      return 6.9;
    }
    return score;
  }

  // ─── Panel State Rendering ────────────────────────────────

  function setPanelState(stateId) {
    for (const id of ["cb-idle", "cb-loading", "cb-error", "cb-results"]) {
      const el = shadow.getElementById(id);
      if (el) el.style.display = (id === stateId) ? "" : "none";
    }
  }

  function showIdle() {
    getOrCreatePanel();
    setPanelState("cb-idle");
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

  // ─── Feedback Handlers ─────────────────────────────────

  function handleThumbsUp() {
    if (feedbackGiven) return;
    feedbackGiven = true;
    sendFeedback("thumbs_up", null, null);
    showFeedbackConfirm();
  }

  function handleThumbsDown() {
    if (feedbackGiven) return;
    // Show the negative feedback panel
    var panel = shadow.getElementById("cb-fb-panel");
    if (panel) panel.style.display = "";
    var row = shadow.getElementById("cb-fb-row");
    if (row) row.style.display = "none";
  }

  function handleFeedbackSubmit() {
    feedbackGiven = true;
    var selected = shadow.querySelectorAll(".cb-fb-chip-selected");
    var reason = null;
    if (selected.length > 0) reason = selected[0].getAttribute("data-reason");
    var comment = (shadow.getElementById("cb-fb-text").value || "").trim();
    sendFeedback("thumbs_down", reason, comment || null);
    shadow.getElementById("cb-fb-panel").style.display = "none";
    showFeedbackConfirm();
  }

  function handleFeedbackCancel() {
    shadow.getElementById("cb-fb-panel").style.display = "none";
    var row = shadow.getElementById("cb-fb-row");
    if (row) row.style.display = "";
  }

  function handleBugReport() {
    var d = lastFeedbackData || {};
    var body = "**Score shown:** " + (d.score != null ? d.score : "n/a") +
      "\n**Job:** " + (d.jobTitle || "n/a") + " @ " + (d.company || "n/a") +
      "\n**Decision:** " + (d.decision || "n/a") +
      "\n**Panel version:** " + PANEL_VERSION +
      "\n\n**What went wrong?**\n";
    var url = "https://github.com/K1ZM3TxD/caliber-beta/issues/new?" +
      "labels=bug&title=" + encodeURIComponent("[Extension Bug] ") +
      "&body=" + encodeURIComponent(body);
    window.open(url, "_blank", "noopener");
  }

  function showFeedbackConfirm() {
    var row = shadow.getElementById("cb-fb-row");
    if (row) row.innerHTML = '<span class="cb-fb-thanks">Thanks for the feedback</span>';
  }

  function sendFeedback(type, reason, comment) {
    var d = lastFeedbackData || {};
    var payload = {
      surface: "extension",
      site: "linkedin",
      company_name: d.company || null,
      job_title: d.jobTitle || null,
      search_title: getSearchKeywords() || null,
      calibration_title_direction: null,
      fit_score: d.score != null ? d.score : null,
      decision_label: d.decision || null,
      hiring_reality_band: d.hrcBand || null,
      better_search_title_suggestion: d.suggestedTitle || null,
      feedback_type: type,
      feedback_reason: reason,
      optional_comment: comment,
      behavioral_signals: {
        jobs_viewed_in_session: sessionSignals.jobs_viewed,
        scores_below_6_count: sessionSignals.scores_below_6,
        highest_score_seen: sessionSignals.highest_score,
        better_title_suggestion_shown: sessionSignals.suggest_shown,
        better_title_suggestion_clicked: sessionSignals.suggest_clicked,
      },
    };
    chrome.runtime.sendMessage({ type: "CALIBER_FEEDBACK", payload: payload }, function () {
      console.debug("[Caliber] feedback sent:", type, reason)
    });
  }

  // ─── Rolling Weak-Search Detection ─────────────────────

  // Returns true if two titles are semantically equivalent for search purposes.
  // Only exact normalized match — keeps containment-different titles like
  // "Senior Product Manager" vs "Product Manager" as distinct suggestions.
  function titlesEquivalent(a, b) {
    if (!a || !b) return false;
    var na = a.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    var nb = b.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    return na === nb;
  }

  function checkWeakSearchPattern() {
    // Documented: rolling window of last 4 scored jobs.
    // Trigger when 3 of 4 scores are below 6.5 and none are >= 7.5.
    if (recentScores.length < 4) {
      console.debug("[Caliber] rolling window: only " + recentScores.length + " entries, need 4");
      return null;
    }
    var win = recentScores.slice(-4);
    var weakCount = 0;
    var hasStrong = false;
    for (var i = 0; i < win.length; i++) {
      if (win[i].score < 6.5) weakCount++;
      if (win[i].score >= 7.5) hasStrong = true;
    }
    console.debug("[Caliber] rolling window check: " + win.length + " entries, weak=" + weakCount + ", hasStrong=" + hasStrong);
    if (weakCount >= 3 && !hasStrong) {
      var currentQuery = getSearchKeywords();

      // Check if ANY entry has suggestion data
      var hasAnyCalibrationTitle = false;
      var hasAnyNearbyRole = false;
      for (var c = 0; c < win.length; c++) {
        if (win[c].calibrationTitle) hasAnyCalibrationTitle = true;
        if (win[c].nearbyRoles && win[c].nearbyRoles.length > 0) hasAnyNearbyRole = true;
      }

      if (!hasAnyCalibrationTitle && !hasAnyNearbyRole) {
        // Neither calibration_title nor nearby_roles available — cannot suggest
        console.warn("[Caliber] weak-search triggered but no suggestion data: calibration_title and nearby_roles are both empty. Check that the calibration session has titleRecommendation populated.");
        return "";
      }

      // Source 1: calibration primary title (the user's strongest fit direction)
      for (var j = win.length - 1; j >= 0; j--) {
        if (win[j].calibrationTitle && !titlesEquivalent(win[j].calibrationTitle, currentQuery)) {
          console.debug("[Caliber] weak-search triggered, suggesting calibration title: " + win[j].calibrationTitle);
          return win[j].calibrationTitle;
        }
      }
      // Source 2: adjacent search-surface titles from calibration
      for (var j = win.length - 1; j >= 0; j--) {
        if (win[j].nearbyRoles && win[j].nearbyRoles.length > 0) {
          for (var k = 0; k < win[j].nearbyRoles.length; k++) {
            var role = win[j].nearbyRoles[k];
            if (role.title && !titlesEquivalent(role.title, currentQuery)) {
              console.debug("[Caliber] weak-search triggered, suggesting adjacent title: " + role.title);
              return role.title;
            }
          }
        }
      }
      // All available titles match current search query — suppress banner
      console.debug("[Caliber] weak-search triggered but all suggestions match current query (" + currentQuery + ") — suppressed");
      return "";
    }
    return null;
  }

  function showResults(data) {
    getOrCreatePanel();
    hideOverlay();

    console.log("[caliber] showResults v" + PANEL_VERSION, JSON.stringify(data).substring(0, 500));

    var rawScore = Number(data.score_0_to_10) || 0;
    var hrc = data.hiring_reality_check;
    var hrcBand = (hrc && hrc.band) ? hrc.band : null;
    var score = applyDomainMismatchGuardrail(rawScore, hrcBand);
    lastScoredScore = score;
    var decision = getDecision(score);

    // Score + decision (left side of header row)
    var scoreEl = shadow.getElementById("cb-score");
    scoreEl.textContent = score;
    scoreEl.style.color = score >= 7.5 ? "#4ADE80" : score >= 5 ? "#FBBF24" : "#EF4444";

    var decEl = shadow.getElementById("cb-decision");
    decEl.textContent = decision.label;
    decEl.className = "cb-decision " + decision.cls;

    // Company identity (right side of header row)
    var companyEl = shadow.getElementById("cb-company");
    var titleEl = shadow.getElementById("cb-jobtitle");
    companyEl.textContent = lastJobMeta.company || "";
    titleEl.textContent = lastJobMeta.title || "";

    // Auto-save to pipeline for strong matches (score >= 8.5)
    var autosaveRow = shadow.getElementById("cb-autosave-row");
    if (autosaveRow) {
      if (score >= 8.5) {
        autosaveRow.style.display = "none"; // hidden until save confirms
        chrome.runtime.sendMessage({
          type: "CALIBER_PIPELINE_SAVE",
          jobTitle: lastJobMeta.title || "",
          company: lastJobMeta.company || "",
          jobUrl: location.href,
          score: score,
        }, function (resp) {
          if (resp && resp.ok) {
            autosaveRow.style.display = "";
            console.debug("[Caliber] auto-saved to pipeline: " + (lastJobMeta.title || "untitled"));
          } else {
            console.warn("[Caliber] auto-save failed:", resp && resp.error);
          }
        });
      } else {
        autosaveRow.style.display = "none";
      }
    }

    // Hiring Reality Check (collapsible row)
    var hrcSection = shadow.getElementById("cb-hrc-section");
    var hrcBandEl = shadow.getElementById("cb-hrc-band");
    var hrcReason = shadow.getElementById("cb-hrc-reason");
    var hrcToggle = hrcSection.querySelector(".cb-collapse-toggle");
    hrcSection.style.display = "";
    if (hrc && hrc.band) {
      hrcBandEl.textContent = hrc.band;
      hrcBandEl.className = "cb-hrc-badge";
      hrcToggle.className = "cb-collapse-toggle";
      if (hrc.band === "High") {
        hrcBandEl.classList.add("cb-hrc-high");
        hrcToggle.classList.add("cb-toggle-green");
        hrcReason.style.color = "#6EE7A0";
      } else if (hrc.band === "Possible") {
        hrcBandEl.classList.add("cb-hrc-possible");
        hrcToggle.classList.add("cb-toggle-yellow");
        hrcReason.style.color = "#D4A017";
      } else {
        hrcBandEl.classList.add("cb-hrc-unlikely");
        hrcToggle.classList.add("cb-toggle-red");
        hrcReason.style.color = "#F87171";
      }
      hrcReason.textContent = hrc.reason || "";
    } else {
      hrcBandEl.textContent = "\u2014";
      hrcBandEl.className = "cb-hrc-badge";
      hrcToggle.className = "cb-collapse-toggle";
      hrcReason.textContent = "";
    }

    // Supports (collapsible — dot indicators in toggle)
    var supportItems = data.supports_fit || [];
    renderList(shadow.getElementById("cb-supports"), supportItems);
    var supCount = shadow.getElementById("cb-supports-count");
    if (supCount) supCount.innerHTML = renderDotIndicators(supportItems.length, "green");

    // Stretch factors (collapsible — dot indicators in toggle)
    var stretchItems = data.stretch_factors || [];
    renderList(shadow.getElementById("cb-stretch"), stretchItems);
    var strCount = shadow.getElementById("cb-stretch-count");
    if (strCount) strCount.innerHTML = renderDotIndicators(stretchItems.length, "yellow");
    var stretchSection = shadow.getElementById("cb-stretch-section");
    if (stretchSection) stretchSection.style.display = "";

    // Bottom line (collapsible)
    shadow.getElementById("cb-bottomline").textContent = data.bottom_line_2s || "\u2014";
    var blSection = shadow.getElementById("cb-bottomline-section");
    if (blSection) blSection.style.display = "";

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

    // Tailor Resume banner (above sidecard, 8.0+ only)
    // Show opened-state only when pipeline entry confirmed; otherwise show tailor CTA.
    var tailorBanner = shadow.getElementById("cb-tailor-banner");
    if (tailorBanner) {
      if (score >= 8.0) {
        tailorBanner.style.display = "";
        var btn = shadow.getElementById("cb-tailor-btn");
        // Default to tailor CTA while pipeline check is in flight
        if (btn) { btn.textContent = "Tailor resume for this job \u2192"; btn.disabled = false; btn.dataset.opened = ""; }
        // Check pipeline membership asynchronously
        chrome.runtime.sendMessage({
          type: "CALIBER_PIPELINE_CHECK",
          jobUrl: location.href,
        }, function (resp) {
          if (resp && resp.ok && resp.exists) {
            // Job is already in pipeline — show opened state
            setTailorBtnOpened(shadow);
          }
          // If not in pipeline or check failed, keep the default tailor CTA
        });
      } else {
        tailorBanner.style.display = "none";
      }
    }

    // Rolling weak-search detection
    var _calTitle = data.calibration_title || "";
    var _nearbyLen = (data.nearby_roles || []).length;
    recentScores.push({ score: score, nearbyRoles: data.nearby_roles || [], calibrationTitle: _calTitle });
    if (recentScores.length > 4) recentScores.shift();
    console.debug("[Caliber] rolling window: " + recentScores.length + " entries, latest score=" + score + ", calibration_title=" + (_calTitle || "(empty)") + ", nearby_roles=" + _nearbyLen);
    var suggestedTitle = checkWeakSearchPattern();
    var recoveryBanner = shadow.getElementById("cb-recovery-banner");
    var recoveryLink = shadow.getElementById("cb-recovery-link");
    if (suggestedTitle !== null && suggestedTitle !== "") {
      recoveryBanner.style.display = "";
      recoveryLink.textContent = suggestedTitle;
      recoveryLink.href = "https://www.linkedin.com/jobs/search/?keywords=" + encodeURIComponent(suggestedTitle);
      sessionSignals.suggest_shown = true;
      recoveryLink.onclick = function () { sessionSignals.suggest_clicked = true; };
    } else {
      recoveryBanner.style.display = "none";
    }

    // Behavioral signal tracking
    sessionSignals.jobs_viewed++;
    if (score < 6) sessionSignals.scores_below_6++;
    if (score > sessionSignals.highest_score) sessionSignals.highest_score = score;

    // Snapshot context for feedback
    lastFeedbackData = {
      score: score,
      decision: decision.label,
      company: lastJobMeta.company || null,
      jobTitle: lastJobMeta.title || null,
      hrcBand: hrcBand,
      suggestedTitle: suggestedTitle || null,
    };

    // Reset feedback UI for new result (unless already given in this session)
    var fbRow = shadow.getElementById("cb-fb-row");
    var fbPanel = shadow.getElementById("cb-fb-panel");
    if (fbPanel) fbPanel.style.display = "none";
    if (fbRow && !feedbackGiven) {
      fbRow.style.display = "";
      fbRow.innerHTML = '<span class="cb-fb-prompt">Helpful?</span>' +
        '<button id="cb-fb-up" class="cb-fb-btn" title="Yes"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3H14z"/><path d="M7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/></svg></button>' +
        '<button id="cb-fb-down" class="cb-fb-btn" title="No"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3H10z"/><path d="M17 2h3a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-3"/></svg></button>' +
        '<span class="cb-fb-spacer"></span>' +
        '<button id="cb-fb-bug" class="cb-fb-bug" title="Report a bug"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg></button>';
      shadow.getElementById("cb-fb-up").addEventListener("click", handleThumbsUp);
      shadow.getElementById("cb-fb-down").addEventListener("click", handleThumbsDown);
      shadow.getElementById("cb-fb-bug").addEventListener("click", handleBugReport);
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

  /**
   * Build dot-indicator HTML for collapsed Supports/Stretch rows.
   * Up to 5 filled/empty dots; a star (★) if count exceeds 5.
   * @param {number} count  - actual item count
   * @param {"green"|"yellow"} tone - color family
   */
  function renderDotIndicators(count, tone) {
    if (count === 0) return "";
    var maxDots = 5;
    var filled = Math.min(count, maxDots);
    var html = '<span class="cb-dots">';
    for (var i = 0; i < maxDots; i++) {
      html += '<span class="cb-dot ' + (i < filled ? "cb-dot-on-" + tone : "cb-dot-off-" + tone) + '"></span>';
    }
    if (count > maxDots) {
      html += '<span class="cb-dot-star cb-dot-star-' + tone + '">\u2605</span>';
    }
    html += '</span>';
    return html;
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
        showError("Calibration incomplete. Finish the calibration prompts on Caliber first.");
        return;
      }

      showLoading("Extracting job description\u2026");

      // Capture job metadata from the page for the card header
      lastJobMeta = extractJobMeta();

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

  // ─── Job Change Detection ─────────────────────────────────

  function startWatching() {
    if (watchInterval) return;
    // Poll: text changes + LinkedIn SPA URL changes (currentJobId param)
    watchInterval = setInterval(function () {
      if (!active || scoring) return;
      if (location.href !== lastWatchedUrl) {
        lastWatchedUrl = location.href;
        lastScoredText = ""; // force re-score on navigation
        // Reset rolling window if search query changed
        var currentQuery = getSearchKeywords();
        if (currentQuery !== lastSearchQuery) {
          recentScores = [];
          lastSearchQuery = currentQuery;
          resetSessionSignals();
          resetVisibleSurface();
          console.debug("[Caliber] search query changed, reset rolling window + session signals + visible surface");
        }
        console.debug("[Caliber] URL changed, re-scoring");
        scoreCurrentJob(true);
        scheduleVisibleRescan();
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
    clearTimeout(detailDebounce);
  }

  // ─── Activation / Deactivation ────────────────────────────

  function activatePanel() {
    if (active) { scoreCurrentJob(true); return; }
    active = true;
    chrome.storage.local.set({ caliberPanelEnabled: true });
    showIdle();
    startWatching();
    startVisibleSurfaceWatchers();
    // If a job description is already visible, score immediately
    var text = extractJobText();
    if (text && text.length >= MIN_SCORE_CHARS) {
      scoreCurrentJob(true);
    }
    // Kick off visible-surface scoring after a short delay
    setTimeout(function () { scoreVisibleSurface(); }, 2500);
  }

  function deactivatePanel() {
    active = false;
    chrome.storage.local.set({ caliberPanelEnabled: false });
    stopWatching();
    stopVisibleSurfaceWatchers();
    removePanel();
    resetVisibleSurface();
    lastScoredText = "";
    recentScores = [];
    resetSessionSignals();
  }

  // Auto-activate unless user explicitly dismissed
  chrome.storage.local.get(["caliberPanelEnabled"], function (data) {
    if (data.caliberPanelEnabled !== false) activatePanel();
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
    '<div class="cb-container">',
    '<div id="cb-tailor-banner" class="cb-tailor-banner" style="display:none">',
    '  <span class="cb-tailor-icon">\u2728</span>',
    '  <div class="cb-tailor-body">',
    '    <div class="cb-tailor-label">Strong match</div>',
    '    <button id="cb-tailor-btn" class="cb-tailor-link">Tailor resume for this job \u2192</button>',
    '  </div>',
    '</div>',
    '<div id="cb-recovery-banner" class="cb-recovery-banner" style="display:none">',
    '  <span class="cb-recovery-icon">\uD83D\uDD0D</span>',
    '  <div class="cb-recovery-body">',
    '    <div class="cb-recovery-label">Try a stronger search title</div>',
    '    <a id="cb-recovery-link" class="cb-recovery-link" target="_self"></a>',
    '  </div>',
    '</div>',
    '<div class="cb-panel">',
    '  <div class="cb-header">',
    '    <span class="cb-logo">Caliber</span>',
    '    <div class="cb-header-controls">',
    '      <button id="cb-recalc" class="cb-refresh-btn" aria-label="Refresh score" title="Re-score">\u21BB</button>',
    '      <button id="cb-close" class="cb-close-btn" aria-label="Close">\u00d7</button>',
    '    </div>',
    '  </div>',
    '  <div id="cb-surface-summary" class="cb-surface-summary" style="display:none">',
    '    <div class="cb-surface-header">Search Surface</div>',
    '    <div class="cb-surface-stats">',
    '      <div class="cb-surface-stat"><span class="cb-surface-stat-label">Median Fit</span><span id="cb-surface-median" class="cb-surface-stat-value">\u2014</span></div>',
    '      <div class="cb-surface-stat"><span class="cb-surface-stat-label">Top Fit</span><span id="cb-surface-top" class="cb-surface-stat-value">\u2014</span></div>',
    '      <div class="cb-surface-stat"><span class="cb-surface-stat-label">Strong</span><span id="cb-surface-strong" class="cb-surface-stat-value">\u2014</span></div>',
    '    </div>',
    '    <div id="cb-surface-count" class="cb-surface-count"></div>',
    '  </div>',
    '  <div id="cb-idle" class="cb-body" style="display:none">',
    '    <div class="cb-idle-icon">\u25CE</div>',
    '    <p class="cb-status">Select a job to analyze</p>',
    '  </div>',
    '  <div id="cb-loading" class="cb-body" style="display:none">',
    '    <div class="cb-spinner"></div>',
    '    <p id="cb-loading-text" class="cb-status">Computing fit score\u2026</p>',
    '  </div>',
    '  <div id="cb-error" class="cb-body" style="display:none">',
    '    <div class="cb-error-icon">!</div>',
    '    <p id="cb-error-msg" class="cb-status"></p>',
    '    <button id="cb-retry" class="cb-btn cb-btn-s">Retry</button>',
    '  </div>',
    '  <div id="cb-results" class="cb-body" style="display:none">',
    '    <div id="cb-rescore-overlay" class="cb-overlay" style="display:none">',
    '      <div class="cb-spinner cb-spinner-sm"></div>',
    '      <span class="cb-overlay-text">Rescoring\u2026</span>',
    '    </div>',
    '    <div id="cb-autosave-row" class="cb-autosave-row" style="display:none">',
    '      <span class="cb-autosave-check">✓</span>',
    '      <span class="cb-autosave-label">Saved to pipeline</span>',
    '      <div class="cb-autosave-actions">',
    '        <button id="cb-autosave-tailor" class="cb-autosave-action">Tailor resume</button>',
    '        <button id="cb-autosave-pipeline" class="cb-autosave-action">View pipeline</button>',
    '      </div>',
    '    </div>',
    '    <div class="cb-toprow">',
    '      <div class="cb-toprow-left">',
    '        <div class="cb-score-row">',
    '          <span id="cb-score" class="cb-score-num">\u2014</span>',
    '          <span class="cb-score-of">/10</span>',
    '        </div>',
    '        <div id="cb-decision" class="cb-decision"></div>',
    '      </div>',
    '      <div class="cb-toprow-right">',
    '        <div id="cb-company" class="cb-company-name"></div>',
    '        <div id="cb-jobtitle" class="cb-job-title"></div>',
    '      </div>',
    '    </div>',
    '    <div id="cb-hrc-section" class="cb-collapsible" style="display:none">',
    '      <button class="cb-collapse-toggle" type="button">',
    '        <span class="cb-collapse-icon">\u25b8</span>',
    '        <span>Hiring Reality</span>',
    '        <span id="cb-hrc-band" class="cb-hrc-badge"></span>',
    '      </button>',
    '      <div class="cb-collapse-body">',
    '        <p id="cb-hrc-reason" class="cb-hrc-reason"></p>',
    '      </div>',
    '    </div>',
    '    <div class="cb-collapsible" id="cb-supports-section">',
    '      <button class="cb-collapse-toggle cb-toggle-green" type="button">',
    '        <span class="cb-collapse-icon">\u25b8</span>',
    '        <span>Supports the Fit</span>',
    '        <span id="cb-supports-count" class="cb-collapse-count"></span>',
    '      </button>',
    '      <div class="cb-collapse-body">',
    '        <ul id="cb-supports" class="cb-bullets"></ul>',
    '      </div>',
    '    </div>',
    '    <div class="cb-collapsible" id="cb-stretch-section">',
    '      <button class="cb-collapse-toggle cb-toggle-yellow" type="button">',
    '        <span class="cb-collapse-icon">\u25b8</span>',
    '        <span>Stretch Factors</span>',
    '        <span id="cb-stretch-count" class="cb-collapse-count"></span>',
    '      </button>',
    '      <div class="cb-collapse-body">',
    '        <ul id="cb-stretch" class="cb-bullets cb-stretch"></ul>',
    '      </div>',
    '    </div>',
    '    <div class="cb-collapsible" id="cb-bottomline-section">',
    '      <button class="cb-collapse-toggle" type="button">',
    '        <span class="cb-collapse-icon">\u25b8</span>',
    '        <span>Bottom Line</span>',
    '      </button>',
    '      <div class="cb-collapse-body">',
    '        <p id="cb-bottomline" class="cb-bltext"></p>',
    '      </div>',
    '    </div>',
    '    <div id="cb-nearby-section" class="cb-collapsible cb-nearby-section" style="display:none">',
    '      <button class="cb-collapse-toggle" type="button">',
    '        <span class="cb-collapse-icon">\u25b8</span>',
    '        <span>\u2192 Better nearby roles</span>',
    '      </button>',
    '      <div class="cb-collapse-body">',
    '        <ul id="cb-nearby" class="cb-nearby-list"></ul>',
    '      </div>',
    '    </div>',
    // Tailor CTA moved to above-sidecard banner (cb-tailor-banner)
    '    <div id="cb-fb-row" class="cb-fb-row">',
    '      <span class="cb-fb-prompt">Helpful?</span>',
    '      <button id="cb-fb-up" class="cb-fb-btn" aria-label="Thumbs up" title="Yes"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3H14z"/><path d="M7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/></svg></button>',
    '      <button id="cb-fb-down" class="cb-fb-btn" aria-label="Thumbs down" title="No"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3H10z"/><path d="M17 2h3a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-3"/></svg></button>',
    '      <span class="cb-fb-spacer"></span>',
    '      <button id="cb-fb-bug" class="cb-fb-bug" aria-label="Report a bug" title="Report a bug"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg></button>',
    '    </div>',
    '    <div id="cb-fb-panel" class="cb-fb-panel" style="display:none">',
    '      <div class="cb-fb-panel-title">What was off?</div>',
    '      <div class="cb-fb-chips">',
    '        <button class="cb-fb-chip" data-reason="score_wrong">Score wrong</button>',
    '        <button class="cb-fb-chip" data-reason="hiring_reality_wrong">Hiring reality wrong</button>',
    '        <button class="cb-fb-chip" data-reason="title_suggestion_wrong">Title suggestion wrong</button>',
    '        <button class="cb-fb-chip" data-reason="explanation_not_helpful">Explanation not helpful</button>',
    '        <button class="cb-fb-chip" data-reason="other">Other</button>',
    '      </div>',
    '      <textarea id="cb-fb-text" class="cb-fb-text" placeholder="Optional details\u2026" rows="2" maxlength="500"></textarea>',
    '      <div class="cb-fb-actions">',
    '        <button id="cb-fb-submit" class="cb-fb-submit">Submit</button>',
    '        <button id="cb-fb-cancel" class="cb-fb-cancel">Cancel</button>',
    '      </div>',
    '    </div>',
    '  </div>',
    '</div>',
    '</div>'
  ].join("\n");

  var PANEL_CSS = [
    "*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }",
    // Container: sidecard in normal flow; banners absolutely positioned above
    ".cb-container {",
    "  position: relative;",
    "}",
    // Recovery banner (above sidecard)
    ".cb-recovery-banner {",
    "  position: absolute; bottom: 100%; left: 0; margin-bottom: 6px;",
    "  width: 380px; background: #161B2E;",
    "  border: 1px solid rgba(96,165,250,0.25); border-radius: 10px;",
    "  box-shadow: 0 2px 8px rgba(0,0,0,0.4);",
    "  padding: 8px 12px; display: flex; align-items: center; gap: 8px;",
    "  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;",
    "  animation: cb-banner-fade 0.15s ease-out;",
    "}",
    ".cb-recovery-icon { font-size: 15px; flex-shrink: 0; line-height: 1; }",
    ".cb-recovery-body { flex: 1; min-width: 0; }",
    ".cb-recovery-label {",
    "  font-size: 9px; font-weight: 600; color: #60A5FA;",
    "  letter-spacing: 0.03em; text-transform: uppercase; margin-bottom: 2px;",
    "}",
    ".cb-recovery-link {",
    "  font-size: 12px; font-weight: 700; color: #93C5FD;",
    "  text-decoration: none; display: block;",
    "  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;",
    "  border-bottom: 1px solid rgba(147,197,253,0.3);",
    "  transition: color 0.15s, border-color 0.15s;",
    "}",
    ".cb-recovery-link:hover { color: #BFDBFE; border-color: #BFDBFE; }",
    ".cb-panel {",
    "  width: 380px; max-height: 520px; overflow-y: auto;",
    "  background: #111114; color: #F2F2F2; border-radius: 12px;",
    "  box-shadow: 0 2px 8px rgba(0,0,0,0.6), 0 12px 40px rgba(0,0,0,0.5);",
    "  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;",
    "  font-size: 13px; line-height: 1.45;",
    "  border: 1px solid rgba(255,255,255,0.12);",
    "  animation: cb-enter 0.2s ease-out;",
    "}",
    "@keyframes cb-enter {",
    "  from { opacity: 0; transform: translateY(12px); }",
    "  to   { opacity: 1; transform: translateY(0); }",
    "}",
    "@keyframes cb-banner-fade {",
    "  from { opacity: 0; }",
    "  to   { opacity: 1; }",
    "}",
    ".cb-panel::-webkit-scrollbar { width: 4px; }",
    ".cb-panel::-webkit-scrollbar-track { background: transparent; }",
    ".cb-panel::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.15); border-radius: 3px; }",
    ".cb-header {",
    "  display: flex; align-items: center; justify-content: space-between;",
    "  padding: 8px 14px; border-bottom: 1px solid rgba(255,255,255,0.08);",
    "}",
    ".cb-logo { font-size: 10px; font-weight: 700; letter-spacing: -0.02em; color: #555; }",
    ".cb-header-controls { display: flex; align-items: center; gap: 2px; }",
    ".cb-refresh-btn {",
    "  background: none; border: none; color: #555; font-size: 14px;",
    "  cursor: pointer; padding: 0 4px; line-height: 1;",
    "}",
    ".cb-refresh-btn:hover { color: #AFAFAF; }",
    ".cb-close-btn {",
    "  background: none; border: none; color: #555; font-size: 15px;",
    "  cursor: pointer; padding: 0 4px; line-height: 1;",
    "}",
    ".cb-close-btn:hover { color: #F2F2F2; }",
    ".cb-body { padding: 12px 14px; position: relative; }",
    "#cb-results { min-height: 240px; }",
    ".cb-spinner {",
    "  width: 20px; height: 20px;",
    "  border: 2px solid rgba(242,242,242,0.12);",
    "  border-top-color: #4ADE80; border-radius: 50%;",
    "  animation: cb-spin 0.7s linear infinite;",
    "  margin: 8px auto 6px;",
    "}",
    ".cb-spinner-sm { width: 14px; height: 14px; border-width: 2px; margin: 0; }",
    "@keyframes cb-spin { to { transform: rotate(360deg); } }",
    ".cb-status { text-align: center; color: #AFAFAF; font-size: 11px; }",
    ".cb-idle-icon {",
    "  width: 28px; height: 28px; border-radius: 50%;",
    "  background: rgba(242,242,242,0.06); color: #666;",
    "  display: flex; align-items: center; justify-content: center;",
    "  font-size: 14px; margin: 8px auto 6px;",
    "}",
    ".cb-error-icon {",
    "  width: 24px; height: 24px; border-radius: 50%;",
    "  background: rgba(239,68,68,0.15); color: #EF4444;",
    "  display: flex; align-items: center; justify-content: center;",
    "  font-weight: 700; font-size: 12px; margin: 6px auto;",
    "}",
    ".cb-overlay {",
    "  position: absolute; inset: 0; z-index: 10;",
    "  background: rgba(17,17,20,0.85); border-radius: 12px;",
    "  display: flex; align-items: center; justify-content: center; gap: 6px;",
    "}",
    ".cb-overlay-text { font-size: 11px; color: #AFAFAF; }",
    // Top row: score LEFT, identity RIGHT
    ".cb-toprow {",
    "  display: flex; align-items: center; gap: 12px;",
    "  padding-bottom: 8px; margin-bottom: 4px;",
    "  border-bottom: 1px solid rgba(255,255,255,0.08);",
    "}",
    ".cb-toprow-left {",
    "  flex-shrink: 0;",
    "  display: flex; flex-direction: column; align-items: flex-start; gap: 1px;",
    "}",
    ".cb-score-row { display: flex; align-items: baseline; gap: 1px; }",
    ".cb-score-num { font-size: 28px; font-weight: 800; letter-spacing: -0.03em; }",
    ".cb-score-of { font-size: 11px; font-weight: 500; color: #555; }",
    ".cb-decision {",
    "  font-size: 9px; font-weight: 700; padding: 1px 6px; border-radius: 3px;",
    "  letter-spacing: 0.01em;",
    "}",
    ".cb-decision-strong { background: rgba(74,222,128,0.15); color: #4ADE80; }",
    ".cb-decision-stretch { background: rgba(251,191,36,0.15); color: #FBBF24; }",
    ".cb-decision-skip { background: rgba(239,68,68,0.15); color: #EF4444; }",
    ".cb-toprow-right { flex: 1; min-width: 0; text-align: right; }",
    ".cb-company-name {",
    "  font-size: 11px; font-weight: 600; color: #777;",
    "  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;",
    "}",
    ".cb-job-title {",
    "  font-size: 12px; font-weight: 700; color: #F2F2F2;",
    "  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;",
    "}",
    // Hiring Reality Check badge
    ".cb-hrc-badge {",
    "  font-size: 9px; font-weight: 700; padding: 1px 5px; border-radius: 3px; margin-left: auto;",
    "}",
    ".cb-hrc-high { background: rgba(74,222,128,0.15); color: #4ADE80; }",
    ".cb-hrc-possible { background: rgba(251,191,36,0.15); color: #FBBF24; }",
    ".cb-hrc-unlikely { background: rgba(239,68,68,0.15); color: #EF4444; }",
    ".cb-hrc-reason { font-size: 10px; color: #999; padding: 2px 0 4px; line-height: 1.4; }",
    // Bottom line text
    ".cb-bltext { font-size: 11px; color: #CFCFCF; line-height: 1.4; padding: 2px 0 4px; }",
    // Collapsible sections
    ".cb-collapsible { border-top: 1px solid rgba(255,255,255,0.06); }",
    ".cb-collapse-toggle {",
    "  display: flex; align-items: center; gap: 4px; width: 100%;",
    "  background: none; border: none; color: #888; cursor: pointer;",
    "  font-size: 10px; font-weight: 600; text-transform: uppercase;",
    "  letter-spacing: 0.04em; padding: 7px 0; text-align: left;",
    "  flex-wrap: nowrap;",
    "}",
    ".cb-collapse-toggle:hover { color: #CFCFCF; }",
    ".cb-toggle-green { color: #4ADE80; }",
    ".cb-toggle-green:hover { color: #6EE7A0; }",
    ".cb-toggle-yellow { color: #FBBF24; }",
    ".cb-toggle-yellow:hover { color: #FCD34D; }",
    ".cb-toggle-red { color: #EF4444; }",
    ".cb-toggle-red:hover { color: #F87171; }",
    ".cb-collapse-icon {",
    "  font-size: 9px; transition: transform 0.15s; display: inline-block;",
    "}",
    ".cb-collapse-count { font-weight: 400; color: #666; margin-left: auto; flex-shrink: 0; }",
    // Dot indicators (collapsed row signal strength)
    ".cb-dots { display: inline-flex; align-items: center; gap: 3px; margin-left: auto; flex-shrink: 0; white-space: nowrap; }",
    ".cb-dot {",
    "  width: 5px; height: 5px; border-radius: 50%; display: inline-block;",
    "  flex-shrink: 0;",
    "}",
    ".cb-dot-on-green  { background: #4ADE80; }",
    ".cb-dot-off-green { background: rgba(74,222,128,0.18); }",
    ".cb-dot-on-yellow  { background: #FBBF24; }",
    ".cb-dot-off-yellow { background: rgba(251,191,36,0.18); }",
    ".cb-dot-star {",
    "  font-size: 8px; line-height: 1; margin-left: 1px;",
    "}",
    ".cb-dot-star-green  { color: #4ADE80; }",
    ".cb-dot-star-yellow { color: #FBBF24; }",
    ".cb-collapse-body {",
    "  max-height: 0; overflow: hidden;",
    "  transition: max-height 0.2s ease-out;",
    "}",
    ".cb-open .cb-collapse-icon { transform: rotate(90deg); }",
    ".cb-open .cb-collapse-body { max-height: 600px; }",
    // Bullet lists
    ".cb-bullets { list-style: none; padding-bottom: 3px; }",
    ".cb-bullets li {",
    "  position: relative; padding-left: 10px;",
    "  font-size: 11px; color: #CFCFCF; margin-bottom: 2px; line-height: 1.45;",
    "}",
    ".cb-bullets li::before {",
    "  content: '\\2022'; position: absolute; left: 0; top: 0; color: #4ADE80; font-weight: 700;",
    "}",
    ".cb-stretch li::before { color: #FBBF24; }",
    // Nearby roles
    ".cb-nearby-section {",
    "  background: rgba(255,255,255,0.04); border-radius: 6px;",
    "  padding: 0 8px; margin-top: 2px;",
    "}",
    ".cb-nearby-section .cb-collapse-toggle { color: #60A5FA; }",
    ".cb-nearby-list { list-style: none; padding-bottom: 3px; }",
    ".cb-nearby-list li { padding: 1px 0; font-size: 10px; }",
    ".cb-nearby-link {",
    "  color: #93C5FD; text-decoration: none; cursor: pointer;",
    "  border-bottom: 1px solid rgba(147,197,253,0.25);",
    "  transition: color 0.15s, border-color 0.15s;",
    "}",
    ".cb-nearby-link:hover { color: #BFDBFE; border-color: #BFDBFE; }",
    // Auto-save pipeline row
    ".cb-autosave-row {",
    "  display: flex; align-items: center; gap: 6px; flex-wrap: wrap;",
    "  padding: 6px 0 4px; margin-bottom: 2px;",
    "  border-bottom: 1px solid rgba(255,255,255,0.06);",
    "}",
    ".cb-autosave-check {",
    "  font-size: 12px; font-weight: 700; color: #4ADE80; line-height: 1;",
    "}",
    ".cb-autosave-label {",
    "  font-size: 11px; font-weight: 600; color: #4ADE80;",
    "}",
    ".cb-autosave-actions {",
    "  display: flex; gap: 6px; margin-left: auto;",
    "}",
    ".cb-autosave-action {",
    "  background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.10);",
    "  border-radius: 4px; padding: 2px 8px; font-size: 10px; font-weight: 600;",
    "  color: #AFAFAF; cursor: pointer; transition: background 0.15s, color 0.15s;",
    "}",
    ".cb-autosave-action:hover { background: rgba(255,255,255,0.10); color: #F2F2F2; }",
    // Tailor Resume above-sidecard banner
    ".cb-tailor-banner {",
    "  position: absolute; bottom: 100%; left: 0; margin-bottom: 6px;",
    "  width: 380px; background: #0F2318;",
    "  border: 1px solid rgba(74,222,128,0.25); border-radius: 10px;",
    "  box-shadow: 0 2px 8px rgba(0,0,0,0.4);",
    "  padding: 8px 12px; display: flex; align-items: center; gap: 8px;",
    "  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;",
    "  animation: cb-banner-fade 0.15s ease-out;",
    "}",
    ".cb-tailor-icon { font-size: 15px; flex-shrink: 0; line-height: 1; }",
    ".cb-tailor-body { flex: 1; min-width: 0; }",
    ".cb-tailor-label {",
    "  font-size: 9px; font-weight: 600; color: #4ADE80;",
    "  letter-spacing: 0.03em; text-transform: uppercase; margin-bottom: 2px;",
    "}",
    ".cb-tailor-link {",
    "  font-size: 12px; font-weight: 700; color: #86EFAC;",
    "  text-decoration: none; display: block; cursor: pointer;",
    "  background: none; border: none; padding: 0; text-align: left;",
    "  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;",
    "  border-bottom: 1px solid rgba(74,222,128,0.3);",
    "  transition: color 0.15s, border-color 0.15s;",
    "}",
    ".cb-tailor-link:hover { color: #BBF7D0; border-color: #BBF7D0; }",
    ".cb-tailor-link:disabled { opacity: 0.6; cursor: default; }",
    // Retry button (error state)
    ".cb-btn {",
    "  padding: 4px 10px; border: none; border-radius: 5px;",
    "  font-size: 10px; font-weight: 600; cursor: pointer;",
    "  text-align: center; display: inline-flex; align-items: center; justify-content: center;",
    "  transition: opacity 0.15s; margin-top: 6px;",
    "}",
    ".cb-btn:hover { opacity: 0.85; }",
    ".cb-btn-s {",
    "  background: rgba(242,242,242,0.10); color: #F2F2F2;",
    "  border: 1px solid rgba(242,242,242,0.16);",
    "}",
    // Feedback row
    ".cb-fb-row {",
    "  display: flex; align-items: center; gap: 6px;",
    "  padding: 7px 0 3px; margin-top: 4px;",
    "  border-top: 1px solid rgba(255,255,255,0.04);",
    "}",
    ".cb-fb-prompt { font-size: 10.5px; color: #555; font-weight: 600; }",
    ".cb-fb-spacer { flex: 1; }",
    ".cb-fb-btn {",
    "  background: none; border: 1px solid rgba(255,255,255,0.08); border-radius: 5px;",
    "  cursor: pointer; padding: 4px 6px; line-height: 1; color: #777;",
    "  display: inline-flex; align-items: center; justify-content: center;",
    "  transition: background 0.15s, border-color 0.15s, color 0.15s;",
    "}",
    ".cb-fb-btn:hover { background: rgba(255,255,255,0.06); border-color: rgba(255,255,255,0.16); color: #CFCFCF; }",
    ".cb-fb-bug {",
    "  background: none; border: none; cursor: pointer; padding: 3px 4px;",
    "  color: #444; line-height: 1; display: inline-flex; align-items: center;",
    "  transition: color 0.15s;",
    "}",
    ".cb-fb-bug:hover { color: #888; }",
    // Feedback detail panel
    ".cb-fb-panel {",
    "  padding: 6px 0 2px; margin-top: 4px;",
    "  border-top: 1px solid rgba(255,255,255,0.04);",
    "}",
    ".cb-fb-panel-title { font-size: 10.5px; font-weight: 600; color: #888; margin-bottom: 5px; }",
    ".cb-fb-chips { display: flex; flex-wrap: wrap; gap: 4px; margin-bottom: 6px; }",
    ".cb-fb-chip {",
    "  background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.10);",
    "  border-radius: 10px; padding: 2px 8px; font-size: 10.5px; color: #AFAFAF;",
    "  cursor: pointer; transition: background 0.15s, border-color 0.15s, color 0.15s;",
    "}",
    ".cb-fb-chip:hover { background: rgba(255,255,255,0.10); color: #F2F2F2; }",
    ".cb-fb-chip-selected {",
    "  background: rgba(96,165,250,0.15); border-color: rgba(96,165,250,0.4); color: #93C5FD;",
    "}",
    ".cb-fb-text {",
    "  width: 100%; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08);",
    "  border-radius: 5px; padding: 5px 7px; font-size: 10.5px; color: #CFCFCF;",
    "  resize: none; font-family: inherit; outline: none;",
    "}",
    ".cb-fb-text::placeholder { color: #555; }",
    ".cb-fb-text:focus { border-color: rgba(96,165,250,0.4); }",
    ".cb-fb-actions { display: flex; gap: 6px; margin-top: 5px; }",
    ".cb-fb-submit {",
    "  background: rgba(74,222,128,0.15); color: #4ADE80; border: none;",
    "  border-radius: 4px; padding: 3px 10px; font-size: 10.5px; font-weight: 600;",
    "  cursor: pointer; transition: opacity 0.15s;",
    "}",
    ".cb-fb-submit:hover { opacity: 0.85; }",
    ".cb-fb-cancel {",
    "  background: none; color: #666; border: 1px solid rgba(255,255,255,0.08);",
    "  border-radius: 4px; padding: 3px 10px; font-size: 10.5px; font-weight: 600;",
    "  cursor: pointer; transition: color 0.15s;",
    "}",
    ".cb-fb-cancel:hover { color: #AFAFAF; }",
    // Feedback thanks
    ".cb-fb-thanks {",
    "  font-size: 10.5px; color: #4ADE80; font-weight: 600;",
    "  padding: 6px 0 2px; margin-top: 4px;",
    "  border-top: 1px solid rgba(255,255,255,0.04);",
    "  text-align: center;",
    "}",
    // Surface summary (visible-job stats)
    ".cb-surface-summary {",
    "  border-bottom: 1px solid rgba(255,255,255,0.08);",
    "  padding: 8px 14px;",
    "}",
    ".cb-surface-header {",
    "  font-size: 9px; font-weight: 600; color: #60A5FA;",
    "  letter-spacing: 0.04em; text-transform: uppercase; margin-bottom: 6px;",
    "}",
    ".cb-surface-stats {",
    "  display: flex; gap: 16px;",
    "}",
    ".cb-surface-stat {",
    "  display: flex; flex-direction: column; align-items: center;",
    "}",
    ".cb-surface-stat-label {",
    "  font-size: 9px; color: #555; font-weight: 500; text-transform: uppercase;",
    "  letter-spacing: 0.03em;",
    "}",
    ".cb-surface-stat-value {",
    "  font-size: 18px; font-weight: 700; color: #F2F2F2;",
    "}",
    ".cb-surface-count {",
    "  font-size: 9px; color: #444; margin-top: 4px; text-align: center;",
    "}"
  ].join("\n");
})();
