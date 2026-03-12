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
        {/* Framing line — thin architectural rule above wordmark */}
        <div
          aria-hidden
          className="fixed inset-x-0 pointer-events-none z-[1]"
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