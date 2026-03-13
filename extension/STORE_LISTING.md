# Chrome Web Store Listing — Caliber v0.8.0

## Extension Name
Caliber — Job Fit Score

## Short Description (132 chars max)
Score how well LinkedIn jobs match your career pattern. Requires a free Caliber calibration at caliber-app.com.

## Detailed Description

Caliber scores LinkedIn job listings against your unique career pattern.

**How it works:**
1. Complete a free calibration at caliber-app.com (takes ~5 minutes).
2. Install this extension.
3. Browse LinkedIn job listings — Caliber automatically scores each job for fit.

**What you see:**
- A fit score (0–10) for each LinkedIn job you view.
- A brief summary of why the job is or isn't a good match.
- Support factors and stretch factors that explain the score.

**Requirements:**
- A completed Caliber calibration at caliber-app.com.
- LinkedIn job listing pages (linkedin.com/jobs).

**What this extension does NOT do:**
- It does not work on non-LinkedIn pages.
- It does not extract or transmit personal data from LinkedIn.
- It does not modify LinkedIn page content beyond adding the Caliber scoring panel.

**Permissions explained:**
- activeTab: Reads the job listing text on the current tab to score it.
- storage: Stores your calibration session locally so scoring works across tabs.
- cookies: Reads the Caliber session cookie to connect the extension to your calibration.
- Host permissions (caliber-app.com, linkedin.com): Required to communicate with the Caliber API and read LinkedIn job listings.

## Category
Productivity

## Language
English

## Single Purpose Description
This extension scores LinkedIn job listings for career fit based on the user's calibration profile at caliber-app.com.

## Reviewer Notes
- To test: visit caliber-app.com, complete a calibration (~5 min), then navigate to any LinkedIn job listing at linkedin.com/jobs/view/*.
- The extension popup shows clear guidance when not on a supported page.
- The sidecard scoring panel appears automatically on LinkedIn job detail pages after calibration is complete.
- On unsupported pages the popup shows only an informational message — no buttons or actions are available.
