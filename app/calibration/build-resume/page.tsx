"use client";

import Link from "next/link";
import CaliberHeader from "../../components/caliber_header";

export default function BuildResumePage() {
  return (
    <div
      className="fixed inset-0 flex justify-center overflow-y-auto"
      style={{
        background:
          "radial-gradient(ellipse 70% 30% at 50% 55%, rgba(74,222,128,0.045), transparent), #050505",
      }}
    >
    <div
      className="w-full max-w-[600px] px-6 pt-[20vh] pb-16 text-center flex flex-col items-center"
    >
      <CaliberHeader className="mb-8" />

      <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-white mb-4">
        Resume Builder
      </h1>
      <p className="text-sm text-zinc-400 leading-relaxed max-w-sm mx-auto mb-8">
        This feature is coming soon. In the meantime, upload any version
        of your resume to get started — even rough drafts work.
      </p>

      <Link
        href="/calibration"
        className="inline-flex items-center justify-center rounded-md px-6 py-3 text-sm font-semibold transition-all"
        style={{
          backgroundColor: "rgba(74,222,128,0.06)",
          color: "#4ADE80",
          border: "1px solid rgba(74,222,128,0.45)",
          boxShadow: "none",
        }}
      >
        Back to Upload
      </Link>
    </div>
    </div>
  );
}
