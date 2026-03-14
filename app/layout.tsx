import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import AuthSessionProvider from "./components/session_provider";

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
        <AuthSessionProvider>
          <div className="min-h-screen flex justify-center px-4 sm:px-6 pb-12">
            <div className="w-full max-w-[960px]">
              {children}
            </div>
          </div>
        </AuthSessionProvider>
      </body>
    </html>
  );
}