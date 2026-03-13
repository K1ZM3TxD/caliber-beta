"use client";
// app/components/auth_button.tsx — Lightweight sign-in / user indicator
import { useSession, signOut } from "next-auth/react";
import Link from "next/link";
import { useState, useRef, useEffect } from "react";

export default function AuthButton() {
  const { data: session, status } = useSession();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  if (status === "loading") return null;

  if (!session?.user) {
    return (
      <Link
        href="/signin"
        className="text-sm text-neutral-500 hover:text-neutral-300 transition-colors"
      >
        Sign in
      </Link>
    );
  }

  const initial = (session.user.name?.[0] || session.user.email?.[0] || "?").toUpperCase();

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-colors"
        style={{
          background: "rgba(74,222,128,0.10)",
          color: "#4ADE80",
          border: "1px solid rgba(74,222,128,0.25)",
        }}
        title={session.user.email || "Account"}
      >
        {initial}
      </button>
      {open && (
        <div
          className="absolute right-0 mt-2 w-52 rounded-lg py-2 z-50 shadow-xl"
          style={{
            background: "#141414",
            border: "1px solid rgba(255,255,255,0.08)",
          }}
        >
          <div className="px-4 py-2 border-b" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
            <div className="text-sm text-neutral-300 truncate">{session.user.name || "User"}</div>
            <div className="text-xs text-neutral-500 truncate">{session.user.email}</div>
          </div>
          <button
            onClick={() => signOut({ callbackUrl: "/" })}
            className="w-full text-left px-4 py-2 text-sm text-neutral-400 hover:text-white hover:bg-white/5 transition-colors"
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
