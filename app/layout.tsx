import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Caliber",
  description: "Internal tooling for calibration",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased text-white`}
        style={{ background: "var(--bg-base)" }}
      >
        {/* ── Shared background skeleton (three zones + framing line) ── */}

        {/* Zone 1 — Atmospheric green wash (full viewport) */}
        <div
          aria-hidden
          className="fixed inset-0 pointer-events-none z-[1]"
          style={{ background: "var(--bg-atmospheric-wash)" }}
        />

        {/* Zone 2 — Top dark region */}
        <div
          aria-hidden
          className="fixed inset-x-0 top-0 pointer-events-none z-[2]"
          style={{ height: "38vh", background: "var(--bg-top-dark)" }}
        />

        {/* Zone 3 — Bottom dark fade */}
        <div
          aria-hidden
          className="fixed inset-x-0 bottom-0 pointer-events-none z-[2]"
          style={{ height: "25vh", background: "var(--bg-bottom-fade)" }}
        />

        {/* Framing line — thin architectural rule above wordmark */}
        <div
          aria-hidden
          className="fixed inset-x-0 pointer-events-none z-[3]"
          style={{
            top: "calc(50% - 5.5rem)",
            height: "1px",
            background: "var(--bg-framing-line)",
          }}
        />

        {/* Content layer */}
        <div className="relative z-10 min-h-screen flex items-center justify-center px-6">
          <div className="w-full max-w-[600px]">
            {children}
          </div>
        </div>
      </body>
    </html>
  );
}