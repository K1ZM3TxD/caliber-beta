// app/calibration/page.tsx
'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { CalibrationEvent, CalibrationSession, CalibrationState } from '@/lib/calibration_types';

type NormalizedError = { code: string; message: string };

function safeString(v: any): string {
  if (typeof v === 'string') return v;
  if (v == null) return '';
  try {
    return String(v);
  } catch {
    return '';
  }
}

function getPromptIndex(state: CalibrationState): 1 | 2 | 3 | 4 | 5 | null {
  switch (state) {
    case 'PROMPT_1':
    case 'PROMPT_1_CLARIFIER':
      return 1;
    case 'PROMPT_2':
    case 'PROMPT_2_CLARIFIER':
      return 2;
    case 'PROMPT_3':
    case 'PROMPT_3_CLARIFIER':
      return 3;
    case 'PROMPT_4':
    case 'PROMPT_4_CLARIFIER':
      return 4;
    case 'PROMPT_5':
    case 'PROMPT_5_CLARIFIER':
      return 5;
    default:
      return null;
  }
}

function isPromptState(state: CalibrationState): boolean {
  return state === 'PROMPT_1' || state === 'PROMPT_2' || state === 'PROMPT_3' || state === 'PROMPT_4' || state === 'PROMPT_5';
}

function isClarifierState(state: CalibrationState): boolean {
  return (
    state === 'PROMPT_1_CLARIFIER' ||
    state === 'PROMPT_2_CLARIFIER' ||
    state === 'PROMPT_3_CLARIFIER' ||
    state === 'PROMPT_4_CLARIFIER' ||
    state === 'PROMPT_5_CLARIFIER'
  );
}

// M5.1: Job ingest UI must NOT appear before JOB_INGEST.
function isJobInputState(state: CalibrationState): boolean {
  return state === 'JOB_INGEST' || state === 'ALIGNMENT_OUTPUT' || state === 'TERMINAL_COMPLETE';
}

// M5.1: Strict explicit allowlist (no fallback inference).
const ADVANCE_ALLOWED = new Set<CalibrationState>([
  'PATTERN_SYNTHESIS',
  'TITLE_DIALOGUE', // only if backend expects ADVANCE -> JOB_INGEST
]);

