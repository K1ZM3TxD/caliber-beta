'use client';

import React, { useMemo, useState } from 'react';

type NormalizedError = { code: string; message: string };

type StoredHistoryItem = {
  storedAt: string; // ISO timestamp of when we stored it (session-local)
  result: any; // must store exact contract as returned (no transformation)
};

const SAMPLE_JOB_TEXT =
  'Senior Product Analyst needed. Build dashboards, define metrics, and partner with engineering on data quality.';

function safeString(v: any): string {
  if (typeof v === 'string') return v;
  if (v == null) return '';
  try {
    return String(v);
  } catch {
    return '';
  }
}

function extractMetaComputedAt(result: any): string {
  const computedAt = result?.meta?.computedAt;
  if (typeof computedAt === 'string' && computedAt.length > 0) return computedAt;
  return '';
}

function extractAlignmentScore(result: any): string {
  const score = result?.alignment?.score;
  if (typeof score === 'number') return String(score);
  if (typeof score === 'string') return score;
  return '';
}

function extractSkillMatchScore(result: any): string {
  const score = result?.skillMatch?.score;
  if (typeof score === 'number') return String(score);
  if (typeof score === 'string') return score;
  return '';
}

function extractStretchLoadBand(result: any): string {
  const band = result?.stretchLoad?.band;
  if (typeof band === 'string') return band;
  return '';
}

