// popup.js — Caliber extension popup logic

const API_BASE = "http://localhost:3000";

const $loading = document.getElementById("loading");
const $error = document.getElementById("error");
const $errorMsg = document.getElementById("error-msg");
const $results = document.getElementById("results");
const $scoreValue = document.getElementById("score-value");
const $supportsList = document.getElementById("supports-list");
const $stretchList = document.getElementById("stretch-list");
const $bottomLine = document.getElementById("bottom-line");
const $linkCaliber = document.getElementById("link-caliber");

function show(el) {
  [$loading, $error, $results].forEach(e => e.classList.add("hidden"));
  el.classList.remove("hidden");
}

function showError(msg) {
  $errorMsg.textContent = msg;
  show($error);
}

function renderResults(data) {
  $scoreValue.textContent = data.score_0_to_10;
  // Color the score
  const score = data.score_0_to_10;
  if (score >= 7) $scoreValue.style.color = "#4ADE80";
  else if (score >= 4) $scoreValue.style.color = "#FBBF24";
  else $scoreValue.style.color = "#EF4444";

  $supportsList.innerHTML = "";
  for (const item of data.supports_fit || []) {
    const li = document.createElement("li");
    li.textContent = item;
    $supportsList.appendChild(li);
  }

  $stretchList.innerHTML = "";
  $stretchList.classList.add("stretch-list");
  for (const item of data.stretch_factors || []) {
    const li = document.createElement("li");
    li.textContent = item;
    $stretchList.appendChild(li);
  }

  $bottomLine.textContent = data.bottom_line_2s || "";

  if (data.calibrationId) {
    $linkCaliber.href = API_BASE + "/calibration?calibrationId=" + data.calibrationId;
  }
  show($results);
}

/** Extract job text from the active tab via content script. */
async function extractJobText() {
  return new Promise((resolve) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs[0];
      if (!tab || !tab.id) {
        resolve(null);
        return;
      }

      // For LinkedIn/Indeed pages, the content script is already injected
      chrome.tabs.sendMessage(tab.id, { type: "EXTRACT_JOB_TEXT" }, (response) => {
        if (chrome.runtime.lastError || !response || !response.text) {
          // Content script not injected (not a matching page) — try executeScript fallback
          chrome.scripting.executeScript(
            {
              target: { tabId: tab.id },
              func: () => {
                // Try generic extraction: user selection, then largest text block
                const sel = window.getSelection();
                if (sel && sel.toString().trim().length > 100) {
                  return sel.toString().trim();
                }
                // Try common job description containers
                const candidates = document.querySelectorAll(
                  'article, [role="main"], .job-description, .description, #job-details'
                );
                let best = "";
                candidates.forEach((el) => {
                  const t = el.innerText || "";
                  if (t.length > best.length) best = t;
                });
                return best.trim().length > 100 ? best.trim() : null;
              },
            },
            (results) => {
              if (chrome.runtime.lastError || !results || !results[0]) {
                resolve(null);
              } else {
                resolve(results[0].result);
              }
            }
          );
        } else {
          resolve(response.text);
        }
      });
    });
  });
}

/** Get stored sessionId or discover the latest one. */
async function getSessionId() {
  return new Promise((resolve) => {
    chrome.storage.local.get(["caliberSessionId"], (data) => {
      resolve(data.caliberSessionId || null);
    });
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

/** Main flow: extract → call API → render. */
async function run() {
  show($loading);
  $loading.querySelector(".status-text").textContent = "Extracting job description…";

  try {
    const jobText = await extractJobText();
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
    renderResults(data);
  } catch (err) {
    showError(err.message || "Something went wrong.");
  }
}

// Wire up buttons
document.getElementById("btn-retry").addEventListener("click", run);
document.getElementById("btn-recalc").addEventListener("click", run);

// Auto-run on popup open
run();