export default function CalibrationPage() {
  const [session, setSession] = useState<CalibrationSession | null>(null);
  const [error, setError] = useState<NormalizedError | null>(null);

  const [resumeText, setResumeText] = useState<string>('');
  const [promptAnswer, setPromptAnswer] = useState<string>('');
  const [clarifierAnswer, setClarifierAnswer] = useState<string>('');
  const [jobText, setJobText] = useState<string>('');

  const [titleFeedback, setTitleFeedback] = useState<string>('');

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const historyJson = useMemo(() => {
    if (!session) return '';
    const items = Array.isArray(session.history) ? session.history : [];
    const last = items.slice(-10);
    return JSON.stringify(last, null, 2);
  }, [session]);

  const resultJson = useMemo(() => {
    if (!session?.result) return '';
    return JSON.stringify(session.result, null, 2);
  }, [session]);

  const prevStateRef = useRef<CalibrationState | null>(null);

  useEffect(() => {
    const nextState = session?.state ?? null;
    const prevState = prevStateRef.current;

    // Only clear drafts when the server actually transitions state (success path).
    if (prevState && nextState && prevState !== nextState) {
      setPromptAnswer('');
      setClarifierAnswer('');

      if (prevState === 'RESUME_INGEST') setResumeText('');

      if (isJobInputState(prevState)) setJobText('');

      if (prevState === 'TITLE_HYPOTHESIS' || prevState === 'TITLE_DIALOGUE') setTitleFeedback('');
    }

    prevStateRef.current = nextState;
  }, [session?.state]);

  async function sendEvent(event: any) {
    setError(null);
    setIsSubmitting(true);

    try {
      const res = await fetch('/api/calibration', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event }),
      });

      const contentType = res.headers.get('content-type') || '';
      const isJson = contentType.includes('application/json');
      const payload = isJson ? await res.json() : null;

      if (!res.ok) {
        const code = safeString(payload?.error?.code) || safeString(payload?.code) || 'HTTP_ERROR';
        const message =
          safeString(payload?.error?.message) || safeString(payload?.message) || `Request failed with status ${res.status}`;
        setError({ code, message });
        return;
      }

      const ok = payload?.ok === true;
      const nextSession = payload?.session;

      if (!ok || !nextSession) {
        setError({ code: 'BAD_RESPONSE', message: 'Missing ok:true session in response' });
        return;
      }

      setSession(nextSession as CalibrationSession);
    } catch (e: any) {
      setError({ code: 'NETWORK_ERROR', message: safeString(e?.message) || 'Network error' });
    } finally {
      setIsSubmitting(false);
    }
  }

  function resetLocalUi() {
    setError(null);
    setResumeText('');
    setPromptAnswer('');
    setClarifierAnswer('');
    setJobText('');
    setTitleFeedback('');
    setIsSubmitting(false);
  }

  const state: CalibrationState | null = session?.state ?? null;
  const promptIndex = state ? getPromptIndex(state) : null;

  // M5.1: server-driven polling for auto-advance states (no client-side simulation).
  useEffect(() => {
    if (!session) return;

    if (session.state !== 'CONSOLIDATION_PENDING' && session.state !== 'CONSOLIDATION_RITUAL') return;

    const sessionId = session.sessionId;
    const handle = window.setInterval(() => {
      // Dispatch with no user text input.
      // This must advance at most one state per call (server enforces).
      sendEvent({ type: 'ADVANCE', sessionId } as CalibrationEvent);
    }, 800);

    return () => window.clearInterval(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.sessionId, session?.state]);

  const showAdvance = !!(session && state && ADVANCE_ALLOWED.has(state));

  return (
    <main style={{ padding: 16, maxWidth: 900, margin: '0 auto' }}>
      <h1 style={{ margin: 0, marginBottom: 12, fontSize: 20, fontWeight: 600 }}>Caliber — Calibration UI (v0)</h1>

      <section style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
        {!session ? (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button
              onClick={() => sendEvent({ type: 'CREATE_SESSION' } as CalibrationEvent)}
              disabled={isSubmitting}
              style={{
                padding: '8px 12px',
                borderRadius: 8,
                border: '1px solid #d0d0d0',
                background: 'white',
                cursor: isSubmitting ? 'not-allowed' : 'pointer',
              }}
            >
              {isSubmitting ? 'Submitting…' : 'Create session'}
            </button>
          </div>
        ) : (
          <div
            style={{
              padding: 12,
              borderRadius: 10,
              border: '1px solid #d0d0d0',
              background: 'white',
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
            }}
          >
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
              <div style={{ fontSize: 13 }}>
                <span style={{ fontWeight: 600 }}>sessionId:</span>{' '}
                <span
                  style={{
                    fontFamily:
                      'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
                  }}
                >
                  {session.sessionId}
                </span>
              </div>
              <div style={{ fontSize: 13 }}>
                <span style={{ fontWeight: 600 }}>state:</span>{' '}
                <span
                  style={{
                    fontFamily:
                      'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
                  }}
                >
                  {session.state}
                </span>
              </div>

              <button
                onClick={resetLocalUi}
                style={{
                  marginLeft: 'auto',
                  padding: '8px 12px',
                  borderRadius: 8,
                  border: '1px solid #d0d0d0',
                  background: 'white',
                  cursor: 'pointer',
                }}
              >
                Reset local UI
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ fontSize: 14, fontWeight: 600 }}>History (last ~10)</div>
              <pre
                style={{
                  margin: 0,
                  padding: 10,
                  borderRadius: 8,
                  border: '1px solid #d0d0d0',
                  background: 'white',
                  fontFamily:
                    'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
                  fontSize: 12,
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                }}
              >
                {historyJson || '[]'}
              </pre>
            </div>
          </div>
        )}

        {error && (
          <div
            style={{
              padding: 10,
              borderRadius: 8,
              border: '1px solid #d0d0d0',
              background: 'white',
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
              fontSize: 13,
              whiteSpace: 'pre-wrap',
            }}
          >
            {JSON.stringify({ ok: false, error }, null, 2)}
          </div>
        )}
      </section>

      {session && state === 'RESUME_INGEST' && (
        <section style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 600 }}>Resume ingest</div>

          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontSize: 13, fontWeight: 600 }}>Resume text</span>
            <textarea
              value={resumeText}
              onChange={(e) => setResumeText(e.target.value)}
              rows={8}
              style={{
                width: '100%',
                resize: 'vertical',
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
                fontSize: 13,
                padding: 10,
                borderRadius: 8,
                border: '1px solid #d0d0d0',
              }}
              placeholder="Paste resume text here…"
            />
          </label>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <button
              onClick={() => sendEvent({ type: 'SUBMIT_RESUME', sessionId: session.sessionId, resumeText } as CalibrationEvent)}
              disabled={isSubmitting || resumeText.trim().length === 0}
              style={{
                padding: '8px 12px',
                borderRadius: 8,
                border: '1px solid #d0d0d0',
                background: 'white',
                cursor: isSubmitting || resumeText.trim().length === 0 ? 'not-allowed' : 'pointer',
              }}
            >
              {isSubmitting ? 'Submitting…' : 'Submit resume'}
            </button>

            <button
              onClick={() => sendEvent({ type: 'ADVANCE', sessionId: session.sessionId } as CalibrationEvent)}
              disabled={isSubmitting || !session.resume?.completed}
              style={{
                padding: '8px 12px',
                borderRadius: 8,
                border: '1px solid #d0d0d0',
                background: 'white',
                cursor: isSubmitting || !session.resume?.completed ? 'not-allowed' : 'pointer',
              }}
            >
              {isSubmitting ? 'Submitting…' : 'Advance'}
            </button>
          </div>
        </section>
      )}

      {session && state === 'CONSOLIDATION_PENDING' && (
        <section style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 600 }}>Consolidation</div>
          <div
            style={{
              padding: 10,
              borderRadius: 8,
              border: '1px solid #d0d0d0',
              background: 'white',
              fontSize: 13,
              whiteSpace: 'pre-wrap',
            }}
          >
            Preparing consolidation ritual…
          </div>
          <div style={{ fontSize: 12, opacity: 0.8 }}>Auto-progressing via server dispatch.</div>
        </section>
      )}

      {session && state === 'CONSOLIDATION_RITUAL' && (
        <section style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 600 }}>Consolidation ritual</div>

          <div
            style={{
              padding: 10,
              borderRadius: 8,
              border: '1px solid #d0d0d0',
              background: 'white',
              fontSize: 13,
              whiteSpace: 'pre-wrap',
            }}
          >
            {session.consolidationRitual?.message || '…'}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ fontSize: 12, opacity: 0.8 }}>
              Progress: {typeof session.consolidationRitual?.progressPct === 'number' ? session.consolidationRitual.progressPct : 0}%
            </div>
            <div style={{ height: 10, borderRadius: 999, border: '1px solid #d0d0d0', background: 'white', overflow: 'hidden' }}>
              <div
                style={{
                  height: '100%',
                  width: `${Math.max(0, Math.min(100, session.consolidationRitual?.progressPct ?? 0))}%`,
                  background: '#111',
                }}
              />
            </div>
          </div>

          <div style={{ fontSize: 12, opacity: 0.8 }}>Auto-progressing via server dispatch.</div>
        </section>
      )}

      {session && state && isPromptState(state) && promptIndex && (
        <section style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 600 }}>Prompt {promptIndex}</div>

          <div
            style={{
              padding: 10,
              borderRadius: 8,
              border: '1px solid #d0d0d0',
              background: 'white',
              fontSize: 13,
              whiteSpace: 'pre-wrap',
            }}
          >
            {session.prompts[promptIndex]?.question || '(missing question)'}
          </div>

          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontSize: 13, fontWeight: 600 }}>Answer</span>
            <textarea
              value={promptAnswer}
              onChange={(e) => setPromptAnswer(e.target.value)}
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
              placeholder="Type your answer…"
            />
          </label>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <button
              onClick={() => sendEvent({ type: 'SUBMIT_PROMPT_ANSWER', sessionId: session.sessionId, answer: promptAnswer } as CalibrationEvent)}
              disabled={isSubmitting || promptAnswer.trim().length === 0}
              style={{
                padding: '8px 12px',
                borderRadius: 8,
                border: '1px solid #d0d0d0',
                background: 'white',
                cursor: isSubmitting || promptAnswer.trim().length === 0 ? 'not-allowed' : 'pointer',
              }}
            >
              {isSubmitting ? 'Submitting…' : 'Submit answer'}
            </button>

            {/* Manual advance between prompts 1-4 */}
            {promptIndex !== 5 && (
              <button
                onClick={() => sendEvent({ type: 'ADVANCE', sessionId: session.sessionId } as CalibrationEvent)}
                disabled={isSubmitting || !session.prompts[promptIndex]?.accepted}
                style={{
                  padding: '8px 12px',
                  borderRadius: 8,
                  border: '1px solid #d0d0d0',
                  background: 'white',
                  cursor: isSubmitting || !session.prompts[promptIndex]?.accepted ? 'not-allowed' : 'pointer',
                }}
              >
                {isSubmitting ? 'Submitting…' : 'Advance'}
              </button>
            )}
          </div>
        </section>
      )}

      {session && state && isClarifierState(state) && promptIndex && (
        <section style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 600 }}>Prompt {promptIndex} — Clarifier</div>

          <div
            style={{
              padding: 10,
              borderRadius: 8,
              border: '1px solid #d0d0d0',
              background: 'white',
              fontSize: 13,
              whiteSpace: 'pre-wrap',
            }}
          >
            {session.prompts[promptIndex]?.clarifier?.question || '(missing clarifier question)'}
          </div>

          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontSize: 13, fontWeight: 600 }}>Clarifier answer</span>
            <textarea
              value={clarifierAnswer}
              onChange={(e) => setClarifierAnswer(e.target.value)}
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
              placeholder="Type your clarifier answer…"
            />
          </label>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <button
              onClick={() =>
                sendEvent({
                  type: 'SUBMIT_PROMPT_CLARIFIER_ANSWER',
                  sessionId: session.sessionId,
                  answer: clarifierAnswer,
                } as CalibrationEvent)
              }
              disabled={isSubmitting || clarifierAnswer.trim().length === 0}
              style={{
                padding: '8px 12px',
                borderRadius: 8,
                border: '1px solid #d0d0d0',
                background: 'white',
                cursor: isSubmitting || clarifierAnswer.trim().length === 0 ? 'not-allowed' : 'pointer',
              }}
            >
              {isSubmitting ? 'Submitting…' : 'Submit clarifier answer'}
            </button>
          </div>
        </section>
      )}

      {session && state === 'PATTERN_SYNTHESIS' && (
        <section style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 600 }}>Pattern synthesis</div>

          <div
            style={{
              padding: 10,
              borderRadius: 8,
              border: '1px solid #d0d0d0',
              background: 'white',
              fontSize: 13,
              whiteSpace: 'pre-wrap',
            }}
          >
            {session.synthesis?.patternSummary || '(missing patternSummary)'}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div style={{ padding: 10, borderRadius: 8, border: '1px solid #d0d0d0', background: 'white' }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Where You Operate Best</div>
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13 }}>
                {(session.synthesis?.operateBest || []).map((b, i) => (
                  <li key={i}>{b}</li>
                ))}
              </ul>
            </div>

            <div style={{ padding: 10, borderRadius: 8, border: '1px solid #d0d0d0', background: 'white' }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Where You Lose Energy</div>
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13 }}>
                {(session.synthesis?.loseEnergy || []).map((b, i) => (
                  <li key={i}>{b}</li>
                ))}
              </ul>
            </div>
          </div>

          {/* Exactly one Advance button for this state */}
          {showAdvance && (
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => sendEvent({ type: 'ADVANCE', sessionId: session.sessionId } as CalibrationEvent)}
                disabled={isSubmitting}
                style={{
                  padding: '8px 12px',
                  borderRadius: 8,
                  border: '1px solid #d0d0d0',
                  background: 'white',
                  cursor: isSubmitting ? 'not-allowed' : 'pointer',
                }}
              >
                {isSubmitting ? 'Submitting…' : 'Advance'}
              </button>
            </div>
          )}
        </section>
      )}

      {session && state === 'TITLE_HYPOTHESIS' && (
        <section style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 600 }}>Title hypothesis</div>

          <div style={{ padding: 10, borderRadius: 8, border: '1px solid #d0d0d0', background: 'white' }}>
            <div style={{ fontSize: 12, fontWeight: 600, opacity: 0.8, marginBottom: 6 }}>identitySummary</div>
            <div style={{ fontSize: 13, whiteSpace: 'pre-wrap' }}>{session.synthesis?.identitySummary || '(missing)'}</div>
          </div>

          <div style={{ padding: 10, borderRadius: 8, border: '1px solid #d0d0d0', background: 'white' }}>
            <div style={{ fontSize: 12, fontWeight: 600, opacity: 0.8, marginBottom: 6 }}>marketTitle</div>
            <div style={{ fontSize: 13, whiteSpace: 'pre-wrap' }}>{session.synthesis?.marketTitle || '(missing)'}</div>
          </div>

          <div style={{ padding: 10, borderRadius: 8, border: '1px solid #d0d0d0', background: 'white' }}>
            <div style={{ fontSize: 12, fontWeight: 600, opacity: 0.8, marginBottom: 6 }}>titleExplanation</div>
            <div style={{ fontSize: 13, whiteSpace: 'pre-wrap' }}>{session.synthesis?.titleExplanation || '(missing)'}</div>
          </div>

          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontSize: 13, fontWeight: 600 }}>Reaction / feedback</span>
            <textarea
              value={titleFeedback}
              onChange={(e) => setTitleFeedback(e.target.value)}
              rows={5}
              style={{
                width: '100%',
                resize: 'vertical',
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
                fontSize: 13,
                padding: 10,
                borderRadius: 8,
                border: '1px solid #d0d0d0',
              }}
              placeholder="Your reaction…"
            />
          </label>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <button
              onClick={() =>
                sendEvent({ type: 'TITLE_FEEDBACK', sessionId: session.sessionId, feedback: titleFeedback } as CalibrationEvent)
              }
              disabled={isSubmitting || titleFeedback.trim().length === 0}
              style={{
                padding: '8px 12px',
                borderRadius: 8,
                border: '1px solid #d0d0d0',
                background: 'white',
                cursor: isSubmitting || titleFeedback.trim().length === 0 ? 'not-allowed' : 'pointer',
              }}
            >
              {isSubmitting ? 'Submitting…' : 'Submit feedback'}
            </button>
          </div>
        </section>
      )}

      {session && state === 'TITLE_DIALOGUE' && (
        <section style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 600 }}>Title dialogue</div>

          <div style={{ padding: 10, borderRadius: 8, border: '1px solid #d0d0d0', background: 'white' }}>
            <div style={{ fontSize: 12, fontWeight: 600, opacity: 0.8, marginBottom: 6 }}>marketTitle</div>
            <div style={{ fontSize: 13, whiteSpace: 'pre-wrap' }}>{session.synthesis?.marketTitle || '(missing)'}</div>
          </div>

          <div style={{ padding: 10, borderRadius: 8, border: '1px solid #d0d0d0', background: 'white' }}>
            <div style={{ fontSize: 12, fontWeight: 600, opacity: 0.8, marginBottom: 6 }}>titleExplanation</div>
            <div style={{ fontSize: 13, whiteSpace: 'pre-wrap' }}>{session.synthesis?.titleExplanation || '(missing)'}</div>
          </div>

          {session.synthesis?.lastTitleFeedback && (
            <div style={{ padding: 10, borderRadius: 8, border: '1px solid #d0d0d0', background: 'white' }}>
              <div style={{ fontSize: 12, fontWeight: 600, opacity: 0.8, marginBottom: 6 }}>lastTitleFeedback</div>
              <div style={{ fontSize: 13, whiteSpace: 'pre-wrap' }}>{session.synthesis.lastTitleFeedback}</div>
            </div>
          )}

          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontSize: 13, fontWeight: 600 }}>Reaction / feedback</span>
            <textarea
              value={titleFeedback}
              onChange={(e) => setTitleFeedback(e.target.value)}
              rows={5}
              style={{
                width: '100%',
                resize: 'vertical',
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
                fontSize: 13,
                padding: 10,
                borderRadius: 8,
                border: '1px solid #d0d0d0',
              }}
              placeholder="Your reaction…"
            />
          </label>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <button
              onClick={() =>
                sendEvent({ type: 'TITLE_FEEDBACK', sessionId: session.sessionId, feedback: titleFeedback } as CalibrationEvent)
              }
              disabled={isSubmitting || titleFeedback.trim().length === 0}
              style={{
                padding: '8px 12px',
                borderRadius: 8,
                border: '1px solid #d0d0d0',
                background: 'white',
                cursor: isSubmitting || titleFeedback.trim().length === 0 ? 'not-allowed' : 'pointer',
              }}
            >
              {isSubmitting ? 'Submitting…' : 'Submit feedback'}
            </button>

            {/* Strict allowlist: Advance only if backend expects TITLE_DIALOGUE -> JOB_INGEST */}
            {showAdvance && (
              <button
                onClick={() => sendEvent({ type: 'ADVANCE', sessionId: session.sessionId } as CalibrationEvent)}
                disabled={isSubmitting}
                style={{
                  padding: '8px 12px',
                  borderRadius: 8,
                  border: '1px solid #d0d0d0',
                  background: 'white',
                  cursor: isSubmitting ? 'not-allowed' : 'pointer',
                }}
              >
                {isSubmitting ? 'Submitting…' : 'Advance'}
              </button>
            )}
          </div>
        </section>
      )}

      {session && state && isJobInputState(state) && (
        <section style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 600 }}>Job</div>

          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontSize: 13, fontWeight: 600 }}>Job text</span>
            <textarea
              value={jobText}
              onChange={(e) => setJobText(e.target.value)}
              rows={7}
              style={{
                width: '100%',
                resize: 'vertical',
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
                fontSize: 13,
                padding: 10,
                borderRadius: 8,
                border: '1px solid #d0d0d0',
              }}
              placeholder="Paste job description here…"
            />
          </label>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <button
              onClick={() => sendEvent({ type: 'SUBMIT_JOB_TEXT', sessionId: session.sessionId, jobText } as CalibrationEvent)}
              disabled={isSubmitting || jobText.trim().length === 0}
              style={{
                padding: '8px 12px',
                borderRadius: 8,
                border: '1px solid #d0d0d0',
                background: 'white',
                cursor: isSubmitting || jobText.trim().length === 0 ? 'not-allowed' : 'pointer',
              }}
            >
              {isSubmitting ? 'Submitting…' : 'Submit job'}
            </button>

            {state === 'JOB_INGEST' && (
              <button
                onClick={() => sendEvent({ type: 'ADVANCE', sessionId: session.sessionId } as CalibrationEvent)}
                disabled={isSubmitting}
                style={{
                  padding: '8px 12px',
                  borderRadius: 8,
                  border: '1px solid #d0d0d0',
                  background: 'white',
                  cursor: isSubmitting ? 'not-allowed' : 'pointer',
                }}
              >
                {isSubmitting ? 'Submitting…' : 'Advance'}
              </button>
            )}

            {state === 'ALIGNMENT_OUTPUT' && (
              <button
                onClick={() => sendEvent({ type: 'COMPUTE_ALIGNMENT_OUTPUT', sessionId: session.sessionId } as CalibrationEvent)}
                disabled={isSubmitting}
                style={{
                  padding: '8px 12px',
                  borderRadius: 8,
                  border: '1px solid #d0d0d0',
                  background: 'white',
                  cursor: isSubmitting ? 'not-allowed' : 'pointer',
                }}
              >
                {isSubmitting ? 'Submitting…' : 'Compute alignment output'}
              </button>
            )}
          </div>

          {session.result && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ fontSize: 14, fontWeight: 600 }}>session.result (raw JSON)</div>
              <pre
                style={{
                  margin: 0,
                  padding: 10,
                  borderRadius: 8,
                  border: '1px solid #d0d0d0',
                  background: 'white',
                  fontFamily:
                    'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
                  fontSize: 12,
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                }}
              >
                {resultJson}
              </pre>
            </div>
          )}
        </section>
      )}

      {session && state && !isPromptState(state) && !isClarifierState(state) && state !== 'RESUME_INGEST' && (
        <section style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ fontSize: 13 }}>
            <span style={{ fontWeight: 600 }}>State snapshot:</span>{' '}
            <span
              style={{
                fontFamily:
                  'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
              }}
            >
              {state}
            </span>
          </div>

          <pre
            style={{
              margin: 0,
              padding: 10,
              borderRadius: 8,
              border: '1px solid #d0d0d0',
              background: 'white',
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
              fontSize: 12,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            }}
          >
            {JSON.stringify(session, null, 2)}
          </pre>
        </section>
      )}
    </main>
  );
}