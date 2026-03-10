"use client";

export default function BuildResumePage() {
  return (
    <div
      className="w-full py-16 text-center"
      style={{
        background:
          "radial-gradient(ellipse 60% 35% at 50% 0%, rgba(74,222,128,0.045), transparent)",
      }}
    >
      <div className="mb-8">
        <span
          className="text-sm font-medium tracking-[0.22em] uppercase text-zinc-400"
          style={{ textShadow: "0 0 40px rgba(74,222,128,0.08)" }}
        >
          Caliber
        </span>
      </div>

      <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-white mb-4">
        Resume Builder
      </h1>
      <p className="text-sm text-zinc-400 leading-relaxed max-w-sm mx-auto mb-8">
        This feature is coming soon. In the meantime, upload any version
        of your resume to get started — even rough drafts work.
      </p>

      <a
        href="/calibration"
        className="inline-flex items-center justify-center rounded-md px-6 py-3 text-sm font-semibold transition-all"
        style={{
          backgroundColor: "#4ADE80",
          color: "#0B0B0B",
          boxShadow: "0 4px 20px rgba(74,222,128,0.15)",
        }}
      >
        Back to Upload
      </a>
    </div>
  );
}
