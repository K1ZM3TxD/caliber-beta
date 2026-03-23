"use client";

import { useState } from "react";
import {
  EXTENSION_ZIP_PATH,
  EXTENSION_BETA_VERSION,
} from "@/lib/extension_config";

interface ExtensionInstallBlockProps {
  calibratedTitle?: string | null;
  hideLinkedIn?: boolean;
}

export default function ExtensionInstallBlock({ calibratedTitle, hideLinkedIn }: ExtensionInstallBlockProps) {
  const [showInstall, setShowInstall] = useState(false);

  return (
    <div className="cb-reveal w-full">
      {/* Download CTA — reveals install instructions inline */}
      <div className="text-center mb-5">
        <button
          type="button"
          onClick={() => setShowInstall((prev) => !prev)}
          className="inline-flex items-center justify-center rounded-lg px-7 py-3 text-sm font-semibold transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2"
          style={{
            background: "rgba(74,222,128,0.10)",
            color: "#4ADE80",
            border: "1px solid rgba(74,222,128,0.55)",
            cursor: "pointer",
            minWidth: 240,
          }}
        >
          Download Caliber Extension
        </button>
        <div className="mt-1.5 text-[11px]" style={{ color: "#666" }}>
          v{EXTENSION_BETA_VERSION} &middot; Chrome
        </div>
      </div>

      {/* Install instructions + LinkedIn CTA — revealed on button click */}
      {showInstall && (
        <div className="cb-reveal">
          {/* Compact install instructions */}
          <div
            className="rounded-lg px-5 py-4 mb-5 text-left"
            style={{
              backgroundColor: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.09)",
            }}
          >
            <div className="text-xs font-semibold uppercase tracking-widest mb-2.5" style={{ color: "#555" }}>
              Install in 30 seconds
            </div>
            <ol className="space-y-1.5 text-[13px] list-decimal list-inside" style={{ color: "#999" }}>
              <li>
                <a
                  href={EXTENSION_ZIP_PATH}
                  download
                  className="font-medium transition-colors duration-200"
                  style={{ color: "#4ADE80" }}
                >Download the ZIP</a>{" "}
                and unzip it.
              </li>
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
          {calibratedTitle && !hideLinkedIn ? (
            <div className="text-center">
              <a
                href={`https://www.linkedin.com/jobs/search/?keywords=${encodeURIComponent(calibratedTitle)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="group inline-flex items-center justify-center gap-2 rounded-lg px-6 py-2.5 text-sm font-semibold transition-colors duration-200"
                style={{
                  background: "rgba(74,222,128,0.10)",
                  color: "#4ADE80",
                  border: "1px solid rgba(74,222,128,0.55)",
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
      )}
    </div>
  );
}
