"use client";

import {
  CHROME_STORE_URL,
  EXTENSION_ZIP_PATH,
  EXTENSION_BETA_VERSION,
} from "@/lib/extension_config";

interface ExtensionInstallBlockProps {
  calibratedTitle?: string | null;
}

export default function ExtensionInstallBlock({ calibratedTitle }: ExtensionInstallBlockProps) {
  const hasStoreUrl = Boolean(CHROME_STORE_URL);

  return (
    <div className="cb-reveal w-full">
      {/* Download CTA */}
      <div className="text-center mb-5">
        {hasStoreUrl ? (
          <a
            href={CHROME_STORE_URL!}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center rounded-lg px-7 py-3 text-sm font-semibold transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2"
            style={{
              background: "rgba(74,222,128,0.06)",
              color: "#4ADE80",
              border: "1px solid rgba(74,222,128,0.45)",
              cursor: "pointer",
              minWidth: 240,
            }}
          >
            Add to Chrome
          </a>
        ) : (
          <a
            href={EXTENSION_ZIP_PATH}
            download
            className="inline-flex items-center justify-center rounded-lg px-7 py-3 text-sm font-semibold transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2"
            style={{
              background: "rgba(74,222,128,0.06)",
              color: "#4ADE80",
              border: "1px solid rgba(74,222,128,0.45)",
              cursor: "pointer",
              minWidth: 240,
            }}
          >
            Download Caliber Extension
          </a>
        )}
        <div className="mt-1.5 text-[11px]" style={{ color: "#666" }}>
          v{EXTENSION_BETA_VERSION} &middot; Chrome &middot; {hasStoreUrl ? "Chrome Web Store" : "ZIP download"}
        </div>
      </div>

      {/* Compact install instructions */}
      <div
        className="rounded-lg px-5 py-4 mb-5 text-left"
        style={{
          backgroundColor: "rgba(255,255,255,0.02)",
          border: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        <div className="text-xs font-semibold uppercase tracking-widest mb-2.5" style={{ color: "#555" }}>
          Install in 30 seconds
        </div>
        <ol className="space-y-1.5 text-[13px] list-decimal list-inside" style={{ color: "#999" }}>
          <li>Download the ZIP above and unzip it.</li>
          <li>
            Open{" "}
            <code
              className="px-1 py-0.5 rounded text-[11px] select-all cursor-pointer"
              style={{ backgroundColor: "rgba(255,255,255,0.06)", color: "#4ADE80" }}
            >
              chrome://extensions
            </code>
          </li>
          <li>Turn on <strong style={{ color: "#bbb" }}>Developer Mode</strong> (top right).</li>
          <li>Click <strong style={{ color: "#bbb" }}>Load unpacked</strong> and select the folder.</li>
        </ol>
      </div>

      {/* LinkedIn search CTA */}
      {calibratedTitle ? (
        <div className="text-center">
          <a
            href={`https://www.linkedin.com/jobs/search/?keywords=${encodeURIComponent(calibratedTitle)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="group inline-flex items-center justify-center gap-2 rounded-lg px-6 py-2.5 text-sm font-medium transition-colors duration-200"
            style={{
              backgroundColor: "rgba(242,242,242,0.06)",
              color: "#CFCFCF",
              border: "1px solid rgba(242,242,242,0.12)",
              cursor: "pointer",
            }}
          >
            <span>Search &ldquo;{calibratedTitle}&rdquo; on LinkedIn</span>
            <span
              style={{ fontSize: "1.1em", display: "inline-block", transition: "transform 0.2s" }}
              className="group-hover:translate-x-0.5"
            >
              {"\u2192"}
            </span>
          </a>
        </div>
      ) : null}
    </div>
  );
}
