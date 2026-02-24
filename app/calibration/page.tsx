"use client"

import React, { useEffect, useState } from "react"
import type { CalibrationSession } from "@/lib/calibration_types"

export default function CalibrationPage() {
  const [session, setSession] = useState<CalibrationSession | null>(null)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function dispatch(event: Record<string, unknown>) {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/calibration/event", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event }),
      })
      const data = await res.json()
      if (!data.ok) {
        setError(data.error?.message ?? "Unknown error")
      } else {
        setSession(data.session)
        setSessionId(data.session.sessionId)
      }
    } catch {
      setError("Network error")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    dispatch({ type: "CREATE_SESSION" })
  }, [])

  const synthesis = session?.synthesis

  return (
    <div
      className="fixed inset-0 bg-[#0B0B0B] text-[#F2F2F2] flex items-center justify-center overflow-auto"
    >
      <div className="w-full max-w-[720px] px-6 py-12">
        <div className="font-semibold tracking-tight text-[30px] sm:text-[32px] text-center">
          Caliber
        </div>

        {error && (
          <div className="mt-4 text-sm text-red-400 text-center">{error}</div>
        )}

        {loading && (
          <div className="mt-4 text-sm opacity-60 text-center">Loading…</div>
        )}

        {session && (
          <div className="mt-8 text-left text-[14px] leading-relaxed opacity-80">
            <div className="text-xs tracking-widest opacity-60 mb-2">STATE: {session.state}</div>

            {synthesis?.patternSummary && (
              <div className="mt-4 space-y-3">
                <div className="font-semibold text-base">Pattern Synthesis</div>
                <p>{synthesis.patternSummary}</p>
              </div>
            )}

            {synthesis?.operateBest && synthesis.operateBest.length > 0 && (
              <div className="mt-4 space-y-2">
                <div className="font-semibold text-base">Where You Operate Best</div>
                <ul className="space-y-1">
                  {synthesis.operateBest.map((item, i) => (
                    <li key={i}>• {item}</li>
                  ))}
                </ul>
              </div>
            )}

            {synthesis?.loseEnergy && synthesis.loseEnergy.length > 0 && (
              <div className="mt-4 space-y-2">
                <div className="font-semibold text-base">Where You Lose Energy</div>
                <ul className="space-y-1">
                  {synthesis.loseEnergy.map((item, i) => (
                    <li key={i}>• {item}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Anchor metrics block */}
            <div className="mt-8 space-y-2">
              <div>
                <span className="font-semibold">Anchor overlap: </span>
                {typeof synthesis?.anchor_overlap_score === "number"
                  ? synthesis.anchor_overlap_score.toFixed(2)
                  : "—"}
              </div>
              <div>
                <span className="font-semibold">Missing anchors: </span>
                {typeof synthesis?.missing_anchor_count === "number"
                  ? synthesis.missing_anchor_count
                  : "—"}
              </div>
              {(synthesis?.missing_anchor_terms ?? []).length > 0 ? (
                <div>
                  <span className="font-semibold">Missing terms: </span>
                  {synthesis?.missing_anchor_terms?.join(", ")}
                </div>
              ) : null}
            </div>
          </div>
        )}

        {sessionId && (
          <div className="mt-8 text-center">
            <button
              type="button"
              onClick={() => dispatch({ type: "ADVANCE", sessionId })}
              disabled={loading}
              className="inline-flex items-center justify-center rounded-md px-5 py-3 text-sm font-medium"
              style={{
                backgroundColor: "#F2F2F2",
                color: "#0B0B0B",
              }}
            >
              Advance
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
