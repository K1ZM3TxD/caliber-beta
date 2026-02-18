// app/page.tsx
import Link from "next/link"

export default function HomePage() {
  return (
    <main className="fixed inset-0 w-screen h-[100svh] bg-[#0B0B0B] text-[#F2F2F2] flex items-center justify-center">
      <div className="w-full max-w-[720px] px-6 text-center">
        <div className="text-xs tracking-[0.35em] opacity-80">
          WELCOME TO
        </div>

        <h1 className="mt-3 text-5xl sm:text-6xl font-semibold tracking-tight">
          Caliber
        </h1>

        <p className="mt-4 text-base sm:text-lg opacity-90">
          The alignment tool for job calibration.
        </p>

        <div className="mt-8 flex items-center justify-center">
          <Link
            href="/calibration"
            className="inline-flex items-center justify-center px-5 py-3 text-sm font-semibold bg-[#F2F2F2] text-[#0B0B0B] hover:bg-white transition-colors"
          >
            Begin Calibration
          </Link>
        </div>
      </div>
    </main>
  )
}