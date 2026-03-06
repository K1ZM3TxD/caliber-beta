import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy – Caliber",
  description: "Privacy policy for the Caliber web app and Chrome extension.",
};

export default function PrivacyPolicyPage() {
  return (
    <div className="w-full max-w-2xl mx-auto py-12 px-2">
      <h1
        className="text-2xl font-bold mb-1 tracking-tight"
        style={{ color: "#F2F2F2" }}
      >
        Privacy Policy
      </h1>
      <p className="text-xs mb-8" style={{ color: "#777" }}>
        Effective date: March 6, 2026
      </p>

      <div className="space-y-6 text-sm leading-relaxed" style={{ color: "#D0D0D0" }}>
        <section>
          <h2 className="text-base font-semibold mb-1" style={{ color: "#F2F2F2" }}>
            1. What Caliber Is
          </h2>
          <p>
            Caliber is a career-calibration tool consisting of a web application
            (&ldquo;caliber-app.com&rdquo;) and a companion Chrome browser extension.
            Together they help users understand how their professional pattern maps to
            market titles and individual job descriptions.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold mb-1" style={{ color: "#F2F2F2" }}>
            2. Data We Collect
          </h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>
              <strong>Resume text</strong> &ndash; uploaded or pasted by the user during a
              calibration session. Used solely to extract professional signals for scoring.
            </li>
            <li>
              <strong>Prompt answers</strong> &ndash; short free-text responses provided
              during the calibration flow to refine title and pattern analysis.
            </li>
            <li>
              <strong>Job description text</strong> &ndash; pasted by the user in the web
              app or read from a supported job-listing page (LinkedIn, Indeed) by the
              Chrome extension. Used to compute a fit score against the user&rsquo;s
              calibrated profile.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-base font-semibold mb-1" style={{ color: "#F2F2F2" }}>
            3. Chrome Extension Behavior
          </h2>
          <p>The Caliber Chrome extension:</p>
          <ul className="list-disc pl-5 space-y-1 mt-1">
            <li>
              Reads job-page content from supported sites (LinkedIn and Indeed) when the
              user activates the extension on that page.
            </li>
            <li>
              Sends the extracted job text to the Caliber backend for scoring. No other
              page content is collected or transmitted.
            </li>
            <li>
              May use local browser extension storage (chrome.storage.local) to persist
              lightweight settings such as session identifiers and user preferences. This
              data stays on the user&rsquo;s device and is not sent to any server.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-base font-semibold mb-1" style={{ color: "#F2F2F2" }}>
            4. How We Use Your Data
          </h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>Generate calibration results (title recommendations, fit scores, pattern summaries).</li>
            <li>Display those results to you within the app or extension.</li>
          </ul>
          <p className="mt-1">
            We do not use your data for advertising, marketing profiling, or model training.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold mb-1" style={{ color: "#F2F2F2" }}>
            5. Data Storage &amp; Retention
          </h2>
          <p>
            Session data (resume text, answers, job descriptions, and results) is held
            in server memory for the duration of an active calibration session and is not
            persisted to a long-term database. Once the session ends or the server
            recycles, session data is discarded.
          </p>
          <p className="mt-1">
            No personal account system exists; we do not store emails, passwords, or
            persistent user profiles.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold mb-1" style={{ color: "#F2F2F2" }}>
            6. Third-Party Sharing
          </h2>
          <p>
            We do not sell, rent, or share your data with third parties. Job description
            text may be sent to an AI inference provider strictly to generate scoring
            results; no other data leaves our infrastructure.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold mb-1" style={{ color: "#F2F2F2" }}>
            7. Cookies &amp; Analytics
          </h2>
          <p>
            Caliber does not set tracking cookies. We may use minimal, privacy-respecting
            analytics (e.g., page-view counts) with no personal identifiers.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold mb-1" style={{ color: "#F2F2F2" }}>
            8. Your Rights
          </h2>
          <p>
            Because we do not maintain persistent user accounts or stored personal data,
            there is generally nothing to delete. If you believe we hold data about you
            and would like it removed, contact us and we will address your request
            promptly.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold mb-1" style={{ color: "#F2F2F2" }}>
            9. Changes to This Policy
          </h2>
          <p>
            We may update this policy from time to time. Material changes will be
            reflected by updating the effective date at the top of this page.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold mb-1" style={{ color: "#F2F2F2" }}>
            10. Contact
          </h2>
          <p>
            For privacy questions or concerns, reach us at{" "}
            <a
              href="mailto:privacy@caliber-app.com"
              className="underline"
              style={{ color: "#4ADE80" }}
            >
              privacy@caliber-app.com
            </a>
            .
          </p>
        </section>
      </div>

      <div className="mt-12 pt-6 border-t" style={{ borderColor: "rgba(242,242,242,0.10)" }}>
        <a
          href="/calibration"
          className="text-sm underline"
          style={{ color: "#777" }}
        >
          &larr; Back to Caliber
        </a>
      </div>
    </div>
  );
}
