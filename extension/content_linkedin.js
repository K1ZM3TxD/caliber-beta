// content_linkedin.js — LinkedIn job description extractor + persistent Caliber panel
// Injected on linkedin.com/jobs/* pages

(function () {
  const API_BASE = CALIBER_ENV.API_BASE;
  const PANEL_HOST_ID = "caliber-panel-host";
  const PANEL_VERSION = "0.9.13";
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

  // Score history (persisted via chrome.storage.local, used for analytics + fallback)
  // BST is now driven by badge-cache evaluation, not this rolling window.
  let recentScores = [];       // last 10 entries: { score, nearbyRoles, calibrationTitle, title, ts }
  let recentScoresLoaded = false;
  let lastSearchQuery = getSearchSurfaceKey();

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

  /**
   * Emit a telemetry event via background.js → POST /api/events.
   * Fire-and-forget: never blocks, swallows all errors.
   */
  function emitTelemetry(event, fields) {
    try {
      var payload = { event: event, source: "extension" };
      if (fields) {
        for (var k in fields) {
          if (Object.prototype.hasOwnProperty.call(fields, k)) payload[k] = fields[k];
        }
      }
      chrome.runtime.sendMessage({ type: "CALIBER_TELEMETRY", payload: payload }, function () {
        if (chrome.runtime.lastError) { /* swallow */ }
      });
    } catch (e) { /* swallow */ }
  }

  function getSearchKeywords() {
    try { return new URL(location.href).searchParams.get("keywords") || ""; }
    catch (e) { return ""; }
  }

  /**
   * Build a stable search-surface key from query + filters + pathname.
   * Two different search surfaces must produce different keys.
   */
  function getSearchSurfaceKey() {
    try {
      var url = new URL(location.href);
      var params = url.searchParams;
      // Normalize pathname: /jobs/view/XXXX should not change the surface key.
      // Only the search-level path matters (e.g. /jobs/search/, /jobs/collections/).
      var path = url.pathname.replace(/\/jobs\/view\/\d+\/?/, "/jobs/search/");
      // Include keywords, location, job type, distance, experience level, sort
      var parts = [
        path,
        params.get("keywords") || "",
        params.get("location") || "",
        params.get("f_TPR") || "",
        params.get("f_JT") || "",
        params.get("f_E") || "",
        params.get("f_WT") || "",
        params.get("distance") || "",
        params.get("sortBy") || "",
        params.get("geoId") || "",
      ];
      return parts.join("|").trim().toLowerCase();
    } catch (e) {
      return "";
    }
  }

  // ─── Pre-scan State (durable via chrome.storage.local) ────

  let prescanDone = false;       // has prescan completed for current search query?
  let prescanRunning = false;    // is prescan currently in progress?
  let prescanSearchQuery = "";   // query for which prescan was last completed
  let prescanBSTActive = false;  // is a prescan-triggered BST banner currently showing?
  let prescanStoredTitle = null;  // suggested title from durable state (for banner restore)
  let prescanSurfaceBanner = null; // stored surface-quality banner data {strongCount, bestTitle, bestScore}

  // ─── Session Readiness State ──────────────────────────────
  var sessionReady = false;          // has a valid session been confirmed?
  var sessionCheckAttempts = 0;      // retry counter for session pre-check
  var sessionCheckMax = 8;           // max retries (8 × escalating delay ≈ 40s)
  var sessionCheckTimer = null;      // timer for session retry
  var lastKnownCalibrationTitle = ""; // fallback calibration title from any successful scoring
  var lastKnownNearbyRoles = [];        // fallback nearby roles from session backup or scoring

  // Load persisted calibration context from chrome.storage.local so BST has
  // a suggestion title immediately, even before the first scoring batch returns.
  chrome.storage.local.get(["caliberCalibrationTitle", "caliberNearbyRoles"], function (data) {
    if (data.caliberCalibrationTitle && !lastKnownCalibrationTitle) {
      lastKnownCalibrationTitle = data.caliberCalibrationTitle;
      console.debug("[Caliber][session][diag] loaded persisted calibrationTitle: \"" + lastKnownCalibrationTitle + "\"");
    }
    if (Array.isArray(data.caliberNearbyRoles) && data.caliberNearbyRoles.length > 0 && lastKnownNearbyRoles.length === 0) {
      lastKnownNearbyRoles = data.caliberNearbyRoles;
      console.debug("[Caliber][session][diag] loaded persisted nearbyRoles: " + lastKnownNearbyRoles.length + " entries");
    }
  });

  // Load persisted prescan state on script init
  chrome.runtime.sendMessage({ type: "CALIBER_PRESCAN_STATE_GET" }, function (resp) {
    if (resp && resp.ok && resp.state && resp.state.done) {
      var currentKey = getSearchSurfaceKey();
      if (resp.state.surfaceKey === currentKey) {
        prescanDone = true;
        prescanSearchQuery = currentKey;
        prescanBSTActive = resp.state.suggestionShown || false;
        prescanStoredTitle = resp.state.suggestedTitle || null;
        // Do NOT restore prescanSurfaceBanner from durable state.
        // Surface-quality banner must render only from fresh scoring on the
        // current surface to avoid showing a stale "best so far" score.
        console.debug("[Caliber][prescan] restored durable state for surface: " + currentKey + " (surfaceBanner intentionally skipped)");
      } else {
        // Stale state from different search surface — clear it
        console.debug("[Caliber][prescan] durable state is stale (different surface), clearing");
        chrome.runtime.sendMessage({ type: "CALIBER_PRESCAN_STATE_CLEAR" });
      }
    }
  });

  // Load persisted score history — only if surface key matches
  chrome.runtime.sendMessage({ type: "CALIBER_SCORE_HISTORY_GET" }, function (resp) {
    if (resp && resp.ok && Array.isArray(resp.history)) {
      // Check surface key on most recent entry
      var currentKey = getSearchSurfaceKey();
      if (resp.history.length > 0 && resp.history[resp.history.length - 1].surfaceKey && resp.history[resp.history.length - 1].surfaceKey !== currentKey) {
        // Stale history from different surface — clear it
        console.debug("[Caliber] persisted score history is from different surface, clearing");
        recentScores = [];
        chrome.runtime.sendMessage({ type: "CALIBER_SCORE_HISTORY_CLEAR" });
      } else {
        recentScores = resp.history;
        console.debug("[Caliber] loaded persisted score history: " + recentScores.length + " entries");
      }
      recentScoresLoaded = true;
    }
  });

  // ─── Pre-scan: Job Card Detection ─────────────────────────

  var JOB_CARD_SELECTORS = [
    ".jobs-search-results__list-item",
    ".scaffold-layout__list-container li.ember-view",
    ".job-card-container",
    "[data-occludable-job-id]",
    'li[class*="jobs-search-results"]',
    'li[class*="job-card"]',
  ];

  var JOB_CARD_TITLE_SELECTORS = [
    ".job-card-list__title",
    ".job-card-container__link",
    'a[class*="job-card"][href*="/jobs/view/"]',
    ".artdeco-entity-lockup__title a",
    'a[href*="/jobs/view/"]',
  ];

  function isElementInViewport(el) {
    var rect = el.getBoundingClientRect();
    // Include a buffer zone (half viewport) so near-viewport cards get pre-scored
    var buffer = window.innerHeight * 0.5;
    return rect.top < window.innerHeight + buffer && rect.bottom > -buffer;
  }

  /**
   * Detect the first visible job cards in the LinkedIn search results list.
   * Returns array of { element, url, title, text } capped at maxCards.
   */
  function getVisibleJobCards(maxCards) {
    maxCards = maxCards || 12;
    var cards = [];
    var seen = new Set(); // dedupe by URL

    for (var s = 0; s < JOB_CARD_SELECTORS.length; s++) {
      var els = document.querySelectorAll(JOB_CARD_SELECTORS[s]);
      if (els.length === 0) continue;

      for (var i = 0; i < els.length && cards.length < maxCards; i++) {
        if (!isElementInViewport(els[i])) continue;

        var el = els[i];
        var cardText = (el.innerText || "").trim().replace(/\s+/g, " ");
        if (cardText.length < 30) continue; // too small to be a real card

        // Extract job URL
        var link = el.querySelector('a[href*="/jobs/view/"]');
        var jobUrl = link ? link.href : "";
        if (jobUrl && seen.has(jobUrl)) continue;
        if (jobUrl) seen.add(jobUrl);

        // Extract job title
        var titleText = "";
        for (var t = 0; t < JOB_CARD_TITLE_SELECTORS.length; t++) {
          var titleEl = el.querySelector(JOB_CARD_TITLE_SELECTORS[t]);
          if (titleEl) {
            titleText = (titleEl.textContent || "").trim();
            if (titleText.length > 2) break;
          }
        }

        cards.push({
          element: el,
          url: jobUrl,
          title: titleText,
          text: cardText,
        });
      }
      if (cards.length > 0) break; // found cards with this selector set
    }

    return cards;
  }

  // ─── Phase 2: Job Card Score Badges ───────────────────────
  //
  // Threshold reference (do not merge these thresholds):
  //   BST_STRONG_MATCH_THRESHOLD (7.0) — discovery guidance: BST fires when
  //     the recent-window has zero jobs at this score or above.
  //   PIPELINE_AUTO_SAVE_THRESHOLD (8.5) — action workflow: auto-save to
  //     pipeline. Separate from BST; do not conflate.
  //   Badge color bands: green (8.0+), yellow (6.0–7.9), red (<6.0)
  //
  // Pre-read scoring architecture (v0.9.1):
  //   Scoring runs silently in the background regardless of whether badge
  //   DOM elements are rendered. BST is driven by the scored window, not
  //   badge visibility. Set BADGES_VISIBLE = false to hide overlay badges
  //   while keeping the scoring pipeline and BST evaluation active.
  //
  var BADGES_VISIBLE = false;             // render badge DOM on cards (false = silent scoring only)
  var BST_STRONG_MATCH_THRESHOLD = 7.0;   // discovery: strong-match / pursue threshold
  var BST_MIN_WINDOW_SIZE = 5;            // minimum scored cards before BST can evaluate
  var BST_AMBIGUOUS_AVG_CEILING = 6.0;   // ambiguous surfaces only trigger BST if avg < this
  var PIPELINE_AUTO_SAVE_THRESHOLD = 8.5; // action: auto-save to pipeline (distinct from BST)
  var SCORE_CEILING_OUT_OF_SCOPE = 5.0;   // hard cap for clearly out-of-scope job families

  // ─── Role-Family Clusters ─────────────────────────────────
  // Lightweight client-side heuristic for detecting obviously different job
  // domains (e.g., bartender vs product manager). Each cluster is a set of
  // title keywords. If the job title matches one cluster and the calibration
  // title matches a different cluster, the job is ceiling-capped.
  var ROLE_FAMILY_CLUSTERS = {
    hospitality: ["bartender", "barista", "waiter", "waitress", "server", "hostess", "host", "busser", "dishwasher", "line cook", "sous chef", "chef", "sommelier", "barback"],
    retail: ["cashier", "stocker", "merchandiser", "sales associate", "store manager", "retail"],
    trades: ["electrician", "plumber", "welder", "carpenter", "hvac", "mechanic", "technician"],
    healthcare_clinical: ["nurse", "registered nurse", "lpn", "cna", "phlebotomist", "dental hygienist", "paramedic", "emt", "physician", "surgeon", "pharmacist"],
    transportation: ["truck driver", "cdl", "forklift", "warehouse associate", "delivery driver", "courier", "dispatcher"],
    education_k12: ["teacher", "substitute teacher", "paraprofessional", "school counselor", "principal"],
    product_eng: ["product manager", "program manager", "project manager", "product owner", "scrum master", "agile coach", "tpm", "technical program"],
    software_eng: ["software engineer", "developer", "frontend", "backend", "full stack", "fullstack", "sre", "devops", "platform engineer", "data engineer", "ml engineer", "machine learning"],
    design: ["ux designer", "ui designer", "product designer", "graphic designer", "visual designer", "interaction designer"],
    data_analytics: ["data analyst", "data scientist", "business analyst", "analytics", "bi analyst", "statistician"],
    finance: ["accountant", "cpa", "financial analyst", "controller", "bookkeeper", "auditor", "tax"],
    legal: ["attorney", "lawyer", "paralegal", "legal counsel", "compliance officer"],
    marketing: ["marketing manager", "content strategist", "seo", "growth", "brand manager", "copywriter", "social media manager"],
    sales_bd: ["account executive", "business development", "sales representative", "sdr", "bdr", "account manager"],
  };

  /**
   * Detect if job title and calibration title belong to clearly different role families.
   * Returns true if they are in different clusters (out-of-scope).
   * Returns false if either is unmatched (benefit of the doubt) or same cluster.
   */
  function isRoleFamilyMismatch(jobTitle, calibrationTitle) {
    if (!jobTitle || !calibrationTitle) return false;
    var jt = jobTitle.toLowerCase();
    var ct = calibrationTitle.toLowerCase();
    var jobCluster = null;
    var calCluster = null;
    var clusters = Object.keys(ROLE_FAMILY_CLUSTERS);
    for (var i = 0; i < clusters.length; i++) {
      var keywords = ROLE_FAMILY_CLUSTERS[clusters[i]];
      for (var k = 0; k < keywords.length; k++) {
        if (jt.indexOf(keywords[k]) !== -1) jobCluster = clusters[i];
        if (ct.indexOf(keywords[k]) !== -1) calCluster = clusters[i];
      }
    }
    // Only flag mismatch when BOTH matched a cluster AND they differ
    if (jobCluster && calCluster && jobCluster !== calCluster) return true;
    return false;
  }

  /** Get the role-family cluster for a title string, or null if unrecognized. */
  function getClusterForTitle(title) {
    if (!title) return null;
    var t = title.toLowerCase();
    var clusters = Object.keys(ROLE_FAMILY_CLUSTERS);
    for (var i = 0; i < clusters.length; i++) {
      var keywords = ROLE_FAMILY_CLUSTERS[clusters[i]];
      for (var k = 0; k < keywords.length; k++) {
        if (t.indexOf(keywords[k]) !== -1) return clusters[i];
      }
    }
    return null;
  }

  /**
   * Classify the search surface relative to the user's calibration.
   * Returns: { surfaceClass: "aligned"|"out-of-scope"|"ambiguous", reason: string }
   *
   * - aligned: query matches calibration title, a nearby role, or shares
   *   significant keywords with the calibration title. BST should not fire.
   * - out-of-scope: query belongs to a different known role-family cluster,
   *   or has zero keyword overlap with calibration. BST should fire.
   * - ambiguous: not enough signal either way; defer to score distribution.
   */
  function classifySearchSurface(query, calibrationTitle, nearbyRoles) {
    if (!query) return { surfaceClass: "ambiguous", reason: "no query available" };

    var hasCalTitle = !!calibrationTitle;
    console.debug("[Caliber][BST][classify] input — query: \"" + query +
      "\", calTitle: \"" + (calibrationTitle || "") +
      "\", nearbyRoles: " + (nearbyRoles ? nearbyRoles.length : 0));

    // 1. Direct title equivalence → aligned
    if (hasCalTitle && titlesEquivalent(query, calibrationTitle)) {
      return { surfaceClass: "aligned", reason: "exact title match" };
    }

    // 2. Query matches a nearby role → aligned
    if (nearbyRoles && nearbyRoles.length > 0) {
      for (var i = 0; i < nearbyRoles.length; i++) {
        if (nearbyRoles[i].title && titlesEquivalent(nearbyRoles[i].title, query)) {
          return { surfaceClass: "aligned", reason: "matches nearby role: " + nearbyRoles[i].title };
        }
      }
    }

    // 3. Significant keyword overlap (≥50% of query words) → aligned
    var queryWords = query.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().split(/\s+/).filter(function (w) { return w.length > 2; });
    var calWords = hasCalTitle
      ? calibrationTitle.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().split(/\s+/).filter(function (w) { return w.length > 2; })
      : [];
    var overlap = 0;
    for (var w = 0; w < queryWords.length; w++) {
      for (var c = 0; c < calWords.length; c++) {
        if (queryWords[w] === calWords[c]) { overlap++; break; }
      }
    }
    if (hasCalTitle && queryWords.length > 0 && overlap / queryWords.length >= 0.5) {
      return { surfaceClass: "aligned", reason: "keyword overlap >= 50% (" + overlap + "/" + queryWords.length + ")" };
    }

    // 4. Cluster-based comparison
    var queryCluster = getClusterForTitle(query);
    var calCluster = hasCalTitle ? getClusterForTitle(calibrationTitle) : null;
    if (queryCluster && calCluster) {
      if (queryCluster === calCluster) {
        return { surfaceClass: "aligned", reason: "same cluster: " + queryCluster };
      }
      return { surfaceClass: "out-of-scope", reason: "cluster mismatch: query=" + queryCluster + " cal=" + calCluster };
    }
    // Query is in a known cluster but calibration title is unrecognised or
    // absent.  With zero keyword overlap this is clearly out-of-scope:
    // a query like "bartender" (hospitality cluster) should fire BST even
    // when we have no calibration title to compare against.
    if (queryCluster && overlap === 0) {
      var oosReason = hasCalTitle
        ? "query cluster " + queryCluster + ", calibration unrecognised, zero overlap"
        : "query cluster " + queryCluster + ", no calibration title available";
      return { surfaceClass: "out-of-scope", reason: oosReason };
    }

    // 5. Neither side clusters, insufficient keyword overlap → ambiguous
    if (!hasCalTitle) {
      return { surfaceClass: "ambiguous", reason: "no calibration title, query not in known cluster" };
    }
    return { surfaceClass: "ambiguous", reason: "no cluster match, low keyword overlap (" + overlap + "/" + queryWords.length + ")" };
  }

  var BADGE_ATTR = "data-caliber-badge";
  var JOB_ID_ATTR = "data-caliber-job-id";
  var BADGE_STYLE_ID = "caliber-badge-css";
  var badgeScoredIds = new Set();        // job IDs already scored or in-flight
  var badgeScoreCache = {};              // jobId → { score, calibrationTitle, nearbyRoles }
  var badgeCacheSurface = "";            // surface key the cache belongs to
  var badgeScrollAttached = false;
  var badgeScrollTimer = null;
  var badgeScrollHandler = null;        // stored ref for removeEventListener
  var badgeListObserver = null;          // MutationObserver on the results list
  var badgeObserverDebounce = null;      // debounce timer for observer callback
  var badgeBatchQueue = [];              // pending cards waiting to be scored
  var badgeBatchRunning = false;         // is a batch currently in-flight?
  var badgeBatchGeneration = 0;          // incremented on clear; stale responses discarded
  var badgeBatchTimeout = null;          // safety timeout to reset badgeBatchRunning
  var badgeBatchStartTime = 0;           // Date.now() when current batch started (stale-lock detection)
  var badgeInjecting = false;            // true while we're writing badges (skip observer)
  var badgeScanInterval = null;          // periodic fallback scan interval
  var bstShowDebounce = null;            // debounce timer for BST banner show (prevents flicker)
  var bstSuggestedTitles = {};           // session memory: titles already suggested (normalized→true)
  var bstSearchedQueries = {};           // session memory: queries the user has searched (normalized→true)
  var initialSurfaceResolved = false;    // true once initial visible-card scoring pass completes

  // ─── Surface Diagnostic Log (validation only) ─────────────
  // Captures identity of scored jobs per search surface for diagnostic validation.
  // Capped at SURFACE_DIAG_MAX entries per surface. Written to console.debug only.
  var SURFACE_DIAG_MAX = 15;
  var surfaceDiagEntries = [];           // { query, jobId, jobTitle, company, score, positionIndex, timestamp }
  var surfaceDiagSurface = "";           // surface key the log belongs to

  /**
   * Record a scored job identity to the surface diagnostic log.
   * Logs to console.debug only — no UI impact.
   * @param {string} trigger - "initial" or "scroll" indicating capture context
   */
  function logSurfaceDiagEntry(jobId, jobTitle, company, score, positionIndex, trigger) {
    var currentSurface = getSearchSurfaceKey();
    // Reset log on surface change
    if (surfaceDiagSurface !== currentSurface) {
      surfaceDiagEntries = [];
      surfaceDiagSurface = currentSurface;
    }
    if (surfaceDiagEntries.length >= SURFACE_DIAG_MAX) return;
    var entry = {
      query: getSearchKeywords(),
      jobId: jobId || "",
      jobTitle: jobTitle || "",
      company: company || "",
      score: score,
      positionIndex: positionIndex,
      timestamp: new Date().toISOString(),
    };
    surfaceDiagEntries.push(entry);
    console.debug("[Caliber][surface-diag][" + trigger + "] captured #" + surfaceDiagEntries.length +
      "/" + SURFACE_DIAG_MAX + ": " + JSON.stringify(entry));
  }

  /** Flush the full surface diagnostic snapshot to console. */
  function flushSurfaceDiagLog(trigger) {
    if (surfaceDiagEntries.length === 0) return;
    console.debug("[Caliber][surface-diag][" + trigger + "] ── snapshot (" +
      surfaceDiagEntries.length + " jobs) ──");
    console.debug("[Caliber][surface-diag][" + trigger + "] " +
      JSON.stringify(surfaceDiagEntries));
  }

  var BADGE_CHUNK_SIZE = 5;             // score N cards per API batch
  var BADGE_BATCH_TIMEOUT_MS = 15000;   // max time to wait for a batch response

  // LinkedIn card logo/image-area selectors (badge renders below company icon)
  var CARD_LOGO_SELECTORS = [
    ".artdeco-entity-lockup__image",
    ".job-card-container__logo-container",
    "[class*='entity-lockup__image']",
    "[class*='job-card'] img[class*='logo']",
    "[class*='job-card'] [class*='company-logo']",
  ];
  // Fallback: content-area selectors if logo column is missing
  var CARD_CONTENT_SELECTORS = [
    ".artdeco-entity-lockup__content",
    ".job-card-container__company-name",
    "[class*='entity-lockup__content']",
    "[class*='job-card'] [class*='company']",
  ];

  // Card-level company name selectors (search result cards, not detail top-card)
  var CARD_COMPANY_SELECTORS = [
    ".job-card-container__primary-description",
    ".artdeco-entity-lockup__subtitle span",
    ".artdeco-entity-lockup__subtitle",
    "[class*='job-card'] [class*='primary-description']",
    "[class*='job-card'] [class*='company-name']",
    "[class*='entity-lockup__subtitle']",
  ];

  /** Extract company name from a search-result card element. */
  function extractCardCompany(cardEl) {
    for (var i = 0; i < CARD_COMPANY_SELECTORS.length; i++) {
      var el = cardEl.querySelector(CARD_COMPANY_SELECTORS[i]);
      if (el) {
        var t = (el.textContent || "").trim();
        if (t.length > 1 && t.length < 150) return t;
      }
    }
    return "";
  }

  /** Inject badge CSS into the LinkedIn page (outside shadow DOM). */
  function ensureBadgeStyles() {
    var existing = document.getElementById(BADGE_STYLE_ID);
    if (existing && existing.parentNode) return;
    // Remove orphaned element if it lost its parent
    if (existing) existing.remove();
    var style = document.createElement("style");
    style.id = BADGE_STYLE_ID;
    style.textContent = [
      ".caliber-badge {",
      "  display: flex; align-items: center; justify-content: center;",
      "  width: 36px; height: 36px; border-radius: 6px;",
      "  background: #1a1a1a;",
      "  box-shadow: 0 1px 4px rgba(0,0,0,0.45), 0 0 0 1px rgba(255,255,255,0.04);",
      "  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;",
      "  font-size: 12px; font-weight: 800; letter-spacing: -0.03em; line-height: 1;",
      "  color: #888;",
      "  white-space: nowrap; pointer-events: none;",
      "  margin: 6px auto 0 auto;",
      "}",
      ".caliber-badge--loading { color: #555; font-weight: 600; }",
      ".caliber-badge--green  { color: #4ADE80; }",
      ".caliber-badge--yellow { color: #FBBF24; }",
      ".caliber-badge--red    { color: #EF4444; }",
    ].join("\n");
    document.head.appendChild(style);
  }

  /** Build badge HTML for a given state. */
  function badgeHTML(state, score) {
    if (state === "loading") {
      return '<span class="caliber-badge caliber-badge--loading" ' + BADGE_ATTR + '>\u2026</span>';
    }
    var rounded = Math.round(score * 10) / 10;
    var band = "red";
    if (rounded >= 8.0) band = "green";
    else if (rounded >= 6.0) band = "yellow";
    return '<span class="caliber-badge caliber-badge--' + band + '" ' + BADGE_ATTR + '>' + rounded.toFixed(1) + "</span>";
  }

  /** Find the logo/image area within a job card element (badge inserts below the icon). */
  function findBadgeTarget(cardEl) {
    // Primary: logo/image column — place badge directly under the company icon
    for (var i = 0; i < CARD_LOGO_SELECTORS.length; i++) {
      var el = cardEl.querySelector(CARD_LOGO_SELECTORS[i]);
      if (el) {
        // If this element is the img itself, use its parent container
        if (el.tagName === "IMG") return el.parentElement || el;
        return el;
      }
    }
    // Fallback: content area (text column) if logo column not found
    for (var j = 0; j < CARD_CONTENT_SELECTORS.length; j++) {
      var contentEl = cardEl.querySelector(CARD_CONTENT_SELECTORS[j]);
      if (contentEl) return contentEl;
    }
    return null;
  }

  /**
   * Extract a stable job identity from a card element.
   * Priority: data-occludable-job-id → /jobs/view/{id} href → data-job-id → title hash.
   * Returns a string like "job-12345678" or "hash-abc123" (never empty).
   */
  function cardJobId(cardEl) {
    // 1. LinkedIn's own job-id attribute (most reliable)
    var occId = cardEl.getAttribute("data-occludable-job-id");
    if (occId) return "job-" + occId.trim();
    // 2. Numeric ID from /jobs/view/{id}/ href
    var link = cardEl.querySelector('a[href*="/jobs/view/"]');
    if (link && link.href) {
      var m = link.href.match(/\/jobs\/view\/(\d+)/);
      if (m) return "job-" + m[1];
    }
    // 3. data-job-id attribute (alternate LinkedIn markup)
    var djId = cardEl.getAttribute("data-job-id");
    if (djId) return "job-" + djId.trim();
    // 4. Fallback: lightweight hash of title + company
    var text = (cardEl.textContent || "").trim().substring(0, 120);
    var hash = 0;
    for (var i = 0; i < text.length; i++) {
      hash = ((hash << 5) - hash + text.charCodeAt(i)) | 0;
    }
    return "hash-" + Math.abs(hash).toString(36);
  }

  /**
   * Stamp a card element with its stable job identity.
   * Returns the job ID string. If already stamped AND the identity still matches
   * the DOM content, returns existing ID. Otherwise re-stamps (handles LinkedIn
   * DOM recycling where the same <li> gets new job content).
   */
  function stampCard(cardEl) {
    var existing = cardEl.getAttribute(JOB_ID_ATTR);
    if (existing) {
      // Validate: does the stamped ID still match the current card content?
      var currentId = cardJobId(cardEl);
      if (currentId === existing) return existing;
      // Stale stamp — LinkedIn recycled this DOM node with new job content
      console.debug("[Caliber][badges] recycled card detected: " + existing + " → " + currentId);
      // Remove stale badge before re-stamping
      badgeInjecting = true;
      try {
        var staleBadge = cardEl.querySelector("[" + BADGE_ATTR + "]");
        if (staleBadge) staleBadge.remove();
      } finally {
        badgeInjecting = false;
      }
      cardEl.setAttribute(JOB_ID_ATTR, currentId);
      return currentId;
    }
    var id = cardJobId(cardEl);
    cardEl.setAttribute(JOB_ID_ATTR, id);
    return id;
  }

  /** Inject or update a badge on a single card element. */
  function setBadgeOnCard(cardEl, state, score) {
    if (!BADGES_VISIBLE) return;  // silent scoring mode — skip DOM writes
    badgeInjecting = true;
    try {
      var existing = cardEl.querySelector("[" + BADGE_ATTR + "]");
      if (existing) {
        if (state !== "loading") {
          existing.outerHTML = badgeHTML(state, score);
        }
        return;
      }
      // Append badge at the end of the content area (below title/company)
      var target = findBadgeTarget(cardEl);
      if (target) {
        target.insertAdjacentHTML("beforeend", badgeHTML(state, score));
      } else {
        // Fallback: append to card
        cardEl.insertAdjacentHTML("beforeend", badgeHTML(state, score));
        if (state !== "loading") {
          console.debug("[Caliber][diag][badge] no badge target found for " +
            (cardEl.getAttribute(JOB_ID_ATTR) || "unknown") + ", used card fallback");
        }
      }
    } finally {
      badgeInjecting = false;
    }
  }

  /** Find a card element by its stable job ID (O(1) via data attribute). */
  function findCardById(jobId) {
    if (!jobId) return null;
    return document.querySelector("[" + JOB_ID_ATTR + '="' + jobId + '"]');
  }

  /**
   * Re-inject badges on cards that lost them due to LinkedIn DOM rerenders.
   * Uses the score cache to restore badges without re-scoring.
   * Also re-stamps identity attributes on cards LinkedIn replaced.
   */
  function restoreBadgesFromCache() {
    if (!active || !isSearchResultsPage()) return;
    // Safety: skip if cache belongs to a different surface
    var currentSurface = getSearchSurfaceKey();
    if (badgeCacheSurface !== "" && badgeCacheSurface !== currentSurface) return;
    ensureBadgeStyles();
    var restored = 0;
    // First pass: re-stamp any visible cards that lost their data attribute
    // Scan ALL selector groups (avoid early break)
    var seen = new Set();
    for (var s = 0; s < JOB_CARD_SELECTORS.length; s++) {
      var els = document.querySelectorAll(JOB_CARD_SELECTORS[s]);
      for (var i = 0; i < els.length; i++) {
        if (seen.has(els[i])) continue;
        seen.add(els[i]);
        var id = stampCard(els[i]);
        // If this card has a cached score but lost its badge, restore it
        if (badgeScoreCache[id] && !els[i].querySelector("[" + BADGE_ATTR + "]")) {
          setBadgeOnCard(els[i], "scored", badgeScoreCache[id].score);
          restored++;
        }
      }
    }
    if (restored > 0) {
      console.debug("[Caliber][badges] restored " + restored + " badges from cache after DOM mutation");
    }
  }

  /**
   * Process the next chunk from the badge batch queue.
   * Scores BADGE_CHUNK_SIZE cards, applies results, then recurses for the next chunk.
   */
  function processBadgeQueue() {
    // Stale-lock recovery: if batch has been running longer than timeout, force-reset
    if (badgeBatchRunning && badgeBatchStartTime > 0 && (Date.now() - badgeBatchStartTime) > BADGE_BATCH_TIMEOUT_MS) {
      console.warn("[Caliber][diag][schedule] batch lock stale for " +
        Math.round((Date.now() - badgeBatchStartTime) / 1000) + "s — force-resetting");
      badgeBatchRunning = false;
      badgeBatchStartTime = 0;
    }
    if (!active || badgeBatchRunning || badgeBatchQueue.length === 0) {
      if (badgeBatchRunning && badgeBatchQueue.length > 0) {
        console.debug("[Caliber][diag][schedule] processBadgeQueue deferred — batch in-flight (" +
          Math.round((Date.now() - badgeBatchStartTime) / 1000) + "s), queue: " + badgeBatchQueue.length);
      }
      return;
    }

    var chunk = badgeBatchQueue.splice(0, BADGE_CHUNK_SIZE);
    var batchGen = badgeBatchGeneration;  // capture current generation (don't increment)
    badgeBatchRunning = true;
    badgeBatchStartTime = Date.now();

    // Safety timeout: if background doesn't respond (service worker unloaded),
    // reset badgeBatchRunning so the queue isn't permanently blocked.
    // Keep loading badges visible (don't remove them) — they'll be retried or
    // restored from cache. Removing badges on timeout caused the "briefly appear
    // then disappear" regression.
    clearTimeout(badgeBatchTimeout);
    badgeBatchTimeout = setTimeout(function () {
      if (badgeBatchRunning) {
        console.warn("[Caliber][diag][schedule] batch timeout (" + (BADGE_BATCH_TIMEOUT_MS / 1000) +
          "s) — resetting lock, releasing " + chunk.length + " cards for retry");
        badgeBatchRunning = false;
        badgeBatchStartTime = 0;
        // Release cards for retry but KEEP loading badges visible
        for (var t = 0; t < chunk.length; t++) {
          if (chunk[t].id && !badgeScoreCache[chunk[t].id]) {
            badgeScoredIds.delete(chunk[t].id);  // allow retry on next scan
          }
        }
        if (active && badgeBatchQueue.length > 0) setTimeout(processBadgeQueue, 500);
      }
    }, BADGE_BATCH_TIMEOUT_MS);

    console.debug("[Caliber][diag][schedule] scoring chunk of " + chunk.length +
      " (remaining: " + badgeBatchQueue.length + ", gen: " + batchGen + ")");

    chrome.runtime.sendMessage({
      type: "CALIBER_PRESCAN_BATCH",
      jobs: chunk.map(function (c) { return { jobText: c.jobText, title: c.title }; }),
    }, function (resp) {
      badgeBatchRunning = false;
      badgeBatchStartTime = 0;
      clearTimeout(badgeBatchTimeout);

      // Discard stale response if badges were cleared while in-flight
      if (batchGen !== badgeBatchGeneration) {
        console.debug("[Caliber][badges] discarding stale batch response (generation mismatch)");
        return;
      }

      if (chrome.runtime.lastError) {
        console.warn("[Caliber][diag][score] chunk transport error:", chrome.runtime.lastError.message,
          "— releasing " + chunk.length + " cards for retry (badges kept)");
        // Release failed cards so they can be retried on next scan
        // Keep loading badges visible — don't remove them
        for (var f = 0; f < chunk.length; f++) {
          if (chunk[f].id && !badgeScoreCache[chunk[f].id]) {
            badgeScoredIds.delete(chunk[f].id);
          }
        }
        if (active && badgeBatchQueue.length > 0) setTimeout(processBadgeQueue, 200);
        return;
      }
      if (!resp || !resp.ok || !Array.isArray(resp.results)) {
        // Detect no-session error specifically — use longer backoff to let session hydrate
        var isNoSession = resp && resp.errorType === "no_session";
        var retryDelay = isNoSession ? 5000 : 200;
        console.warn("[Caliber][diag][score] chunk scoring failed:", resp && resp.error,
          (isNoSession ? " [NO SESSION — backoff " + retryDelay + "ms]" : ""),
          "— releasing " + chunk.length + " cards for retry (badges kept)");
        if (isNoSession) {
          sessionReady = false;
          console.warn("[Caliber][session][diag] session lost during scoring — marking sessionReady=false");
        }
        for (var g = 0; g < chunk.length; g++) {
          if (chunk[g].id && !badgeScoreCache[chunk[g].id]) {
            badgeScoredIds.delete(chunk[g].id);
          }
        }
        // On no-session, also re-queue the current chunk's cards for retry
        if (isNoSession) {
          badgeBatchQueue = chunk.concat(badgeBatchQueue);
        }
        if (active && badgeBatchQueue.length > 0) setTimeout(processBadgeQueue, retryDelay);
        return;
      }

      for (var k = 0; k < resp.results.length; k++) {
        var result = resp.results[k];
        var entry = chunk[k];
        if (!entry) continue;

        if (result.ok) {
          // Track calibration title for fallback guardrail
          if (result.calibrationTitle) {
            var calTitleChanged = lastKnownCalibrationTitle !== result.calibrationTitle;
            lastKnownCalibrationTitle = result.calibrationTitle;
            // Persist to chrome.storage.local so it survives page navigations
            if (calTitleChanged) {
              chrome.storage.local.set({ caliberCalibrationTitle: result.calibrationTitle });
              console.debug("[Caliber][session][diag] persisted calibrationTitle: \"" + result.calibrationTitle + "\"");
            }
          }
          // Track nearby roles
          if (result.nearbyRoles && result.nearbyRoles.length > 0 && lastKnownNearbyRoles.length === 0) {
            lastKnownNearbyRoles = result.nearbyRoles;
            chrome.storage.local.set({ caliberNearbyRoles: result.nearbyRoles });
          }

          // Apply out-of-scope ceiling before caching
          // Fall back to lastKnownCalibrationTitle when API omits calibration_title
          // (stale session or serverless cold-start without full context)
          var effectiveCalibTitle = result.calibrationTitle || lastKnownCalibrationTitle || "";
          var rawBadgeScore = result.score;
          var badgeScore = applyDomainMismatchGuardrail(
            rawBadgeScore,
            result.hrcBand || null,
            entry.title || "",
            effectiveCalibTitle
          );
          if (!result.calibrationTitle && lastKnownCalibrationTitle) {
            console.debug("[Caliber][session][diag] scoring result missing calibrationTitle — " +
              "using cached fallback: \"" + lastKnownCalibrationTitle + "\"");
          }
          // Cache the score by job ID.
          // Guard: never overwrite a sidecard-scored entry — the sidecard uses
          // the full job description and is always the authoritative score.
          // Late-arriving badge responses must not downgrade a sidecard score.
          if (entry.id) {
            var existingEntry = badgeScoreCache[entry.id];
            if (existingEntry && existingEntry.sidecard) {
              console.debug("[Caliber][diag][score] skipping cache write for " + entry.id +
                " — sidecard-authoritative entry exists (sidecard=" + existingEntry.score +
                ", badge=" + badgeScore + ")");
            } else {
              badgeScoreCache[entry.id] = {
                score: badgeScore,
                title: sanitizeJobTitle(entry.title),
                calibrationTitle: effectiveCalibTitle,
                nearbyRoles: result.nearbyRoles || [],
              };
            }
          }
          // Re-find the card by job ID (O(1) via data attribute, survives DOM mutation)
          var cardEl = entry.id ? findCardById(entry.id) : null;
          if (cardEl) {
            setBadgeOnCard(cardEl, "scored", badgeScore);
          }
          console.debug("[Caliber][diag][score] completed: " + entry.title + " → " + badgeScore +
            (rawBadgeScore !== badgeScore ? " (raw: " + rawBadgeScore + ", capped)" : "") +
            (entry.id ? " (" + entry.id + ")" : ""));
          // Surface diagnostic: capture scored job identity
          logSurfaceDiagEntry(
            entry.id,
            sanitizeJobTitle(entry.title),
            entry.company || "",
            badgeScore,
            typeof entry.positionIndex === "number" ? entry.positionIndex : -1,
            initialSurfaceResolved ? "scroll" : "initial"
          );
          // Telemetry: badge score rendered on card
          emitTelemetry("job_score_rendered", {
            surfaceKey: getSearchSurfaceKey(),
            jobId: entry.id || null,
            jobTitle: entry.title || null,
            score: badgeScore,
            rawScore: rawBadgeScore !== badgeScore ? rawBadgeScore : undefined,
          });
        } else {
          // Release from scoredIds for retry but keep loading badge visible
          if (entry.id) badgeScoredIds.delete(entry.id);
          console.debug("[Caliber][diag][score] item error (released for retry, badge kept): " + entry.title + " → " + result.error +
            (entry.id ? " (" + entry.id + ")" : ""));
        }
      }

      // Batch succeeded — session is confirmed working
      if (!sessionReady) {
        sessionReady = true;
        console.debug("[Caliber][session][diag] sessionReady confirmed via successful batch scoring");
      }

      // After each chunk, check if BST should fire (from accumulated badge scores)
      console.debug("[Caliber][BST][diag] invoking evaluateBSTFromBadgeCache after chunk — cache size: " +
        Object.keys(badgeScoreCache).length);
      evaluateBSTFromBadgeCache();

      // Process next chunk
      if (active && badgeBatchQueue.length > 0) {
        setTimeout(processBadgeQueue, 200);
      } else if (badgeBatchQueue.length === 0) {
        hideScanningIndicator();
        console.debug("[Caliber][diag][schedule] all queued cards scored. Cache: " + Object.keys(badgeScoreCache).length +
          ", scoredIds: " + badgeScoredIds.size);
      }
    });
  }

  /**
   * Scan all DOM-present job cards, stamp identity, inject loading badges, and queue for scoring.
   * Cards with cached scores get their badge immediately (no API call).
   * Scans all cards in the DOM (not just viewport-visible) to catch LinkedIn's
   * pre-rendered and recycled cards that may not trigger scroll events.
   */
  function scanAndBadgeVisibleCards() {
    if (!active || !isSearchResultsPage()) {
      console.debug("[Caliber][diag][detect] scanAndBadgeVisibleCards skipped — active=" + active + ", searchPage=" + isSearchResultsPage());
      return;
    }

    if (BADGES_VISIBLE) ensureBadgeStyles();

    // Bind cache to current surface on first scan
    var currentSurface = getSearchSurfaceKey();
    if (!badgeCacheSurface) badgeCacheSurface = currentSurface;

    // Gather ALL DOM-present cards across ALL selector groups
    var allCards = [];
    var seen = new Set();
    for (var s = 0; s < JOB_CARD_SELECTORS.length; s++) {
      var els = document.querySelectorAll(JOB_CARD_SELECTORS[s]);
      for (var i = 0; i < els.length; i++) {
        if (!seen.has(els[i])) {
          seen.add(els[i]);
          allCards.push(els[i]);
        }
      }
    }

    // Filter to un-scored cards only
    var toQueue = [];
    var cacheHits = 0;
    for (var c = 0; c < allCards.length; c++) {
      var card = allCards[c];

      // Stamp stable identity on card
      var id = stampCard(card);

      // Already has a badge → skip
      if (card.querySelector("[" + BADGE_ATTR + "]")) continue;

      // Cache hit → inject badge immediately, no API call
      if (badgeScoreCache[id]) {
        setBadgeOnCard(card, "scored", badgeScoreCache[id].score);
        cacheHits++;
        continue;
      }

      // Already in-flight → skip
      if (badgeScoredIds.has(id)) continue;

      // New card — mark as in-flight and queue
      badgeScoredIds.add(id);

      var cardText = (card.innerText || "").trim().replace(/\s+/g, " ");
      var titleText = "";
      for (var t = 0; t < JOB_CARD_TITLE_SELECTORS.length; t++) {
        var titleEl = card.querySelector(JOB_CARD_TITLE_SELECTORS[t]);
        if (titleEl) {
          titleText = (titleEl.textContent || "").trim();
          if (titleText.length > 2) break;
        }
      }

      if (cardText.length < 80) {
        console.debug("[Caliber][badges] card too short (" + cardText.length + " chars), skipping: " + titleText);
        continue;
      }

      // Inject loading placeholder immediately
      setBadgeOnCard(card, "loading", 0);

      // Extract company for diagnostic logging
      var companyText = extractCardCompany(card);

      toQueue.push({
        id: id,
        jobText: cardText,
        title: titleText,
        company: companyText,
        positionIndex: allCards.indexOf(card),
      });
    }

    if (cacheHits > 0) {
      console.debug("[Caliber][badges] restored " + cacheHits + " badges from cache (no API call)");
    }

    if (toQueue.length === 0) {
      console.debug("[Caliber][diag][detect] scan complete — 0 new cards" +
        " (DOM: " + allCards.length + ", cached: " + cacheHits +
        ", scoredIds: " + badgeScoredIds.size +
        ", batchRunning: " + badgeBatchRunning + ", queueLen: " + badgeBatchQueue.length + ")");
      return;
    }

    console.debug("[Caliber][diag][detect] scan found " + toQueue.length + " new cards to score" +
      " (DOM: " + allCards.length + ", cacheHits: " + cacheHits +
      ", cache: " + Object.keys(badgeScoreCache).length +
      ", batchRunning: " + badgeBatchRunning + ", queueLen: " + badgeBatchQueue.length + ")");

    // Add to queue and kick off processing
    badgeBatchQueue = badgeBatchQueue.concat(toQueue);
    showScanningIndicator();
    processBadgeQueue();
  }

  /**
   * Evaluate BST trigger from the silent pre-read scored window.
   *
   * Architecture (v0.9.1 — score-evidence-primary):
   *   Primary signal: the pre-read scored window in badgeScoreCache.
   *   - If the window contains at least one genuine aligned strong match
   *     (score >= 7.0, already domain-guardrailed), BST is SUPPRESSED.
   *   - If the window contains zero strong matches, BST can TRIGGER.
   *
   *   Secondary context: query classification (aligned / out-of-scope / ambiguous).
   *   - out-of-scope + weak window → trigger confidently
   *   - aligned + weak first batch → still depends on scored evidence
   *   - ambiguous → resolved through scored evidence
   *
   *   The domain-mismatch guardrail (applyDomainMismatchGuardrail) already
   *   caps out-of-scope job scores to 5.0, so any score >= 7.0 in the cache
   *   is inherently a genuine aligned strong match. No additional filtering.
   *
   * Re-evaluated after each scoring chunk so BST can appear/hide dynamically.
   */
  function evaluateBSTFromBadgeCache() {
    console.debug("[Caliber][BST][diag] evaluateBSTFromBadgeCache() invoked — sessionReady=" + sessionReady +
      ", initialSurfaceResolved=" + initialSurfaceResolved +
      ", lastKnownCalibrationTitle=\"" + lastKnownCalibrationTitle + "\"");
    var urls = Object.keys(badgeScoreCache);

    // Prune orphaned cache entries: if a cached job ID's card is no longer in
    // the DOM, the result set has changed (same query, fresh results). Remove
    // stale entries so the banner reflects only the current visible surface.
    var prunedCount = 0;
    for (var pi = urls.length - 1; pi >= 0; pi--) {
      if (!findCardById(urls[pi])) {
        delete badgeScoreCache[urls[pi]];
        badgeScoredIds.delete(urls[pi]);
        urls.splice(pi, 1);
        prunedCount++;
      }
    }
    if (prunedCount > 0) {
      console.debug("[Caliber][BST][diag] pruned " + prunedCount + " orphaned cache entries (cards no longer in DOM)");
    }

    if (urls.length < BST_MIN_WINDOW_SIZE) {
      console.debug("[Caliber][BST] skip — only " + urls.length + "/" + BST_MIN_WINDOW_SIZE + " scores in cache");
      return;
    }

    // Gate: don't render BST until the initial visible-card scoring pass has drained.
    // This prevents premature BST on the first chunk when strong matches may still be in-flight.
    if (!initialSurfaceResolved) {
      if (badgeBatchQueue.length > 0) {
        console.debug("[Caliber][BST] skip — initial surface scoring still in progress (queue: " +
          badgeBatchQueue.length + ", cache: " + urls.length + ")");
        return;
      }
      // Queue is drained — initial pass complete, resolve the surface
      initialSurfaceResolved = true;
      console.debug("[Caliber][BST] initial surface resolved (" + urls.length + " scores) — proceeding with first evaluation");
      // Flush diagnostic snapshot of the initial surface
      flushSurfaceDiagLog("initial-resolve");
    }

    var surfaceKey = getSearchSurfaceKey();
    var currentQuery = getSearchKeywords();
    bstMarkSearched(currentQuery);  // record this query to prevent BST from suggesting it later
    var strongCount = 0;        // scores >= 7.0 (genuine aligned — guardrail ensures this)
    var mismatchCount = 0;      // jobs with isRoleFamilyMismatch = true
    var alignedCount = 0;       // jobs NOT mismatched (aligned or unknown)
    var sameClusterCount = 0;   // jobs whose title shares cluster with calibration title
    var scoredCount = 0;
    var maxScore = 0;
    var scoreSum = 0;
    var scores = [];
    var bestCalibrationTitle = "";
    var bestNearbyRoles = [];
    var bestJobTitle = "";
    var bestJobScore = 0;
    var pageMaxScore = 0;        // true highest score across ALL cache entries
    var pageBestTitle = "";      // title of the true highest-score job

    for (var i = 0; i < urls.length; i++) {
      var entry = badgeScoreCache[urls[i]];
      scoredCount++;
      scores.push(entry.score);
      scoreSum += entry.score;
      if (entry.score > maxScore) maxScore = entry.score;
      // Track true page max across ALL entries (for surface banner truth)
      if (entry.score > pageMaxScore) {
        pageMaxScore = entry.score;
        pageBestTitle = entry.title || "";
      }
      if (entry.score >= BST_STRONG_MATCH_THRESHOLD) {
        strongCount++;
        if (entry.score > bestJobScore) {
          bestJobScore = entry.score;
          bestJobTitle = entry.title || "";
        }
      }
      if (entry.calibrationTitle) bestCalibrationTitle = entry.calibrationTitle;
      if (entry.nearbyRoles && entry.nearbyRoles.length > 0) bestNearbyRoles = entry.nearbyRoles;
      // Count aligned vs mismatched jobs in the window
      if (entry.calibrationTitle && entry.title && isRoleFamilyMismatch(entry.title, entry.calibrationTitle)) {
        mismatchCount++;
      } else {
        alignedCount++;
      }
    }

    // Defense-in-depth: if the sidecard scored the selected job higher than
    // any badge-cached entry, use it as the true page max. Handles edge cases
    // where the sidecard entry was pruned (card scrolled off) or timing gaps.
    if (lastScoredScore > pageMaxScore) {
      pageMaxScore = lastScoredScore;
      pageBestTitle = sanitizeJobTitle(lastJobMeta.title || "");
      if (lastScoredScore >= BST_STRONG_MATCH_THRESHOLD) {
        // Check if already counted via cache entry
        var scUrlMatch = location.href.match(/\/jobs\/view\/(\d+)/);
        var scInCache = scUrlMatch && badgeScoreCache["job-" + scUrlMatch[1]];
        if (!scInCache) strongCount++;
      }
      console.debug("[Caliber][BST][diag] sidecard score (" + lastScoredScore.toFixed(1) +
        ") exceeds badge cache max — elevated pageMaxScore");
    }

    // Count how many scored job titles share a cluster with the calibration title.
    // Used to detect ambiguous queries landing on entirely foreign job surfaces.
    var calClusterForEvidence = bestCalibrationTitle ? getClusterForTitle(bestCalibrationTitle) : null;
    if (!calClusterForEvidence && lastKnownCalibrationTitle) {
      calClusterForEvidence = getClusterForTitle(lastKnownCalibrationTitle);
    }
    if (calClusterForEvidence) {
      for (var sc = 0; sc < urls.length; sc++) {
        var scEntry = badgeScoreCache[urls[sc]];
        if (scEntry.title && getClusterForTitle(scEntry.title) === calClusterForEvidence) {
          sameClusterCount++;
        }
      }
    }

    // Fallback: if badge cache didn't yield a calibration title, try recentScores
    if (!bestCalibrationTitle) {
      for (var rs = recentScores.length - 1; rs >= 0; rs--) {
        if (recentScores[rs].calibrationTitle) {
          bestCalibrationTitle = recentScores[rs].calibrationTitle;
          break;
        }
      }
    }
    // Fallback: use persisted calibration title from session backup or previous scoring
    if (!bestCalibrationTitle && lastKnownCalibrationTitle) {
      bestCalibrationTitle = lastKnownCalibrationTitle;
      console.debug("[Caliber][BST][diag] using lastKnownCalibrationTitle fallback: \"" + bestCalibrationTitle + "\"");
    }
    // Fallback: use persisted nearby roles
    if (bestNearbyRoles.length === 0 && lastKnownNearbyRoles.length > 0) {
      bestNearbyRoles = lastKnownNearbyRoles;
      console.debug("[Caliber][BST][diag] using lastKnownNearbyRoles fallback: " + bestNearbyRoles.length + " entries");
    }

    var avgScore = scoredCount > 0 ? scoreSum / scoredCount : 0;

    // ── Secondary context: query classification ──
    var classification = classifySearchSurface(currentQuery, bestCalibrationTitle, bestNearbyRoles);
    var surfaceClass = classification.surfaceClass;
    var classificationReason = classification.reason;

    // ── Primary decision: driven by scored window evidence ──
    var shouldTrigger;
    var triggerReason;

    if (strongCount > 0) {
      // PRIMARY: at least one genuine strong match on the visible surface.
      // Domain-mismatch guardrail already caps out-of-scope jobs to 5.0,
      // so any score >= 7.0 in the cache is a genuine aligned strong match.
      // Show surface-quality banner instead of BST.
      shouldTrigger = false;
      triggerReason = "pre-read window has " + strongCount + " genuine strong match" + (strongCount > 1 ? "es" : "") +
        " (≥" + BST_STRONG_MATCH_THRESHOLD + ") — surface is productive, showing surface-quality banner";
    } else if (surfaceClass === "out-of-scope") {
      // SECONDARY BOOST: no strong matches + query is clearly out-of-scope.
      // Trigger confidently — the user is in the wrong job family.
      shouldTrigger = true;
      triggerReason = "no strong matches + out-of-scope query (" + classificationReason + ") — recovery needed";
    } else if (surfaceClass === "aligned") {
      // No strong matches but query looks aligned. This is a weak aligned
      // surface — BST should fire to suggest better search terms.
      shouldTrigger = true;
      triggerReason = "no strong matches on aligned surface (max " + maxScore.toFixed(1) +
        ", avg " + avgScore.toFixed(1) + ") — recovery still needed";
    } else {
      // Ambiguous query — resolve through scored + cluster evidence.
      // Primary: low average confirms poor surface.
      // Secondary: if calibration title has a known cluster but ZERO scored
      // job titles share it, the surface is effectively foreign.
      // Tertiary: if NEITHER side has a known cluster (both unrecognised)
      // AND query has zero keyword overlap with calibration title, the
      // user is almost certainly on a foreign surface (e.g., "specialist"
      // when calibrated as "Business Operations Designer").
      var noClusterOverlap = calClusterForEvidence && sameClusterCount === 0 && scoredCount >= BST_MIN_WINDOW_SIZE;
      var bothUnclusteredNoOverlap = false;
      if (!calClusterForEvidence && bestCalibrationTitle && currentQuery) {
        var aqWords = currentQuery.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().split(/\s+/).filter(function (w) { return w.length > 2; });
        var acWords = bestCalibrationTitle.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().split(/\s+/).filter(function (w) { return w.length > 2; });
        var ambOverlap = 0;
        for (var aw = 0; aw < aqWords.length; aw++) {
          for (var ac = 0; ac < acWords.length; ac++) {
            if (aqWords[aw] === acWords[ac]) { ambOverlap++; break; }
          }
        }
        bothUnclusteredNoOverlap = aqWords.length > 0 && ambOverlap === 0;
      }
      shouldTrigger = avgScore < BST_AMBIGUOUS_AVG_CEILING || noClusterOverlap || bothUnclusteredNoOverlap;
      if (shouldTrigger) {
        if (noClusterOverlap && avgScore >= BST_AMBIGUOUS_AVG_CEILING) {
          triggerReason = "no strong matches + ambiguous query + zero job titles in calibration cluster (" + calClusterForEvidence +
            ") despite avg " + avgScore.toFixed(1) + " — surface is foreign";
        } else if (bothUnclusteredNoOverlap && avgScore >= BST_AMBIGUOUS_AVG_CEILING) {
          triggerReason = "no strong matches + ambiguous query + zero keyword overlap with calTitle \"" +
            bestCalibrationTitle + "\" (no clusters) despite avg " + avgScore.toFixed(1) + " — surface is foreign";
        } else {
          triggerReason = "no strong matches + ambiguous query + weak scores (avg " + avgScore.toFixed(1) + " < " + BST_AMBIGUOUS_AVG_CEILING + ")";
        }
      } else {
        triggerReason = "no strong matches + ambiguous query but acceptable avg (" + avgScore.toFixed(1) +
          " ≥ " + BST_AMBIGUOUS_AVG_CEILING + ") + " + sameClusterCount + " jobs share calibration cluster — holding";
      }
    }

    // ── Diagnostic logging ──
    console.debug("[Caliber][BST] ── evaluation ──");
    console.debug("[Caliber][BST]   scoreWindowSize: " + scoredCount);
    console.debug("[Caliber][BST]   query: \"" + currentQuery + "\"");
    console.debug("[Caliber][BST]   calibrationTitle: \"" + bestCalibrationTitle + "\" (lastKnown: \"" + lastKnownCalibrationTitle + "\")");
    console.debug("[Caliber][BST]   nearbyRoles: " + (bestNearbyRoles.length > 0
      ? bestNearbyRoles.map(function(r) { return r.title; }).join(", ") : "(none)"));
    console.debug("[Caliber][BST]   pre-read window: [" + scores.map(function(s) { return s.toFixed(1); }).join(", ") + "]");
    console.debug("[Caliber][BST]   genuineStrongCount: " + strongCount + " (≥" + BST_STRONG_MATCH_THRESHOLD + ")");
    console.debug("[Caliber][BST]   alignedJobs: " + alignedCount + ", mismatchedJobs: " + mismatchCount +
      ", sameClusterJobs: " + sameClusterCount + " (calCluster: " + (calClusterForEvidence || "unknown") + ")");
    console.debug("[Caliber][BST]   maxScore: " + maxScore.toFixed(1) + ", avgScore: " + avgScore.toFixed(1));
    console.debug("[Caliber][BST]   queryClassification: " + surfaceClass + " (" + classificationReason + ")");
    console.debug("[Caliber][BST]   triggerReason: " + triggerReason);
    console.debug("[Caliber][BST]   decision: " + (shouldTrigger ? "TRIGGER" : "SUPPRESS"));
    console.debug("[Caliber][BST]   badgesVisible: " + BADGES_VISIBLE);
    // ── Surface-truth diagnostic (issue #73) ──
    console.debug("[Caliber][BST][surface-truth] strongCount=" + strongCount +
      ", pageMaxScore=" + pageMaxScore.toFixed(1) +
      ", pageBestTitle=\"" + pageBestTitle + "\"" +
      ", currentSelectedScore=" + (lastScoredScore || 0) +
      ", currentQuery=\"" + currentQuery + "\"" +
      ", bstSuggestedTitle=\"" + (prescanStoredTitle || "") + "\"" +
      ", suppression=" + (shouldTrigger ? "none" : triggerReason));

    if (shouldTrigger) {
      // BST TRIGGER — debounce the show to prevent flicker.
      if (!prescanBSTActive && !bstShowDebounce) {
        var deferredCalibTitle = bestCalibrationTitle;
        var deferredNearby = bestNearbyRoles;
        var deferredQuery = currentQuery;
        var deferredSurfaceClass = surfaceClass;
        bstShowDebounce = setTimeout(function () {
          bstShowDebounce = null;
          // Re-check: has scored evidence changed during debounce?
          var reUrls = Object.keys(badgeScoreCache);
          var reStrongCount = 0;
          var reCalibTitle = deferredCalibTitle;
          for (var ri = 0; ri < reUrls.length; ri++) {
            if (badgeScoreCache[reUrls[ri]].score >= BST_STRONG_MATCH_THRESHOLD) reStrongCount++;
            if (!reCalibTitle && badgeScoreCache[reUrls[ri]].calibrationTitle) {
              reCalibTitle = badgeScoreCache[reUrls[ri]].calibrationTitle;
            }
          }
          // Primary check: if a strong match appeared during debounce, cancel BST and show surface-quality banner
          if (reStrongCount > 0 || prescanBSTActive) {
            console.debug("[Caliber][BST] deferred show cancelled — " +
              (reStrongCount > 0 ? "strong match appeared during debounce (" + reStrongCount + ")" : "banner already active"));
            if (reStrongCount > 0 && !prescanBSTActive) {
              // Show surface-quality banner with true page max from the fresh re-check
              var rePageMax = 0;
              var rePageBestTitle = "";
              for (var rpm = 0; rpm < reUrls.length; rpm++) {
                if (badgeScoreCache[reUrls[rpm]].score > rePageMax) {
                  rePageMax = badgeScoreCache[reUrls[rpm]].score;
                  rePageBestTitle = badgeScoreCache[reUrls[rpm]].title || "";
                }
              }
              // Non-regression: preserve sidecard-authoritative best if higher
              // Only valid when prescanSurfaceBanner is from the current scoring pass
              // (pruned cache ensures it reflects live DOM state)
              showSurfaceQualityBanner(reStrongCount, rePageBestTitle, rePageMax);
              prescanSurfaceBanner = { strongCount: reStrongCount, bestTitle: rePageBestTitle, bestScore: rePageMax };
              console.debug("[Caliber][SurfaceBanner] SHOW (debounce upgrade) — " + reStrongCount + " strong, pageMax=" + rePageMax.toFixed(1));
            }
            return;
          }

          // Determine suggestion title with fallback chain
          var title = determinePrescanSuggestion(reCalibTitle, deferredNearby, deferredQuery);
          var titleSource = "none";
          if (title) {
            titleSource = (reCalibTitle && !titlesEquivalent(reCalibTitle, deferredQuery)) ? "calibration primary" : "adjacent role";
          } else {
            title = getCalibrationTitleFallback(deferredQuery);
            if (title) titleSource = "recentScores fallback";
          }
          // Final fallback: use lastKnownCalibrationTitle (from session backup or prior scoring)
          if (!title && lastKnownCalibrationTitle && !titlesEquivalent(lastKnownCalibrationTitle, deferredQuery) && !bstTitleAlreadySeen(lastKnownCalibrationTitle)) {
            title = lastKnownCalibrationTitle;
            titleSource = "lastKnownCalibrationTitle";
          }
          // Final fallback: use lastKnownNearbyRoles
          if (!title && lastKnownNearbyRoles.length > 0) {
            for (var nr = 0; nr < lastKnownNearbyRoles.length; nr++) {
              if (lastKnownNearbyRoles[nr].title && !titlesEquivalent(lastKnownNearbyRoles[nr].title, deferredQuery) && !bstTitleAlreadySeen(lastKnownNearbyRoles[nr].title)) {
                title = lastKnownNearbyRoles[nr].title;
                titleSource = "lastKnownNearbyRoles";
                break;
              }
            }
          }

          console.debug("[Caliber][BST]   titleSource: " + titleSource + ", title: " + (title ? "\"" + title + "\"" : "(none)"));
          console.debug("[Caliber][BST-LOOP] suggestedSoFar: " + JSON.stringify(Object.keys(bstSuggestedTitles)) +
            ", searchedSoFar: " + JSON.stringify(Object.keys(bstSearchedQueries)));

          if (title) {
            bstMarkSuggested(title);
            console.debug("[Caliber][BST] SHOW — suggestion: \"" + title + "\" (source: " + titleSource +
              ", class: " + deferredSurfaceClass + ")");
            showPrescanBSTBanner(title);
            prescanStoredTitle = title;
          } else {
            console.debug("[Caliber][BST] SHOW (generic) — no suggestion title, class: " + deferredSurfaceClass);
            showPrescanBSTBanner(null);
            prescanStoredTitle = null;
          }
          chrome.runtime.sendMessage({
            type: "CALIBER_PRESCAN_STATE_SAVE",
            surfaceKey: getSearchSurfaceKey(),
            query: deferredQuery,
            strongCount: 0,
            scoredCount: Object.keys(badgeScoreCache).length,
            suggestedTitle: prescanStoredTitle,
            suggestionShown: true,
            surfaceBanner: prescanSurfaceBanner,
          });
        }, 800);
      }
    } else {
      // BST SUPPRESS — cancel pending show and hide existing BST banner
      if (bstShowDebounce) {
        clearTimeout(bstShowDebounce);
        bstShowDebounce = null;
        console.debug("[Caliber][BST] cancelled pending show — " + triggerReason);
      }
      if (prescanBSTActive) {
        console.debug("[Caliber][BST] SUPPRESS — hiding BST banner — " + triggerReason);
        prescanBSTActive = false;
        prescanStoredTitle = null;
        if (shadow) {
          var banner = shadow.getElementById("cb-recovery-banner");
          if (banner) banner.style.display = "none";
        }
      }

      // Surface-quality banner: show when strong matches exist on the loaded surface
      // Use true pageMaxScore/pageBestTitle computed fresh from the (pruned) badge cache.
      if (strongCount > 0) {
        var bannerScore = pageMaxScore;
        var bannerTitle = pageBestTitle;
        if (bannerTitle) {
          showSurfaceQualityBanner(strongCount, bannerTitle, bannerScore);
          prescanSurfaceBanner = { strongCount: strongCount, bestTitle: bannerTitle, bestScore: bannerScore };
          console.debug("[Caliber][SurfaceBanner] SHOW — " + strongCount + " strong, best: \"" + bannerTitle + "\" (" + bannerScore.toFixed(1) + ")");
        } else {
          showSurfaceQualityBanner(strongCount, "", bannerScore);
          prescanSurfaceBanner = { strongCount: strongCount, bestTitle: "", bestScore: bannerScore };
          console.debug("[Caliber][SurfaceBanner] SHOW (no title) — " + strongCount + " strong, best=" + bannerScore.toFixed(1));
        }
      } else if (prescanSurfaceBanner) {
        // No strong matches anymore — hide surface-quality banner
        hideSurfaceQualityBanner();
        prescanSurfaceBanner = null;
      }
    }

    // Mark prescan done for persistence (but re-evaluation still runs on each chunk)
    prescanDone = true;
    prescanRunning = false;
    prescanSearchQuery = surfaceKey;

    // Persist prescan result (BST show state is updated by the debounced callback separately)
    chrome.runtime.sendMessage({
      type: "CALIBER_PRESCAN_STATE_SAVE",
      surfaceKey: surfaceKey,
      query: currentQuery,
      strongCount: strongCount,
      scoredCount: scoredCount,
      suggestedTitle: prescanStoredTitle,
      suggestionShown: prescanBSTActive,
      surfaceBanner: prescanSurfaceBanner,
    });
  }

  /** Find LinkedIn's inner scrollable container (results list scrolls inside this). */
  function findLinkedInScrollContainer() {
    var selectors = [
      ".jobs-search-results-list",
      ".scaffold-layout__list",
      ".scaffold-layout__list-container",
      "[class*='jobs-search-results-list']",
      "[class*='scaffold-layout__list']",
    ];
    for (var i = 0; i < selectors.length; i++) {
      var el = document.querySelector(selectors[i]);
      if (el) return el;  // attach even if not yet scrollable — it will become scrollable
    }
    return null;
  }

  var badgeInnerScrollEl = null;  // cached inner scroll container ref

  /** Start scroll-based badge scanning for newly visible cards. */
  function startBadgeScrollListener() {
    if (badgeScrollAttached) return;
    badgeScrollAttached = true;
    badgeScrollHandler = function () {
      clearTimeout(badgeScrollTimer);
      badgeScrollTimer = setTimeout(function () {
        console.debug("[Caliber][diag][detect] scroll-triggered scan");
        scanAndBadgeVisibleCards();
      }, 350);
    };
    // Listen on window (catches some scroll configurations)
    window.addEventListener("scroll", badgeScrollHandler, { passive: true });
    // Also listen on LinkedIn's inner scrollable container if present
    badgeInnerScrollEl = findLinkedInScrollContainer();
    if (badgeInnerScrollEl) {
      badgeInnerScrollEl.addEventListener("scroll", badgeScrollHandler, { passive: true });
      console.debug("[Caliber][badges] scroll listener attached (window + inner container)");
    } else {
      console.debug("[Caliber][badges] scroll listener attached (window only, will retry inner)");
      // Persistent retry: keep searching for inner container until found
      var innerRetryCount = 0;
      var innerRetryMax = 10;
      var innerRetryDelay = 2000;
      function retryInnerScroll() {
        innerRetryCount++;
        if (badgeInnerScrollEl || !badgeScrollAttached || !badgeScrollHandler) return;
        badgeInnerScrollEl = findLinkedInScrollContainer();
        if (badgeInnerScrollEl) {
          badgeInnerScrollEl.addEventListener("scroll", badgeScrollHandler, { passive: true });
          console.debug("[Caliber][diag][detect] inner scroll container found on retry " + innerRetryCount);
        } else if (innerRetryCount < innerRetryMax) {
          setTimeout(retryInnerScroll, innerRetryDelay);
        } else {
          console.debug("[Caliber][diag][detect] inner scroll container not found after " + innerRetryMax + " retries");
        }
      }
      setTimeout(retryInnerScroll, innerRetryDelay);
    }
    // Start periodic fallback scan (catches any cards missed by scroll/observer)
    startBadgeScanInterval();
  }

  /** Detach the scroll listener and reset its flag. */
  function stopBadgeScrollListener() {
    if (badgeScrollHandler) {
      window.removeEventListener("scroll", badgeScrollHandler);
      if (badgeInnerScrollEl) {
        badgeInnerScrollEl.removeEventListener("scroll", badgeScrollHandler);
        badgeInnerScrollEl = null;
      }
      badgeScrollHandler = null;
    }
    clearTimeout(badgeScrollTimer);
    clearTimeout(badgeBatchTimeout);
    badgeScrollAttached = false;
    stopBadgeScanInterval();
  }

  /** Start periodic scan interval (safety net for scroll/observer gaps). */
  function startBadgeScanInterval() {
    if (badgeScanInterval) return;
    badgeScanInterval = setInterval(function () {
      if (!active || !isSearchResultsPage()) return;
      // Stale-lock recovery (redundant with processBadgeQueue check, but catches idle periods)
      if (badgeBatchRunning && badgeBatchStartTime > 0 && (Date.now() - badgeBatchStartTime) > BADGE_BATCH_TIMEOUT_MS) {
        console.warn("[Caliber][diag][schedule] periodic: stale batch lock (" +
          Math.round((Date.now() - badgeBatchStartTime) / 1000) + "s), resetting");
        badgeBatchRunning = false;
        badgeBatchStartTime = 0;
      }
      scanAndBadgeVisibleCards();
      // BST evaluation removed from periodic interval — it now fires only
      // from scoring-completion events (processBadgeQueue + sidecard backfill)
      // to avoid evaluating before scores exist.
    }, 3000);  // every 3s: scan for new/recycled cards
    console.debug("[Caliber][diag] periodic scan interval started (3s)");
  }

  /** Stop periodic scan interval. */
  function stopBadgeScanInterval() {
    if (badgeScanInterval) {
      clearInterval(badgeScanInterval);
      badgeScanInterval = null;
    }
  }

  /** Attach a MutationObserver on the results list to restore badges after rerenders. */
  function startBadgeListObserver() {
    if (badgeListObserver) return;
    var listEl =
      document.querySelector(".jobs-search-results-list") ||
      document.querySelector(".scaffold-layout__list-container") ||
      document.querySelector("[class*='jobs-search-results']") ||
      document.querySelector("[class*='scaffold-layout__list']");
    if (!listEl) {
      console.debug("[Caliber][badges] no results list container found for observer");
      return;
    }
    badgeListObserver = new MutationObserver(function () {
      // Skip mutations caused by our own badge injection
      if (badgeInjecting) return;
      clearTimeout(badgeObserverDebounce);
      badgeObserverDebounce = setTimeout(function () {
        console.debug("[Caliber][diag][detect] observer-triggered rescan");
        restoreBadgesFromCache();
        // Also pick up any brand-new cards that appeared
        scanAndBadgeVisibleCards();
      }, 300);
    });
    badgeListObserver.observe(listEl, { childList: true, subtree: true });
    console.debug("[Caliber][badges] list MutationObserver attached");
  }

  /** Clear all badges, cache, and identity stamps (used on surface change). */
  function clearAllBadges() {
    badgeScoredIds.clear();
    badgeScoreCache = {};
    badgeCacheSurface = "";
    badgeBatchQueue = [];
    badgeBatchRunning = false;
    badgeBatchStartTime = 0;
    badgeBatchGeneration++;  // invalidate any in-flight batch responses
    // Reset surface diagnostic log on surface change
    surfaceDiagEntries = [];
    surfaceDiagSurface = "";
    // Reset surface-quality banner state
    prescanSurfaceBanner = null;
    hideSurfaceQualityBanner();
    badgeInjecting = true;
    var badges = document.querySelectorAll("[" + BADGE_ATTR + "]");
    for (var i = 0; i < badges.length; i++) badges[i].remove();
    // Remove identity stamps so cards get re-identified on next surface
    var stamped = document.querySelectorAll("[" + JOB_ID_ATTR + "]");
    for (var j = 0; j < stamped.length; j++) stamped[j].removeAttribute(JOB_ID_ATTR);
    badgeInjecting = false;
    // Detach scroll listener + observer
    stopBadgeScrollListener();
    clearTimeout(badgeObserverDebounce);
    if (badgeListObserver) {
      badgeListObserver.disconnect();
      badgeListObserver = null;
    }
    console.debug("[Caliber][badges] cleared all badges, identity stamps, cache, scroll listener, and observer");
  }

  // ─── Pre-scan Trigger Logic ───────────────────────────────

  function isSearchResultsPage() {
    // Match search results, collections, AND /jobs/view/ — LinkedIn changes
    // the URL to /jobs/view/ID when a job is selected from search, but the
    // split-pane search results list is still visible and needs badge scoring.
    return /\/jobs\/(search|collections|view)/.test(location.pathname);
  }

  /**
   * Start badge scanning with retry polling for cards.
   * LinkedIn lazily renders card DOM, so we poll until cards appear.
   * Separated from prescan evaluation so scanning always runs regardless
   * of whether prescan BST evaluation has already completed for this surface.
   */
  function startBadgeScanningWithRetry() {
    var attempts = 0;
    var maxAttempts = 8;
    function attempt() {
      attempts++;
      if (!active || !isSearchResultsPage()) {
        console.debug("[Caliber][diag][detect] badge scan aborted — active=" + active + ", searchPage=" + isSearchResultsPage());
        return;
      }
      scanAndBadgeVisibleCards();
      startBadgeScrollListener();
      startBadgeListObserver();
      // Check if we found any cards; if not, retry
      var foundAny = false;
      var cardCounts = [];
      for (var s = 0; s < JOB_CARD_SELECTORS.length; s++) {
        var count = document.querySelectorAll(JOB_CARD_SELECTORS[s]).length;
        if (count > 0) { foundAny = true; cardCounts.push(JOB_CARD_SELECTORS[s] + ":" + count); }
      }
      if (!foundAny && attempts < maxAttempts) {
        console.debug("[Caliber][diag][detect] badge scan retry " + attempts + "/" + maxAttempts + " — no cards found yet");
        setTimeout(attempt, 1500);
      } else if (foundAny) {
        console.debug("[Caliber][diag][detect] badge scanning active, cards found on attempt " + attempts + " [" + cardCounts.join(", ") + "]");
      } else {
        console.debug("[Caliber][diag][detect] badge scanning: no cards found after " + maxAttempts + " retries");
      }
    }
    // First attempt after short delay for DOM to settle
    setTimeout(attempt, 1000);
  }

  /**
   * Pre-check session availability before starting badge scoring.
   * Polls background for a valid session with exponential backoff.
   * On success, starts badge scanning. On exhaustion, starts anyway (will fail gracefully).
   */
  function checkSessionThenStartScoring() {
    chrome.runtime.sendMessage({ type: "CALIBER_SESSION_DISCOVER" }, function (resp) {
      if (chrome.runtime.lastError) {
        console.warn("[Caliber][session][diag] session discover transport error:", chrome.runtime.lastError.message);
      }
      if (resp && resp.ok && resp.sessionId && resp.profileComplete) {
        sessionReady = true;
        sessionCheckAttempts = 0;
        // Hydrate calibration context from session discover response (extracted from backup)
        if (resp.calibrationTitle && !lastKnownCalibrationTitle) {
          lastKnownCalibrationTitle = resp.calibrationTitle;
          console.debug("[Caliber][session][diag] hydrated calibrationTitle from discover: \"" + resp.calibrationTitle + "\"");
        }
        if (Array.isArray(resp.nearbyRoles) && resp.nearbyRoles.length > 0 && lastKnownNearbyRoles.length === 0) {
          lastKnownNearbyRoles = resp.nearbyRoles;
          console.debug("[Caliber][session][diag] hydrated nearbyRoles from discover: " + resp.nearbyRoles.length + " entries");
        }
        console.log("[Caliber][session][diag] session confirmed: " + resp.sessionId +
          ", profileComplete: " + resp.profileComplete + ", state: " + (resp.state || "?") +
          ", calTitle: \"" + (lastKnownCalibrationTitle || "") + "\"");
        startBadgeScanningWithRetry();
      } else {
        sessionCheckAttempts++;
        var reason = resp ? ("sessionId=" + (resp.sessionId || "none") +
          ", profileComplete=" + !!resp.profileComplete + ", error=" + (resp.error || "none")) : "no response";
        if (sessionCheckAttempts < sessionCheckMax) {
          var delay = Math.min(2000 * Math.pow(1.5, sessionCheckAttempts - 1), 10000);
          console.warn("[Caliber][session][diag] session not ready (attempt " + sessionCheckAttempts +
            "/" + sessionCheckMax + "): " + reason + " — retry in " + Math.round(delay) + "ms");
          clearTimeout(sessionCheckTimer);
          sessionCheckTimer = setTimeout(checkSessionThenStartScoring, delay);
        } else {
          console.warn("[Caliber][session][diag] session not available after " + sessionCheckMax +
            " attempts: " + reason + " — starting scoring anyway (will fail gracefully)");
          startBadgeScanningWithRetry();
        }
      }
    });
  }

  /**
   * Kick off the search prescan.
   * Badge scoring IS the prescan — this just ensures badge scanning is running.
   * BST evaluation happens automatically in evaluateBSTFromBadgeCache() after scores arrive.
   */
  function runSearchPrescan() {
    var surfaceKey = getSearchSurfaceKey();

    if (!isSearchResultsPage()) {
      console.debug("[Caliber][prescan] not a search results page, skipping");
      return;
    }

    // Guard: skip prescan EVALUATION if already done for this surface,
    // but ALWAYS start badge scanning infrastructure.
    // Previous regression: early return here prevented badge scanning from
    // ever starting when durable prescan state was loaded on page reload.
    if (prescanDone && prescanSearchQuery === surfaceKey) {
      // Durable state exists for this surface, but on refresh the badge cache is empty.
      // Don't restore stale banners — fall through to fresh scoring which will
      // produce the correct banner after the initial surface resolves.
      console.debug("[Caliber][prescan] durable state found for surface: " + surfaceKey + " — re-evaluating from fresh scores");
    }

    // Reset prescan state for new/refreshed surface
    prescanRunning = true;
    prescanDone = false;
    prescanSearchQuery = surfaceKey;
    prescanBSTActive = false;
    prescanStoredTitle = null;
    prescanSurfaceBanner = null;
    initialSurfaceResolved = false;

    // Clear badge cache so the surface starts with zero cached scores.
    // This prevents stale scores from a previous run of the same query
    // from appearing in the banner before new results are scored.
    // PRESERVE sidecard-authoritative entries — these were scored from the
    // full job description and are higher fidelity than card-text badges.
    // Race fix: sidecard can finish before runSearchPrescan fires (t+2s),
    // so a full wipe would lose the high-fidelity score (e.g. 8.8 → 7.1).
    var preservedSidecard = {};
    for (var scKey in badgeScoreCache) {
      if (badgeScoreCache[scKey].sidecard) preservedSidecard[scKey] = badgeScoreCache[scKey];
    }
    badgeScoredIds.clear();
    badgeScoreCache = preservedSidecard;
    for (var psKey in preservedSidecard) badgeScoredIds.add(psKey);
    badgeCacheSurface = surfaceKey;
    badgeBatchQueue = [];
    badgeBatchGeneration++;

    // Hide any previous prescan banner
    if (shadow) {
      var banner = shadow.getElementById("cb-recovery-banner");
      if (banner) banner.style.display = "none";
    }

    console.debug("[Caliber][prescan] prescan delegated to badge scoring pipeline for surface: " + surfaceKey);

    // Pre-check session availability before starting badge scoring.
    // If session is already confirmed, skip straight to scoring.
    if (sessionReady) {
      console.debug("[Caliber][session][diag] session already confirmed, starting badge scoring immediately");
      startBadgeScanningWithRetry();
    } else {
      sessionCheckAttempts = 0;
      clearTimeout(sessionCheckTimer);
      checkSessionThenStartScoring();
    }
  }

  /**
   * Fallback: get calibration title from recentScores history when
   * badge cache entries don't have it (e.g., API omitted calibration_title).
   */
  function getCalibrationTitleFallback(currentQuery) {
    for (var i = recentScores.length - 1; i >= 0; i--) {
      var ct = recentScores[i].calibrationTitle;
      if (ct && !titlesEquivalent(ct, currentQuery) && !bstTitleAlreadySeen(ct)) return ct;
    }
    return null;
  }

  /**
   * Determine the best title suggestion from prescan results.
   * Hierarchy: calibration primary title > adjacent/nearby roles > null
   */
  function determinePrescanSuggestion(calibrationTitle, nearbyRoles, currentQuery) {
    // Primary: calibration primary title (skip if equivalent to query OR already seen)
    if (calibrationTitle && !titlesEquivalent(calibrationTitle, currentQuery) && !bstTitleAlreadySeen(calibrationTitle)) {
      return calibrationTitle;
    }
    // Secondary: adjacent/nearby roles from calibration (skip seen titles)
    if (nearbyRoles && nearbyRoles.length > 0) {
      for (var i = 0; i < nearbyRoles.length; i++) {
        if (nearbyRoles[i].title && !titlesEquivalent(nearbyRoles[i].title, currentQuery) && !bstTitleAlreadySeen(nearbyRoles[i].title)) {
          return nearbyRoles[i].title;
        }
      }
    }
    return null;
  }

  /**
   * Show the Better Search Title banner from search-surface scan results.
   * If suggestedTitle is null, shows a generic recovery message without a link.
   */
  function showPrescanBSTBanner(suggestedTitle) {
    suggestedTitle = sanitizeJobTitle(suggestedTitle);
    // Self-suggestion suppression: if suggested title matches current query, do not render
    var currentQueryForBST = getSearchKeywords();
    if (suggestedTitle && currentQueryForBST && titlesEquivalent(suggestedTitle, currentQueryForBST)) {
      console.debug("[Caliber][BST] self-suggestion suppressed — suggested \"" + suggestedTitle +
        "\" is equivalent to current query \"" + currentQueryForBST + "\"");
      console.debug("[Caliber][BST][surface-truth] suppression=self-suggestion (title=\"" + suggestedTitle +
        "\", query=\"" + currentQueryForBST + "\")");
      return;
    }
    getOrCreatePanel();
    prescanBSTActive = true;
    prescanSurfaceBanner = null; // BST overrides surface-quality banner
    var banner = shadow.getElementById("cb-recovery-banner");
    var link = shadow.getElementById("cb-recovery-link");
    var reason = shadow.getElementById("cb-recovery-reason");
    var label = shadow.getElementById("cb-recovery-label");
    if (banner) {
      banner.style.display = "";
      banner.className = "cb-recovery-banner"; // restore default class (remove surface-quality)
      // Restore search icon in case it was swapped to checkmark
      var icon = banner.querySelector(".cb-recovery-icon");
      if (icon) icon.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="10.5" cy="10.5" r="7"/><line x1="16" y1="16" x2="21" y2="21"/></svg>';
      if (label) label.style.display = "";
      if (reason) {
        reason.textContent = suggestedTitle
          ? "None of the scored jobs on this page are strong matches for your calibration."
          : "None of the scored jobs on this page are strong matches. Try a different search.";
      }
      if (link) {
        if (suggestedTitle) {
          link.textContent = suggestedTitle;
          link.href = "https://www.linkedin.com/jobs/search/?keywords=" + encodeURIComponent(suggestedTitle);
          link.style.display = "";
          link.onclick = function () { sessionSignals.suggest_clicked = true; };
        } else {
          // Generic recovery: no specific title to suggest
          link.style.display = "none";
        }
      }
      sessionSignals.suggest_shown = true;
      console.debug("[Caliber][BST] banner shown" + (suggestedTitle ? ", suggested: \"" + suggestedTitle + "\"" : " (generic, no suggestion)"));
    }
  }

  /**
   * Show surface-quality banner in the BST slot when the loaded surface has strong matches.
   * Content: "{strongCount} strong matches · Best: {bestTitle} ({bestScore})"
   */
  function showSurfaceQualityBanner(strongCount, bestTitle, bestScore) {
    bestTitle = sanitizeJobTitle(bestTitle);
    getOrCreatePanel();
    // Hide BST if active
    prescanBSTActive = false;
    prescanStoredTitle = null;

    var banner = shadow.getElementById("cb-recovery-banner");
    var reason = shadow.getElementById("cb-recovery-reason");
    var link = shadow.getElementById("cb-recovery-link");
    var label = shadow.getElementById("cb-recovery-label");
    if (banner) {
      banner.style.display = "";
      banner.className = "cb-recovery-banner cb-surface-quality";
      // Replace icon with green checkmark
      var icon = banner.querySelector(".cb-recovery-icon");
      if (icon) icon.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>';
      if (reason) {
        var matchLabel = strongCount + " strong match" + (strongCount > 1 ? "es" : "");
        var scoreHtml = bestScore ? ' <span class="cb-sq-score">' + bestScore.toFixed(1) + '</span>' : "";
        var scanningHtml = ' <span class="cb-sq-scanning" id="cb-sq-scanning" style="display:none">&middot; scanning\u2026</span>';
        reason.innerHTML = matchLabel + ' \u00B7 <span class="cb-sq-best-link" id="cb-sq-best-link">Best so far:</span>' + scoreHtml + scanningHtml +
          '<div class="cb-sq-dropdown" id="cb-sq-dropdown">' +
          '<div class="cb-sq-dropdown-title">Why \u201Cbest so far\u201D?</div>' +
          '<div class="cb-sq-dropdown-body">' +
          'LinkedIn loads jobs as you scroll.<br>' +
          'Caliber scores them as they appear.<br>' +
          'If a stronger match appears, this banner updates.' +
          '</div></div>';
        // Wire up click toggle on the "Best so far" link
        var bestLink = reason.querySelector("#cb-sq-best-link");
        var dropdown = reason.querySelector("#cb-sq-dropdown");
        if (bestLink && dropdown) {
          bestLink.onclick = function (e) {
            e.stopPropagation();
            dropdown.classList.toggle("cb-sq-dropdown-open");
          };
        }
      }
      if (label) label.style.display = "none";
      if (link) link.style.display = "none";
    }
  }

  /** Hide surface-quality banner (restores BST slot to hidden state). */
  function hideSurfaceQualityBanner() {
    if (!shadow) return;
    var banner = shadow.getElementById("cb-recovery-banner");
    if (banner) {
      banner.style.display = "none";
      banner.className = "cb-recovery-banner";
      // Restore search icon
      var icon = banner.querySelector(".cb-recovery-icon");
      if (icon) icon.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="10.5" cy="10.5" r="7"/><line x1="16" y1="16" x2="21" y2="21"/></svg>';
      var label = shadow.getElementById("cb-recovery-label");
      if (label) label.style.display = "";
    }
  }

  /** Show the "scanning…" indicator on the surface-quality banner. */
  function showScanningIndicator() {
    if (!shadow) return;
    var el = shadow.getElementById("cb-sq-scanning");
    if (el) el.style.display = "";
  }

  /** Hide the "scanning…" indicator on the surface-quality banner. */
  function hideScanningIndicator() {
    if (!shadow) return;
    var el = shadow.getElementById("cb-sq-scanning");
    if (el) el.style.display = "none";
  }

  function resetPrescanState() {
    prescanDone = false;
    prescanRunning = false;
    prescanSearchQuery = "";
    prescanBSTActive = false;
    prescanStoredTitle = null;
    prescanSurfaceBanner = null;
    initialSurfaceResolved = false;
    if (bstShowDebounce) {
      clearTimeout(bstShowDebounce);
      bstShowDebounce = null;
    }
    if (shadow) {
      var banner = shadow.getElementById("cb-recovery-banner");
      if (banner) {
        banner.style.display = "none";
        banner.className = "cb-recovery-banner";
      }
    }
    // Clear durable state so new search gets a fresh scan
    chrome.runtime.sendMessage({ type: "CALIBER_PRESCAN_STATE_CLEAR" }, function () {
      console.debug("[Caliber][prescan] durable state cleared");
    });
  }

  // ─── Panel Creation ───────────────────────────────────────

  function getOrCreatePanel() {
    if (shadow) return shadow;

    panelHost = document.createElement("div");
    panelHost.id = PANEL_HOST_ID;
    panelHost.style.cssText =
      "position:fixed!important;bottom:20px!important;left:20px!important;" +
      "z-index:2147483647!important;"

    shadow = panelHost.attachShadow({ mode: "closed" });

    const style = document.createElement("style");
    style.textContent = PANEL_CSS;
    shadow.appendChild(style);

    const wrapper = document.createElement("div");
    wrapper.innerHTML = PANEL_HTML;
    shadow.appendChild(wrapper.firstElementChild);

    document.body.appendChild(panelHost);

    // Animate on first creation only
    var panelEl = shadow.querySelector(".cb-panel");
    if (panelEl) {
      panelEl.style.animation = "cb-enter 0.2s ease-out";
      panelEl.addEventListener("animationend", function () {
        panelEl.style.animation = "none";
      }, { once: true });
    }

    shadow.getElementById("cb-close").addEventListener("click", deactivatePanel);
    shadow.getElementById("cb-recalc").addEventListener("click", () => scoreCurrentJob(true));
    shadow.getElementById("cb-retry").addEventListener("click", () => scoreCurrentJob(true));

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
    shadow.getElementById("cb-fb-submit").addEventListener("click", handleFeedbackSubmit);
    shadow.getElementById("cb-fb-cancel").addEventListener("click", handleFeedbackCancel);
    shadow.querySelectorAll(".cb-fb-chip").forEach(function (chip) {
      chip.addEventListener("click", function () {
        chip.classList.toggle("cb-fb-chip-selected");
      });
    });

    // Wire bug report controls
    shadow.getElementById("cb-bug-btn").addEventListener("click", handleBugOpen);
    shadow.getElementById("cb-bug-submit").addEventListener("click", handleBugSubmit);
    shadow.getElementById("cb-bug-cancel").addEventListener("click", handleBugCancel);
    shadow.querySelectorAll(".cb-bug-chip").forEach(function (chip) {
      chip.addEventListener("click", function () {
        chip.classList.toggle("cb-fb-chip-selected");
      });
    });

    // Wire "View pipeline" link in TRP secondary row
    shadow.getElementById("cb-pipeline-view").addEventListener("click", function (e) {
      e.preventDefault();
      chrome.runtime.sendMessage({ type: "CALIBER_OPEN_PIPELINE" });
    });

    // Wire "Add to pipeline" button in TRP secondary row
    shadow.getElementById("cb-pipeline-add-btn").addEventListener("click", function () {
      var addBtn = shadow.getElementById("cb-pipeline-add-btn");
      if (addBtn) { addBtn.textContent = "Adding\u2026"; addBtn.disabled = true; }
      // Re-extract meta in case DOM was not ready at score time
      var freshMeta = extractJobMeta();
      var saveTitle = lastJobMeta.title || freshMeta.title || "Untitled Position";
      var saveCompany = lastJobMeta.company || freshMeta.company || "Unknown Company";
      var saveUrl = location.href;
      var saveScore = lastScoredScore || 0;
      console.debug("[Caliber][TRP] manual pipeline save started — title=\"" + saveTitle +
        "\", company=\"" + saveCompany + "\", url=" + saveUrl + ", score=" + saveScore);
      chrome.runtime.sendMessage({
        type: "CALIBER_PIPELINE_SAVE",
        jobTitle: saveTitle,
        company: saveCompany,
        jobUrl: saveUrl,
        score: saveScore,
      }, function (resp) {
        if (chrome.runtime.lastError) {
          if (addBtn) { addBtn.textContent = "Add to pipeline"; addBtn.disabled = false; }
          console.warn("[Caliber][TRP] manual pipeline save — messaging error:", chrome.runtime.lastError.message);
          return;
        }
        if (resp && resp.ok) {
          updateTRPPipelineState("in-pipeline");
          console.debug("[Caliber][TRP] manual pipeline save succeeded — id=" + (resp.entry && resp.entry.id));
          emitTelemetry("pipeline_save", {
            surfaceKey: getSearchSurfaceKey(),
            jobTitle: saveTitle || null,
            company: saveCompany || null,
            jobUrl: saveUrl,
            score: saveScore,
            trigger: "manual_trp",
          });
        } else {
          if (addBtn) { addBtn.textContent = "Add to pipeline"; addBtn.disabled = false; }
          console.warn("[Caliber][TRP] manual pipeline save failed — error=" +
            (resp && resp.error || "unknown") + ", http=" + (resp && resp.httpStatus || "?") +
            ", title=\"" + saveTitle + "\", company=\"" + saveCompany + "\"");
        }
      });
    });

    // Wire tailor banner button
    shadow.getElementById("cb-tailor-btn").addEventListener("click", function () {
      var btn = shadow.getElementById("cb-tailor-btn");
      if (btn) { btn.textContent = "Preparing\u2026"; btn.disabled = true; }
      chrome.runtime.sendMessage({
        type: "CALIBER_TAILOR_PREPARE",
        jobTitle: lastJobMeta.title || "",
        company: lastJobMeta.company || "",
        jobUrl: location.href,
        jobText: lastScoredText || "",
        score: lastScoredScore || 0,
      }, function (resp) {
        if (resp && resp.ok) {
          if (btn) btn.textContent = "Opened \u2713";
        } else {
          if (btn) { btn.textContent = "Tailor resume for this job \u2192"; btn.disabled = false; }
          console.warn("[Caliber] Tailor prepare failed:", resp && resp.error);
        }
      });
    });

    // Dismiss "Best so far" dropdown on any click outside it
    shadow.addEventListener("click", function (e) {
      var dropdown = shadow.getElementById("cb-sq-dropdown");
      if (dropdown && dropdown.classList.contains("cb-sq-dropdown-open")) {
        var link = shadow.getElementById("cb-sq-best-link");
        if (e.target !== link && !dropdown.contains(e.target)) {
          dropdown.classList.remove("cb-sq-dropdown-open");
        }
      }
    });

    return shadow;
  }

  function removePanel() {
    if (panelHost && panelHost.parentNode) panelHost.parentNode.removeChild(panelHost);
    panelHost = null;
    shadow = null;
  }

  /**
   * Swap the TRP secondary action state.
   * @param {"hidden"|"add"|"in-pipeline"|"auto-added"} state
   *   hidden     — no secondary action shown
   *   add        — "Add to pipeline" button (score 7.0–8.4, not yet added)
   *   in-pipeline — "✓ In pipeline" + "View pipeline →" (manual add or returning)
   *   auto-added — "✓ Added to pipeline" + "View pipeline →" (score >= 8.5)
   */
  function updateTRPPipelineState(state) {
    if (!shadow) return;
    var addBtn = shadow.getElementById("cb-pipeline-add-btn");
    var statusEl = shadow.getElementById("cb-pipeline-status");
    var viewLink = shadow.getElementById("cb-pipeline-view");
    if (!addBtn || !statusEl || !viewLink) return;

    // Reset all to hidden
    addBtn.style.display = "none";
    addBtn.disabled = false;
    addBtn.textContent = "Add to pipeline";
    statusEl.style.display = "none";
    statusEl.textContent = "";
    viewLink.style.display = "none";

    if (state === "add") {
      addBtn.style.display = "";
    } else if (state === "in-pipeline") {
      statusEl.textContent = "\u2713 In pipeline";
      statusEl.style.display = "";
      viewLink.style.display = "";
    } else if (state === "auto-added") {
      statusEl.textContent = "\u2713 Added to pipeline";
      statusEl.style.display = "";
      viewLink.style.display = "";
    }
    // "hidden" — everything stays hidden (default reset)
  }

  // ─── Decision Label ───────────────────────────────────────

  function getDecision(score) {
    if (score >= 9.0) return { label: "Excellent Match", cls: "cb-decision-excellent" };
    if (score >= 8.0) return { label: "Very Strong Match", cls: "cb-decision-vstrong" };
    if (score >= 7.0) return { label: "Strong Partial Match", cls: "cb-decision-strong" };
    if (score >= 6.0) return { label: "Viable Stretch", cls: "cb-decision-stretch" };
    if (score >= 5.0) return { label: "Adjacent Background", cls: "cb-decision-adjacent" };
    return { label: "Poor Fit", cls: "cb-decision-skip" };
  }

  // ─── Domain-Mismatch Score Guardrail ─────────────────────
  // Two-tier ceiling for out-of-scope jobs:
  //   1. HRC="Unlikely" → hard cap at SCORE_CEILING_OUT_OF_SCOPE (5.0)
  //   2. Role-family mismatch (client-side heuristic) → same cap
  // Capped scores feed into badge cache and BST evaluation, accelerating
  // BST recovery when the user's search yields clearly wrong-domain results.
  function applyDomainMismatchGuardrail(score, hrcBand, jobTitle, calibrationTitle) {
    var ceiling = SCORE_CEILING_OUT_OF_SCOPE;
    if (hrcBand === "Unlikely" && score > ceiling) {
      console.debug("[Caliber][diag][ceiling] HRC=Unlikely cap: " + score + " → " + ceiling);
      return ceiling;
    }
    if (isRoleFamilyMismatch(jobTitle, calibrationTitle) && score > ceiling) {
      console.debug("[Caliber][diag][ceiling] role-family mismatch cap: " + score + " → " + ceiling +
        " (job: \"" + (jobTitle || "") + "\", cal: \"" + (calibrationTitle || "") + "\")");
      return ceiling;
    }
    // Tier 3: job title is in a known cluster but calibration title is NOT in
    // any cluster AND they share zero keyword overlap. This catches cases like
    // job="Bartender" (hospitality) + calTitle="Business Operations Designer"
    // (no cluster match). Without this, the guardrail silently passes 6-7 scores.
    if (calibrationTitle && jobTitle && score > ceiling) {
      var jobCluster = getClusterForTitle(jobTitle);
      var calCluster = getClusterForTitle(calibrationTitle);
      if (jobCluster && !calCluster) {
        var jWords = jobTitle.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().split(/\s+/).filter(function (w) { return w.length > 2; });
        var cWords = calibrationTitle.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().split(/\s+/).filter(function (w) { return w.length > 2; });
        var overlapCount = 0;
        for (var ow = 0; ow < jWords.length; ow++) {
          for (var cw = 0; cw < cWords.length; cw++) {
            if (jWords[ow] === cWords[cw]) { overlapCount++; break; }
          }
        }
        if (overlapCount === 0) {
          console.debug("[Caliber][diag][ceiling] cluster-vs-unrecognised cap: " + score + " → " + ceiling +
            " (job: \"" + jobTitle + "\" [" + jobCluster + "], cal: \"" + calibrationTitle + "\" [no cluster], 0 overlap)");
          return ceiling;
        }
      }
    }
    // Diagnostic: surface when guardrail can't evaluate due to missing context
    if (!calibrationTitle && score > ceiling) {
      var diagJobCluster = jobTitle ? getClusterForTitle(jobTitle) : null;
      if (diagJobCluster) {
        console.warn("[Caliber][diag][ceiling] GUARDRAIL GAP: job \"" + (jobTitle || "") +
          "\" (cluster: " + diagJobCluster + ") scored " + score + " but no calibrationTitle available to compare — " +
          "score passes uncapped. lastKnownCalibrationTitle=\"" + lastKnownCalibrationTitle + "\"");
      }
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

  function handleBugOpen() {
    var panel = shadow.getElementById("cb-bug-panel");
    if (panel) panel.style.display = "";
    var row = shadow.getElementById("cb-fb-row");
    if (row) row.style.display = "none";
    // Also hide thumbs-down panel if open
    var fbPanel = shadow.getElementById("cb-fb-panel");
    if (fbPanel) fbPanel.style.display = "none";
  }

  function handleBugSubmit() {
    var selected = shadow.querySelectorAll(".cb-bug-chip.cb-fb-chip-selected");
    var category = null;
    if (selected.length > 0) category = selected[0].getAttribute("data-bug");
    var comment = (shadow.getElementById("cb-bug-text").value || "").trim();
    sendBugReport(category, comment || null);
    shadow.getElementById("cb-bug-panel").style.display = "none";
    showFeedbackConfirm();
  }

  function handleBugCancel() {
    shadow.getElementById("cb-bug-panel").style.display = "none";
    var row = shadow.getElementById("cb-fb-row");
    if (row) row.style.display = "";
  }

  function sendBugReport(category, comment) {
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
      feedback_type: "bug_report",
      feedback_reason: null,
      bug_category: category,
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
      console.debug("[Caliber] bug report sent:", category)
    });
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

  /**
   * Sanitize a job title scraped from LinkedIn cards.
   * Strips: duplicated title segments ("Sr. PM Sr. PM" → "Sr. PM"),
   * "with verification" suffix, and trailing LinkedIn badge metadata.
   */
  function sanitizeJobTitle(raw) {
    if (!raw) return "";
    var t = raw.trim();
    // Strip "with verification" suffix (LinkedIn badge metadata)
    t = t.replace(/\s+with\s+verification\s*$/i, "").trim();
    // Strip trailing badge text like "· 2nd", "· 3rd+", "· Promoted", "· Reposted", "· Actively recruiting"
    t = t.replace(/\s*·\s*(1st|2nd|3rd\+?|Promoted|Reposted|Actively\s+recruiting|Easy\s+Apply)\s*$/i, "").trim();
    // Detect and remove exact-duplicate halves: "Title Title" → "Title"
    // Only if the title is long enough to plausibly contain a duplicate
    if (t.length >= 6) {
      var half = Math.floor(t.length / 2);
      // Try matching the first half repeated, allowing whitespace in between
      var firstHalf = t.substring(0, half).trim();
      var secondHalf = t.substring(half).trim();
      if (firstHalf.length > 2 && firstHalf === secondHalf) {
        t = firstHalf;
      } else {
        // Also try splitting on double-space or common separator
        var words = t.split(/\s+/);
        if (words.length >= 4 && words.length % 2 === 0) {
          var mid = words.length / 2;
          var first = words.slice(0, mid).join(" ");
          var second = words.slice(mid).join(" ");
          if (first === second) t = first;
        }
      }
    }
    return t;
  }

  /** Check if a candidate BST title was already suggested or already searched this session. */
  function bstTitleAlreadySeen(title) {
    if (!title) return false;
    var norm = title.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    return !!bstSuggestedTitles[norm] || !!bstSearchedQueries[norm];
  }

  /** Record a title as suggested this session (prevents re-suggesting). */
  function bstMarkSuggested(title) {
    if (!title) return;
    var norm = title.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    bstSuggestedTitles[norm] = true;
    console.debug("[Caliber][BST-LOOP] marked suggested: \"" + title + "\" (norm: \"" + norm + "\")");
  }

  /** Record a query the user has searched (prevents suggesting it back). */
  function bstMarkSearched(query) {
    if (!query) return;
    var norm = query.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    bstSearchedQueries[norm] = true;
    console.debug("[Caliber][BST-LOOP] marked searched: \"" + query + "\" (norm: \"" + norm + "\")");
  }

  // checkWeakSearchPattern removed — BST is now triggered by visible-page scan, not per-click history

  function showResults(data) {
    getOrCreatePanel();
    hideOverlay();

    console.log("[caliber] showResults v" + PANEL_VERSION, JSON.stringify(data).substring(0, 500));

    var rawScore = Number(data.score_0_to_10) || 0;
    var hrc = data.hiring_reality_check;
    var hrcBand = (hrc && hrc.band) ? hrc.band : null;
    var score = applyDomainMismatchGuardrail(rawScore, hrcBand, lastJobMeta.title || "", data.calibration_title || "");
    lastScoredScore = score;

    // If client-side role-family mismatch capped the score, override HRC to
    // reflect the actual reason — the server HRC may show "High" because
    // the job had no real domain requirements after benefits filtering.
    var roleMismatch = isRoleFamilyMismatch(lastJobMeta.title || "", data.calibration_title || "");
    if (roleMismatch && score < rawScore) {
      hrc = { band: "Unlikely", reason: "Role-family mismatch — job is in a different career family" };
      hrcBand = "Unlikely";
      console.log("[Caliber][HRC] override: role-family mismatch detected",
        { jobTitle: lastJobMeta.title, calibrationTitle: data.calibration_title,
          serverBand: (data.hiring_reality_check && data.hiring_reality_check.band) || null,
          serverReason: (data.hiring_reality_check && data.hiring_reality_check.reason) || null,
          overrideBand: "Unlikely", overrideReason: hrc.reason });
    } else {
      console.log("[Caliber][HRC] server result:",
        { band: hrcBand, reason: (hrc && hrc.reason) || null, roleMismatch: roleMismatch });
    }

    // Display score rounded to 1 decimal — label and color derive from this
    // so the user never sees a mismatch between displayed score and band label.
    var displayScore = Math.round(score * 10) / 10;
    var decision = getDecision(displayScore);

    // Score + decision (left side of header row)
    var scoreEl = shadow.getElementById("cb-score");
    scoreEl.textContent = displayScore.toFixed(1);
    scoreEl.style.color = displayScore >= 7 ? "#4ADE80" : displayScore >= 6 ? "#FBBF24" : "#EF4444";

    var decEl = shadow.getElementById("cb-decision");
    decEl.textContent = decision.label;
    decEl.className = "cb-decision " + decision.cls;

    // Job identity (below score row)
    var titleEl = shadow.getElementById("cb-jobtitle");
    var companyEl = shadow.getElementById("cb-company");
    titleEl.textContent = lastJobMeta.title || "";
    companyEl.textContent = lastJobMeta.company || "";

    // Hiring Reality Check (collapsible row)
    var hrcSection = shadow.getElementById("cb-hrc-section");
    var hrcBandEl = shadow.getElementById("cb-hrc-band");
    var hrcReason = shadow.getElementById("cb-hrc-reason");
    var hrcToggle = hrcSection.querySelector(".cb-collapse-toggle");
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
      hrcBandEl.style.color = "#555";
      hrcToggle.className = "cb-collapse-toggle";
      hrcReason.textContent = "";
    }
    hrcSection.style.display = "";

    // Supports (collapsible — dot indicators in toggle)
    var supportItems = data.supports_fit || [];
    renderList(shadow.getElementById("cb-supports"), supportItems);
    var supCount = shadow.getElementById("cb-supports-count");
    if (supCount) supCount.innerHTML = renderBarIndicator(supportItems.length, "green");

    // Stretch factors (collapsible — dot indicators in toggle)
    var stretchItems = data.stretch_factors || [];
    renderList(shadow.getElementById("cb-stretch"), stretchItems);
    var strCount = shadow.getElementById("cb-stretch-count");
    if (strCount) strCount.innerHTML = renderBarIndicator(stretchItems.length, "yellow");
    var stretchSection = shadow.getElementById("cb-stretch-section");
    if (stretchSection) stretchSection.style.display = "";

    // Bottom line (collapsible)
    var blEl = shadow.getElementById("cb-bottomline");
    blEl.textContent = data.bottom_line_2s || "";
    if (score < 8.5 && stretchItems.length === 0 && blEl.textContent) {
      var limiterLine = document.createElement("span");
      limiterLine.style.cssText = "display:block;margin-top:3px;color:#999;font-style:italic;";
      limiterLine.textContent = "Score capped slightly by scope alignment.";
      blEl.appendChild(limiterLine);
    }
    var blSection = shadow.getElementById("cb-bottomline-section");
    if (blSection) blSection.style.display = "";

    // Nearby roles: show as recovery banner above sidecard (not inside sidecard)
    // GUARD: only show if the page-level cache has NO strong matches.
    // On aligned surfaces with strong matches available, a single weak job click
    // must not override the page-level BST suppression state.
    if (score < 7.5 && data.nearby_roles && data.nearby_roles.length > 0) {
      var pageHasStrongMatches = false;
      var cacheKeys = Object.keys(badgeScoreCache);
      for (var sm = 0; sm < cacheKeys.length; sm++) {
        if (badgeScoreCache[cacheKeys[sm]].score >= BST_STRONG_MATCH_THRESHOLD) {
          pageHasStrongMatches = true;
          break;
        }
      }
      if (pageHasStrongMatches) {
        console.debug("[Caliber][BST] sidecard weak-job BST suppressed — page has strong matches in cache");
        console.debug("[Caliber][BST][surface-truth] suppression=page-level-strong-match-present" +
          ", currentSelectedScore=" + score +
          ", currentQuery=\"" + getSearchKeywords() + "\"");
      } else {
        var bestNearby = data.nearby_roles[0];
        if (bestNearby && bestNearby.title) {
          showPrescanBSTBanner(bestNearby.title);
        }
      }
    }

    // Tailor Resume Pipeline card (above sidecard, 7.0+ only)
    var tailorBanner = shadow.getElementById("cb-tailor-banner");
    if (tailorBanner) {
      if (score >= 7.0) {
        // Reset banner to default state for the new job
        var tailorBtn = shadow.getElementById("cb-tailor-btn");
        if (tailorBtn) { tailorBtn.textContent = "Tailor resume for this job \u2192"; tailorBtn.disabled = false; }
        // Reset secondary action to blank before pipeline check resolves
        updateTRPPipelineState("hidden");
        tailorBanner.style.display = "";
        // Check pipeline membership to set secondary action state
        chrome.runtime.sendMessage(
          { type: "CALIBER_PIPELINE_CHECK", jobUrl: location.href },
          function (resp) {
            if (resp && resp.exists) {
              console.debug("[Caliber][TRP] job already in pipeline");
              updateTRPPipelineState("in-pipeline");
            } else if (score >= PIPELINE_AUTO_SAVE_THRESHOLD) {
              // Auto-add will handle this — state set in auto-save callback
              console.debug("[Caliber][TRP] score >= " + PIPELINE_AUTO_SAVE_THRESHOLD + ", auto-add pending");
            } else {
              // 7.0 – 8.4: show manual add button
              updateTRPPipelineState("add");
            }
          }
        );
      } else {
        tailorBanner.style.display = "none";
      }
    }

    // Rolling score history — persist for analytics + fallback BST trigger
    var historyEntry = { score: score, title: lastJobMeta.title || "", nearbyRoles: data.nearby_roles || [], calibrationTitle: data.calibration_title || "", surfaceKey: getSearchSurfaceKey() };
    recentScores.push(historyEntry);
    if (recentScores.length > 10) recentScores = recentScores.slice(-10);
    chrome.runtime.sendMessage({
      type: "CALIBER_SCORE_HISTORY_PUSH",
      score: score,
      title: lastJobMeta.title || "",
      nearbyRoles: data.nearby_roles || [],
      calibrationTitle: data.calibration_title || "",
      surfaceKey: getSearchSurfaceKey(),
    }, function (resp) {
      if (resp && resp.ok && Array.isArray(resp.history)) {
        recentScores = resp.history;
      }
    });

    // Direct surface-quality banner update: when the sidecard discovers a score
    // higher than the current banner's best, update the banner immediately.
    // This is defense-in-depth — the backfill also updates via evaluateBSTFromBadgeCache,
    // but the direct path guarantees the banner reflects the true page max.
    if (isSearchResultsPage() && prescanSurfaceBanner && score > prescanSurfaceBanner.bestScore) {
      var sidecardDisplayTitle = sanitizeJobTitle(lastJobMeta.title || "");
      var prevBest = prescanSurfaceBanner.bestScore;
      showSurfaceQualityBanner(prescanSurfaceBanner.strongCount, sidecardDisplayTitle, score);
      prescanSurfaceBanner = { strongCount: prescanSurfaceBanner.strongCount, bestTitle: sidecardDisplayTitle, bestScore: score };
      console.debug("[Caliber][SurfaceBanner] DIRECT UPDATE from sidecard — new best: \"" +
        sidecardDisplayTitle + "\" (" + score.toFixed(1) + "), prev best was " + prevBest.toFixed(1));
    }

    // Backfill inline badge from sidecard score.
    // When a user clicks a job and the sidecard scores it, update the badge
    // cache and inject/update the badge on the corresponding list card.
    (function backfillBadgeFromSidecard() {
      if (!isSearchResultsPage()) return;
      // Extract job ID from current URL
      var urlMatch = location.href.match(/\/jobs\/view\/(\d+)/);
      var sidecardJobId = urlMatch ? "job-" + urlMatch[1] : null;
      if (!sidecardJobId) {
        console.debug("[Caliber][diag][backfill] no job ID in URL, skipping backfill");
        return;
      }
      console.debug("[Caliber][diag][backfill] sidecard scored " + sidecardJobId +
        " (score=" + score + "), attempting badge backfill" +
        ", cacheHadEntry=" + (!!badgeScoreCache[sidecardJobId]) +
        (badgeScoreCache[sidecardJobId] ? " (was " + badgeScoreCache[sidecardJobId].score + ")" : ""));
      // Update badge cache — mark as sidecard-authoritative so badge scoring
      // callbacks (which may arrive late) can never overwrite with a stale card-text score.
      badgeScoreCache[sidecardJobId] = {
        score: score,
        title: sanitizeJobTitle(lastJobMeta.title),
        calibrationTitle: data.calibration_title || "",
        nearbyRoles: data.nearby_roles || [],
        sidecard: true,
      };
      // Find the card in the list — first try data-attribute lookup (O(1))
      var cardEl = findCardById(sidecardJobId);
      // Fallback: search by href if card wasn't previously stamped
      if (!cardEl) {
        var numericId = sidecardJobId.replace("job-", "");
        var allLinks = document.querySelectorAll('a[href*="/jobs/view/' + numericId + '"]');
        for (var bl = 0; bl < allLinks.length; bl++) {
          // Walk up to find the card container
          var ancestor = allLinks[bl];
          for (var up = 0; up < 8 && ancestor; up++) {
            ancestor = ancestor.parentElement;
            if (!ancestor) break;
            var isCard = false;
            for (var cs = 0; cs < JOB_CARD_SELECTORS.length; cs++) {
              if (ancestor.matches && ancestor.matches(JOB_CARD_SELECTORS[cs])) { isCard = true; break; }
            }
            if (isCard) {
              // Stamp it so future lookups find it O(1)
              ancestor.setAttribute(JOB_ID_ATTR, sidecardJobId);
              cardEl = ancestor;
              console.debug("[Caliber][diag][backfill] found card via href walk for " + sidecardJobId);
              break;
            }
          }
          if (cardEl) break;
        }
      }
      if (cardEl) {
        ensureBadgeStyles();
        setBadgeOnCard(cardEl, "scored", score);
        console.debug("[Caliber][diag][backfill] badge injected on card " + sidecardJobId + " (score=" + score + ")");
      } else {
        console.debug("[Caliber][diag][backfill] card DOM not found for " + sidecardJobId + " — badge cached for later restore");
      }
      // Also mark as scored so it's not re-queued
      badgeScoredIds.add(sidecardJobId);
      // Re-evaluate BST with the new score
      evaluateBSTFromBadgeCache();
    })();

    // Telemetry: strong_match_viewed (score >= 7.0)
    if (score >= 7.0) {
      emitTelemetry("strong_match_viewed", {
        surfaceKey: getSearchSurfaceKey(),
        jobTitle: lastJobMeta.title || null,
        company: lastJobMeta.company || null,
        jobUrl: location.href,
        score: score,
      });
    }

    // Behavioral signal tracking
    sessionSignals.jobs_viewed++;
    if (score < 6) sessionSignals.scores_below_6++;
    if (score > sessionSignals.highest_score) sessionSignals.highest_score = score;
    console.debug("[Caliber][BST] score=" + score + " weak=" + (score < 7 ? "yes" : "no") +
      " history=" + recentScores.length + " prescanBST=" + prescanBSTActive +
      " viewed=" + sessionSignals.jobs_viewed);

    // Auto-save strong-match jobs to pipeline silently
    // Uses PIPELINE_AUTO_SAVE_THRESHOLD (8.5), distinct from BST threshold (8.0)
    if (score >= PIPELINE_AUTO_SAVE_THRESHOLD) {
      var autoTitle = lastJobMeta.title || extractJobMeta().title || "Untitled Position";
      var autoCompany = lastJobMeta.company || extractJobMeta().company || "Unknown Company";
      console.debug("[Caliber][TRP] auto-save pipeline started — title=\"" + autoTitle +
        "\", company=\"" + autoCompany + "\", score=" + score);
      chrome.runtime.sendMessage(
        {
          type: "CALIBER_PIPELINE_SAVE",
          jobTitle: autoTitle,
          company: autoCompany,
          jobUrl: location.href,
          score: score,
        },
        function (resp) {
          if (chrome.runtime.lastError) {
            console.warn("[Caliber][TRP] auto-save pipeline — messaging error:", chrome.runtime.lastError.message);
            updateTRPPipelineState("add");
            return;
          }
          if (resp && resp.ok) {
            console.debug("[Caliber][TRP] auto-save pipeline succeeded — id=" + (resp.entry && resp.entry.id) + ", score=" + score);
            updateTRPPipelineState("auto-added");
            // Telemetry: pipeline_save from auto-save
            emitTelemetry("pipeline_save", {
              surfaceKey: getSearchSurfaceKey(),
              jobTitle: autoTitle || null,
              company: autoCompany || null,
              jobUrl: location.href,
              score: score,
            });
          } else {
            console.warn("[Caliber][TRP] auto-save pipeline failed — error=" +
              (resp && resp.error || "unknown") + ", http=" + (resp && resp.httpStatus || "?"));
            // Fall back to manual add button if auto-save fails
            updateTRPPipelineState("add");
          }
        }
      );
    }

    // Snapshot context for feedback
    lastFeedbackData = {
      score: score,
      decision: decision.label,
      company: lastJobMeta.company || null,
      jobTitle: lastJobMeta.title || null,
      hrcBand: hrcBand,
      suggestedTitle: data.calibration_title || null,
    };

    // Reset feedback UI for new result (unless already given in this session)
    var fbRow = shadow.getElementById("cb-fb-row");
    var fbPanel = shadow.getElementById("cb-fb-panel");
    var bugPanel = shadow.getElementById("cb-bug-panel");
    if (fbPanel) fbPanel.style.display = "none";
    if (bugPanel) bugPanel.style.display = "none";
    if (fbRow && !feedbackGiven) {
      fbRow.style.display = "";
      fbRow.innerHTML = '<span class="cb-fb-prompt">Helpful?</span>' +
        '<button id="cb-fb-up" class="cb-fb-btn" title="Yes">\u25B2</button>' +
        '<button id="cb-fb-down" class="cb-fb-btn" title="No">\u25BC</button>' +
        '<span class="cb-fb-sep"></span>' +
        '<button id="cb-bug-btn" class="cb-bug-btn" title="Report bug">Report bug</button>';
      shadow.getElementById("cb-fb-up").addEventListener("click", handleThumbsUp);
      shadow.getElementById("cb-fb-down").addEventListener("click", handleThumbsDown);
      shadow.getElementById("cb-bug-btn").addEventListener("click", handleBugOpen);
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
  function renderBarIndicator(count, tone) {
    if (count === 0) return "";
    var pct = Math.min(count / 5, 1) * 100;
    return '<span class="cb-bar"><span class="cb-bar-fill cb-bar-' + tone + '" style="width:' + pct + '%"></span></span>' +
           '<span class="cb-bar-count cb-bar-count-' + tone + '">' + count + '</span>';
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
      // Telemetry: job opened for scoring
      emitTelemetry("job_opened", {
        surfaceKey: getSearchSurfaceKey(),
        jobTitle: lastJobMeta.title || null,
        company: lastJobMeta.company || null,
        jobUrl: location.href,
      });

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
          { type: "CALIBER_FIT_API", jobText: text, sessionId: sessionInfo.sessionId || undefined },
          (response) => {
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message));
            } else if (!response || !response.ok) {
              var raw = (response && response.error) || "API error";
              // Sanitize session/pipeline errors to a clean prerequisite message
              if (/session|pipeline|SUBMIT_JOB|calibration/i.test(raw)) {
                console.warn("[caliber] prerequisite error (raw):", raw);
                reject(new Error("No active calibration found. Complete your calibration on Caliber first."));
              } else {
                reject(new Error(raw));
              }
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
        // Reset rolling window if search surface changed
        var currentKey = getSearchSurfaceKey();
        if (currentKey !== lastSearchQuery) {
          recentScores = [];
          lastSearchQuery = currentKey;
          resetSessionSignals();
          resetPrescanState();
          // Also clear persisted score history for the old surface
          chrome.runtime.sendMessage({ type: "CALIBER_SCORE_HISTORY_CLEAR" });
          // Clear stale badges from previous surface
          clearAllBadges();
          // Telemetry: new search surface
          emitTelemetry("search_surface_opened", { surfaceKey: currentKey });
          console.debug("[Caliber] search surface changed, reset rolling window + session signals + prescan + persisted history + badges");
          // Re-trigger prescan for the new search surface
          setTimeout(function () { runSearchPrescan(); }, 3000);
          // Re-scan badges + re-attach scroll + observer for new surface
          setTimeout(function () {
            scanAndBadgeVisibleCards();
            startBadgeScrollListener();
            startBadgeListObserver();
          }, 4000);
        }
        // Same surface but URL changed (e.g. opened a job, returned to list)
        // — restore any cached badges and re-attach observer
        // Only runs when surface key is unchanged (else block handles fresh surfaces)
        else if (isSearchResultsPage()) {
          setTimeout(function () {
            restoreBadgesFromCache();
            scanAndBadgeVisibleCards();
            startBadgeScrollListener();
            startBadgeListObserver();
          }, 1500);
        }
        console.debug("[Caliber] URL changed, re-scoring");
        // Delay slightly so LinkedIn DOM settles before extraction
        setTimeout(function () { scoreCurrentJob(true); }, 400);
        return;
      }
      var text = extractJobText();
      if (text && text.length >= MIN_SCORE_CHARS && text !== lastScoredText) {
        scoreCurrentJob(false);
      }
    }, 2500);

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
      }, 1500);
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
    console.log("[Caliber][session][diag] activatePanel() — sessionReady=" + sessionReady +
      ", isSearchPage=" + isSearchResultsPage() + ", url=" + location.href.substring(0, 80));
    chrome.storage.local.set({ caliberPanelEnabled: true });
    showIdle();
    startWatching();
    // If a job description is already visible, score immediately
    var text = extractJobText();
    if (text && text.length >= MIN_SCORE_CHARS) {
      scoreCurrentJob(true);
    }
    // Emit search_surface_opened on activation if on a search page
    if (isSearchResultsPage()) {
      emitTelemetry("search_surface_opened", { surfaceKey: getSearchSurfaceKey() });
    }
    // Trigger pre-scan of visible job cards on search results pages
    // Badge scoring handles both badges AND BST prescan evaluation
    setTimeout(function () { runSearchPrescan(); }, 2000);
  }

  function deactivatePanel() {
    active = false;
    chrome.storage.local.set({ caliberPanelEnabled: false });
    stopWatching();
    removePanel();
    clearAllBadges();
    lastScoredText = "";
    recentScores = [];
    resetSessionSignals();
    resetPrescanState();
    // Clear session check timer but preserve sessionReady (session is still valid)
    clearTimeout(sessionCheckTimer);
    sessionCheckAttempts = 0;
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
    if (msg.type === "CALIBER_SESSION_READY") {
      console.log("[Caliber][session][diag] CALIBER_SESSION_READY received from background");
      sessionReady = true;
      // Cancel any pending session retry — session is now available
      clearTimeout(sessionCheckTimer);
      sessionCheckAttempts = 0;
      // If badge scanning hasn't started yet (was waiting for session), start it now
      if (active && isSearchResultsPage() && !badgeScrollAttached) {
        console.debug("[Caliber][session][diag] session ready — initiating badge scanning");
        startBadgeScanningWithRetry();
      }
      // If badge scoring was queued but stalled due to no-session failures, kick it
      if (active && badgeBatchQueue.length > 0 && !badgeBatchRunning) {
        console.debug("[Caliber][session][diag] session ready — resuming queued badge scoring (" + badgeBatchQueue.length + " in queue)");
        processBadgeQueue();
      }
      // If we have scores but BST hasn't evaluated yet, run it now
      if (active && Object.keys(badgeScoreCache).length >= BST_MIN_WINDOW_SIZE && !prescanDone) {
        console.debug("[Caliber][session][diag] session ready — running deferred BST evaluation");
        evaluateBSTFromBadgeCache();
      }
      sendResponse({ ok: true });
      return false;
    }
  });

  // ─── Panel Markup & Styles ────────────────────────────────

  var PANEL_HTML = [
    '<div class="cb-container">',
    '<div id="cb-tailor-banner" class="cb-tailor-banner" style="display:none">',
    '  <span class="cb-tailor-icon">\u25C6</span>',
    '  <div class="cb-tailor-body">',
    '    <div class="cb-tailor-label">Strong match</div>',
    '    <div class="cb-tailor-actions">',
    '      <button id="cb-tailor-btn" class="cb-tailor-link">Tailor resume for this job \u2192</button>',
    '    </div>',
    '    <div id="cb-tailor-secondary" class="cb-tailor-secondary">',
    '      <button id="cb-pipeline-add-btn" class="cb-pipeline-add-btn" style="display:none">Add to pipeline</button>',
    '      <span id="cb-pipeline-status" class="cb-pipeline-status" style="display:none"></span>',
    '      <a id="cb-pipeline-view" class="cb-pipeline-view-link" style="display:none">View pipeline \u2192</a>',
    '    </div>',
    '  </div>',
    '</div>',
    '<div id="cb-recovery-banner" class="cb-recovery-banner" style="display:none">',
    '  <span class="cb-recovery-icon"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="10.5" cy="10.5" r="7"/><line x1="16" y1="16" x2="21" y2="21"/></svg></span>',
    '  <div class="cb-recovery-body">',
    '    <div id="cb-recovery-reason" class="cb-recovery-reason"></div>',
    '    <div id="cb-recovery-label" class="cb-recovery-label">Try this title instead</div>',
    '    <a id="cb-recovery-link" class="cb-recovery-link" target="_self"></a>',
    '  </div>',
    '</div>',
    '<div class="cb-panel">',
    '  <div class="cb-header">',
    '    <span class="cb-logo">Caliber</span><span class="cb-version">v' + PANEL_VERSION + '</span>',
    '    <div class="cb-header-controls">',
    '      <button id="cb-recalc" class="cb-refresh-btn" aria-label="Refresh score" title="Re-score">\u21BB</button>',
    '      <button id="cb-close" class="cb-close-btn" aria-label="Close">\u00d7</button>',
    '    </div>',
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
    '    <div class="cb-toprow">',
    '      <div class="cb-score-row">',
    '        <span id="cb-score" class="cb-score-num">\u2014</span>',
    '        <span class="cb-score-sep">\u2014</span>',
    '        <span id="cb-decision" class="cb-decision"></span>',
    '      </div>',
    '      <div id="cb-jobtitle" class="cb-job-title"></div>',
    '      <div id="cb-company" class="cb-company-name"></div>',
    '    </div>',
    '    <div id="cb-hrc-section" class="cb-collapsible">',
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

    // Tailor CTA moved to above-sidecard banner (cb-tailor-banner)
    '    <div id="cb-fb-row" class="cb-fb-row">',
    '      <span class="cb-fb-prompt">Helpful?</span>',
    '      <button id="cb-fb-up" class="cb-fb-btn" aria-label="Thumbs up" title="Yes">\u25B2</button>',
    '      <button id="cb-fb-down" class="cb-fb-btn" aria-label="Thumbs down" title="No">\u25BC</button>',
    '      <span class="cb-fb-sep"></span>',
    '      <button id="cb-bug-btn" class="cb-bug-btn" aria-label="Report bug" title="Report bug">Report bug</button>',
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
    '    <div id="cb-bug-panel" class="cb-fb-panel" style="display:none">',
    '      <div class="cb-fb-panel-title">What went wrong?</div>',
    '      <div class="cb-fb-chips">',
    '        <button class="cb-bug-chip" data-bug="wrong_job_detected">Wrong job detected</button>',
    '        <button class="cb-bug-chip" data-bug="score_failed_to_load">Score failed to load</button>',
    '        <button class="cb-bug-chip" data-bug="panel_not_opening">Panel not opening correctly</button>',
    '        <button class="cb-bug-chip" data-bug="content_missing">Content missing or cut off</button>',
    '        <button class="cb-bug-chip" data-bug="action_not_working">Button/action not working</button>',
    '        <button class="cb-bug-chip" data-bug="other">Other</button>',
    '      </div>',
    '      <textarea id="cb-bug-text" class="cb-fb-text" placeholder="Optional details\u2026" rows="2" maxlength="500"></textarea>',
    '      <div class="cb-fb-actions">',
    '        <button id="cb-bug-submit" class="cb-fb-submit">Submit</button>',
    '        <button id="cb-bug-cancel" class="cb-fb-cancel">Cancel</button>',
    '      </div>',
    '    </div>',
    '  </div>',
    '</div>',
    '</div>'
  ].join("\n");

  var PANEL_CSS = [
    "*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }",
    // Container: stacks recovery banner above sidecard
    ".cb-container {",
    "  display: flex; flex-direction: column; gap: 4px; align-items: flex-start;",
    "}",
    // Recovery banner (above sidecard)
    ".cb-recovery-banner {",
    "  width: 320px; background: #161B2E;",
    "  border: 1px solid rgba(96,165,250,0.25); border-radius: 10px;",
    "  box-shadow: 0 2px 8px rgba(0,0,0,0.4);",
    "  padding: 8px 10px; display: flex; align-items: flex-start; gap: 8px;",
    "  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;",
    "  animation: cb-enter 0.2s ease-out;",
    "}",
    ".cb-recovery-icon { flex-shrink: 0; line-height: 0; color: #60A5FA; display: flex; align-items: center; align-self: flex-start; margin-top: 2px; }",
    ".cb-recovery-body { flex: 1; min-width: 0; }",
    ".cb-recovery-reason {",
    "  font-size: 10px; color: #A0AEC0; line-height: 1.3; margin-bottom: 4px;",
    "}",
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
    // Surface-quality banner variant (green accent when strong matches exist)
    ".cb-surface-quality { border-color: rgba(74,222,128,0.3); }",
    ".cb-surface-quality .cb-recovery-icon { color: #4ADE80; }",
    ".cb-surface-quality .cb-recovery-reason { font-size: 11px; color: #D1D5DB; font-weight: 500; margin-bottom: 0; position: relative; }",
    // "Best so far" clickable link
    ".cb-sq-best-link { color: #93C5FD; cursor: pointer; border-bottom: 1px dashed rgba(147,197,253,0.4); }",
    ".cb-sq-best-link:hover { color: #BFDBFE; border-color: #BFDBFE; }",
    // Score number in green
    ".cb-sq-score { color: #4ADE80; font-weight: 700; }",
    // Dropdown explanation panel
    ".cb-sq-dropdown { display: none; position: absolute; left: 0; top: calc(100% + 6px); z-index: 10; width: 240px; background: #1A1F33; border: 1px solid rgba(96,165,250,0.3); border-radius: 8px; padding: 10px 12px; box-shadow: 0 4px 16px rgba(0,0,0,0.5); }",
    ".cb-sq-dropdown-open { display: block; }",
    ".cb-sq-dropdown-title { font-size: 11px; font-weight: 700; color: #93C5FD; margin-bottom: 6px; }",
    ".cb-sq-dropdown-body { font-size: 10px; color: #A0AEC0; line-height: 1.5; }",
    // Scanning indicator
    ".cb-sq-scanning { font-size: 10px; color: #6B7280; font-weight: 400; }",
    ".cb-panel {",
    "  width: 320px; min-width: 320px; max-width: 320px;",
    "  max-height: 90vh; overflow-y: auto; overflow-x: hidden;",
    "  background: #111114; color: #F2F2F2; border-radius: 10px;",
    "  box-shadow: 0 2px 8px rgba(0,0,0,0.6), 0 8px 24px rgba(0,0,0,0.5);",
    "  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;",
    "  font-size: 12px; line-height: 1.4;",
    "  border: 1px solid rgba(255,255,255,0.12);",
    "  contain: layout style;",
    "}",
    "@keyframes cb-enter {",
    "  from { opacity: 0; transform: translateY(8px); }",
    "  to   { opacity: 1; transform: translateY(0); }",
    "}",
    ".cb-panel::-webkit-scrollbar { width: 4px; }",
    ".cb-panel::-webkit-scrollbar-track { background: transparent; }",
    ".cb-panel::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.15); border-radius: 3px; }",
    ".cb-header {",
    "  display: flex; align-items: center; justify-content: space-between;",
    "  padding: 5px 10px; border-bottom: 1px solid rgba(255,255,255,0.08);",
    "}",
    ".cb-logo { font-size: 10px; font-weight: 700; letter-spacing: -0.02em; color: #555; }",
    ".cb-version { font-size: 8px; color: #444; margin-left: 4px; font-weight: 400; }",
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
    ".cb-body { padding: 8px 10px; position: relative; min-height: 80px; }",
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
    // Top row: score dominant, then title, then company
    ".cb-toprow {",
    "  display: flex; flex-direction: column; gap: 2px;",
    "  padding-bottom: 6px; margin-bottom: 3px;",
    "  border-bottom: 1px solid rgba(255,255,255,0.08);",
    "}",
    ".cb-score-row { display: flex; align-items: baseline; gap: 3px; }",
    ".cb-score-num { font-size: 34px; font-weight: 800; letter-spacing: -0.03em; line-height: 1; }",
    ".cb-score-sep { font-size: 18px; font-weight: 300; color: #555; margin: 0 2px; }",
    ".cb-decision {",
    "  font-size: 9px; font-weight: 700; padding: 1px 6px; border-radius: 3px;",
    "  letter-spacing: 0.01em;",
    "}",
    ".cb-decision-excellent { background: rgba(74,222,128,0.2); color: #4ADE80; }",
    ".cb-decision-vstrong { background: rgba(74,222,128,0.15); color: #4ADE80; }",
    ".cb-decision-strong { background: rgba(74,222,128,0.12); color: #6EE7A0; }",
    ".cb-decision-stretch { background: rgba(251,191,36,0.15); color: #FBBF24; }",
    ".cb-decision-adjacent { background: rgba(251,191,36,0.10); color: #D4A017; }",
    ".cb-decision-skip { background: rgba(239,68,68,0.15); color: #EF4444; }",
    ".cb-job-title {",
    "  font-size: 12px; font-weight: 700; color: #F2F2F2;",
    "  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;",
    "}",
    ".cb-company-name {",
    "  font-size: 10px; font-weight: 600; color: #777;",
    "  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;",
    "}",
    // Hiring Reality Check badge
    ".cb-hrc-badge {",
    "  font-size: 9px; font-weight: 700; padding: 1px 5px; border-radius: 3px; margin-left: auto;",
    "}",
    ".cb-hrc-high { background: rgba(74,222,128,0.15); color: #4ADE80; }",
    ".cb-hrc-possible { background: rgba(251,191,36,0.15); color: #FBBF24; }",
    ".cb-hrc-unlikely { background: rgba(239,68,68,0.15); color: #EF4444; }",
    ".cb-hrc-reason { font-size: 10px; color: #999; padding: 1px 0 3px; line-height: 1.35; }",
    // Bottom line text
    ".cb-bltext { font-size: 11px; color: #CFCFCF; line-height: 1.35; padding: 1px 0 3px; }",
    // Collapsible sections
    ".cb-collapsible { border-top: 1px solid rgba(255,255,255,0.06); }",
    ".cb-collapse-toggle {",
    "  display: flex; align-items: center; gap: 4px; width: 100%;",
    "  background: none; border: none; color: #888; cursor: pointer;",
    "  font-size: 10px; font-weight: 600; text-transform: uppercase;",
    "  letter-spacing: 0.04em; padding: 5px 0; text-align: left;",
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
    // Bar indicators (collapsed row signal strength)
    ".cb-bar {",
    "  display: inline-block; width: 40px; height: 4px; border-radius: 2px;",
    "  background: rgba(255,255,255,0.08); margin-left: auto; vertical-align: middle;",
    "  overflow: hidden; flex-shrink: 0;",
    "}",
    ".cb-bar-fill {",
    "  display: block; height: 100%; border-radius: 2px;",
    "  transition: width 0.2s ease;",
    "}",
    ".cb-bar-green  { background: #4ADE80; }",
    ".cb-bar-yellow { background: #FBBF24; }",
    ".cb-bar-count {",
    "  font-size: 9px; font-weight: 600; margin-left: 4px;",
    "  vertical-align: middle; flex-shrink: 0;",
    "}",
    ".cb-bar-count-green  { color: #4ADE80; }",
    ".cb-bar-count-yellow { color: #FBBF24; }",
    ".cb-collapse-body {",
    "  max-height: 0; overflow: hidden;",
    "  transition: max-height 0.2s ease-out;",
    "}",
    ".cb-open .cb-collapse-icon { transform: rotate(90deg); }",
    ".cb-open .cb-collapse-body { max-height: 600px; }",
    // Bullet lists
    ".cb-bullets { list-style: none; padding-bottom: 2px; }",
    ".cb-bullets li {",
    "  position: relative; padding-left: 10px;",
    "  font-size: 11px; color: #CFCFCF; margin-bottom: 1px; line-height: 1.35;",
    "}",
    ".cb-bullets li::before {",
    "  content: '\\2022'; position: absolute; left: 0; color: #4ADE80; font-weight: 700;",
    "}",
    ".cb-stretch li::before { color: #FBBF24; }",

    // Tailor Resume above-sidecard banner
    ".cb-tailor-banner {",
    "  width: 320px; background: #0F2318;",
    "  border: 1px solid rgba(74,222,128,0.25); border-radius: 10px;",
    "  box-shadow: 0 2px 8px rgba(0,0,0,0.4);",
    "  padding: 6px 10px; display: flex; align-items: center; gap: 6px;",
    "  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;",
    "  animation: cb-enter 0.2s ease-out; margin-bottom: 6px;",
    "}",
    ".cb-tailor-icon { font-size: 11px; flex-shrink: 0; line-height: 1; color: #4ADE80; }",
    ".cb-tailor-body { flex: 1; min-width: 0; }",
    ".cb-tailor-label {",
    "  font-size: 9px; font-weight: 600; color: #4ADE80;",
    "  letter-spacing: 0.03em; text-transform: uppercase; margin-bottom: 2px;",
    "}",
    ".cb-tailor-actions {",
    "  display: flex; align-items: baseline; gap: 8px;",
    "  flex-wrap: nowrap; min-width: 0;",
    "}",
    ".cb-tailor-link {",
    "  font-size: 12px; font-weight: 700; color: #86EFAC;",
    "  text-decoration: none; cursor: pointer;",
    "  background: none; border: none; padding: 0; text-align: left;",
    "  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;",
    "  border-bottom: 1px solid rgba(74,222,128,0.3);",
    "  transition: color 0.15s, border-color 0.15s;",
    "}",
    ".cb-tailor-link:hover { color: #BBF7D0; border-color: #BBF7D0; }",
    ".cb-tailor-link:disabled { opacity: 0.6; cursor: default; }",
    ".cb-tailor-secondary {",
    "  display: flex; align-items: center; gap: 8px;",
    "  margin-top: 3px; min-height: 16px;",
    "}",
    ".cb-pipeline-add-btn {",
    "  font-size: 10px; font-weight: 600; color: #888;",
    "  background: none; border: none; padding: 0; cursor: pointer;",
    "  border-bottom: 1px solid rgba(255,255,255,0.1);",
    "  transition: color 0.15s, border-color 0.15s;",
    "}",
    ".cb-pipeline-add-btn:hover { color: #BBF7D0; border-color: rgba(74,222,128,0.3); }",
    ".cb-pipeline-add-btn:disabled { opacity: 0.6; cursor: default; }",
    ".cb-pipeline-status {",
    "  font-size: 10px; font-weight: 600; color: #4ADE80;",
    "}",
    ".cb-pipeline-view-link {",
    "  font-size: 10px; font-weight: 600; color: #555;",
    "  text-decoration: none; cursor: pointer;",
    "  white-space: nowrap; flex-shrink: 0;",
    "  border-bottom: 1px solid transparent;",
    "  transition: color 0.15s, border-color 0.15s;",
    "}",
    ".cb-pipeline-view-link:hover { color: #86EFAC; border-color: rgba(74,222,128,0.3); }",
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
    "  display: flex; align-items: center; gap: 4px;",
    "  padding: 4px 0 1px; margin-top: 3px;",
    "  border-top: 1px solid rgba(255,255,255,0.04);",
    "}",
    ".cb-fb-prompt { font-size: 10px; color: #666; font-weight: 600; }",
    ".cb-fb-btn {",
    "  background: none; border: 1px solid rgba(255,255,255,0.08); border-radius: 4px;",
    "  cursor: pointer; font-size: 9px; padding: 3px 7px; line-height: 1; color: #555;",
    "  transition: background 0.15s, border-color 0.15s, color 0.15s;",
    "}",
    ".cb-fb-btn:hover { background: rgba(255,255,255,0.06); border-color: rgba(255,255,255,0.16); color: #999; }",
    ".cb-fb-sep { width: 1px; height: 14px; background: rgba(255,255,255,0.06); margin: 0 2px; }",
    ".cb-bug-btn {",
    "  background: none; border: 1px solid rgba(255,255,255,0.08); border-radius: 4px;",
    "  cursor: pointer; font-size: 9px; font-weight: 500; padding: 3px 8px; line-height: 1; color: #444;",
    "  transition: background 0.15s, border-color 0.15s, color 0.15s;",
    "}",
    ".cb-bug-btn:hover { background: rgba(255,255,255,0.06); border-color: rgba(255,255,255,0.16); color: #888; }",
    // Feedback detail panel
    ".cb-fb-panel {",
    "  padding: 6px 0 2px; margin-top: 4px;",
    "  border-top: 1px solid rgba(255,255,255,0.04);",
    "}",
    ".cb-fb-panel-title { font-size: 10px; font-weight: 600; color: #888; margin-bottom: 5px; }",
    ".cb-fb-chips { display: flex; flex-wrap: wrap; gap: 4px; margin-bottom: 6px; }",
    ".cb-fb-chip {",
    "  background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.10);",
    "  border-radius: 10px; padding: 2px 8px; font-size: 10px; color: #AFAFAF;",
    "  cursor: pointer; transition: background 0.15s, border-color 0.15s, color 0.15s;",
    "}",
    ".cb-fb-chip:hover { background: rgba(255,255,255,0.10); color: #F2F2F2; }",
    ".cb-fb-chip-selected {",
    "  background: rgba(96,165,250,0.15); border-color: rgba(96,165,250,0.4); color: #93C5FD;",
    "}",
    ".cb-fb-text {",
    "  width: 100%; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08);",
    "  border-radius: 5px; padding: 4px 6px; font-size: 10px; color: #CFCFCF;",
    "  resize: none; font-family: inherit; outline: none;",
    "}",
    ".cb-fb-text::placeholder { color: #555; }",
    ".cb-fb-text:focus { border-color: rgba(96,165,250,0.4); }",
    ".cb-fb-actions { display: flex; gap: 6px; margin-top: 5px; }",
    ".cb-fb-submit {",
    "  background: rgba(74,222,128,0.15); color: #4ADE80; border: none;",
    "  border-radius: 4px; padding: 3px 10px; font-size: 10px; font-weight: 600;",
    "  cursor: pointer; transition: opacity 0.15s;",
    "}",
    ".cb-fb-submit:hover { opacity: 0.85; }",
    ".cb-fb-cancel {",
    "  background: none; color: #666; border: 1px solid rgba(255,255,255,0.08);",
    "  border-radius: 4px; padding: 3px 10px; font-size: 10px; font-weight: 600;",
    "  cursor: pointer; transition: color 0.15s;",
    "}",
    ".cb-fb-cancel:hover { color: #AFAFAF; }",
    // Feedback thanks
    ".cb-fb-thanks {",
    "  font-size: 10px; color: #4ADE80; font-weight: 600;",
    "  padding: 6px 0 2px; margin-top: 4px;",
    "  border-top: 1px solid rgba(255,255,255,0.04);",
    "  text-align: center;",
    "}"
  ].join("\n");
})();
