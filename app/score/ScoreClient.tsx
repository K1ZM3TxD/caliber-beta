"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";

interface FitResult {
  score_0_to_10: number;
  bottom_line_2s: string;
  supports_fit: string[];
  stretch_factors: string[];
  hiring_reality_check: {
    band: string;
    reason: string;
    execution_evidence_gap: string | null;
  };
  calibration_title: string;
}

function getDecision(score: number): string {
  if (score >= 9.0) return "Excellent Match";
  if (score >= 8.0) return "Very Strong Match";
  if (score >= 7.0) return "Strong Partial Match";
  if (score >= 6.0) return "Viable Stretch";
  if (score >= 5.0) return "Adjacent Background";
  return "Poor Fit";
}

function getScoreColor(score: number): string {
  if (score >= 7.5) return "#4ADE80";
  if (score >= 5.0) return "#FBBF24";
  return "#EF4444";
}

function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const m = document.cookie.match(new RegExp("(?:^|; )" + name + "=([^;]*)"));
  return m ? decodeURIComponent(m[1]) : null;
}

const MIN_CHARS = 200;

export default function ScoreClient() {
  const [jobText, setJobText] = useState("");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<FitResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setSessionId(getCookie("caliber_sessionId"));
    textareaRef.current?.focus();
  }, []);

  const charCount = jobText.length;
  const canSubmit = charCount >= MIN_CHARS && !loading;

  async function handleScore() {
    if (!canSubmit) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const body: Record<string, unknown> = { jobText: jobText.trim() };
      if (sessionId) body.sessionId = sessionId;
      const res = await fetch("/api/extension/fit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json) {
        setError(json?.error ?? `Request failed (${res.status})`);
        return;
      }
      setResult(json as FitResult);
    } catch (e: any) {
      setError(e?.message ?? "Network error");
    } finally {
      setLoading(false);
    }
  }

  function handleReset() {
    setResult(null);
    setError(null);
    setJobText("");
    setTimeout(() => textareaRef.current?.focus(), 50);
  }

  const scoreColor = result ? getScoreColor(result.score_0_to_10) : "#4ADE80";
  const decision = result ? getDecision(result.score_0_to_10) : "";

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "flex-start",
        paddingTop: "clamp(32px, 6vh, 72px)",
        paddingBottom: 48,
        position: "relative",
      }}
    >
      {/* Ambient glow */}
      <div
        style={{
          position: "fixed",
          inset: 0,
          background:
            "radial-gradient(ellipse 70% 50% at 50% 35%, rgba(74,222,128,0.06) 0%, rgba(74,222,128,0.02) 50%, transparent 80%)",
          zIndex: 0,
          pointerEvents: "none",
        }}
      />

      <div
        style={{
          position: "relative",
          zIndex: 1,
          width: "100%",
          maxWidth: 640,
          padding: "0 16px",
        }}
      >
        {/* Back nav */}
        <div style={{ marginBottom: 24 }}>
          <Link
            href="/pipeline"
            style={{
              fontSize: "0.8rem",
              color: "rgba(207,207,207,0.35)",
              textDecoration: "none",
              letterSpacing: "0.05em",
            }}
          >
            ← Pipeline
          </Link>
        </div>

        {/* Header */}
        <div style={{ marginBottom: 28 }}>
          <h2
            style={{
              fontSize: "1.1rem",
              fontWeight: 600,
              letterSpacing: "0.12em",
              color: "rgba(237,237,237,0.78)",
              margin: 0,
            }}
          >
            Score a Job
          </h2>
          <p
            style={{
              marginTop: 8,
              fontSize: "0.85rem",
              color: "rgba(161,161,170,0.55)",
              lineHeight: 1.6,
            }}
          >
            Paste a job description to see how well it fits your calibrated profile.
          </p>
        </div>

        {/* Input phase */}
        {!result && (
          <div>
            <textarea
              ref={textareaRef}
              value={jobText}
              onChange={(e) => setJobText(e.target.value)}
              disabled={loading}
              placeholder="Paste the full job description here…"
              rows={12}
              style={{
                width: "100%",
                padding: "14px 16px",
                borderRadius: 8,
                background: "rgba(255,255,255,0.04)",
                border: "1.5px solid rgba(255,255,255,0.10)",
                color: "#F2F2F2",
                fontSize: "0.875rem",
                lineHeight: 1.65,
                resize: "vertical",
                outline: "none",
                fontFamily: "inherit",
                boxSizing: "border-box",
                transition: "border-color 0.2s",
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = "rgba(74,222,128,0.45)";
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = "rgba(255,255,255,0.10)";
              }}
            />

            {/* Char count + hint */}
            <div
              style={{
                marginTop: 6,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <span
                style={{
                  fontSize: "0.75rem",
                  color:
                    charCount >= MIN_CHARS
                      ? "rgba(74,222,128,0.6)"
                      : "rgba(161,161,170,0.4)",
                }}
              >
                {charCount < MIN_CHARS
                  ? `${MIN_CHARS - charCount} more characters needed`
                  : `${charCount} characters`}
              </span>
            </div>

            {/* Error */}
            {error && (
              <div
                style={{
                  marginTop: 12,
                  padding: "10px 14px",
                  borderRadius: 6,
                  background: "#2A0F0F",
                  color: "#FFD1D1",
                  fontSize: "0.82rem",
                  lineHeight: 1.5,
                }}
              >
                {error}
              </div>
            )}

            {/* Submit */}
            <div style={{ marginTop: 18, display: "flex", justifyContent: "center" }}>
              <button
                type="button"
                onClick={handleScore}
                disabled={!canSubmit}
                style={{
                  padding: "12px 32px",
                  borderRadius: 8,
                  fontSize: "14px",
                  fontWeight: 600,
                  backgroundColor: canSubmit
                    ? "rgba(74,222,128,0.10)"
                    : "rgba(74,222,128,0.04)",
                  color: canSubmit ? "#4ADE80" : "rgba(74,222,128,0.35)",
                  border: canSubmit
                    ? "1px solid rgba(74,222,128,0.55)"
                    : "1px solid rgba(74,222,128,0.18)",
                  cursor: canSubmit ? "pointer" : "not-allowed",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  letterSpacing: "0.03em",
                  transition: "all 0.15s",
                }}
              >
                {loading ? (
                  <>
                    <span
                      style={{
                        display: "inline-block",
                        width: 14,
                        height: 14,
                        border: "2px solid rgba(74,222,128,0.2)",
                        borderTop: "2px solid #4ADE80",
                        borderRadius: "50%",
                        animation: "score-spin 0.8s linear infinite",
                      }}
                    />
                    Scoring…
                  </>
                ) : (
                  "Score This Job"
                )}
              </button>
            </div>
          </div>
        )}

        {/* Results phase */}
        {result && (
          <div style={{ animation: "score-fade-up 0.35s ease-out both" }}>
            {/* Score hero */}
            <div
              style={{
                backgroundColor: "rgba(255,255,255,0.05)",
                border: `1.5px solid ${scoreColor}33`,
                borderRadius: 16,
                padding: "28px 24px",
                textAlign: "center",
                boxShadow: `0 0 0 1px ${scoreColor}10, 0 2px 20px rgba(0,0,0,0.35)`,
              }}
            >
              <div
                style={{
                  fontSize: "3.25rem",
                  fontWeight: 700,
                  fontFamily: "var(--font-geist-mono), monospace",
                  color: scoreColor,
                  lineHeight: 1,
                }}
              >
                {result.score_0_to_10.toFixed(1)}
              </div>
              <div
                style={{
                  marginTop: 6,
                  fontSize: "0.8rem",
                  fontWeight: 600,
                  letterSpacing: "0.12em",
                  color: scoreColor,
                  opacity: 0.8,
                }}
              >
                {decision}
              </div>

              {/* Bottom line */}
              {result.bottom_line_2s && (
                <p
                  style={{
                    marginTop: 16,
                    fontSize: "0.875rem",
                    color: "rgba(237,237,237,0.7)",
                    lineHeight: 1.65,
                    textAlign: "left",
                  }}
                >
                  {result.bottom_line_2s}
                </p>
              )}
            </div>

            {/* Supports + Stretch chips */}
            {(result.supports_fit.length > 0 || result.stretch_factors.length > 0) && (
              <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 12 }}>
                {result.supports_fit.slice(0, 3).length > 0 && (
                  <div>
                    <div
                      style={{
                        fontSize: "0.7rem",
                        fontWeight: 600,
                        letterSpacing: "0.10em",
                        color: "#4ADE80",
                        marginBottom: 6,
                        textTransform: "uppercase",
                      }}
                    >
                      Supports the fit
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {result.supports_fit.slice(0, 3).map((item, i) => (
                        <span
                          key={i}
                          style={{
                            padding: "4px 10px",
                            borderRadius: 20,
                            fontSize: "0.78rem",
                            backgroundColor: "rgba(74,222,128,0.07)",
                            border: "1px solid rgba(74,222,128,0.22)",
                            color: "rgba(237,237,237,0.78)",
                          }}
                        >
                          {item}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {result.stretch_factors.slice(0, 2).length > 0 && (
                  <div>
                    <div
                      style={{
                        fontSize: "0.7rem",
                        fontWeight: 600,
                        letterSpacing: "0.10em",
                        color: "#FBBF24",
                        marginBottom: 6,
                        textTransform: "uppercase",
                      }}
                    >
                      Stretch factors
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {result.stretch_factors.slice(0, 2).map((item, i) => (
                        <span
                          key={i}
                          style={{
                            padding: "4px 10px",
                            borderRadius: 20,
                            fontSize: "0.78rem",
                            backgroundColor: "rgba(250,204,21,0.06)",
                            border: "1px solid rgba(250,204,21,0.22)",
                            color: "rgba(237,237,237,0.78)",
                          }}
                        >
                          {item}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Hiring Reality Check */}
            <div
              style={{
                marginTop: 16,
                padding: "12px 16px",
                borderRadius: 8,
                backgroundColor: "rgba(255,255,255,0.025)",
                border: "1px solid rgba(255,255,255,0.07)",
              }}
            >
              <div
                style={{
                  fontSize: "0.7rem",
                  fontWeight: 600,
                  letterSpacing: "0.10em",
                  color: "rgba(161,161,170,0.55)",
                  textTransform: "uppercase",
                  marginBottom: 5,
                }}
              >
                Hiring Reality
              </div>
              <div
                style={{
                  fontSize: "0.82rem",
                  color: "rgba(237,237,237,0.65)",
                  lineHeight: 1.55,
                }}
              >
                <span
                  style={{
                    fontWeight: 600,
                    color:
                      result.hiring_reality_check.band === "Likely"
                        ? "#4ADE80"
                        : result.hiring_reality_check.band === "Possible"
                        ? "#FBBF24"
                        : "#EF4444",
                  }}
                >
                  {result.hiring_reality_check.band}
                </span>
                {" — "}
                {result.hiring_reality_check.reason}
              </div>
              {result.hiring_reality_check.execution_evidence_gap && (
                <p
                  style={{
                    marginTop: 6,
                    fontSize: "0.8rem",
                    color: "#EF4444",
                    fontStyle: "italic",
                    lineHeight: 1.5,
                  }}
                >
                  {result.hiring_reality_check.execution_evidence_gap}
                </p>
              )}
            </div>

            {/* Actions */}
            <div
              style={{
                marginTop: 24,
                display: "flex",
                flexWrap: "wrap",
                gap: 10,
                justifyContent: "center",
              }}
            >
              <button
                type="button"
                onClick={handleReset}
                style={{
                  padding: "10px 22px",
                  borderRadius: 8,
                  fontSize: "13px",
                  fontWeight: 500,
                  backgroundColor: "rgba(74,222,128,0.08)",
                  color: "#4ADE80",
                  border: "1px solid rgba(74,222,128,0.40)",
                  cursor: "pointer",
                  letterSpacing: "0.02em",
                }}
              >
                Score Another Job
              </button>
              <Link
                href="/pipeline"
                style={{
                  padding: "10px 22px",
                  borderRadius: 8,
                  fontSize: "13px",
                  fontWeight: 500,
                  backgroundColor: "rgba(255,255,255,0.05)",
                  color: "rgba(207,207,207,0.6)",
                  border: "1px solid rgba(255,255,255,0.10)",
                  textDecoration: "none",
                  letterSpacing: "0.02em",
                  display: "inline-flex",
                  alignItems: "center",
                }}
              >
                View Pipeline →
              </Link>
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes score-spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @keyframes score-fade-up {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
