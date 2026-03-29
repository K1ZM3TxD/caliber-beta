// content_indeed.js — Indeed job description extractor + persistent Caliber panel
// Injected on indeed.com/* pages
// Port of content_linkedin.js adapted for Indeed DOM/surfaces.

(function () {
  var API_BASE = CALIBER_ENV.API_BASE;
  var PANEL_HOST_ID = "caliber-panel-host";
  var PANEL_VERSION = "0.9.34";
  console.log("[caliber][indeed] content_indeed.js v" + PANEL_VERSION + " loaded");

  // ─── Minimum text lengths ─────────────────────────────────
  var MIN_EXTRACT_CHARS = 80;
  var MIN_SCORE_CHARS = 150;

  // ─── Job Text Extraction ──────────────────────────────────

  // Indeed job description selectors — ordered by confidence
  var JOB_DESCRIPTION_SELECTORS = [
    "#jobDescriptionText",
    ".jobsearch-jobDescriptionText",
    ".jobsearch-JobComponent-description",
    ".jobsearch-ViewJobLayout-jobDisplay",
    '[class*="jobsearch-jobDescriptionText"]',
    '[id="jobDescriptionText"]',
    '[data-testid="job-description-text"]',
    '[data-testid="jobDescriptionText"]',
    ".jobsearch-FullWidthView .jobsearch-JobDescriptionSection",
    ".jobsearch-JobDescriptionSection--wrapper",
    '[class*="JobDescription"]',
    '[class*="jobDescription"]',
    ".jobsearch-JobComponent .jobsearch-JobComponent-description",
  ];

  var SHOW_MORE_SELECTORS = [
    'button[aria-label="Show more job description"]',
    'button[data-testid="showMoreButton"]',
    '[class*="DescriptionExpandButton"]',
    '[class*="descriptionExpandButton"]',
    'button[class*="showMore"]',
    'button[class*="show-more"]',
  ];

  function tryExpandDescription() {
    for (var i = 0; i < SHOW_MORE_SELECTORS.length; i++) {
      var btn = document.querySelector(SHOW_MORE_SELECTORS[i]);
      if (btn && btn.offsetParent !== null) {
        try {
          btn.click();
          console.log("[caliber][indeed] expanded description via:", SHOW_MORE_SELECTORS[i]);
          return true;
        } catch (e) {
          console.warn("[caliber][indeed] expand click failed:", e);
        }
      }
    }
    return false;
  }

  function extractJobText() {
    var bestText = "";
    var bestSource = "";

    // Phase 1 — CSS selectors
    for (var i = 0; i < JOB_DESCRIPTION_SELECTORS.length; i++) {
      var sel = JOB_DESCRIPTION_SELECTORS[i];
      var els = document.querySelectorAll(sel);
      for (var j = 0; j < els.length; j++) {
        var el = els[j];
        if (!el) continue;
        var t = (el.innerText || "").trim();
        if (t.length < MIN_EXTRACT_CHARS) t = (el.textContent || "").trim();
        if (t.length > bestText.length) { bestText = t; bestSource = "P1:" + sel; }
      }
    }
    if (bestText.length >= MIN_EXTRACT_CHARS) {
      console.log("[caliber][indeed] P1 extracted " + bestText.length + " chars via: " + bestSource);
      return bestText.replace(/\s+/g, " ");
    }

    // Phase 2 — heading anchor walk
    var anchorPhrases = ["about the job", "job description", "description",
                         "position overview", "responsibilities", "qualifications",
                         "what you'll do", "the role", "role overview", "job summary",
                         "full job description"];
    var anchorCandidates = document.querySelectorAll("h1,h2,h3,h4,h5,h6,span,div,p,strong,b");
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
              console.log("[caliber][indeed] P2 anchor '" + anchorPhrases[p] + "': " + ct.length + " chars");
              return ct.replace(/\s+/g, " ");
            }
            container = container.parentElement;
          }
        }
      }
    }

    // Phase 3 — broad container scan
    var main = document.querySelector('[role="main"]') ||
                document.querySelector(".jobsearch-ViewJobLayout") ||
                document.body;
    var broadEls = main.querySelectorAll(
      "section,article,[role='main'],[role='region']," +
      "[class*='jobsearch'],[class*='job-description'],[class*='JobDescription']," +
      "div>ul,div>ol,div>p"
    );
    for (var k = 0; k < broadEls.length; k++) {
      var st = (broadEls[k].innerText || "").trim();
      if (st.length > bestText.length) { bestText = st; bestSource = "P3:broad"; }
    }
    if (bestText.length >= MIN_EXTRACT_CHARS) {
      console.log("[caliber][indeed] P3 extracted " + bestText.length + " chars");
      return bestText.replace(/\s+/g, " ");
    }

    // Phase 4 — nuclear scan
    var allDivs = document.querySelectorAll("div,section,article,main,aside");
    var nucText = "";
    for (var d = 0; d < allDivs.length; d++) {
      var dt = (allDivs[d].innerText || "").trim();
      if (dt.length > 15000) continue;
      if (dt.length > nucText.length && dt.length >= MIN_SCORE_CHARS) nucText = dt;
    }
    if (nucText.length >= MIN_SCORE_CHARS) {
      console.log("[caliber][indeed] P4 nuclear: " + nucText.length + " chars");
      return nucText.replace(/\s+/g, " ");
    }

    // Phase 5 — user selection fallback
    var userSel = window.getSelection();
    if (userSel && userSel.toString().trim().length >= MIN_EXTRACT_CHARS) {
      return userSel.toString().trim().replace(/\s+/g, " ");
    }

    console.log("[caliber][indeed] ALL PHASES FAILED. URL:", location.href);
    return null;
  }

  function waitForJobDescription(timeoutMs) {
    timeoutMs = timeoutMs || 8000;
    return new Promise(function (resolve) {
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

      var expandTimer = setTimeout(function () {
        if (settled || expandAttempted) return;
        expandAttempted = true;
        if (tryExpandDescription()) {
          setTimeout(function () {
            if (!settled) { var t = extractJobText(); if (t) settle(t); }
          }, 500);
        }
      }, 1500);

      var timer = setTimeout(function () {
        if (!expandAttempted) { expandAttempted = true; tryExpandDescription(); }
        setTimeout(function () { settle(extractJobText()); }, 300);
      }, timeoutMs);

      var observer = new MutationObserver(function () {
        var t = extractJobText(); if (t) settle(t);
      });
      observer.observe(document.body, { childList: true, subtree: true });
    });
  }

  function extractWithRetry(retries, delayMs) {
    return waitForJobDescription(retries * delayMs);
  }

  // ─── Job Metadata Extraction ──────────────────────────────

  var JOB_TITLE_SELECTORS = [
    "h1.jobsearch-JobInfoHeader-title",
    "h1[class*='JobHeader-title']",
    "h1[data-testid='jobsearch-JobInfoHeader-title']",
    ".jobsearch-JobInfoHeader-title",
    '[data-testid="jobTitle"]',
    ".jobTitle h1",
    ".jobsearch-JobInfoHeader h1",
    "h1",
  ];

  var COMPANY_NAME_SELECTORS = [
    "[data-testid='inlineHeader-companyName'] a",
    "[data-testid='inlineHeader-companyName']",
    ".jobsearch-InlineCompanyRating-companyHeader a",
    ".jobsearch-InlineCompanyRating .icl-u-lg-mr--sm a",
    ".jobsearch-JobInfoHeader-companyNameSimple",
    '[class*="CompanyName"] a',
    '[class*="CompanyName"]',
    '[class*="companyName"] a',
    '[class*="companyName"]',
    '[data-testid="companyName"]',
    '[data-testid="companyInfoName"]',
    '[itemprop="hiringOrganization"] [itemprop="name"]',
  ];

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
    return meta;
  }

  // ─── Surface Detection ────────────────────────────────────

  /**
   * Indeed job-page surfaces:
   *   /viewjob?jk=...           direct job page
   *   /jobs?q=...&vjk=...       search results with active job panel (split-pane)
   *   /rc/clk?jk=...            redirect with jk param (description may load async)
   */
  function isIndeedJobPage() {
    var path = location.pathname;
    try {
      var params = new URLSearchParams(location.search);
      if (path === "/viewjob" || path.startsWith("/viewjob")) return true;
      if (/^\/(jobs|rc\/clk|pagead\/clk)/.test(path) && (params.get("vjk") || params.get("jk"))) return true;
    } catch (e) {}
    return false;
  }

  function currentJobIdFromUrl() {
    try {
      var params = new URLSearchParams(location.search);
      var jk = params.get("jk") || params.get("vjk");
      if (jk) return "indeed-" + jk;
    } catch (e) {}
    return null;
  }

  function getSearchKeywords() {
    try { return new URLSearchParams(location.search).get("q") || ""; }
    catch (e) { return ""; }
  }

  function getSearchSurfaceKey() {
    try {
      var url = new URL(location.href);
      var params = url.searchParams;
      return [
        url.pathname,
        params.get("q") || "",
        params.get("l") || "",
        params.get("sc") || "",
        params.get("radius") || "",
        params.get("jt") || "",
        params.get("explvl") || "",
        params.get("remotejob") || "",
      ].join("|").trim().toLowerCase();
    } catch (e) { return ""; }
  }

  // ─── Panel State Variables ────────────────────────────────

  var panelHost = null;
  var shadow = null;
  var active = false;
  var panelMinimized = false;
  var scoring = false;
  var lastScoredText = "";
  var lastScoredScore = 0;
  var lastJobMeta = { title: "", company: "", logoUrl: "" };
  var skeletonTimer = null;
  var watchInterval = null;
  var lastWatchedUrl = location.href;
  var detailObserver = null;
  var detailDebounce = null;

  var sidecardGeneration = 0;
  var sidecardRequestId = 0;
  var sidecardProvisional = false;
  var sidecardResultCache = {};
  var sidecardDisplayedScore = null;

  var FULL_TEXT_THRESHOLD = 400;
  var STABILITY_WAIT_MS = 500;
  var STABILITY_GROWTH_THRESHOLD = 800;
  var PIPELINE_AUTO_SAVE_THRESHOLD = 8.5;

  var recentScores = [];
  var sessionSignals = { jobs_viewed: 0, scores_below_6: 0, highest_score: 0, suggest_shown: false, suggest_clicked: false };
  var feedbackGiven = false;
  var lastFeedbackData = null;

  var sessionReady = false;
  var sessionCheckTimer = null;
  var lastKnownCalibrationTitle = "";
  var lastKnownNearbyRoles = [];

  chrome.storage.local.get(["caliberCalibrationTitle", "caliberNearbyRoles"], function (data) {
    if (data.caliberCalibrationTitle) lastKnownCalibrationTitle = data.caliberCalibrationTitle;
    if (Array.isArray(data.caliberNearbyRoles) && data.caliberNearbyRoles.length > 0) {
      lastKnownNearbyRoles = data.caliberNearbyRoles;
    }
  });

  function resetSessionSignals() {
    sessionSignals = { jobs_viewed: 0, scores_below_6: 0, highest_score: 0, suggest_shown: false, suggest_clicked: false };
    feedbackGiven = false;
    lastFeedbackData = null;
  }

  // ─── Role-Family Clusters ─────────────────────────────────

  var ROLE_FAMILY_CLUSTERS = {
    hospitality: ["bartender","barista","waiter","waitress","server","hostess","host","busser","dishwasher","line cook","sous chef","chef","sommelier","barback"],
    retail: ["cashier","stocker","merchandiser","sales associate","store manager","retail"],
    trades: ["electrician","plumber","welder","carpenter","hvac","mechanic","technician"],
    healthcare_clinical: ["nurse","registered nurse","lpn","cna","phlebotomist","dental hygienist","paramedic","emt","physician","surgeon","pharmacist"],
    transportation: ["truck driver","cdl","forklift","warehouse associate","delivery driver","courier","dispatcher"],
    education_k12: ["teacher","substitute teacher","paraprofessional","school counselor","principal"],
    product_eng: ["product manager","program manager","project manager","product owner","scrum master","agile coach","tpm","technical program"],
    software_eng: ["software engineer","developer","frontend","backend","full stack","fullstack","sre","devops","platform engineer","data engineer","ml engineer","machine learning"],
    design: ["ux designer","ui designer","product designer","graphic designer","visual designer","interaction designer"],
    data_analytics: ["data analyst","data scientist","business analyst","analytics","bi analyst","statistician"],
    finance: ["accountant","cpa","financial analyst","controller","bookkeeper","auditor","tax"],
    legal: ["attorney","lawyer","paralegal","legal counsel","compliance officer"],
    marketing: ["marketing manager","content strategist","seo","growth","brand manager","copywriter","social media manager"],
    sales_bd: ["account executive","business development","sales representative","sdr","bdr","account manager"],
  };

  function getClusterForTitle(title) {
    if (!title) return null;
    var t = title.toLowerCase();
    var clusters = Object.keys(ROLE_FAMILY_CLUSTERS);
    for (var i = 0; i < clusters.length; i++) {
      var kws = ROLE_FAMILY_CLUSTERS[clusters[i]];
      for (var k = 0; k < kws.length; k++) { if (t.indexOf(kws[k]) !== -1) return clusters[i]; }
    }
    return null;
  }

  function isRoleFamilyMismatch(jobTitle, calTitle) {
    if (!jobTitle || !calTitle) return false;
    var jc = getClusterForTitle(jobTitle), cc = getClusterForTitle(calTitle);
    return !!(jc && cc && jc !== cc);
  }

  // ─── Telemetry ────────────────────────────────────────────

  function emitTelemetry(event, fields) {
    try {
      var payload = { event: event, source: "extension_indeed" };
      if (fields) {
        Object.keys(fields).forEach(function (k) {
          if (Object.prototype.hasOwnProperty.call(fields, k)) payload[k] = fields[k];
        });
      }
      chrome.runtime.sendMessage({ type: "CALIBER_TELEMETRY", payload: payload }, function () {
        if (chrome.runtime.lastError) { /* swallow */ }
      });
    } catch (e) { /* swallow */ }
  }

  // ─── Decision Label ───────────────────────────────────────

  function getDecision(score) {
    if (score >= 9.0) return { label: "Excellent Match",      cls: "cb-decision-excellent" };
    if (score >= 8.0) return { label: "Very Strong Match",    cls: "cb-decision-vstrong"   };
    if (score >= 7.0) return { label: "Strong Partial Match", cls: "cb-decision-strong"    };
    if (score >= 6.0) return { label: "Viable Stretch",       cls: "cb-decision-stretch"   };
    if (score >= 5.0) return { label: "Adjacent Background",  cls: "cb-decision-adjacent"  };
    return              { label: "Poor Fit",               cls: "cb-decision-skip"      };
  }

  // ─── Panel State Helpers ──────────────────────────────────

  function setPanelState(stateId) {
    ["cb-idle", "cb-loading", "cb-error", "cb-results"].forEach(function (id) {
      var el = shadow.getElementById(id);
      if (el) el.style.display = (id === stateId) ? "" : "none";
    });
  }

  function showIdle()    { getOrCreatePanel(); setPanelState("cb-idle"); }

  function showLoading(msg) {
    getOrCreatePanel();
    var resultsEl = shadow.getElementById("cb-results");
    var overlayEl = shadow.getElementById("cb-rescore-overlay");
    if (resultsEl && resultsEl.style.display !== "none") {
      if (overlayEl) { overlayEl.querySelector(".cb-overlay-text").textContent = msg || "Rescoring\u2026"; overlayEl.style.display = ""; }
      var loadEl = shadow.getElementById("cb-loading");
      if (loadEl) loadEl.style.display = "none";
    } else {
      shadow.getElementById("cb-loading-text").textContent = msg || "Computing fit score\u2026";
      if (overlayEl) overlayEl.style.display = "none";
      setPanelState("cb-loading");
    }
  }

  function hideOverlay() {
    if (!shadow) return;
    var el = shadow.getElementById("cb-rescore-overlay");
    if (el) el.style.display = "none";
  }

  function showError(msg) {
    getOrCreatePanel(); hideOverlay(); clearSkeletonTimer();
    shadow.getElementById("cb-error-msg").textContent = msg;
    setPanelState("cb-error");
  }

  function clearSkeletonTimer() {
    if (skeletonTimer) { clearTimeout(skeletonTimer); skeletonTimer = null; }
  }

  function showSkeleton(meta) {
    getOrCreatePanel(); hideOverlay(); setPanelState("cb-results");
    sidecardDisplayedScore = null;

    var scoreEl = shadow.getElementById("cb-score");
    scoreEl.textContent = "\u2014"; scoreEl.style.color = "#555"; scoreEl.classList.add("cb-score-pulse");

    var decEl = shadow.getElementById("cb-decision");
    decEl.textContent = "Analyzing fit\u2026"; decEl.className = "cb-decision cb-decision-skeleton";

    shadow.getElementById("cb-jobtitle").textContent  = meta.title   || "";
    shadow.getElementById("cb-company").textContent   = meta.company || "";

    var hcEl = shadow.getElementById("cb-high-conf");
    if (hcEl) hcEl.style.display = "none";

    var hrcSec = shadow.getElementById("cb-hrc-section");
    if (hrcSec) {
      var hrcB = shadow.getElementById("cb-hrc-band");
      if (hrcB) { hrcB.textContent = "\u2014"; hrcB.className = "cb-hrc-badge"; hrcB.style.color = "#555"; }
      var hrcTog = hrcSec.querySelector(".cb-collapse-toggle");
      if (hrcTog) hrcTog.className = "cb-collapse-toggle";
      var hrcR = shadow.getElementById("cb-hrc-reason");
      if (hrcR) hrcR.textContent = "";
      var hrcG = shadow.getElementById("cb-hrc-gap");
      if (hrcG) { hrcG.textContent = ""; hrcG.style.display = "none"; }
    }

    ["cb-supports-count","cb-supports","cb-stretch-count","cb-stretch"].forEach(function (id) {
      var el = shadow.getElementById(id); if (el) el.innerHTML = "";
    });

    var blEl = shadow.getElementById("cb-bottomline"); if (blEl) blEl.textContent = "";
    var blSec = shadow.getElementById("cb-bottomline-section");
    if (blSec) { blSec.style.transition = ""; blSec.style.opacity = "0"; }

    updatePipelineRow("hidden");
  }

  // ─── Pipeline Row ─────────────────────────────────────────

  function updatePipelineRow(state) {
    if (!shadow) return;
    var row     = shadow.getElementById("cb-pipeline-row");
    var addBtn  = shadow.getElementById("cb-pipeline-add");
    var statusEl= shadow.getElementById("cb-pipeline-status");
    var viewLink= shadow.getElementById("cb-pipeline-view");
    if (!row || !addBtn || !statusEl || !viewLink) return;

    addBtn.style.display = "none"; addBtn.disabled = false;
    addBtn.textContent = "Save this job";
    addBtn.classList.remove("cb-pipeline-add-error", "cb-pipeline-add-saved");
    statusEl.style.display = "none"; statusEl.textContent = "";
    viewLink.style.display = "none";

    if (state === "hidden") {
      row.style.visibility = "hidden";
    } else if (state === "add") {
      row.style.visibility = ""; addBtn.style.display = "";
    } else if (state === "in-pipeline" || state === "auto-added") {
      row.style.visibility = "";
      statusEl.textContent = "\u2713 Saved"; statusEl.style.display = "";
      viewLink.style.display = "";
    }
  }

  // ─── Show Results ─────────────────────────────────────────

  function renderList(ul, items) {
    ul.innerHTML = "";
    for (var i = 0; i < items.length; i++) {
      var li = document.createElement("li"); li.textContent = items[i]; ul.appendChild(li);
    }
  }

  function renderBarIndicator(count, tone) {
    if (count === 0) return "";
    var pct = Math.min(count / 5, 1) * 100;
    return '<span class="cb-bar"><span class="cb-bar-fill cb-bar-' + tone + '" style="width:' + pct + '%"></span></span>' +
           '<span class="cb-bar-count cb-bar-count-' + tone + '">' + count + '</span>';
  }

  function showResults(data, scoreMeta) {
    scoreMeta = scoreMeta || {};
    getOrCreatePanel(); hideOverlay(); clearSkeletonTimer();
    sidecardProvisional = !!scoreMeta.provisional;

    var rawScore  = Number(data.score_0_to_10) || 0;
    var hrc       = data.hiring_reality_check;
    var hrcBand   = (hrc && hrc.band) ? hrc.band : null;
    var score     = rawScore;
    lastScoredScore = score;

    // Role-family mismatch override
    if (isRoleFamilyMismatch(lastJobMeta.title || "", data.calibration_title || "")) {
      hrc = { band: "Unlikely", reason: "Role-family mismatch \u2014 job is in a different career family" };
      hrcBand = "Unlikely";
    }

    var displayScore = Math.round(score * 10) / 10;
    var decision     = getDecision(displayScore);

    // Score number
    var scoreEl = shadow.getElementById("cb-score");
    scoreEl.classList.remove("cb-score-pulse");
    scoreEl.textContent = displayScore.toFixed(1);
    scoreEl.style.color = displayScore >= 7 ? "#4ADE80" : displayScore >= 6 ? "#FBBF24" : "#EF4444";

    // Provisional indicator
    var provEl = shadow.getElementById("cb-provisional");
    if (!provEl) {
      provEl = document.createElement("span"); provEl.id = "cb-provisional";
      provEl.style.cssText = "font-size:9px;color:#888;font-style:italic;margin-left:4px;vertical-align:super;";
      scoreEl.parentNode.insertBefore(provEl, scoreEl.nextSibling);
    }
    provEl.textContent = sidecardProvisional ? "(preview)" : "";
    provEl.style.display = sidecardProvisional ? "" : "none";

    // Score entrance animation (only when score actually changed)
    if (sidecardDisplayedScore === null || sidecardDisplayedScore !== displayScore) {
      scoreEl.classList.remove("cb-score-reveal");
      void scoreEl.offsetWidth;
      scoreEl.classList.add("cb-score-reveal");
    }
    sidecardDisplayedScore = displayScore;

    var decEl = shadow.getElementById("cb-decision");
    decEl.textContent = decision.label; decEl.className = "cb-decision " + decision.cls;

    shadow.getElementById("cb-jobtitle").textContent  = lastJobMeta.title   || "";
    shadow.getElementById("cb-company").textContent   = lastJobMeta.company || "";

    // High-confidence glow for 8.5+
    var hcEl    = shadow.getElementById("cb-high-conf");
    var panelEl = shadow.querySelector(".cb-panel");
    if (displayScore >= 8.5) {
      if (hcEl)    hcEl.style.display = "";
      if (panelEl) panelEl.classList.add("cb-panel-glow");
    } else {
      if (hcEl)    hcEl.style.display = "none";
      if (panelEl) panelEl.classList.remove("cb-panel-glow");
    }

    // Restore section visibility
    ["cb-supports-section","cb-stretch-section","cb-fb-row"].forEach(function (id) {
      var el = shadow.getElementById(id); if (el) el.style.display = "";
    });

    // Hiring Reality Check
    var hrcSec = shadow.getElementById("cb-hrc-section");
    var hrcB   = shadow.getElementById("cb-hrc-band");
    var hrcR   = shadow.getElementById("cb-hrc-reason");
    var hrcTog = hrcSec.querySelector(".cb-collapse-toggle");
    if (hrc && hrc.band) {
      hrcB.textContent = hrc.band; hrcB.className = "cb-hrc-badge";
      hrcTog.className = "cb-collapse-toggle";
      if (hrc.band === "High") {
        hrcB.classList.add("cb-hrc-high"); hrcTog.classList.add("cb-toggle-green"); hrcR.style.color = "#6EE7A0";
      } else if (hrc.band === "Possible") {
        hrcB.classList.add("cb-hrc-possible"); hrcTog.classList.add("cb-toggle-yellow"); hrcR.style.color = "#D4A017";
      } else {
        hrcB.classList.add("cb-hrc-unlikely"); hrcTog.classList.add("cb-toggle-red"); hrcR.style.color = "#F87171";
      }
      hrcR.textContent = hrc.reason || "";
    } else {
      hrcB.textContent = "\u2014"; hrcB.className = "cb-hrc-badge"; hrcB.style.color = "#555";
      hrcTog.className = "cb-collapse-toggle"; hrcR.textContent = "";
    }
    var hrcG = shadow.getElementById("cb-hrc-gap");
    if (hrcG) {
      if (hrc && hrc.execution_evidence_gap) {
        hrcG.textContent = hrc.execution_evidence_gap; hrcG.style.display = "";
      } else { hrcG.textContent = ""; hrcG.style.display = "none"; }
    }
    hrcSec.style.display = "";

    // Supports / Stretch / Executive Summary
    var supItems = data.supports_fit || [];
    renderList(shadow.getElementById("cb-supports"), supItems);
    var supCnt = shadow.getElementById("cb-supports-count");
    if (supCnt) supCnt.innerHTML = renderBarIndicator(supItems.length, "green");

    var strItems = data.stretch_factors || [];
    renderList(shadow.getElementById("cb-stretch"), strItems);
    var strCnt = shadow.getElementById("cb-stretch-count");
    if (strCnt) strCnt.innerHTML = renderBarIndicator(strItems.length, "yellow");

    var blEl  = shadow.getElementById("cb-bottomline");
    blEl.textContent = data.bottom_line_2s || "";
    var blSec = shadow.getElementById("cb-bottomline-section");
    if (blSec) {
      blSec.style.opacity = "0"; blSec.style.display = "";
      setTimeout(function () { blSec.style.transition = "opacity 0.35s ease"; blSec.style.opacity = "1"; }, 350);
    }

    // Pipeline check
    var pipeGen = sidecardGeneration;
    var pipeUrl = location.href;
    updatePipelineRow("hidden");
    chrome.runtime.sendMessage({ type: "CALIBER_PIPELINE_CHECK", jobUrl: pipeUrl }, function (resp) {
      if (sidecardGeneration !== pipeGen) return;
      if (chrome.runtime.lastError) { updatePipelineRow("add"); return; }
      if (resp && resp.exists) {
        updatePipelineRow("in-pipeline");
      } else if (score >= PIPELINE_AUTO_SAVE_THRESHOLD) {
        updatePipelineRow("hidden"); // auto-save callback will set state
      } else {
        updatePipelineRow("add");
      }
    });

    // Score history
    recentScores.push({ score: score, title: lastJobMeta.title || "", nearbyRoles: data.nearby_roles || [], calibrationTitle: data.calibration_title || "", surfaceKey: getSearchSurfaceKey() });
    if (recentScores.length > 10) recentScores = recentScores.slice(-10);
    chrome.runtime.sendMessage({ type: "CALIBER_SCORE_HISTORY_PUSH", score: score, title: lastJobMeta.title || "", nearbyRoles: data.nearby_roles || [], calibrationTitle: data.calibration_title || "", surfaceKey: getSearchSurfaceKey() }, function () {});

    // Behavioral signals
    sessionSignals.jobs_viewed++;
    if (score < 6) sessionSignals.scores_below_6++;
    if (score > sessionSignals.highest_score) sessionSignals.highest_score = score;

    // Telemetry
    if (score >= 7.0) {
      emitTelemetry("strong_match_viewed", { surfaceKey: getSearchSurfaceKey(), jobTitle: lastJobMeta.title || null, company: lastJobMeta.company || null, jobUrl: location.href, score: score, scoreSource: "sidecard_full", meta: { searchQuery: getSearchKeywords() } });
    }

    // Auto-save ≥8.5
    if (score >= PIPELINE_AUTO_SAVE_THRESHOLD) {
      var aTitle = lastJobMeta.title || "Untitled Position";
      var aCo    = lastJobMeta.company || "Unknown Company";
      var aUrl   = location.href;
      var aGen   = sidecardGeneration;
      chrome.runtime.sendMessage({ type: "CALIBER_PIPELINE_SAVE", jobTitle: aTitle, company: aCo, jobUrl: aUrl, score: score, jobText: (extractJobText() || "").slice(0, 15000) }, function (resp) {
        if (sidecardGeneration !== aGen || chrome.runtime.lastError) { updatePipelineRow("add"); return; }
        if (resp && resp.ok) {
          updatePipelineRow("auto-added");
          emitTelemetry("pipeline_save", { surfaceKey: getSearchSurfaceKey(), jobTitle: aTitle, company: aCo, jobUrl: aUrl, score: score, meta: { searchQuery: getSearchKeywords(), trigger: "auto_8.5" } });
        } else {
          updatePipelineRow("add");
        }
      });
    }

    // Feedback context snapshot
    lastFeedbackData = { score: score, decision: decision.label, company: lastJobMeta.company || null, jobTitle: lastJobMeta.title || null, hrcBand: hrcBand, suggestedTitle: data.calibration_title || null };

    // Reset feedback UI
    var fbRow   = shadow.getElementById("cb-fb-row");
    var fbPanel = shadow.getElementById("cb-fb-panel");
    var bugPanel= shadow.getElementById("cb-bug-panel");
    if (fbPanel)  fbPanel.style.display  = "none";
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

    // Row-badge backfill omitted: overlays are non-primary / hidden per product truth.
    // backfillBadgeFromSidecard helpers remain available for future use.

    setPanelState("cb-results");
  }

  // ─── Feedback ─────────────────────────────────────────────

  function handleThumbsUp()   { if (feedbackGiven) return; feedbackGiven = true; sendFeedback("thumbs_up", null, null); showFeedbackConfirm(); }
  function handleThumbsDown() {
    if (feedbackGiven) return;
    var p = shadow.getElementById("cb-fb-panel"); if (p) p.style.display = "";
    var r = shadow.getElementById("cb-fb-row");   if (r) r.style.display = "none";
  }
  function handleFeedbackSubmit() {
    feedbackGiven = true;
    var sel = shadow.querySelectorAll(".cb-fb-chip-selected");
    var reason = sel.length > 0 ? sel[0].getAttribute("data-reason") : null;
    var comment = (shadow.getElementById("cb-fb-text").value || "").trim();
    sendFeedback("thumbs_down", reason, comment || null);
    shadow.getElementById("cb-fb-panel").style.display = "none";
    showFeedbackConfirm();
  }
  function handleFeedbackCancel() {
    shadow.getElementById("cb-fb-panel").style.display = "none";
    var r = shadow.getElementById("cb-fb-row"); if (r) r.style.display = "";
  }
  function handleBugOpen() {
    var p = shadow.getElementById("cb-bug-panel"); if (p) p.style.display = "";
    var r = shadow.getElementById("cb-fb-row");    if (r) r.style.display = "none";
    var f = shadow.getElementById("cb-fb-panel");  if (f) f.style.display = "none";
  }
  function handleBugSubmit() {
    var sel = shadow.querySelectorAll(".cb-bug-chip.cb-fb-chip-selected");
    var cat = sel.length > 0 ? sel[0].getAttribute("data-bug") : null;
    var comment = (shadow.getElementById("cb-bug-text").value || "").trim();
    sendBugReport(cat, comment || null);
    shadow.getElementById("cb-bug-panel").style.display = "none";
    showFeedbackConfirm();
  }
  function handleBugCancel() {
    shadow.getElementById("cb-bug-panel").style.display = "none";
    var r = shadow.getElementById("cb-fb-row"); if (r) r.style.display = "";
  }
  function showFeedbackConfirm() {
    var r = shadow.getElementById("cb-fb-row");
    if (r) r.innerHTML = '<span class="cb-fb-thanks">Thanks for the feedback</span>';
  }

  function _buildFeedbackPayload(type, reason, comment) {
    var d = lastFeedbackData || {};
    return {
      surface: "extension", site: "indeed",
      company_name: d.company || null, job_title: d.jobTitle || null,
      search_title: getSearchKeywords() || null, surface_key: getSearchSurfaceKey() || null,
      job_url: location.href || null, calibration_title_direction: null,
      fit_score: d.score != null ? d.score : null, decision_label: d.decision || null,
      hiring_reality_band: d.hrcBand || null, better_search_title_suggestion: d.suggestedTitle || null,
      feedback_type: type, feedback_reason: reason, optional_comment: comment,
      behavioral_signals: { jobs_viewed_in_session: sessionSignals.jobs_viewed, scores_below_6_count: sessionSignals.scores_below_6, highest_score_seen: sessionSignals.highest_score, better_title_suggestion_shown: sessionSignals.suggest_shown, better_title_suggestion_clicked: sessionSignals.suggest_clicked },
    };
  }
  function sendFeedback(type, reason, comment) {
    chrome.runtime.sendMessage({ type: "CALIBER_FEEDBACK", payload: _buildFeedbackPayload(type, reason, comment) }, function () {
      console.debug("[caliber][indeed] feedback sent:", type, reason);
    });
  }
  function sendBugReport(cat, comment) {
    var p = _buildFeedbackPayload("bug_report", null, comment); p.bug_category = cat;
    chrome.runtime.sendMessage({ type: "CALIBER_FEEDBACK", payload: p }, function () {
      console.debug("[caliber][indeed] bug report sent:", cat);
    });
  }

  // ─── Row-Badge Backfill (Phase 2) ─────────────────────────
  // Reactive only: badges appear on a card only after the user has clicked it
  // and a full-description sidecard score has been produced. No prescan, no
  // per-card fetches, no snippet-only scoring. See KERNEL.md invariant 2026-03-29.

  var badgeStylesInjected = false;

  function ensureBadgeStyles() {
    if (badgeStylesInjected) return;
    badgeStylesInjected = true;
    var s = document.createElement("style");
    s.id = "caliber-badge-styles";
    s.textContent = [
      ".caliber-row-badge-wrap { position:absolute; top:6px; right:6px; z-index:9; pointer-events:none; }",
      ".caliber-row-badge { display:inline-block; font-size:10px; font-weight:700; line-height:1; padding:2px 6px; border-radius:4px; border-width:1px; border-style:solid; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif; }",
    ].join("\n");
    (document.head || document.documentElement).appendChild(s);
  }

  function findCardByJobKey(jk) {
    if (!jk) return null;
    try {
      var escaped = typeof CSS !== "undefined" && CSS.escape ? CSS.escape(jk) : jk.replace(/["\\]/g, "");
      return document.querySelector('[data-jk="' + escaped + '"]');
    } catch (e) { return null; }
  }

  function setBadgeOnCard(cardEl, data) {
    if (!cardEl || !data) return;
    ensureBadgeStyles();
    var ds    = Math.round((Number(data.score_0_to_10) || 0) * 10) / 10;
    var color = ds >= 7 ? "#4ADE80" : ds >= 6 ? "#FBBF24" : "#EF4444";
    var bg    = ds >= 7 ? "rgba(74,222,128,0.12)" : ds >= 6 ? "rgba(251,191,36,0.13)" : "rgba(239,68,68,0.12)";
    var bdr   = ds >= 7 ? "rgba(74,222,128,0.30)" : ds >= 6 ? "rgba(251,191,36,0.30)" : "rgba(239,68,68,0.30)";
    var inlineStyle = "color:" + color + ";background:" + bg + ";border-color:" + bdr + ";";
    var existing = cardEl.querySelector(".caliber-row-badge");
    if (existing) {
      existing.textContent = ds.toFixed(1);
      existing.style.cssText = inlineStyle;
      return;
    }
    var pos = window.getComputedStyle(cardEl).position;
    if (pos === "static") cardEl.style.position = "relative";
    var wrap  = document.createElement("div");
    wrap.className = "caliber-row-badge-wrap";
    var badge = document.createElement("span");
    badge.className = "caliber-row-badge";
    badge.textContent = ds.toFixed(1);
    badge.style.cssText = inlineStyle;
    wrap.appendChild(badge);
    cardEl.appendChild(wrap);
  }

  function backfillBadgeFromSidecard(data) {
    if (!data) return;
    try {
      var params = new URLSearchParams(location.search);
      var jk = params.get("jk") || params.get("vjk");
      if (!jk) return;
      var cardEl = findCardByJobKey(jk);
      if (cardEl) setBadgeOnCard(cardEl, data);
    } catch (e) {}
  }

  // ─── Scoring ──────────────────────────────────────────────

  async function scoreCurrentJob(force) {
    if (scoring) return;

    // Skip if stable complete result already displayed for this job
    if (!force) {
      var _jid = currentJobIdFromUrl();
      if (_jid && sidecardResultCache[_jid] && !sidecardProvisional) {
        var _res = shadow && shadow.getElementById("cb-results");
        if (_res && _res.style.display !== "none") return;
      }
    }

    scoring = true;
    clearSkeletonTimer();

    sidecardRequestId++;
    var myReqId  = sidecardRequestId;
    var myGen    = sidecardGeneration;
    var cycleStart = Date.now();

    console.debug("[caliber][indeed] score START reqId=" + myReqId + " gen=" + myGen);

    try {
      lastJobMeta = extractJobMeta();

      var cacheJobId  = currentJobIdFromUrl();
      var cachedResult = cacheJobId ? sidecardResultCache[cacheJobId] : null;
      var usedCache   = false;

      var resultsEl = shadow && shadow.getElementById("cb-results");
      var isRescore = resultsEl && resultsEl.style.display !== "none";

      if (cachedResult) {
        showResults(cachedResult.data, Object.assign({}, cachedResult.scoreMeta, { fromCache: true }));
        usedCache = true;
      } else if (isRescore) {
        showLoading("Rescoring\u2026");
      } else {
        showSkeleton(lastJobMeta);
      }

      // "Still analyzing…" fallback after 2.5s
      if (!isRescore && !usedCache) {
        skeletonTimer = setTimeout(function () {
          if (!shadow) return;
          var decEl = shadow.getElementById("cb-decision");
          if (decEl && decEl.classList.contains("cb-decision-skeleton")) decEl.textContent = "Still analyzing this role\u2026";
        }, 2500);
      }

      // Discover session
      var sessionInfo = await new Promise(function (resolve, reject) {
        chrome.runtime.sendMessage({ type: "CALIBER_SESSION_DISCOVER" }, function (response) {
          if (chrome.runtime.lastError) { reject(new Error(chrome.runtime.lastError.message)); return; }
          if (!response || !response.ok) { reject(new Error((response && response.error) || "No active Caliber session found.")); return; }
          resolve(response);
        });
      });

      if (!sessionInfo.profileComplete) { showError("Calibration incomplete. Finish the calibration prompts on Caliber first."); return; }
      if (sidecardGeneration !== myGen) return;

      // Refresh metadata after session round-trip
      lastJobMeta = extractJobMeta();
      if (shadow) {
        var skT = shadow.getElementById("cb-jobtitle"); if (skT && lastJobMeta.title)   skT.textContent = lastJobMeta.title;
        var skC = shadow.getElementById("cb-company");  if (skC && lastJobMeta.company) skC.textContent = lastJobMeta.company;
      }

      emitTelemetry("job_opened", { surfaceKey: getSearchSurfaceKey(), jobTitle: lastJobMeta.title || null, company: lastJobMeta.company || null, jobUrl: location.href, meta: {} });

      var rawText = await waitForJobDescription(8000);
      if (!rawText || rawText.length < MIN_SCORE_CHARS) {
        showError(!rawText
          ? "Couldn\u2019t detect the job description on this page. Try scrolling down or clicking the job again."
          : "Job description too short (" + rawText.length + " chars). Try expanding \u2018Show more\u2019 or highlighting more text.");
        return;
      }

      // Text stability: wait for DOM to finish hydrating
      var text = rawText;
      var stabilitySource = "initial";
      if (text.length < STABILITY_GROWTH_THRESHOLD) {
        tryExpandDescription();
        await new Promise(function (r) { setTimeout(r, STABILITY_WAIT_MS); });
        var stableText = extractJobText();
        if (stableText) {
          stableText = stableText.replace(/\s+/g, " ");
          if (stableText.length > text.length) { text = stableText; stabilitySource = "stability_regrow"; }
          else { stabilitySource = "stability_stable"; }
        }
      } else {
        stabilitySource = "full_immediate";
      }

      if (sidecardGeneration !== myGen) return;

      var extractionPhase = text.length >= FULL_TEXT_THRESHOLD ? "full" : "partial";
      var isProvisional   = extractionPhase === "partial";

      if (!force && text === lastScoredText) {
        if (!usedCache && cachedResult) showResults(cachedResult.data, Object.assign({}, cachedResult.scoreMeta, { fromCache: true }));
        clearSkeletonTimer(); hideOverlay(); return;
      }
      lastScoredText = text;

      var data = await new Promise(function (resolve, reject) {
        chrome.runtime.sendMessage({ type: "CALIBER_FIT_API", jobText: text, sessionId: sessionInfo.sessionId || undefined }, function (response) {
          if (chrome.runtime.lastError) { reject(new Error(chrome.runtime.lastError.message)); return; }
          if (!response || !response.ok) {
            var raw = (response && response.error) || "API error";
            if (/session|pipeline|SUBMIT_JOB|calibration/i.test(raw)) { reject(new Error("No active calibration found. Complete your calibration on Caliber first.")); }
            else { reject(new Error(raw)); }
            return;
          }
          resolve(response.data);
        });
      });

      if (sidecardGeneration !== myGen) return;
      if (sidecardRequestId  !== myReqId) return;

      console.debug("[caliber][indeed] RESULT reqId=" + myReqId + " score=" + (Number(data.score_0_to_10)||0).toFixed(1) + " elapsed=" + (Date.now()-cycleStart) + "ms");

      var scoreMeta = { provisional: isProvisional, extractionPhase: extractionPhase, stabilitySource: stabilitySource, textLen: text.length, requestId: myReqId };

      if (cacheJobId) {
        sidecardResultCache[cacheJobId] = { data: data, scoreMeta: scoreMeta, displayScore: Math.round((Number(data.score_0_to_10)||0) * 10) / 10 };
      }

      showResults(data, scoreMeta);

      // Persist calibration context updates
      if (data.calibration_title) { lastKnownCalibrationTitle = data.calibration_title; chrome.storage.local.set({ caliberCalibrationTitle: data.calibration_title }); }
      if (Array.isArray(data.nearby_roles) && data.nearby_roles.length > 0) { lastKnownNearbyRoles = data.nearby_roles; chrome.storage.local.set({ caliberNearbyRoles: data.nearby_roles }); }

    } catch (err) {
      if (sidecardGeneration !== myGen) return;
      console.warn("[caliber][indeed] scoring error:", err.message);
      showError(err.message || "Scoring failed. Please try again.");
    } finally {
      scoring = false;
    }
  }

  // ─── Panel DOM ────────────────────────────────────────────

  function getOrCreatePanel() {
    if (shadow) return shadow;

    panelHost = document.createElement("div");
    panelHost.id = PANEL_HOST_ID;
    panelHost.style.cssText = "position:fixed!important;bottom:20px!important;right:20px!important;z-index:2147483647!important;";
    shadow = panelHost.attachShadow({ mode: "closed" });

    var styleEl = document.createElement("style");
    styleEl.textContent = PANEL_CSS;
    shadow.appendChild(styleEl);

    var wrapper = document.createElement("div");
    wrapper.innerHTML = PANEL_HTML;
    shadow.appendChild(wrapper.firstElementChild);

    document.body.appendChild(panelHost);

    // Entrance animation
    var panelEl = shadow.querySelector(".cb-panel");
    if (panelEl) {
      panelEl.style.animation = "cb-enter 0.2s ease-out";
      panelEl.addEventListener("animationend", function () { panelEl.style.animation = "none"; }, { once: true });
    }

    // Wire controls
    shadow.getElementById("cb-close").addEventListener("click", deactivatePanel);
    shadow.getElementById("cb-minimize").addEventListener("click", toggleMinimize);
    shadow.getElementById("cb-recalc").addEventListener("click", function () { scoreCurrentJob(true); });
    shadow.getElementById("cb-retry").addEventListener("click",  function () { scoreCurrentJob(true); });

    shadow.querySelectorAll(".cb-collapse-toggle").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var sec = btn.closest(".cb-collapsible"); if (sec) sec.classList.toggle("cb-open");
      });
    });

    shadow.getElementById("cb-fb-up").addEventListener("click",     handleThumbsUp);
    shadow.getElementById("cb-fb-down").addEventListener("click",   handleThumbsDown);
    shadow.getElementById("cb-fb-submit").addEventListener("click", handleFeedbackSubmit);
    shadow.getElementById("cb-fb-cancel").addEventListener("click", handleFeedbackCancel);
    shadow.querySelector("#cb-fb-panel").querySelectorAll(".cb-fb-chip").forEach(function (c) {
      c.addEventListener("click", function () { c.classList.toggle("cb-fb-chip-selected"); });
    });

    shadow.getElementById("cb-bug-btn").addEventListener("click",    handleBugOpen);
    shadow.getElementById("cb-bug-submit").addEventListener("click", handleBugSubmit);
    shadow.getElementById("cb-bug-cancel").addEventListener("click", handleBugCancel);
    shadow.querySelector("#cb-bug-panel").querySelectorAll(".cb-bug-chip").forEach(function (c) {
      c.addEventListener("click", function () { c.classList.toggle("cb-fb-chip-selected"); });
    });

    // Pipeline save button
    shadow.getElementById("cb-pipeline-add").addEventListener("click", function () {
      var addBtn = shadow.getElementById("cb-pipeline-add");
      if (addBtn) { addBtn.textContent = "Saving\u2026"; addBtn.disabled = true; addBtn.classList.remove("cb-pipeline-add-error"); }
      var freshMeta  = extractJobMeta();
      var saveTitle  = lastJobMeta.title   || freshMeta.title   || "Untitled Position";
      var saveCompany= lastJobMeta.company || freshMeta.company || "Unknown Company";
      var saveUrl    = location.href;
      var saveScore  = lastScoredScore || 0;
      var saveGen    = sidecardGeneration;
      chrome.runtime.sendMessage({ type: "CALIBER_PIPELINE_SAVE", jobTitle: saveTitle, company: saveCompany, jobUrl: saveUrl, score: saveScore, jobText: (extractJobText() || "").slice(0, 15000) }, function (resp) {
        if (chrome.runtime.lastError || sidecardGeneration !== saveGen) {
          if (addBtn) { addBtn.textContent = "Save failed \u2014 retry"; addBtn.disabled = false; addBtn.classList.add("cb-pipeline-add-error"); }
          return;
        }
        if (resp && resp.ok) {
          if (addBtn) { addBtn.textContent = "Saved \u2713"; addBtn.disabled = true; addBtn.classList.add("cb-pipeline-add-saved"); }
          setTimeout(function () { if (addBtn) addBtn.classList.remove("cb-pipeline-add-saved"); updatePipelineRow("in-pipeline"); }, 900);
          emitTelemetry("pipeline_save", { surfaceKey: getSearchSurfaceKey(), jobTitle: saveTitle, company: saveCompany, jobUrl: saveUrl, score: saveScore, meta: { searchQuery: getSearchKeywords(), trigger: "manual_sidecard" } });
        } else {
          if (addBtn) { addBtn.textContent = "Save failed \u2014 retry"; addBtn.disabled = false; addBtn.classList.add("cb-pipeline-add-error"); }
        }
      });
    });

    // Pipeline view link
    shadow.getElementById("cb-pipeline-view").addEventListener("click", function (e) {
      e.preventDefault();
      chrome.runtime.sendMessage({ type: "CALIBER_OPEN_PIPELINE" });
    });

    return shadow;
  }

  function toggleMinimize() {
    if (!shadow) return;
    var container = shadow.querySelector(".cb-container");
    if (!container) return;
    panelMinimized = !panelMinimized;
    container.classList.toggle("cb-minimized", panelMinimized);
    var btn = shadow.getElementById("cb-minimize");
    if (btn) { btn.textContent = panelMinimized ? "+" : "\u2212"; btn.title = panelMinimized ? "Expand" : "Minimize"; }
  }

  function removePanel() {
    if (panelHost && panelHost.parentNode) panelHost.parentNode.removeChild(panelHost);
    panelHost = null; shadow = null; panelMinimized = false;
  }

  // ─── SPA Navigation Watching ──────────────────────────────

  function startWatching() {
    if (watchInterval) return;
    watchInterval = setInterval(function () {
      if (!active || scoring) return;
      if (location.href !== lastWatchedUrl) {
        lastWatchedUrl = location.href;
        lastScoredText = "";
        sidecardGeneration++;
        sidecardDisplayedScore = null;
        recentScores = [];
        resetSessionSignals();
        // Reset detail observer so it re-attaches to the new detail pane DOM node
        if (detailObserver) { detailObserver.disconnect(); detailObserver = null; }
        console.debug("[caliber][indeed] URL changed, re-scoring. gen=" + sidecardGeneration);
        setTimeout(function () {
          if (isIndeedJobPage()) { tryObserveDetailPane(); scoreCurrentJob(true); }
          else showIdle();
        }, 500);
        return;
      }
      var text = extractJobText();
      if (text && text.length >= MIN_SCORE_CHARS && text !== lastScoredText) {
        scoreCurrentJob(false);
      }
    }, 2500);
    tryObserveDetailPane();
  }

  function tryObserveDetailPane() {
    if (detailObserver) return;
    var target =
      document.getElementById("jobDescriptionText") ||
      document.querySelector(".jobsearch-JobComponent-description") ||
      document.querySelector('[data-testid="job-description-text"]') ||
      document.querySelector(".jobsearch-ViewJobLayout") ||
      document.querySelector('[role="main"]');
    if (!target) { console.debug("[caliber][indeed] no detail pane found for MutationObserver"); return; }

    detailObserver = new MutationObserver(function () {
      if (!active || scoring) return;
      var jid = currentJobIdFromUrl();
      if (jid && sidecardResultCache[jid] && !sidecardProvisional) {
        var res = shadow && shadow.getElementById("cb-results");
        if (res && res.style.display !== "none") return;
      }
      clearTimeout(detailDebounce);
      detailDebounce = setTimeout(function () {
        var text = extractJobText();
        if (text && text.length >= MIN_SCORE_CHARS && text !== lastScoredText) scoreCurrentJob(false);
      }, 1500);
    });
    detailObserver.observe(target, { childList: true, subtree: true });
    console.debug("[caliber][indeed] MutationObserver attached to detail pane");
  }

  function stopWatching() {
    if (watchInterval) { clearInterval(watchInterval); watchInterval = null; }
    if (detailObserver) { detailObserver.disconnect(); detailObserver = null; }
    clearTimeout(detailDebounce);
  }

  // ─── First-card preload ────────────────────────────────────
  // On an Indeed search surface where no job is yet selected (no vjk/jk in
  // URL), poll briefly for Indeed to auto-select the first card (Indeed
  // updates the vjk param within ~500ms). Once detected, trigger one score
  // cycle. One-shot per activation; does not loop cards or auto-navigate.

  var firstCardPreloaded = false;

  function isIndeedSearchSurface() {
    try {
      var path = location.pathname;
      var params = new URLSearchParams(location.search);
      return /^\/jobs/.test(path) && (params.get("q") || params.get("l")) && !params.get("vjk") && !params.get("jk");
    } catch (e) { return false; }
  }

  function tryFirstCardPreload() {
    if (firstCardPreloaded) return;
    var attempts = 0;
    var pollId = setInterval(function () {
      attempts++;
      if (attempts > 10 || !active) { clearInterval(pollId); return; }
      if (isIndeedJobPage()) {
        clearInterval(pollId);
        if (!firstCardPreloaded) {
          firstCardPreloaded = true;
          console.debug("[caliber][indeed] first-card preload: job detected, scoring");
          setTimeout(function () { if (active && !scoring) { tryObserveDetailPane(); scoreCurrentJob(true); } }, 400);
        }
      }
    }, 500);
  }

  // ─── Activation / Deactivation ────────────────────────────

  function activatePanel() {
    if (active) { scoreCurrentJob(true); return; }
    var onJobPage = isIndeedJobPage();
    var onSearchSurface = !onJobPage && isIndeedSearchSurface();
    if (!onJobPage && !onSearchSurface) { console.debug("[caliber][indeed] not an Indeed surface, skipping activation"); return; }
    active = true;
    chrome.storage.local.set({ caliberPanelEnabled: true });
    showIdle();
    startWatching();
    if (onJobPage) {
      var text = extractJobText();
      if (text && text.length >= MIN_SCORE_CHARS) scoreCurrentJob(true);
    } else {
      // Search surface without selected job: wait for Indeed to auto-select first card
      tryFirstCardPreload();
    }
  }

  function deactivatePanel() {
    active = false;
    chrome.storage.local.set({ caliberPanelEnabled: false });
    stopWatching();
    removePanel();
    lastScoredText = "";
    recentScores = [];
    resetSessionSignals();
    clearTimeout(sessionCheckTimer);
  }

  // Auto-activate unless user explicitly dismissed
  chrome.storage.local.get(["caliberPanelEnabled"], function (data) {
    if (data.caliberPanelEnabled !== false) activatePanel();
  });

  // ─── Message Handler ──────────────────────────────────────

  chrome.runtime.onMessage.addListener(function (msg, _sender, sendResponse) {
    if (msg.type === "EXTRACT_JOB_TEXT") {
      extractWithRetry(5, 600).then(function (text) { sendResponse({ text: text }); });
      return true;
    }
    if (msg.type === "ACTIVATE_PANEL") {
      activatePanel(); sendResponse({ activated: true }); return false;
    }
    if (msg.type === "CALIBER_SESSION_READY") {
      sessionReady = true;
      clearTimeout(sessionCheckTimer);
      chrome.storage.local.get(["caliberCalibrationTitle", "caliberNearbyRoles"], function (stored) {
        if (stored.caliberCalibrationTitle) lastKnownCalibrationTitle = stored.caliberCalibrationTitle;
        if (Array.isArray(stored.caliberNearbyRoles) && stored.caliberNearbyRoles.length > 0) lastKnownNearbyRoles = stored.caliberNearbyRoles;
      });
      sendResponse({ ok: true }); return false;
    }
  });

  // ─── Panel HTML ───────────────────────────────────────────

  var PANEL_HTML = [
    '<div class="cb-container">',
    '<div class="cb-panel">',
    '  <div class="cb-header">',
    '    <span class="cb-logo">Caliber</span><span class="cb-version">v' + PANEL_VERSION + '</span>',
    '    <div class="cb-header-controls">',
    '      <button id="cb-recalc" class="cb-refresh-btn" aria-label="Refresh score" title="Re-score">\u21BB</button>',
    '      <button id="cb-minimize" class="cb-minimize-btn" aria-label="Minimize" title="Minimize">\u2212</button>',
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
    '      <div id="cb-high-conf" class="cb-high-conf" style="display:none">High-confidence match</div>',
    '    </div>',
    '    <div id="cb-hrc-section" class="cb-collapsible">',
    '      <button class="cb-collapse-toggle" type="button">',
    '        <span class="cb-collapse-icon">\u25b8</span><span>Hiring Reality</span>',
    '        <span id="cb-hrc-band" class="cb-hrc-badge"></span>',
    '      </button>',
    '      <div class="cb-collapse-body">',
    '        <p id="cb-hrc-reason" class="cb-hrc-reason"></p>',
    '        <p id="cb-hrc-gap" class="cb-hrc-gap" style="display:none"></p>',
    '      </div>',
    '    </div>',
    '    <div class="cb-collapsible" id="cb-supports-section">',
    '      <button class="cb-collapse-toggle cb-toggle-green" type="button">',
    '        <span class="cb-collapse-icon">\u25b8</span><span>Supports the Fit</span>',
    '        <span id="cb-supports-count" class="cb-collapse-count"></span>',
    '      </button>',
    '      <div class="cb-collapse-body"><ul id="cb-supports" class="cb-bullets"></ul></div>',
    '    </div>',
    '    <div class="cb-collapsible" id="cb-stretch-section">',
    '      <button class="cb-collapse-toggle cb-toggle-yellow" type="button">',
    '        <span class="cb-collapse-icon">\u25b8</span><span>Stretch Factors</span>',
    '        <span id="cb-stretch-count" class="cb-collapse-count"></span>',
    '      </button>',
    '      <div class="cb-collapse-body"><ul id="cb-stretch" class="cb-bullets cb-stretch"></ul></div>',
    '    </div>',
    '    <div class="cb-collapsible" id="cb-bottomline-section">',
    '      <button class="cb-collapse-toggle cb-toggle-insight" type="button">',
    '        <span class="cb-collapse-icon">\u25b8</span><span>Executive Summary</span>',
    '      </button>',
    '      <div class="cb-collapse-body"><p id="cb-bottomline" class="cb-bltext"></p></div>',
    '    </div>',
    '    <div id="cb-pipeline-row" class="cb-pipeline-row" style="visibility:hidden">',
    '      <button id="cb-pipeline-add" class="cb-pipeline-add">Save this job</button>',
    '      <span id="cb-pipeline-status" class="cb-pipeline-status" style="display:none"></span>',
    '      <a id="cb-pipeline-view" class="cb-pipeline-view" href="#" style="display:none">View saved jobs \u2192</a>',
    '    </div>',
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
    '</div>',
  ].join("\n");

  // ─── Panel CSS ────────────────────────────────────────────
  // Identical visual language to the LinkedIn sidecard.

  var PANEL_CSS = [
    "*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }",
    ".cb-container { display:flex; flex-direction:column; gap:4px; align-items:flex-end; }",
    ".cb-minimized .cb-body { display:none!important; }",
    ".cb-minimized .cb-panel { width:auto; min-width:auto; max-width:none; min-height:auto; border-radius:18px; }",
    ".cb-minimized .cb-header { border-bottom:none; padding:4px 10px; }",
    ".cb-minimized .cb-version { display:none; }",
    ".cb-minimized .cb-refresh-btn { display:none; }",
    ".cb-panel { width:320px; min-width:320px; max-width:320px; min-height:240px; max-height:90vh; overflow-y:auto; overflow-x:hidden; background:#111114; color:#F2F2F2; border-radius:10px; box-shadow:0 2px 8px rgba(0,0,0,0.6),0 8px 24px rgba(0,0,0,0.5); font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; font-size:12px; line-height:1.4; border:1px solid rgba(255,255,255,0.12); contain:layout style; display:flex; flex-direction:column; }",
    "@keyframes cb-enter { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }",
    ".cb-panel::-webkit-scrollbar { width:4px; }",
    ".cb-panel::-webkit-scrollbar-track { background:transparent; }",
    ".cb-panel::-webkit-scrollbar-thumb { background:rgba(255,255,255,0.15); border-radius:3px; }",
    ".cb-header { display:flex; align-items:center; justify-content:space-between; padding:5px 10px; border-bottom:1px solid rgba(255,255,255,0.08); flex-shrink:0; }",
    ".cb-logo { font-size:10px; font-weight:700; letter-spacing:-0.02em; color:#555; }",
    ".cb-version { font-size:8px; color:#444; margin-left:4px; font-weight:400; }",
    ".cb-header-controls { display:flex; align-items:center; gap:2px; }",
    ".cb-refresh-btn,.cb-minimize-btn,.cb-close-btn { background:none; border:none; color:#555; cursor:pointer; padding:0 4px; line-height:1; }",
    ".cb-refresh-btn { font-size:14px; } .cb-minimize-btn { font-size:15px; font-weight:700; } .cb-close-btn { font-size:15px; }",
    ".cb-refresh-btn:hover,.cb-minimize-btn:hover { color:#AFAFAF; } .cb-close-btn:hover { color:#F2F2F2; }",
    ".cb-body { padding:8px 10px; position:relative; flex:1; display:flex; flex-direction:column; justify-content:center; }",
    "#cb-results.cb-body { justify-content:flex-start; }",
    ".cb-spinner { width:20px; height:20px; border:2px solid rgba(242,242,242,0.12); border-top-color:#4ADE80; border-radius:50%; animation:cb-spin 0.7s linear infinite; margin:8px auto 6px; }",
    ".cb-spinner-sm { width:14px; height:14px; border-width:2px; margin:0; }",
    "@keyframes cb-spin { to{transform:rotate(360deg)} }",
    ".cb-status { text-align:center; color:#AFAFAF; font-size:11px; }",
    ".cb-idle-icon { width:28px; height:28px; border-radius:50%; background:rgba(242,242,242,0.06); color:#666; display:flex; align-items:center; justify-content:center; font-size:14px; margin:8px auto 6px; }",
    ".cb-error-icon { width:24px; height:24px; border-radius:50%; background:rgba(239,68,68,0.15); color:#EF4444; display:flex; align-items:center; justify-content:center; font-weight:700; font-size:12px; margin:6px auto; }",
    ".cb-overlay { position:absolute; inset:0; z-index:10; background:rgba(17,17,20,0.85); border-radius:12px; display:flex; align-items:center; justify-content:center; gap:6px; }",
    ".cb-overlay-text { font-size:11px; color:#AFAFAF; }",
    ".cb-toprow { display:flex; flex-direction:column; gap:2px; position:relative; padding-bottom:24px; margin-bottom:3px; border-bottom:1px solid rgba(255,255,255,0.08); }",
    ".cb-score-row { display:flex; align-items:baseline; gap:3px; }",
    ".cb-score-num { font-size:34px; font-weight:800; letter-spacing:-0.03em; line-height:1; }",
    ".cb-score-sep { font-size:18px; font-weight:300; color:#555; margin:0 2px; }",
    ".cb-decision { font-size:9px; font-weight:700; padding:1px 6px; border-radius:3px; letter-spacing:0.01em; }",
    ".cb-decision-excellent { background:rgba(74,222,128,0.2);  color:#4ADE80; }",
    ".cb-decision-vstrong   { background:rgba(74,222,128,0.15); color:#4ADE80; }",
    ".cb-decision-strong    { background:rgba(74,222,128,0.12); color:#6EE7A0; }",
    ".cb-decision-stretch   { background:rgba(251,191,36,0.15); color:#FBBF24; }",
    ".cb-decision-adjacent  { background:rgba(251,191,36,0.10); color:#D4A017; }",
    ".cb-decision-skip      { background:rgba(239,68,68,0.15);  color:#EF4444; }",
    ".cb-job-title { font-size:12px; font-weight:700; color:#F2F2F2; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }",
    ".cb-company-name { font-size:10px; font-weight:600; color:#777; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }",
    ".cb-hrc-badge { font-size:9px; font-weight:700; padding:1px 5px; border-radius:3px; margin-left:auto; }",
    ".cb-hrc-high     { background:rgba(74,222,128,0.15); color:#4ADE80; }",
    ".cb-hrc-possible { background:rgba(251,191,36,0.15); color:#FBBF24; }",
    ".cb-hrc-unlikely { background:rgba(239,68,68,0.15);  color:#EF4444; }",
    ".cb-hrc-reason { font-size:10px; color:#999; padding:1px 0 3px; line-height:1.35; }",
    ".cb-hrc-gap { font-size:10px; color:#F87171; padding:0 0 3px; margin:0; line-height:1.35; font-style:italic; }",
    ".cb-bltext { font-size:11px; color:#DDE1E7; line-height:1.45; padding:1px 0 3px; }",
    "#cb-bottomline-section { transition:opacity 0.35s ease; }",
    ".cb-toggle-insight { color:#A5B4FC; } .cb-toggle-insight:hover { color:#C7D2FE; }",
    ".cb-collapsible { border-top:1px solid rgba(255,255,255,0.06); }",
    ".cb-collapse-toggle { display:flex; align-items:center; gap:4px; width:100%; background:none; border:none; color:#888; cursor:pointer; font-size:10px; font-weight:600; text-transform:uppercase; letter-spacing:0.04em; padding:5px 0; text-align:left; flex-wrap:nowrap; }",
    ".cb-collapse-toggle:hover { color:#CFCFCF; }",
    ".cb-toggle-green  { color:#4ADE80; } .cb-toggle-green:hover  { color:#6EE7A0; }",
    ".cb-toggle-yellow { color:#FBBF24; } .cb-toggle-yellow:hover { color:#FCD34D; }",
    ".cb-toggle-red    { color:#EF4444; } .cb-toggle-red:hover    { color:#F87171; }",
    ".cb-collapse-icon { font-size:9px; transition:transform 0.15s; display:inline-block; }",
    ".cb-collapse-count { font-weight:400; color:#666; margin-left:auto; flex-shrink:0; }",
    ".cb-bar { display:inline-block; width:40px; height:4px; border-radius:2px; background:rgba(255,255,255,0.08); margin-left:auto; vertical-align:middle; overflow:hidden; flex-shrink:0; }",
    ".cb-bar-fill { display:block; height:100%; border-radius:2px; transition:width 0.2s ease; }",
    ".cb-bar-green { background:#4ADE80; } .cb-bar-yellow { background:#FBBF24; }",
    ".cb-bar-count { font-size:9px; font-weight:600; margin-left:4px; vertical-align:middle; flex-shrink:0; }",
    ".cb-bar-count-green { color:#4ADE80; } .cb-bar-count-yellow { color:#FBBF24; }",
    ".cb-collapse-body { max-height:0; overflow:hidden; transition:max-height 0.2s ease-out; }",
    ".cb-open .cb-collapse-icon { transform:rotate(90deg); }",
    ".cb-open .cb-collapse-body { max-height:600px; }",
    ".cb-bullets { list-style:none; padding:1px 0 3px; }",
    ".cb-bullets li { position:relative; padding-left:10px; font-size:11px; color:#CFCFCF; margin-bottom:1px; line-height:1.35; }",
    ".cb-bullets li::before { content:'\\2022'; position:absolute; left:0; color:#4ADE80; font-weight:700; }",
    ".cb-stretch li::before { color:#FBBF24; }",
    ".cb-pipeline-row { display:flex; align-items:center; gap:8px; min-height:24px; box-sizing:border-box; padding:5px 0 3px; margin-top:2px; border-top:1px solid rgba(255,255,255,0.04); }",
    ".cb-pipeline-add { font-size:10px; font-weight:600; color:#86EFAC; background:none; border:1px solid rgba(74,222,128,0.25); border-radius:5px; padding:3px 8px; cursor:pointer; transition:color 0.15s,border-color 0.15s,opacity 0.15s; }",
    ".cb-pipeline-add:hover { color:#BBF7D0; border-color:rgba(74,222,128,0.5); }",
    ".cb-pipeline-add:disabled { opacity:0.6; cursor:default; }",
    ".cb-pipeline-add-saved { color:#4ADE80!important; border-color:rgba(74,222,128,0.4)!important; }",
    ".cb-pipeline-add-error { color:#EF4444!important; border-color:rgba(239,68,68,0.3)!important; cursor:pointer!important; }",
    ".cb-pipeline-status { font-size:10px; font-weight:600; color:#4ADE80; }",
    ".cb-pipeline-view { font-size:10px; font-weight:600; color:#555; text-decoration:none; cursor:pointer; border-bottom:1px solid transparent; transition:color 0.15s,border-color 0.15s; }",
    ".cb-pipeline-view:hover { color:#86EFAC; border-color:rgba(74,222,128,0.3); }",
    ".cb-btn { padding:4px 10px; border:none; border-radius:5px; font-size:10px; font-weight:600; cursor:pointer; text-align:center; display:inline-flex; align-items:center; justify-content:center; transition:opacity 0.15s; margin-top:6px; }",
    ".cb-btn:hover { opacity:0.85; }",
    ".cb-btn-s { background:rgba(242,242,242,0.10); color:#F2F2F2; border:1px solid rgba(242,242,242,0.16); }",
    ".cb-fb-row { display:flex; align-items:center; gap:4px; padding:4px 0 1px; margin-top:3px; border-top:1px solid rgba(255,255,255,0.04); }",
    ".cb-fb-prompt { font-size:10px; color:#666; font-weight:600; }",
    ".cb-fb-btn { background:none; border:1px solid rgba(255,255,255,0.08); border-radius:4px; cursor:pointer; font-size:9px; padding:3px 7px; line-height:1; color:#555; transition:background 0.15s,border-color 0.15s,color 0.15s; }",
    ".cb-fb-btn:hover { background:rgba(255,255,255,0.06); border-color:rgba(255,255,255,0.16); color:#999; }",
    ".cb-fb-sep { width:1px; height:14px; background:rgba(255,255,255,0.06); margin:0 2px; }",
    ".cb-bug-btn { background:none; border:1px solid rgba(255,255,255,0.08); border-radius:4px; cursor:pointer; font-size:9px; font-weight:500; padding:3px 8px; line-height:1; color:#444; transition:background 0.15s,border-color 0.15s,color 0.15s; }",
    ".cb-bug-btn:hover { background:rgba(255,255,255,0.06); border-color:rgba(255,255,255,0.16); color:#888; }",
    ".cb-fb-panel { padding:6px 0 2px; margin-top:4px; border-top:1px solid rgba(255,255,255,0.04); }",
    ".cb-fb-panel-title { font-size:10px; font-weight:600; color:#888; margin-bottom:5px; }",
    ".cb-fb-chips { display:flex; flex-wrap:wrap; gap:4px; margin-bottom:6px; }",
    ".cb-fb-chip { background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.10); border-radius:10px; padding:2px 8px; font-size:10px; color:#AFAFAF; cursor:pointer; transition:background 0.15s,border-color 0.15s,color 0.15s; }",
    ".cb-fb-chip:hover { background:rgba(255,255,255,0.10); color:#F2F2F2; }",
    ".cb-fb-chip-selected { background:rgba(96,165,250,0.15); border-color:rgba(96,165,250,0.4); color:#93C5FD; }",
    ".cb-fb-text { width:100%; background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.08); border-radius:5px; padding:4px 6px; font-size:10px; color:#CFCFCF; resize:none; font-family:inherit; outline:none; }",
    ".cb-fb-text::placeholder { color:#555; }",
    ".cb-fb-text:focus { border-color:rgba(96,165,250,0.4); }",
    ".cb-fb-actions { display:flex; gap:6px; margin-top:5px; }",
    ".cb-fb-submit { background:rgba(74,222,128,0.15); color:#4ADE80; border:none; border-radius:4px; padding:3px 10px; font-size:10px; font-weight:600; cursor:pointer; transition:opacity 0.15s; }",
    ".cb-fb-submit:hover { opacity:0.85; }",
    ".cb-fb-cancel { background:none; color:#666; border:1px solid rgba(255,255,255,0.08); border-radius:4px; padding:3px 10px; font-size:10px; font-weight:600; cursor:pointer; transition:color 0.15s; }",
    ".cb-fb-cancel:hover { color:#AFAFAF; }",
    ".cb-fb-thanks { font-size:10px; color:#4ADE80; font-weight:600; padding:6px 0 2px; margin-top:4px; border-top:1px solid rgba(255,255,255,0.04); text-align:center; }",
    ".cb-decision-skeleton { background:rgba(255,255,255,0.06); color:#888; font-style:italic; font-weight:500; }",
    "@keyframes cb-pulse { 0%,100%{opacity:0.3} 50%{opacity:0.7} }",
    ".cb-score-pulse { animation:cb-pulse 1.4s ease-in-out infinite; }",
    "@keyframes cb-score-pop { 0%{opacity:0;transform:scale(0.7)} 60%{opacity:1;transform:scale(1.05)} 100%{opacity:1;transform:scale(1)} }",
    ".cb-score-reveal { animation:cb-score-pop 0.35s ease-out both; }",
    ".cb-high-conf { position:absolute; bottom:6px; left:0; font-size:9px; font-weight:700; color:#4ADE80; letter-spacing:0.03em; padding:2px 7px; border-radius:4px; background:rgba(74,222,128,0.10); display:inline-block; animation:cb-conf-in 0.4s ease-out both; }",
    "@keyframes cb-conf-in { 0%{opacity:0;transform:translateY(4px)} 100%{opacity:1;transform:translateY(0)} }",
    ".cb-panel-glow { border-color:rgba(74,222,128,0.35); box-shadow:0 0 12px rgba(74,222,128,0.08),0 2px 8px rgba(0,0,0,0.6),0 8px 24px rgba(0,0,0,0.5); transition:border-color 0.4s ease,box-shadow 0.4s ease; }",
  ].join("\n");

})();
