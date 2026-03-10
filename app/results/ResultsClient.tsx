"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function fetchResult(calibrationId: string) {
  return fetch(`/api/calibration/result?calibrationId=${encodeURIComponent(calibrationId)}`)
    .then((r) => r.json());
}

const FEEDBACK_REASONS = [
  { value: "score_wrong", label: "Score wrong" },
  { value: "hiring_reality_wrong", label: "Hiring reality wrong" },
  { value: "explanation_not_helpful", label: "Explanation not helpful" },
  { value: "other", label: "Other" },
] as const;

function FeedbackWidget({ result, calibrationId }: { result: any; calibrationId: string }) {
  const [state, setState] = useState<"idle" | "negative" | "done">("idle");
  const [selectedReason, setSelectedReason] = useState<string | null>(null);
  const [comment, setComment] = useState("");

  function sendFeedback(type: "thumbs_up" | "thumbs_down", reason?: string, optionalComment?: string) {
    const payload = {
      surface: "calibration_results",
      site: "caliber",
      company_name: result.companyName || "",
      job_title: result.jobTitle || "",
      search_title: "",
      fit_score: result.score_0_to_10 ?? null,
      decision_label: "",
      hiring_reality_band: "",
      better_search_title_suggestion: "",
      feedback_type: type,
      feedback_reason: reason || (type === "thumbs_up" ? "helpful" : ""),
      optional_comment: optionalComment || "",
      behavioral_signals: {},
    };
    fetch("/api/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).catch(() => {});
    setState("done");
  }

  if (state === "done") {
    return <p style={{ color: "#4ADE80", fontWeight: 600, fontSize: 13, marginTop: 16 }}>Thanks for your feedback!</p>;
  }

  if (state === "negative") {
    return (
      <div style={{ marginTop: 16, padding: 12, background: "#F7F7F7", borderRadius: 8 }}>
        <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8 }}>What was off?</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
          {FEEDBACK_REASONS.map((r) => (
            <button
              key={r.value}
              onClick={() => setSelectedReason(r.value === selectedReason ? null : r.value)}
              style={{
                padding: "3px 10px", borderRadius: 12, fontSize: 12, fontWeight: 500, cursor: "pointer",
                border: "1px solid",
                borderColor: selectedReason === r.value ? "#3B82F6" : "#CCC",
                background: selectedReason === r.value ? "rgba(59,130,246,0.10)" : "#FFF",
                color: selectedReason === r.value ? "#2563EB" : "#555",
              }}
            >{r.label}</button>
          ))}
        </div>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Optional details…"
          maxLength={500}
          rows={2}
          style={{ width: "100%", padding: "4px 8px", fontSize: 12, borderRadius: 5, border: "1px solid #CCC", resize: "none" }}
        />
        <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
          <button
            disabled={!selectedReason}
            onClick={() => sendFeedback("thumbs_down", selectedReason!, comment)}
            style={{ padding: "4px 14px", borderRadius: 5, fontSize: 12, fontWeight: 600, cursor: "pointer", background: "#EF4444", color: "#FFF", border: "none", opacity: selectedReason ? 1 : 0.4 }}
          >Submit</button>
          <button
            onClick={() => { setState("idle"); setSelectedReason(null); setComment(""); }}
            style={{ padding: "4px 14px", borderRadius: 5, fontSize: 12, fontWeight: 600, cursor: "pointer", background: "#EEE", color: "#555", border: "none" }}
          >Cancel</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 16, borderTop: "1px solid #EEE", paddingTop: 12 }}>
      <span style={{ fontSize: 13, color: "#888", fontWeight: 600 }}>Helpful?</span>
      <button onClick={() => sendFeedback("thumbs_up")} style={{ fontSize: 18, cursor: "pointer", background: "none", border: "1px solid #DDD", borderRadius: 5, padding: "2px 8px" }} aria-label="Thumbs up" title="Yes">👍</button>
      <button onClick={() => setState("negative")} style={{ fontSize: 18, cursor: "pointer", background: "none", border: "1px solid #DDD", borderRadius: 5, padding: "2px 8px" }} aria-label="Thumbs down" title="No">👎</button>
    </div>
  );
}

export default function ResultsClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const calibrationId = searchParams.get("calibrationId");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);

  useEffect(() => {
    if (!calibrationId) {
      setError("Missing calibration id. Please start over.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    fetchResult(calibrationId)
      .then((data) => {
        if (!data.ok) {
          setError(data.error?.message || "Unknown error");
          setResult(null);
        } else {
          setResult(data);
        }
        setLoading(false);
      })
      .catch(() => {
        setError("Network error. Please retry.");
        setLoading(false);
      });
  }, [calibrationId]);

  if (!calibrationId) {
    return (
      <main style={{ padding: 24 }}>
        <h1>Fit score + summary</h1>
        <p style={{ color: "#B00" }}>Missing calibration id. <button onClick={() => router.push("/")}>Start over</button></p>
      </main>
    );
  }

  if (loading) {
    return (
      <main style={{ padding: 24 }}>
        <h1>Fit score + summary</h1>
        <p>Loading…</p>
      </main>
    );
  }

  if (error) {
    return (
      <main style={{ padding: 24 }}>
        <h1>Fit score + summary</h1>
        <p style={{ color: "#B00" }}>{error}</p>
        <button onClick={() => { setLoading(true); setError(null); fetchResult(calibrationId).then((data) => { if (!data.ok) { setError(data.error?.message || "Unknown error") } else { setResult(data) } setLoading(false) }).catch(() => { setError("Network error. Please retry."); setLoading(false) }) }}>Retry</button>
        <button style={{ marginLeft: 12 }} onClick={() => router.push("/")}>Start over</button>
      </main>
    );
  }

  return (
    <main style={{ padding: 24, maxWidth: 600, margin: "0 auto" }}>
      <h1 style={{ fontSize: "2em", fontWeight: 700, marginBottom: 16 }}>Fit score + summary</h1>
      <div style={{ marginBottom: 24, textAlign: "center" }}>
        <div style={{ fontSize: "2.5em", fontWeight: 800, color: "#1A1A1A" }}>
          Fit score: {typeof result.score_0_to_10 === "number" ? result.score_0_to_10 : "-"} / 10
        </div>
        <div style={{ marginTop: 18, fontSize: "1.1em", color: "#444" }}>{result.summary}</div>
      </div>
      <div style={{ marginBottom: 24, background: "#F7F7F7", borderRadius: 8, padding: 16 }}>
        <div style={{ fontWeight: 600, marginBottom: 6 }}>Inputs:</div>
        {result.jobTitle && <div>Job title: <span style={{ fontWeight: 500 }}>{result.jobTitle}</span></div>}
        {result.jobText && <div>Job description: <span style={{ fontWeight: 500 }}>{result.jobText}</span></div>}
        {result.resumeFilename && <div>Resume: <span style={{ fontWeight: 500 }}>{result.resumeFilename}</span></div>}
      </div>
      <div style={{ display: "flex", gap: 16, marginTop: 32 }}>
        <button onClick={() => router.push("/")} style={{ padding: "10px 24px", fontWeight: 600, borderRadius: 6, background: "#EEE" }}>Start over / Re-run</button>
      </div>
      <FeedbackWidget result={result} calibrationId={calibrationId} />
    </main>
  );
}
