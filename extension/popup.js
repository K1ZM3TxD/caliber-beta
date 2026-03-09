// popup.js — Caliber extension popup logic
// env.js is loaded first via popup.html <script> tag

const API_BASE = CALIBER_ENV.API_BASE;

const $loading = document.getElementById("loading");
const $error = document.getElementById("error");
const $errorMsg = document.getElementById("error-msg");
const $results = document.getElementById("results");
const $scoreValue = document.getElementById("score-value");
const $supportsList = document.getElementById("supports-list");
const $stretchList = document.getElementById("stretch-list");
const $bottomLine = document.getElementById("bottom-line");
const $linkCaliber = document.getElementById("link-caliber");
const $hiringCheck = document.getElementById("hiring-check");
const $hiringBand = document.getElementById("hiring-check-band");
const $hiringReason = document.getElementById("hiring-check-reason");
const $identity = document.getElementById("identity");
const $logoImg = document.getElementById("logo-img");
const $companyName = document.getElementById("company-name");
const $jobTitle = document.getElementById("job-title");
const $decision = document.getElementById("decision");
const $supportsCount = document.getElementById("supports-count");
const $stretchCount = document.getElementById("stretch-count");
const $stretchSection = document.getElementById("stretch-section");

function show(el) {
  [$loading, $error, $results].forEach(e => e.classList.add("hidden"));
  el.classList.remove("hidden");
}

function showError(msg) {
  $errorMsg.textContent = msg;
  show($error);
}

function getDecision(score) {
  if (score >= 7.5) return { label: "Strong Fit", cls: "decision-strong" };
  if (score >= 5) return { label: "Stretch", cls: "decision-stretch" };
  return { label: "Skip", cls: "decision-skip" };
}

function renderResults(data, meta) {
  const score = Number(data.score_0_to_10) || 0;

  // Company / job identity
  if (meta && (meta.company || meta.title)) {
    $identity.style.display = "";
    $companyName.textContent = meta.company || "";
    $jobTitle.textContent = meta.title || "";
    if (meta.logoUrl) {
      $logoImg.src = meta.logoUrl;
      $logoImg.style.display = "";
    } else {
      $logoImg.style.display = "none";
    }
  } else {
    $identity.style.display = "none";
  }

  // Score + color
  $scoreValue.textContent = score;
  if (score >= 7.5) $scoreValue.style.color = "#4ADE80";
  else if (score >= 5) $scoreValue.style.color = "#FBBF24";
  else $scoreValue.style.color = "#EF4444";

  // Decision badge
  const decision = getDecision(score);
  $decision.textContent = decision.label;
  $decision.className = "decision " + decision.cls;

  // Hiring Reality Check
  const hrc = data.hiring_reality_check;
  if (hrc && hrc.band) {
    $hiringCheck.style.display = "";
    $hiringBand.textContent = hrc.band;
    $hiringBand.className = "hrc-badge";
    if (hrc.band === "High") $hiringBand.classList.add("band-high");
    else if (hrc.band === "Possible") $hiringBand.classList.add("band-possible");
    else $hiringBand.classList.add("band-unlikely");
    $hiringReason.textContent = hrc.reason || "";
  } else {
    $hiringCheck.style.display = "none";
  }

  // Bottom line
  $bottomLine.textContent = data.bottom_line_2s || "";

  // Supports (collapsible)
  const supportItems = data.supports_fit || [];
  $supportsList.innerHTML = "";
  for (const item of supportItems) {
    const li = document.createElement("li");
    li.textContent = item;
    $supportsList.appendChild(li);
  }
  $supportsCount.textContent = supportItems.length ? "(" + supportItems.length + ")" : "";

  // Stretch factors (collapsible)
  const stretchItems = data.stretch_factors || [];
  $stretchList.innerHTML = "";
  for (const item of stretchItems) {
    const li = document.createElement("li");
    li.textContent = item;
    $stretchList.appendChild(li);
  }
  $stretchCount.textContent = stretchItems.length ? "(" + stretchItems.length + ")" : "";
  $stretchSection.style.display = stretchItems.length ? "" : "none";

  if (data.calibrationId) {
    $linkCaliber.href = API_BASE + "/calibration?calibrationId=" + data.calibrationId;
  }
  show($results);
}

