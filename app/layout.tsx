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
        style={{ background: "#050505" }}
      >
        {/* Layer 1: Broad green atmospheric wash */}
        <div
          aria-hidden
          className="fixed inset-0 pointer-events-none z-[1]"
          style={{
            background:
              "radial-gradient(ellipse 140% 80% at 50% 32%, rgba(74,222,128,0.06) 0%, rgba(74,222,128,0.025) 45%, transparent 78%)",
          }}
        />
        {/* Layer 2: Top darkening — sculpts the wash into depth */}
        <div
          aria-hidden
          className="fixed inset-x-0 top-0 pointer-events-none z-[2]"
          style={{
            height: "100vh",
            background:
              "linear-gradient(to bottom, rgba(0,0,0,0.42) 0%, rgba(0,0,0,0.18) 38%, rgba(0,0,0,0.06) 62%, transparent 100%)",
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
        {/* Hero surface plane — lifted dark value for depth separation */}
        <div
          aria-hidden
          className="fixed inset-0 pointer-events-none z-[4]"
          style={{
            background:
              "radial-gradient(ellipse 60% 45% at 50% 52%, rgba(26,26,26,0.65) 0%, rgba(20,20,20,0.45) 35%, rgba(12,12,12,0.25) 55%, rgba(5,5,5,0) 75%)",
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