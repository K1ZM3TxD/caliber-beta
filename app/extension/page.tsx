import { CHROME_STORE_URL } from "@/lib/extension_config";

export default function ExtensionPage() {
  const hasStoreUrl = Boolean(CHROME_STORE_URL);

  return (
    <div className="fixed inset-0 bg-[#0B0B0B] flex justify-center items-start pt-[8vh] overflow-y-auto">
      <div className="w-full max-w-[620px] px-6" style={{ color: "#F2F2F2" }}>
        <div className="text-center font-semibold tracking-tight text-4xl sm:text-5xl mb-6">Caliber Extension</div>
        <div className="text-center text-lg sm:text-xl mb-8" style={{ color: "#CFCFCF" }}>
          Get a fit score on LinkedIn or Indeed — without copy/paste.
        </div>

        {/* Primary CTA */}
        <div className="text-center mb-8">
          {hasStoreUrl ? (
            <a
              href={CHROME_STORE_URL!}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center rounded-md px-8 py-4 text-lg font-semibold transition-all ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2"
              style={{ backgroundColor: "#F2F2F2", color: "#0B0B0B", cursor: "pointer", minWidth: 220 }}
            >
              Add to Chrome
            </a>
          ) : (
            <div className="rounded-lg px-6 py-8" style={{ backgroundColor: "#141414", border: "1px solid rgba(242,242,242,0.12)" }}>
              <div className="text-xl font-bold mb-2" style={{ color: "#4ADE80" }}>Coming Soon</div>
              <p className="text-sm" style={{ color: "#AFAFAF" }}>
                Chrome Web Store listing is on the way. Check back shortly.
              </p>
            </div>
          )}
        </div>

        {/* How it works */}
        <div className="rounded-lg px-6 py-6 mb-8" style={{ backgroundColor: "#141414", border: "1px solid rgba(242,242,242,0.12)" }}>
          <div className="text-lg font-bold mb-3" style={{ color: "#F2F2F2" }}>How it works</div>
          <ul className="space-y-2 text-sm" style={{ color: "#AFAFAF" }}>
            <li>• Browse jobs on LinkedIn or Indeed like you normally would.</li>
            <li>• Click the Caliber extension icon on any job page.</li>
            <li>• Instantly see your Fit Score, strengths, stretch factors, and bottom line.</li>
            <li>• No copy/paste — the extension reads the job description for you.</li>
          </ul>
        </div>

        <div className="text-center mb-12">
          <a
            href="/calibration"
            className="inline-flex items-center justify-center rounded-md px-5 py-3 text-sm font-medium transition-colors duration-200"
            style={{ backgroundColor: "rgba(242,242,242,0.10)", color: "#F2F2F2", border: "1px solid rgba(242,242,242,0.16)" }}
          >
            ← Back to Calibration
          </a>
        </div>
      </div>
    </div>
  );
}
