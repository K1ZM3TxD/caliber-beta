"use client";
// app/signin/page.tsx — Caliber sign-in (Google + magic-link email + beta email)
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

  const hasGoogle = !!providers?.google;
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
          {errorCode === "OAuthAccountNotLinked"
            ? "This email is already registered with a different sign-in method."
            : errorCode === "CredentialsSignin"
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
          {/* Google */}
          {hasGoogle && (
            <button
              onClick={() => signIn("google", { callbackUrl })}
              className="w-full py-3 rounded-lg font-medium text-sm transition-all flex items-center justify-center gap-3"
              style={{
                background: "rgba(255,255,255,0.04)",
                color: "#e5e5e5",
                border: "1px solid rgba(255,255,255,0.10)",
              }}
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              Continue with Google
            </button>
          )}

          {/* Divider — only when Google is available */}
          {hasGoogle && (
            <div className="flex items-center gap-3">
              <div className="flex-1 h-px" style={{ background: "rgba(255,255,255,0.06)" }} />
              <span className="text-neutral-500 text-xs">or</span>
              <div className="flex-1 h-px" style={{ background: "rgba(255,255,255,0.06)" }} />
            </div>
          )}

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
