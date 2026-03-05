export default function ExtensionPage() {
  return (
    <div className="fixed inset-0 bg-[#0B0B0B] flex justify-center items-start pt-[8vh] overflow-y-auto">
      <div className="w-full max-w-[620px] px-6" style={{ color: "#F2F2F2" }}>
        <div className="text-center font-semibold tracking-tight text-4xl sm:text-5xl mb-6">Caliber Extension</div>
        <div className="text-center text-lg sm:text-xl mb-8" style={{ color: "#CFCFCF" }}>
          Get a fit score on LinkedIn or Indeed — without copy/paste.
        </div>

        {/* Install instructions */}
        <div className="rounded-lg px-6 py-8 mb-6" style={{ backgroundColor: "#141414", border: "1px solid rgba(242,242,242,0.12)" }}>
          <div className="text-xl font-bold mb-4" style={{ color: "#4ADE80" }}>Install (Developer Mode)</div>
          <ol className="space-y-3 text-sm leading-relaxed" style={{ color: "#CFCFCF" }}>
            <li className="flex gap-3">
              <span className="font-bold shrink-0" style={{ color: "#4ADE80" }}>1.</span>
              <span>Pull the latest repo — the <code className="px-1 py-0.5 rounded text-xs" style={{ backgroundColor: "rgba(242,242,242,0.08)" }}>extension/</code> folder is at the project root.</span>
            </li>
            <li className="flex gap-3">
              <span className="font-bold shrink-0" style={{ color: "#4ADE80" }}>2.</span>
              <span>Open Chrome → <strong>chrome://extensions</strong> → toggle <strong>Developer mode</strong> on (top right).</span>
            </li>
            <li className="flex gap-3">
              <span className="font-bold shrink-0" style={{ color: "#4ADE80" }}>3.</span>
              <span>Click <strong>Load unpacked</strong> → select the <code className="px-1 py-0.5 rounded text-xs" style={{ backgroundColor: "rgba(242,242,242,0.08)" }}>extension/</code> folder.</span>
            </li>
            <li className="flex gap-3">
              <span className="font-bold shrink-0" style={{ color: "#4ADE80" }}>4.</span>
              <span>Make sure Caliber is running locally (<code className="px-1 py-0.5 rounded text-xs" style={{ backgroundColor: "rgba(242,242,242,0.08)" }}>npm run dev</code>) and you've completed your profile intake.</span>
            </li>
            <li className="flex gap-3">
              <span className="font-bold shrink-0" style={{ color: "#4ADE80" }}>5.</span>
              <span>Go to a LinkedIn or Indeed job page → click the Caliber extension icon → see your fit score.</span>
            </li>
          </ol>
        </div>

        {/* How it works */}
        <div className="rounded-lg px-6 py-6 mb-8" style={{ backgroundColor: "#141414", border: "1px solid rgba(242,242,242,0.12)" }}>
          <div className="text-lg font-bold mb-3" style={{ color: "#F2F2F2" }}>How it works</div>
          <ul className="space-y-2 text-sm" style={{ color: "#AFAFAF" }}>
            <li>• The extension extracts the job description from the current page automatically.</li>
            <li>• It sends the text to your local Caliber backend, which scores it against your profile.</li>
            <li>• You see: Fit Score, Supports the fit, Stretch factors, and Bottom line — instantly.</li>
            <li>• If extraction fails, highlight the job text on the page and click <strong>Recalculate</strong>.</li>
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
