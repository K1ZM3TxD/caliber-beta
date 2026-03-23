"use client";
// app/signin/page.tsx — Caliber sign-in (magic-link email + beta email fallback)
import { signIn, getProviders } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { useState, useEffect, Suspense } from "react";
import CaliberHeader from "../components/caliber_header";

type ProviderMap = Record<string, { id: string; name: string; type: string }>;

/**
 * Direct POST to the NextAuth beta-email callback, bypassing the buggy
 * `signIn()` from next-auth/react@5.0.0-beta.30 which calls getProviders()
 * internally and — on null — redirects to the error page, ignoring
 * redirect:false entirely.
 */
async function directBetaSignIn(
  email: string,
  callbackUrl: string,
): Promise<{ ok: boolean; url?: string; error?: string }> {
  // 1. Obtain CSRF token
  const csrfRes = await fetch("/api/auth/csrf");
  if (!csrfRes.ok) return { ok: false, error: "Unable to reach sign-in service." };
  const { csrfToken } = await csrfRes.json();

  // 2. POST to the credentials callback with X-Auth-Return-Redirect so the
  //    server returns JSON { url } instead of a 302 redirect.
  const res = await fetch("/api/auth/callback/beta-email", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "X-Auth-Return-Redirect": "1",
    },
    body: new URLSearchParams({ email, csrfToken, callbackUrl }),
  });

  // 3. Parse the JSON response (safe — falls back to empty object)
  const data: { url?: string } = await res.json().catch(() => ({}));

  if (!res.ok || !data.url) {
    return { ok: false, error: "Sign-in failed. Please try again." };
  }

  // 4. Check if the returned URL contains an auth error param
  try {
    const redirect = new URL(data.url, window.location.origin);
    const err = redirect.searchParams.get("error");
    if (err) {
      return {
        ok: false,
        error: err === "CredentialsSignin"
          ? "Could not sign in. Please check your email and try again."
          : "Sign-in failed. Please try again.",
      };
    }
  } catch {
    // URL parsing failed — server returned something unexpected; try the URL anyway
  }

  return { ok: true, url: data.url };
}

function SignInForm() {
  const params = useSearchParams();
  const isVerify = params.get("verify") === "1";
  const callbackUrl = params.get("callbackUrl") || "/pipeline";
  const errorCode = params.get("error");

  const [email, setEmail] = useState("");
  const [emailSent, setEmailSent] = useState(isVerify);
  const [sending, setSending] = useState(false);
  const [authError, setAuthError] = useState("");
  const [providers, setProviders] = useState<ProviderMap | null>(null);

  // ── Clear stale ?error= param after capturing it ──
  // Without this, refreshing or navigating back always re-shows the error
  // even though the underlying issue may have been transient.
  useEffect(() => {
    if (errorCode) {
      const url = new URL(window.location.href);
      url.searchParams.delete("error");
      window.history.replaceState({}, "", url.toString());
    }
  }, [errorCode]);

  useEffect(() => {
    getProviders()
      .then((p) => {
        console.debug("[Caliber][auth] providers loaded", { keys: p ? Object.keys(p) : "null" });
        setProviders(p ?? {});
      })
      .catch((err) => {
        console.warn("[Caliber][auth] getProviders failed, falling back to beta-email", err);
        // beta-email is always configured server-side — allow sign-in even if
        // the providers API call fails (network error, cold-start timeout, etc.)
        setProviders({ "beta-email": { id: "beta-email", name: "Email", type: "credentials" } });
      });
  }, []);

  const hasNodemailer = !!providers?.nodemailer;
  // beta-email is unconditionally pushed in auth.ts — treat it as available
  // even when getProviders() returns an empty map (e.g. NextAuth cold-start).
  const hasBetaEmail = !!providers?.["beta-email"] || (providers !== null && !hasNodemailer);

  const handleEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setSending(true);
    setAuthError("");
    console.debug("[Caliber][auth] sign-in start", { provider: hasNodemailer ? "nodemailer" : "beta-email", email: email.trim() });

    try {
      if (hasNodemailer) {
        // Magic-link flow — sends email, shows confirmation
        console.debug("[Caliber][auth] signIn request — provider=nodemailer");
        await signIn("nodemailer", { email: email.trim(), callbackUrl });
        console.debug("[Caliber][auth] magic-link sent");
        setEmailSent(true);
        setSending(false);
      } else if (hasBetaEmail) {
        // Direct POST to callback — bypasses the buggy signIn() from
        // next-auth/react which silently redirects to the error page on
        // transient getProviders() failures (see directBetaSignIn above).
        console.debug("[Caliber][auth] directBetaSignIn — email=" + email.trim() + " callbackUrl=" + callbackUrl);
        const result = await directBetaSignIn(email.trim(), callbackUrl);
        console.debug("[Caliber][auth] signIn result", result);
        setSending(false);
        if (result.ok && result.url) {
          console.debug("[Caliber][auth] redirecting to", result.url);
          window.location.href = result.url;
        } else {
          setAuthError(result.error || "Sign-in failed. Please try again.");
        }
      } else {
        console.warn("[Caliber][auth] no provider available");
        setSending(false);
        setAuthError("Sign-in is temporarily unavailable. Please try again later.");
      }
    } catch (err) {
      console.error("[Caliber][auth] sign-in error", err);
      setSending(false);
      setAuthError("Something went wrong. Please try again.");
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

  // Map NextAuth error codes (from pages.error redirect) and inline errors
  const displayError = authError
    ? authError
    : errorCode === "CredentialsSignin"
    ? "Could not sign in. Please check your email and try again."
    : errorCode === "Configuration"
    ? "Unable to connect. Please try again."
    : errorCode === "AccessDenied"
    ? "Access denied. Your account may not be authorized."
    : errorCode
    ? "Something went wrong. Please try again."
    : "";

  return (
    <div className="space-y-6">
      {displayError && (
        <div className="text-red-400 text-sm text-center px-4 py-3 rounded-lg" style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)" }}>
          {displayError}
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
            background: "rgba(255,255,255,0.06)",
            border: "1px solid rgba(255,255,255,0.14)",
          }}
          autoComplete="email"
        />
        <button
          type="submit"
          disabled={sending || !email.trim()}
          className="w-full py-3 rounded-lg font-semibold text-sm transition-all disabled:opacity-40"
          style={{
            background: "rgba(74,222,128,0.10)",
            color: "#4ADE80",
            border: "1px solid rgba(74,222,128,0.55)",
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
            Save your scored jobs and pick up where you left off.
          </p>
        </div>

        <div
          className="mt-8 mx-auto max-w-[380px] p-6 rounded-xl"
          style={{
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.09)",
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