export default function Page() {
  const [jobText, setJobText] = useState<string>('');
  const [result, setResult] = useState<any | null>(null);
  const [error, setError] = useState<NormalizedError | null>(null);
  const [history, setHistory] = useState<StoredHistoryItem[]>([]);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const currentResultJson = useMemo(() => {
    if (!result) return '';
    return JSON.stringify(result, null, 2);
  }, [result]);

  async function onSubmit() {
    setError(null);
    setIsSubmitting(true);

    try {
      const res = await fetch('/api/job-ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ job: jobText }),
      });

      const contentType = res.headers.get('content-type') || '';
      const isJson = contentType.includes('application/json');
      const payload = isJson ? await res.json() : null;

      if (!res.ok) {
        const code =
          safeString(payload?.error?.code) ||
          safeString(payload?.code) ||
          'HTTP_ERROR';
        const message =
          safeString(payload?.error?.message) ||
          safeString(payload?.message) ||
          `Request failed with status ${res.status}`;
        setResult(null);
        setError({ code, message });
        return;
      }

      // Expect normalized success payload shape. We only store and render the result object exactly as returned.
      const nextResult = payload?.result ?? payload;

      setResult(nextResult);

      const storedAt = new Date().toISOString();
      setHistory((prev) => {
        const next: StoredHistoryItem[] = [{ storedAt, result: nextResult }, ...prev];
        return next.slice(0, 5);
      });
    } catch (e: any) {
      setResult(null);
      setError({
        code: 'NETWORK_ERROR',
        message: safeString(e?.message) || 'Network error',
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  async function onCopyJson() {
    setError(null);
    if (!result) return;
    try {
      await navigator.clipboard.writeText(JSON.stringify(result, null, 2));
    } catch (e: any) {
      setError({
        code: 'CLIPBOARD_ERROR',
        message: safeString(e?.message) || 'Clipboard write failed',
      });
    }
  }

  function onLoadSample() {
    setError(null);
    setJobText(SAMPLE_JOB_TEXT);
  }

  function onClear() {
    setJobText('');
    setResult(null);
    setError(null);
    setHistory([]);
    setIsSubmitting(false);
  }

  function onSelectHistory(item: StoredHistoryItem) {
    setError(null);
    setResult(item.result);
  }

  return (
    <main style={{ padding: 16, maxWidth: 900, margin: '0 auto' }}>
      <h1 style={{ margin: 0, marginBottom: 12, fontSize: 20, fontWeight: 600 }}>
        Caliber — Contract Viewer (v1)
      </h1>

      <section style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={{ fontSize: 14, fontWeight: 600 }}>Job text</span>
          <textarea
            value={jobText}
            onChange={(e) => setJobText(e.target.value)}
            rows={6}
            style={{
              width: '100%',
              resize: 'vertical',
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
              fontSize: 13,
              padding: 10,
              borderRadius: 8,
              border: '1px solid #d0d0d0',
            }}
            placeholder="Paste a job description here…"
          />
        </label>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          <button
            onClick={onSubmit}
            disabled={isSubmitting || jobText.trim().length === 0}
            style={{
              padding: '8px 12px',
              borderRadius: 8,
              border: '1px solid #d0d0d0',
              background: 'white',
              cursor: isSubmitting || jobText.trim().length === 0 ? 'not-allowed' : 'pointer',
            }}
          >
            {isSubmitting ? 'Submitting…' : 'Submit'}
          </button>

          <button
            onClick={onCopyJson}
            disabled={!result}
            style={{
              padding: '8px 12px',
              borderRadius: 8,
              border: '1px solid #d0d0d0',
              background: 'white',
              cursor: !result ? 'not-allowed' : 'pointer',
            }}
          >
            Copy JSON
          </button>

          <button
            onClick={onLoadSample}
            style={{
              padding: '8px 12px',
              borderRadius: 8,
              border: '1px solid #d0d0d0',
              background: 'white',
              cursor: 'pointer',
            }}
          >
            Load Sample Job
          </button>

          <button
            onClick={onClear}
            style={{
              padding: '8px 12px',
              borderRadius: 8,
              border: '1px solid #d0d0d0',
              background: 'white',
              cursor: 'pointer',
            }}
          >
            Clear State
          </button>
        </div>

        {error && (
          <div
            style={{
              padding: 10,
              borderRadius: 8,
              border: '1px solid #d0d0d0',
              background: 'white',
              fontFamily:
                'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
              fontSize: 13,
              whiteSpace: 'pre-wrap',
            }}
          >
            {JSON.stringify({ ok: false, error }, null, 2)}
          </div>
        )}
      </section>

      <section style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div
          style={{
            padding: 12,
            borderRadius: 10,
            border: '1px solid #d0d0d0',
            background: 'white',
          }}
        >
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>Result History (last 5)</div>
          {history.length === 0 ? (
            <div style={{ fontSize: 13 }}>No successful results in this session.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {history.map((h, idx) => {
                const computedAt = extractMetaComputedAt(h.result);
                const alignmentScore = extractAlignmentScore(h.result);
                const skillMatchScore = extractSkillMatchScore(h.result);
                const stretchLoadBand = extractStretchLoadBand(h.result);

                return (
                  <button
                    key={`${h.storedAt}-${idx}`}
                    onClick={() => onSelectHistory(h)}
                    style={{
                      textAlign: 'left',
                      padding: 10,
                      borderRadius: 8,
                      border: '1px solid #d0d0d0',
                      background: 'white',
                      cursor: 'pointer',
                      fontFamily:
                        'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
                      fontSize: 13,
                    }}
                    aria-label="Select stored result"
                  >
                    <div>meta.computedAt: {computedAt || '(missing)'}</div>
                    <div>alignment.score: {alignmentScore || '(missing)'}</div>
                    <div>skillMatch.score: {skillMatchScore || '(missing)'}</div>
                    <div>stretchLoad.band: {stretchLoadBand || '(missing)'}</div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div
          style={{
            padding: 12,
            borderRadius: 10,
            border: '1px solid #d0d0d0',
            background: 'white',
          }}
        >
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>Result (contract as returned)</div>

          {!result ? (
            <div style={{ fontSize: 13 }}>No result.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div
                style={{
                  padding: 10,
                  borderRadius: 8,
                  border: '1px solid #d0d0d0',
                  background: 'white',
                }}
              >
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>meta</div>
                <pre
                  style={{
                    margin: 0,
                    fontFamily:
                      'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
                    fontSize: 13,
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                  }}
                >
                  {JSON.stringify(result?.meta ?? null, null, 2)}
                </pre>
              </div>

              <div
                style={{
                  padding: 10,
                  borderRadius: 8,
                  border: '1px solid #d0d0d0',
                  background: 'white',
                }}
              >
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>alignment</div>
                <pre
                  style={{
                    margin: 0,
                    fontFamily:
                      'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
                    fontSize: 13,
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                  }}
                >
                  {JSON.stringify(result?.alignment ?? null, null, 2)}
                </pre>
              </div>

              <div
                style={{
                  padding: 10,
                  borderRadius: 8,
                  border: '1px solid #d0d0d0',
                  background: 'white',
                }}
              >
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>skillMatch</div>
                <pre
                  style={{
                    margin: 0,
                    fontFamily:
                      'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
                    fontSize: 13,
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                  }}
                >
                  {JSON.stringify(result?.skillMatch ?? null, null, 2)}
                </pre>
              </div>

              <div
                style={{
                  padding: 10,
                  borderRadius: 8,
                  border: '1px solid #d0d0d0',
                  background: 'white',
                }}
              >
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>stretchLoad</div>
                <pre
                  style={{
                    margin: 0,
                    fontFamily:
                      'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
                    fontSize: 13,
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                  }}
                >
                  {JSON.stringify(result?.stretchLoad ?? null, null, 2)}
                </pre>
              </div>

              <div
                style={{
                  padding: 10,
                  borderRadius: 8,
                  border: '1px solid #d0d0d0',
                  background: 'white',
                }}
              >
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>raw JSON</div>
                <pre
                  style={{
                    margin: 0,
                    fontFamily:
                      'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
                    fontSize: 13,
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                  }}
                >
                  {currentResultJson}
                </pre>
              </div>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}