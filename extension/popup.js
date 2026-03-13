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

  // Detect supported pages: LinkedIn job listings
  var SUPPORTED_PATTERN = /linkedin\.com\/jobs/;

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
        setStatus("Caliber works on LinkedIn job listings. Open a job on linkedin.com/jobs to get started.");
      }
      return;
    }

    // On a LinkedIn jobs page — check session before offering sidecard
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
      setStatus("LinkedIn job page detected.");
      toggleBtn.style.display = "";
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
})();