// Wire collapsible toggles
document.querySelectorAll(".collapse-toggle").forEach(function(btn) {
  btn.addEventListener("click", function() {
    var section = btn.closest(".collapsible");
    if (section) section.classList.toggle("open");
  });
});

/** Extract job text from the active tab via content script. */
async function extractJobText() {
  const TIMEOUT_MS = 8000;
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), TIMEOUT_MS);

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs[0];
      if (!tab || !tab.id) {
        clearTimeout(timer);
        resolve(null);
        return;
      }

      // For LinkedIn/Indeed pages, the content script is already injected
      chrome.tabs.sendMessage(tab.id, { type: "EXTRACT_JOB_TEXT" }, (response) => {
        if (chrome.runtime.lastError || !response || !response.text) {
          // Content script not injected (not a matching page) — try executeScript fallback
          try {
            chrome.scripting.executeScript(
              {
                target: { tabId: tab.id },
                func: () => {
                  // Try generic extraction: user selection, then largest text block
                  const sel = window.getSelection();
                  if (sel && sel.toString().trim().length > 100) {
                    return sel.toString().trim();
                  }
                  // Try common job description containers (broad selectors)
                  const candidates = document.querySelectorAll(
                    'article, [role="main"], [class*="job-description"], [class*="jobs-description"], [class*="job-details"], #job-details, .description'
                  );
                  let best = "";
                  candidates.forEach((el) => {
                    const t = el.innerText || "";
                    if (t.length > best.length) best = t;
                  });
                  if (best.trim().length > 100) return best.trim();
                  // Last resort: longest section/div in main
                  const main = document.querySelector('[role="main"]') || document.body;
                  main.querySelectorAll("section, div > ul, div > p").forEach((el) => {
                    const t = el.innerText || "";
                    if (t.trim().length > best.length && t.trim().length > 200) best = t.trim();
                  });
                  return best.length > 200 ? best : null;
                },
              },
              (results) => {
                clearTimeout(timer);
                if (chrome.runtime.lastError || !results || !results[0]) {
                  resolve(null);
                } else {
                  resolve(results[0].result);
                }
              }
            );
          } catch {
            clearTimeout(timer);
            resolve(null);
          }
        } else {
          clearTimeout(timer);
          resolve(response.text);
        }
      });
    });
  });
}

/** Get stored sessionId or discover the latest one. */
async function getSessionId() {
  // Try session discovery through background service worker first
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(
      { type: "CALIBER_SESSION_DISCOVER" },
      (response) => {
        if (chrome.runtime.lastError || !response || !response.ok) {
          // Fall back to stored value
          chrome.storage.local.get(["caliberSessionId"], (data) => {
            resolve(data.caliberSessionId || null);
          });
        } else {
          resolve(response.sessionId || null);
        }
      }
    );
  });
}

/** Call the Caliber fit API. */
async function callFitAPI(jobText, sessionId) {
  const body = { jobText };
  if (sessionId) body.sessionId = sessionId;

  const resp = await fetch(API_BASE + "/api/extension/fit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const data = await resp.json();
  if (!resp.ok) {
    throw new Error(data.error || "API error " + resp.status);
  }

  // Store calibrationId for future use
  if (data.calibrationId) {
    chrome.storage.local.set({ caliberSessionId: data.calibrationId });
  }

  return data;
}

/** Try to activate the persistent in-page panel (LinkedIn content script). */
async function tryActivatePanel() {
  return new Promise((resolve) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs[0];
      if (!tab || !tab.id) { resolve(false); return; }
      chrome.tabs.sendMessage(tab.id, { type: "ACTIVATE_PANEL" }, (response) => {
        if (chrome.runtime.lastError || !response || !response.activated) {
          resolve(false);
        } else {
          resolve(true);
        }
      });
    });
  });
}

