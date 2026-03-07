import {
  CHROME_STORE_URL,
  EXTENSION_ZIP_PATH,
  EXTENSION_BETA_VERSION,
  BETA_FEEDBACK_EMAIL,
} from "@/lib/extension_config";

export default function ExtensionPage() {
  const hasStoreUrl = Boolean(CHROME_STORE_URL);

  return (
    <div className="fixed inset-0 bg-[#0B0B0B] flex justify-center items-start pt-[6vh] overflow-y-auto">
      <div className="w-full max-w-[640px] px-6 pb-16" style={{ color: "#F2F2F2" }}>
        {/* Header */}
        <div className="text-center font-semibold tracking-tight text-4xl sm:text-5xl mb-4">
          Caliber Extension
        </div>
        <div className="text-center text-lg sm:text-xl mb-8" style={{ color: "#CFCFCF" }}>
          Get a fit score on LinkedIn or Indeed — without copy/paste.
        </div>

        {/* Beta status message */}
        <div
          className="rounded-lg px-6 py-5 mb-8 text-sm leading-relaxed"
          style={{
            backgroundColor: "rgba(74,222,128,0.06)",
            border: "1px solid rgba(74,222,128,0.25)",
            color: "#CFCFCF",
          }}
        >
          This extension is currently in beta and will be available in the Chrome
          Web Store soon. We&apos;re sharing the beta version so early users can
          try Caliber and help improve it.
        </div>

        {/* Download button */}
        <div id="download" className="text-center mb-10">
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
            <a
              href={EXTENSION_ZIP_PATH}
              download
              className="inline-flex items-center justify-center rounded-md px-8 py-4 text-lg font-semibold transition-all ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2"
              style={{ backgroundColor: "#F2F2F2", color: "#0B0B0B", cursor: "pointer", minWidth: 260 }}
            >
              Download Caliber Extension (Beta)
            </a>
          )}
          <div className="mt-2 text-xs" style={{ color: "#777" }}>
            v{EXTENSION_BETA_VERSION} &middot; Chrome &middot; ZIP download
          </div>
        </div>

        {/* Installation instructions */}
        <div
          className="rounded-lg px-6 py-6 mb-8"
          style={{ backgroundColor: "#141414", border: "1px solid rgba(242,242,242,0.12)" }}
        >
          <div className="text-lg font-bold mb-4" style={{ color: "#F2F2F2" }}>
            How to install the extension
          </div>
          <ol className="space-y-3 text-sm list-decimal list-inside" style={{ color: "#CFCFCF" }}>
            <li>Download the extension ZIP using the button above.</li>
            <li>Unzip the file on your computer.</li>
            <li>Open Chrome.</li>
            <li>
              Copy and paste this into your browser bar:{" "}
              <code
                className="px-1.5 py-0.5 rounded text-xs select-all cursor-pointer"
                style={{ backgroundColor: "rgba(242,242,242,0.08)", color: "#4ADE80" }}
              >
                chrome://extensions
              </code>
            </li>
            <li>Turn on <strong>&quot;Developer Mode&quot;</strong> (top right).</li>
            <li>Click <strong>&quot;Load unpacked&quot;</strong>.</li>
            <li>Select the unzipped extension folder.</li>
          </ol>
        </div>

        {/* How it works */}
        <div
          className="rounded-lg px-6 py-6 mb-8"
          style={{ backgroundColor: "#141414", border: "1px solid rgba(242,242,242,0.12)" }}
        >
          <div className="text-lg font-bold mb-3" style={{ color: "#F2F2F2" }}>
            How it works
          </div>
          <ul className="space-y-2 text-sm" style={{ color: "#AFAFAF" }}>
            <li>• Browse jobs on LinkedIn or Indeed like you normally would.</li>
            <li>• Click the Caliber extension icon on any job page.</li>
            <li>• Instantly see your Fit Score, strengths, stretch factors, and bottom line.</li>
            <li>• No copy/paste — the extension reads the job description for you.</li>
          </ul>
        </div>

        {/* Beta feedback */}
        <div
          className="rounded-lg px-6 py-6 mb-10"
          style={{ backgroundColor: "#141414", border: "1px solid rgba(242,242,242,0.12)" }}
        >
          <div className="text-lg font-bold mb-3" style={{ color: "#F2F2F2" }}>
            Help improve Caliber
          </div>
          <p className="text-sm mb-4" style={{ color: "#CFCFCF" }}>
            If you run into issues or have suggestions, send feedback to:
          </p>
          <a
            href={`mailto:${BETA_FEEDBACK_EMAIL}`}
            className="inline-block text-sm font-medium mb-4"
            style={{ color: "#4ADE80" }}
          >
            {BETA_FEEDBACK_EMAIL}
          </a>
          <p className="text-sm mb-2" style={{ color: "#AFAFAF" }}>
            Please include:
          </p>
          <ul className="space-y-1 text-sm" style={{ color: "#AFAFAF" }}>
            <li>• What job page you were viewing</li>
            <li>• What Caliber showed</li>
            <li>• A screenshot if possible</li>
            <li>• The extension version (v{EXTENSION_BETA_VERSION})</li>
          </ul>
          <p className="text-sm mt-4" style={{ color: "#777" }}>
            This will help us debug and improve the tool quickly.
          </p>
        </div>

        {/* Back to calibration */}
        <div className="text-center mb-12">
          <a
            href="/calibration"
            className="inline-flex items-center justify-center rounded-md px-5 py-3 text-sm font-medium transition-colors duration-200"
            style={{
              backgroundColor: "rgba(242,242,242,0.10)",
              color: "#F2F2F2",
              border: "1px solid rgba(242,242,242,0.16)",
            }}
          >
            ← Back to Calibration
          </a>
        </div>
      </div>
    </div>
  );
}
