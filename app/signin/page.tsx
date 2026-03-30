"use client";
// app/signin/page.tsx — Caliber sign-in (magic-link email + beta email fallback)
import { signIn, getProviders, useSession } from "next-auth/react";
import { useSearchParams, useRouter } from "next/navigation";
import { useState, useEffect, Suspense } from "react";
import CaliberHeader from "../components/caliber_header";

type ProviderMap = Record<string, { id: string; name: string; type: string }>;

// Bypass NextAuth's client-side signIn() to avoid the known getProviders() bug.
// Uses three detection tiers because X-Auth-Return-Redirect:1 is a v4 convention
// and is not reliably honored in NextAuth v5 beta — when ignored, fetch() follows
// the 302 redirect to HTML and res.json() silently fails.
async function directBetaSignIn(email: string, callbackUrl: string) {
  const { csrfToken } = await fetch("/api/auth/csrf")
    .then((r) => r.json())
    .catch(() => ({ csrfToken: "" }));

  const res = await fetch("/api/auth/callback/beta-email", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "X-Auth-Return-Redirect": "1",
    },
    body: new URLSearchParams({ email, csrfToken, callbackUrl, json: "true" }),
  });

  // Tier 1: NextAuth honored the header and returned JSON { url }
  const data: { url?: string; message?: string } = await res.json().catch(() => ({}));

  // Guard: server returned a non-2xx status (e.g. 500 Configuration error).
  // Without this check, Tier 2 would see res.url == the API endpoint (no ?error= param)
  // and navigate the browser to it — surfacing the raw JSON error to the user.
  if (!res.ok) {
    console.error("[Caliber][auth] directBetaSignIn server error", { status: res.status, message: data.message ?? "unknown" });
    return { ok: false as const, error: "Configuration" };
  }

  if (data.url) {
    const redirectUrl = new URL(data.url, window.location.origin);
    if (redirectUrl.searchParams.get("error")) {
      return { ok: false as const, error: redirectUrl.searchParams.get("error") ?? "unknown" };
    }
    return { ok: true as const, url: data.url };
  }

  // Tier 2: fetch() followed the 302 redirect — res.url is the final destination.
  // A successful auth lands on callbackUrl (/pipeline); an error lands on /signin?error=…
  if (res.url) {
    const finalUrl = new URL(res.url, window.location.origin);
    const errorParam = finalUrl.searchParams.get("error");
    if (errorParam) {
      return { ok: false as const, error: errorParam };
    }
    // No error param — auth succeeded; navigate to where the server sent us.
    return { ok: true as const, url: res.url };
  }

  // Tier 3: Read the session endpoint directly to confirm whether a session exists.
  const session = await fetch("/api/auth/session")
    .then((r) => r.json())
    .catch(() => ({}));
  if (session?.user?.email) {
    return { ok: true as const, url: callbackUrl };
  }

  return { ok: false as const, error: "unknown" };
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
        // POST directly to the credentials callback — bypasses the getProviders()
        // bug in NextAuth's client-side signIn() that ignores redirect:false.
        console.debug("[Caliber][auth] directBetaSignIn — email=" + email.trim() + " callbackUrl=" + callbackUrl);
        const result = await directBetaSignIn(email.trim(), callbackUrl);
        console.debug("[Caliber][auth] directBetaSignIn result", result);
        setSending(false);
        if (result.ok) {
          console.debug("[Caliber][auth] redirecting to", result.url);
          window.location.href = result.url;
        } else {
          setAuthError(
            result.error === "CredentialsSignin"
              ? "Could not sign in. Please check your email and try again."
              : result.error === "Configuration"
              ? "Server error — please try again in a moment."
              : "Sign-in failed. Please try again."
          );
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
          <p className="text-neutral-500 text-xs mt-2">
            Didn&rsquo;t receive it? Check your spam folder.
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

function SignInPageContent() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useSearchParams();
  const isAuthenticated = status === "authenticated" && !!session?.user;
  const callbackUrl = params.get("callbackUrl") || "/pipeline";

  // Redirect authenticated users — signin page is not needed
  useEffect(() => {
    if (isAuthenticated) {
      router.replace(callbackUrl);
    }
  }, [isAuthenticated, callbackUrl, router]);

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center pb-16">
      <div className="relative z-10 w-full max-w-[600px] mx-auto px-4 flex-1 flex flex-col justify-center">
        <CaliberHeader />

        {!isAuthenticated && (
          /* ── Not signed in — show sign-in form ── */
          <>
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
          </>
        )}

        {isAuthenticated && session?.user?.email && (
          <div className="mt-6 text-center space-y-4">
            <div className="text-neutral-300 text-base font-medium">
              You&apos;re signed in
            </div>
            <div className="text-neutral-500 text-sm">{session.user.email}</div>
            <a
              href="/pipeline"
              className="inline-block mt-2 px-6 py-2.5 rounded-lg font-semibold text-sm transition-all"
              style={{
                background: "rgba(74,222,128,0.10)",
                color: "#4ADE80",
                border: "1px solid rgba(74,222,128,0.55)",
              }}
            >
              Go to Saved Jobs →
            </a>
          </div>
        )}
      </div>

      {/* Signed-in status footer — subtle, informational only */}
      {isAuthenticated && session?.user?.email && (
        <div className="pb-6 text-center">
          <span className="text-xs" style={{ color: "rgba(161,161,170,0.45)" }}>
            Signed in as {session.user.email}
          </span>
        </div>
      )}
    </div>
  );
}

export default function SignInPage() {
  return (
    <Suspense fallback={<div className="min-h-screen" />}>
      <SignInPageContent />
    </Suspense>
  );
}
