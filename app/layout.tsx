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
        <div className="min-h-screen flex justify-center px-6 pt-10 pb-12">
          <div className="w-full max-w-[960px]">
            {children}
          </div>
        </div>
      </body>
    </html>
  );
}