/** Extract job title, company name, and logo from the active tab. */
async function extractJobMeta() {
  return new Promise((resolve) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs[0];
      if (!tab || !tab.id) { resolve({}); return; }
      try {
        chrome.scripting.executeScript(
          {
            target: { tabId: tab.id },
            func: () => {
              var meta = { title: "", company: "", logoUrl: "" };
              // Job title
              var titleSels = [
                "h1.t-24", "h1[class*='job-title']", "h2[class*='job-title']",
                ".job-details-jobs-unified-top-card__job-title a",
                ".job-details-jobs-unified-top-card__job-title",
                ".jobs-unified-top-card__job-title a",
                ".topcard__title",
                "[data-testid='jobsearch-JobInfoHeader-title']",
                "h1",
              ];
              for (var i = 0; i < titleSels.length; i++) {
                var el = document.querySelector(titleSels[i]);
                if (el) {
                  var t = (el.textContent || "").trim();
                  if (t.length > 2 && t.length < 200) { meta.title = t; break; }
                }
              }
              // Company name
              var companySels = [
                ".job-details-jobs-unified-top-card__company-name a",
                ".job-details-jobs-unified-top-card__company-name",
                ".jobs-unified-top-card__company-name a",
                ".topcard__org-name-link",
                "[data-testid='inlineHeader-companyName'] a",
                "[class*='company-name'] a",
                "[class*='company-name']",
              ];
              for (var j = 0; j < companySels.length; j++) {
                var el2 = document.querySelector(companySels[j]);
                if (el2) {
                  var c = (el2.textContent || "").trim();
                  if (c.length > 1 && c.length < 150) { meta.company = c; break; }
                }
              }
              // Logo
              var logoSels = [
                ".job-details-jobs-unified-top-card__company-logo img",
                ".jobs-unified-top-card__company-logo img",
                "[class*='company-logo'] img",
                "[class*='CompanyAvatar'] img",
              ];
              for (var k = 0; k < logoSels.length; k++) {
                var img = document.querySelector(logoSels[k]);
                if (img && img.src && img.src.startsWith("http")) {
                  meta.logoUrl = img.src;
                  break;
                }
              }
              return meta;
            },
          },
          (results) => {
            if (chrome.runtime.lastError || !results || !results[0]) {
              resolve({});
            } else {
              resolve(results[0].result || {});
            }
          }
        );
      } catch {
        resolve({});
      }
    });
  });
}

/** Main flow: activate panel if possible, otherwise extract → call API → render. */
async function run() {
  show($loading);
  $loading.querySelector(".status-text").textContent = "Activating…";

  // Try persistent in-page panel first (LinkedIn/Indeed content script pages)
  const panelOk = await tryActivatePanel();
  if (panelOk) {
    const spinner = $loading.querySelector(".spinner");
    if (spinner) spinner.style.display = "none";
    $loading.querySelector(".status-text").textContent =
      "\u2713 Panel active \u2014 results on page";
    return;
  }

  // Fallback: original popup scoring for non-content-script pages
  $loading.querySelector(".status-text").textContent = "Extracting job description…";

  try {
    const [jobText, jobMeta] = await Promise.all([extractJobText(), extractJobMeta()]);
    if (!jobText || jobText.length < 200) {
      showError(
        jobText
          ? "Job description too short. Highlight more text on the page and click Recalculate."
          : "Couldn't detect the job description. Highlight it on the page and click Recalculate."
      );
      return;
    }

    $loading.querySelector(".status-text").textContent = "Computing fit score…";

    const sessionId = await getSessionId();
    const data = await callFitAPI(jobText, sessionId);
    renderResults(data, jobMeta);
  } catch (err) {
    showError(err.message || "Something went wrong.");
  }
}

// Wire up buttons
document.getElementById("btn-retry").addEventListener("click", run);
document.getElementById("btn-recalc").addEventListener("click", run);

// Set default calibration link from env config
$linkCaliber.href = API_BASE + "/calibration";

// Auto-run on popup open
run();
