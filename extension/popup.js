// popup.js — Caliber extension popup (lightweight launcher)
// env.js is loaded first via popup.html <script> tag

(function () {
  var statusEl = document.getElementById("popup-status");
  var toggleBtn = document.getElementById("popup-toggle");

  function setStatus(msg) {
    statusEl.textContent = msg;
  }

  chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
    var tab = tabs[0];
    if (!tab || !tab.url || !/linkedin\.com\/jobs/.test(tab.url)) {
      setStatus("Navigate to a LinkedIn jobs page to use Caliber.");
      return;
    }

    // On a LinkedIn jobs page — offer to open/reopen the sidecard
    setStatus("LinkedIn jobs page detected.");
    toggleBtn.style.display = "";
    toggleBtn.textContent = "Open Sidecard";

    toggleBtn.addEventListener("click", function () {
      toggleBtn.disabled = true;
      setStatus("Activating…");
      chrome.tabs.sendMessage(tab.id, { type: "ACTIVATE_PANEL" }, function (response) {
        if (chrome.runtime.lastError) {
          setStatus("Could not reach the page. Try refreshing.");
          toggleBtn.disabled = false;
          return;
        }
        if (response && response.activated) {
          setStatus("\u2713 Sidecard activated");
          setTimeout(function () { window.close(); }, 600);
        } else {
          setStatus("Could not activate. Try refreshing the page.");
          toggleBtn.disabled = false;
        }
      });
    });
  });
})();
