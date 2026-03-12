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
        style={{ background: "radial-gradient(ellipse 80% 45% at 50% 0%, rgba(74,222,128,0.05), transparent 70%) no-repeat, #050505" }}
      >
        {/* Atmospheric green wash — soft diffuse radial behind content zone */}
        <div
          aria-hidden
          className="fixed inset-0 pointer-events-none z-[1]"
          style={{
            background:
              "radial-gradient(ellipse 120% 70% at 50% 45%, rgba(74,222,128,0.07) 0%, rgba(74,222,128,0.02) 50%, transparent 80%)",
          }}
        />
        {/* Top darkening — gentle vignette */}
        <div
          aria-hidden
          className="fixed inset-x-0 top-0 pointer-events-none z-[2]"
          style={{
            height: "30vh",
            background:
              "linear-gradient(to bottom, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.15) 60%, transparent 100%)",
          }}
        />
        {/* Framing line — thin architectural rule */}
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