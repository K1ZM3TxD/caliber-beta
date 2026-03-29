// popup.js — Caliber extension popup (lightweight launcher)
// env.js is loaded first via popup.html <script> tag

(function () {
  var headlineEl = document.getElementById("popup-headline");
  var statusEl = document.getElementById("popup-status");
  var toggleBtn = document.getElementById("popup-toggle");
  var calibrateLink = document.getElementById("popup-calibrate");

  function setStatus(msg) {
    statusEl.textContent = msg;
  }

  function showPrerequisiteState() {
    headlineEl.textContent = "Complete calibration first";
    headlineEl.style.display = "";
    setStatus("Caliber needs your calibrated profile to analyze job fit.");
    calibrateLink.href = CALIBER_ENV.API_BASE + "/calibration";
    calibrateLink.style.display = "";
  }

  // Detect supported pages: LinkedIn job listings and Indeed job pages
  var SUPPORTED_PATTERN = /linkedin\.com\/jobs|indeed\.com/;

  chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
    var tab = tabs[0];
    if (!tab || !tab.url) {
      setStatus("Open a LinkedIn job listing to use Caliber.");
      return;
    }

    // Check if on a supported page
    if (!SUPPORTED_PATTERN.test(tab.url)) {
      // Unsupported page — show clear guidance, no action button
      if (/linkedin\.com/.test(tab.url)) {
        setStatus("Navigate to a job listing on LinkedIn to activate scoring.");
      } else {
        setStatus("Caliber works on LinkedIn and Indeed job listings.");
      }
      return;
    }

    var isIndeed = /indeed\.com/.test(tab.url);

    // On a supported jobs page — check session before offering sidecard
    setStatus("Checking calibration…");
    chrome.runtime.sendMessage({ type: "CALIBER_SESSION_DISCOVER" }, function (response) {
      if (chrome.runtime.lastError || !response || !response.ok) {
        showPrerequisiteState();
        return;
      }
      if (!response.profileComplete) {
        showPrerequisiteState();
        return;
      }

      // Session valid — offer sidecard
      setStatus((isIndeed ? "Indeed" : "LinkedIn") + " job page detected.");
      toggleBtn.style.display = "";
      if (!isIndeed) initSignalToggle();
      toggleBtn.textContent = "Open Sidecard";

      toggleBtn.addEventListener("click", function () {
        toggleBtn.disabled = true;
        setStatus("Activating…");
        chrome.tabs.sendMessage(tab.id, { type: "ACTIVATE_PANEL" }, function (resp) {
          if (chrome.runtime.lastError) {
            setStatus("Could not reach the page. Try refreshing.");
            toggleBtn.disabled = false;
            return;
          }
          if (resp && resp.activated) {
            setStatus("\u2713 Sidecard activated");
            setTimeout(function () { window.close(); }, 600);
          } else {
            setStatus("Could not activate. Try refreshing the page.");
            toggleBtn.disabled = false;
          }
        });
      });
    });
  });

  // ── Signal toggle for A/B experiment ──
  function initSignalToggle() {
    var section = document.getElementById("signal-toggle-section");
    var btn = document.getElementById("signal-toggle-btn");
    var statusText = document.getElementById("signal-status");
    section.style.display = "";

    function render(pref) {
      var isOn = pref === "yes";
      btn.textContent = isOn ? "ON" : "OFF";
      btn.className = "signal-toggle " + (isOn ? "is-on" : "is-off");
      statusText.textContent = isOn ? "Scores include detected signals" : "Scores use resume only";
    }

    // Read current value
    chrome.storage.local.get(["caliberSignalPreference"], function (store) {
      var current = store.caliberSignalPreference || "yes";
      render(current);
    });

    btn.addEventListener("click", function () {
      chrome.storage.local.get(["caliberSignalPreference"], function (store) {
        var next = store.caliberSignalPreference === "yes" ? "no" : "yes";
        chrome.storage.local.set({
          caliberSignalPreference: next,
          caliberSignalOverride: true
        }, function () {
          render(next);
        });
      });
    });
  }
})();
