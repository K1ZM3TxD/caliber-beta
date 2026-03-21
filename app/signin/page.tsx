"use client";
// app/signin/page.tsx — Caliber sign-in (magic-link email + beta email fallback)
import { signIn, getProviders } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { useState, useEffect, Suspense } from "react";
import CaliberHeader from "../components/caliber_header";

type ProviderMap = Record<string, { id: string; name: string; type: string }>;

function SignInForm() {
  const params = useSearchParams();
  const isVerify = params.get("verify") === "1";
  const callbackUrl = params.get("callbackUrl") || "/pipeline";
  const errorCode = params.get("error");

  const [email, setEmail] = useState("");
  const [emailSent, setEmailSent] = useState(isVerify);
  const [sending, setSending] = useState(false);
  const [providers, setProviders] = useState<ProviderMap | null>(null);

  useEffect(() => {
    getProviders().then((p) => setProviders(p ?? {}));
  }, []);

  const hasNodemailer = !!providers?.nodemailer;
  const hasBetaEmail = !!providers?.["beta-email"];

  const handleEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setSending(true);

    if (hasNodemailer) {
      // Magic-link flow — sends email, shows confirmation
      await signIn("nodemailer", { email: email.trim(), callbackUrl });
      setEmailSent(true);
      setSending(false);
    } else if (hasBetaEmail) {
      // Beta direct sign-in — no email verification, instant auth
      const result = await signIn("beta-email", {
        email: email.trim(),
        callbackUrl,
        redirect: false,
      });
      setSending(false);
      if (result?.ok) {
        // Redirect manually after successful auth
        window.location.href = callbackUrl;
      } else {
        // Show error inline
        setEmailSent(false);
      }
    }
  };

  // After magic link sent — confirmation screen
  if (emailSent) {
    return (
      <div className="space-y-6 text-center">
        <div
          className="w-12 h-12 mx-auto rounded-full flex items-center justify-center"
          style={{
            background: "rgba(74,222,128,0.08)",
            border: "1px solid rgba(74,222,128,0.3)",
          }}
        >
          <svg className="w-6 h-6 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        </div>
        <div>
          <h2 className="text-neutral-200 text-lg font-semibold">Check your email</h2>
          <p className="text-neutral-400 text-sm mt-2 leading-relaxed">
            We sent a sign-in link to your email.
            <br />
            Click it to continue — no password needed.
          </p>
        </div>
        <button
          onClick={() => setEmailSent(false)}
          className="text-sm text-neutral-500 hover:text-neutral-300 transition-colors"
        >
          Use a different email
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {errorCode && (
        <div className="text-red-400 text-sm text-center px-4 py-3 rounded-lg" style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)" }}>
          {errorCode === "CredentialsSignin"
            ? "Could not sign in. Please check your email and try again."
            : "Something went wrong. Please try again."}
        </div>
      )}

      {/* Loading providers */}
      {providers === null && (
        <div className="text-center py-4">
          <div className="text-neutral-500 text-sm">Loading…</div>
        </div>
      )}

      {providers !== null && (
        <>
      {/* Email magic link / beta sign-in */}
      <form onSubmit={handleEmail} className="space-y-3">
        <input
          type="email"
          placeholder="you@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="w-full px-4 py-3 rounded-lg text-sm text-neutral-200 placeholder-neutral-600 outline-none transition-colors"
          style={{
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.10)",
          }}
          autoComplete="email"
        />
        <button
          type="submit"
          disabled={sending || !email.trim()}
          className="w-full py-3 rounded-lg font-semibold text-sm transition-all disabled:opacity-40"
          style={{
            background: "rgba(74,222,128,0.06)",
            color: "#4ADE80",
            border: "1px solid rgba(74,222,128,0.45)",
          }}
        >
          {sending ? "Signing in…" : "Continue with email"}
        </button>
      </form>

      <p className="text-neutral-600 text-xs text-center leading-relaxed">
        {hasNodemailer
          ? "We\u2019ll send a sign-in link \u2014 no password required."
          : "No password required \u2014 just your email."}
      </p>
        </>
      )}
    </div>
  );
}

export default function SignInPage() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center pb-16">
      {/* Ambient glow — matches current shell baseline */}
      <div
        className="pointer-events-none fixed inset-x-0 top-0"
        style={{
          height: "50vh",
          background: "radial-gradient(ellipse 100% 70% at 50% -20%, rgba(74,222,128,0.045) 0%, rgba(74,222,128,0.015) 40%, transparent 70%)",
          zIndex: 0,
        }}
      />
      <div className="relative z-10 w-full max-w-[600px] mx-auto px-4">
        <CaliberHeader />

        <div className="mt-6 text-center">
          <h1 className="text-neutral-200 text-xl font-semibold tracking-tight">
            Sign in to Caliber
          </h1>
          <p className="text-neutral-400 text-sm mt-2">
            Save your pipeline and pick up where you left off.
          </p>
        </div>

        <div
          className="mt-8 mx-auto max-w-[380px] p-6 rounded-xl"
          style={{
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          <Suspense fallback={<div className="h-48" />}>
            <SignInForm />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
