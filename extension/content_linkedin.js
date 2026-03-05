// content_linkedin.js — LinkedIn job description extractor
// Injected on linkedin.com/jobs/* pages

(function () {
  /** Try multiple selectors to find the job description container. */
  function extractJobText() {
    const selectors = [
      ".jobs-description__content",
      ".jobs-description-content__text",
      ".jobs-box__html-content",
      "#job-details",
      'article[data-job-id]',
      ".job-view-layout .description__text",
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
    return true; // keep channel open for async
  });
})();
