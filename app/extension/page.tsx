export default function ExtensionPage() {
  return (
    <div className="fixed inset-0 bg-[#0B0B0B] flex justify-center items-start pt-[12vh] overflow-y-auto">
      <div className="w-full max-w-[620px] px-6 text-center" style={{ color: "#F2F2F2" }}>
        <div className="font-semibold tracking-tight text-4xl sm:text-5xl mb-6">Caliber Extension</div>
        <div className="text-lg sm:text-xl mb-8" style={{ color: "#CFCFCF" }}>
          Get a fit score on LinkedIn or Indeed — without copy/paste.
        </div>
        <div className="rounded-lg px-6 py-8 mb-8" style={{ backgroundColor: "#141414", border: "1px solid rgba(242,242,242,0.12)" }}>
          <div className="text-2xl font-bold mb-3" style={{ color: "#4ADE80" }}>Coming Soon</div>
          <p className="text-sm leading-relaxed" style={{ color: "#AFAFAF" }}>
            The Caliber browser extension will let you score any job posting directly on LinkedIn and Indeed.
            No tab switching, no pasting — just click and get your fit score inline.
          </p>
        </div>
        <a
          href="/calibration"
          className="inline-flex items-center justify-center rounded-md px-5 py-3 text-sm font-medium transition-colors duration-200"
          style={{ backgroundColor: "rgba(242,242,242,0.10)", color: "#F2F2F2", border: "1px solid rgba(242,242,242,0.16)" }}
        >
          ← Back to Calibration
        </a>
      </div>
    </div>
  );
}
