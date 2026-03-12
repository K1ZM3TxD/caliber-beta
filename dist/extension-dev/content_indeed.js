// content_indeed.js — Indeed job description extractor
// Injected on indeed.com/* pages

(function () {
  /** Try multiple selectors to find the job description container. */
  function extractJobText() {
    const selectors = [
      "#jobDescriptionText",
      ".jobsearch-jobDescriptionText",
      ".jobsearch-JobComponent-description",
      'div[id="jobDescriptionText"]',
    ];
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el && el.innerText && el.innerText.trim().length > 100) {
        return el.innerText.trim().replace(/\s+/g, " ");
      }
    }
    // Fallback: user selection
    const sel = window.getSelection();
    if (sel && sel.toString().trim().length > 100) {
      return sel.toString().trim().replace(/\s+/g, " ");
    }
    return null;
  }

  // Listen for messages from the popup
  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg.type === "EXTRACT_JOB_TEXT") {
      const text = extractJobText();
      sendResponse({ text });
    }
    return true;
  });
})();
