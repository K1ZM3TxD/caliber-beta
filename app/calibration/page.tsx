// app/calibration/page.tsx
'use client';

import React, { useEffect, useRef, useState } from 'react';
import type { CalibrationEvent, CalibrationSession, CalibrationState } from '@/lib/calibration_types';

type NormalizedError = { code: string; message: string };

function Stage({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 w-screen h-[100svh] bg-[#0B0B0B] text-[#F2F2F2] flex items-center justify-center">
      <div className="w-full max-w-[720px] px-6 text-center">{children}</div>
    </div>
  );
}

function ErrorBox({ error }: { error: NormalizedError | null }) {
  return error ? (
    <pre className="mb-6 text-left whitespace-pre-wrap break-words text-[12px] opacity-90">
      {JSON.stringify({ ok: false, error }, null, 2)}
    </pre>
  ) : null;
}

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

export default function CalibrationPage() {
  const [session, setSession] = useState<CalibrationSession | null>(null);
  const [error, setError] = useState<NormalizedError | null>(null);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [promptAnswer, setPromptAnswer] = useState<string>('');
  const [clarifierAnswer, setClarifierAnswer] = useState<string>('');
  const [titleFeedback, setTitleFeedback] = useState<string>('');
  const [jobText, setJobText] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const prevStateRef = useRef<CalibrationState | null>(null);

  // Prevent duplicate timers + prevent runaway ADVANCE spam.
  const autoProgressIntervalRef = useRef<number | null>(null);
  const advanceInFlightRef = useRef<boolean>(false);

  useEffect(() => {
    const nextState = session?.state ?? null;
    const prevState = prevStateRef.current;

    if (prevState && nextState && prevState !== nextState) {
      setPromptAnswer('');
      setClarifierAnswer('');
      setTitleFeedback('');
      setJobText('');
      if (prevState === 'RESUME_INGEST') setSelectedFile(null);
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

      if (payload?.ok !== true || !payload?.session) {
        setError({ code: 'BAD_RESPONSE', message: 'Missing ok:true session in response' });
        return;
      }

      setSession(payload.session as CalibrationSession);
    } catch (e: any) {
      setError({ code: 'NETWORK_ERROR', message: safeString(e?.message) || 'Network error' });
    } finally {
      setIsSubmitting(false);
    }
  }

  async function uploadResumeAndAdvance() {
    if (!session) return;
    if (!selectedFile) return;

    setError(null);
    setIsSubmitting(true);

    try {
      const fd = new FormData();
      fd.set('sessionId', session.sessionId);
      fd.set('file', selectedFile);

      const res = await fetch('/api/calibration/resume-upload', {
        method: 'POST',
        body: fd,
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

      if (payload?.ok !== true || !payload?.session) {
        setError({ code: 'BAD_RESPONSE', message: 'Missing ok:true session in response' });
        return;
      }

      setSession(payload.session as CalibrationSession);
    } catch (e: any) {
      setError({ code: 'NETWORK_ERROR', message: safeString(e?.message) || 'Network error' });
    } finally {
      setIsSubmitting(false);
    }
  }

  function pickFile(f: File | null) {
    if (!f) return;
    setSelectedFile(f);
  }

  // Auto-progress only for ritual states (server remains authoritative).
  useEffect(() => {
    const clearAutoProgress = () => {
      if (autoProgressIntervalRef.current != null) {
        window.clearInterval(autoProgressIntervalRef.current);
        autoProgressIntervalRef.current = null;
      }
      advanceInFlightRef.current = false;
    };

    if (!session) {
      clearAutoProgress();
      return;
    }

    const shouldRun =
      session.state === 'CONSOLIDATION_PENDING' || session.state === 'CONSOLIDATION_RITUAL' || session.state === 'ENCODING_RITUAL';

    if (!shouldRun) {
      clearAutoProgress();
      return;
    }

    // Guard against duplicate intervals (ensure only ONE exists).
    if (autoProgressIntervalRef.current != null) return;

    const sessionId = session.sessionId;

    autoProgressIntervalRef.current = window.setInterval(() => {
      if (advanceInFlightRef.current) return;
      advanceInFlightRef.current = true;

      Promise.resolve(sendEvent({ type: 'ADVANCE', sessionId } as CalibrationEvent))
        .catch(() => {})
        .finally(() => {
          advanceInFlightRef.current = false;
        });
    }, 800);

    return () => {
      clearAutoProgress();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.sessionId, session?.state]);

  // LANDING
  if (!session) {
    return (
      <Stage>
        <ErrorBox error={error} />
        <div className="text-[12px] tracking-[0.22em] opacity-80">WELCOME TO</div>
        <div className="mt-2 text-[56px] leading-[1.05] font-semibold">Caliber</div>
        <div className="mt-4 text-[16px] opacity-90">The alignment tool for job calibration.</div>

        <div className="mt-10 flex items-center justify-center">
          <button
            onClick={() => sendEvent({ type: 'CREATE_SESSION' } as CalibrationEvent)}
            disabled={isSubmitting}
            className="px-6 py-3 rounded-md font-semibold bg-[#F2F2F2] text-[#0B0B0B] disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isSubmitting ? 'Submitting…' : 'Begin Calibration'}
          </button>
        </div>
      </Stage>
    );
  }

  const state = session.state;
  const promptIndex = getPromptIndex(state);

  // RESUME_INGEST (upload-only)
  if (state === 'RESUME_INGEST') {
    return (
      <Stage>
        <ErrorBox error={error} />

        <div className="text-[32px] leading-tight font-semibold">Caliber</div>
        <div className="mt-6 text-[28px] leading-tight font-semibold">Upload Resume</div>
        <div className="mt-3 text-[16px] opacity-90">Your experience holds the pattern.</div>

        <div className="mt-8">
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const f = e.dataTransfer?.files?.[0] ?? null;
              if (f) pickFile(f);
            }}
            onClick={() => fileInputRef.current?.click()}
            className="mx-auto w-full max-w-[560px] cursor-pointer border-2 border-dashed border-[#2A2A2A] px-6 py-6 text-left"
          >
            <div className="text-[14px] font-semibold">Drop resume here, or click to choose</div>
            <div className="mt-2 text-[13px] opacity-80">PDF, DOCX, or TXT</div>
            {selectedFile && <div className="mt-4 text-[12px] font-mono opacity-90">Selected: {selectedFile.name}</div>}
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
            className="hidden"
            onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
          />

          <div className="mt-8 flex items-center justify-center">
            <button
              onClick={uploadResumeAndAdvance}
              disabled={isSubmitting || !selectedFile}
              className="px-6 py-3 rounded-md font-semibold bg-[#F2F2F2] text-[#0B0B0B] disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Submitting…' : 'Continue'}
            </button>
          </div>
        </div>
      </Stage>
    );
  }

  // PROMPTS
  if (isPromptState(state) && promptIndex) {
    const q = session.prompts?.[promptIndex]?.question || '(missing question)';
    return (
      <Stage>
        <ErrorBox error={error} />
        <div className="text-[32px] leading-tight font-semibold">Caliber</div>

        <div className="mt-10 mx-auto w-full max-w-[640px] text-left">
          <div className="text-[14px] font-semibold opacity-90">Prompt {promptIndex}</div>
          <div className="mt-3 text-[16px] leading-relaxed opacity-95 whitespace-pre-wrap">{q}</div>

          <div className="mt-6">
            <textarea
              value={promptAnswer}
              onChange={(e) => setPromptAnswer(e.target.value)}
              rows={7}
              className="w-full resize-y rounded-md border border-[#2A2A2A] bg-transparent px-4 py-3 text-[14px] leading-relaxed outline-none focus:border-[#3A3A3A]"
              placeholder="Type your answer…"
            />
          </div>

          <div className="mt-6 flex items-center justify-end">
            <button
              onClick={() =>
                sendEvent({ type: 'SUBMIT_PROMPT_ANSWER', sessionId: session.sessionId, answer: promptAnswer } as CalibrationEvent)
              }
              disabled={isSubmitting || promptAnswer.trim().length === 0}
              className="px-6 py-3 rounded-md font-semibold bg-[#F2F2F2] text-[#0B0B0B] disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Submitting…' : 'Continue'}
            </button>
          </div>
        </div>
      </Stage>
    );
  }

  // CLARIFIER
  if (isClarifierState(state) && promptIndex) {
    const cq = session.prompts?.[promptIndex]?.clarifier?.question || '(missing clarifier question)';
    return (
      <Stage>
        <ErrorBox error={error} />
        <div className="text-[32px] leading-tight font-semibold">Caliber</div>

        <div className="mt-10 mx-auto w-full max-w-[640px] text-left">
          <div className="text-[14px] font-semibold opacity-90">Prompt {promptIndex} — Clarifier</div>
          <div className="mt-3 text-[16px] leading-relaxed opacity-95 whitespace-pre-wrap">{cq}</div>

          <div className="mt-6">
            <textarea
              value={clarifierAnswer}
              onChange={(e) => setClarifierAnswer(e.target.value)}
              rows={7}
              className="w-full resize-y rounded-md border border-[#2A2A2A] bg-transparent px-4 py-3 text-[14px] leading-relaxed outline-none focus:border-[#3A3A3A]"
              placeholder="Type your clarifier answer…"
            />
          </div>

          <div className="mt-6 flex items-center justify-end">
            <button
              onClick={() =>
                sendEvent({
                  type: 'SUBMIT_PROMPT_CLARIFIER_ANSWER',
                  sessionId: session.sessionId,
                  answer: clarifierAnswer,
                } as CalibrationEvent)
              }
              disabled={isSubmitting || clarifierAnswer.trim().length === 0}
              className="px-6 py-3 rounded-md font-semibold bg-[#F2F2F2] text-[#0B0B0B] disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Submitting…' : 'Continue'}
            </button>
          </div>
        </div>
      </Stage>
    );
  }

  // CONSOLIDATION_PENDING
  if (state === 'CONSOLIDATION_PENDING') {
    return (
      <Stage>
        <ErrorBox error={error} />
        <div className="text-[32px] leading-tight font-semibold">Caliber</div>
        <div className="mt-8 text-[16px] opacity-90">Preparing consolidation ritual…</div>
        <div className="mt-4 text-[12px] opacity-70">Auto-progressing…</div>
      </Stage>
    );
  }

  // CONSOLIDATION_RITUAL
  if (state === 'CONSOLIDATION_RITUAL') {
    const pct = typeof session.consolidationRitual?.progressPct === 'number' ? session.consolidationRitual.progressPct : 0;
    const msg = session.consolidationRitual?.message || '…';

    return (
      <Stage>
        <ErrorBox error={error} />
        <div className="text-[32px] leading-tight font-semibold">Caliber</div>

        <div className="mt-10 mx-auto w-full max-w-[640px] text-left">
          <div className="text-[14px] font-semibold opacity-90">Consolidation Ritual</div>
          <div className="mt-3 text-[15px] leading-relaxed opacity-90 whitespace-pre-wrap">{msg}</div>

          <div className="mt-6">
            <div className="flex items-center justify-between text-[12px] opacity-80">
              <span>Progress</span>
              <span>{Math.max(0, Math.min(100, pct))}%</span>
            </div>
            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-[#141414]">
              <div className="h-full bg-[#F2F2F2]" style={{ width: `${Math.max(0, Math.min(100, pct))}%` }} />
            </div>
          </div>

          <div className="mt-4 text-[12px] opacity-70">Auto-progressing…</div>
        </div>
      </Stage>
    );
  }

  // ENCODING_RITUAL
  if (state === 'ENCODING_RITUAL') {
    return (
      <Stage>
        <ErrorBox error={error} />
        <div className="text-[32px] leading-tight font-semibold">Caliber</div>
        <div className="mt-8 text-[16px] opacity-90">Encoding your pattern…</div>
        <div className="mt-4 text-[12px] opacity-70">Auto-progressing…</div>
      </Stage>
    );
  }

  // PATTERN_SYNTHESIS (freeze-gated screen)
  if (state === 'PATTERN_SYNTHESIS') {
    const overlapRaw =
      (session as any)?.synthesis?.anchor_overlap_score ??
      (session as any)?.synthesis?.anchorOverlapScore ??
      (session as any)?.anchor_overlap_score;

    const missingCountRaw =
      (session as any)?.synthesis?.missing_anchor_count ??
      (session as any)?.synthesis?.missingAnchorCount ??
      (session as any)?.missing_anchor_count;

    const missingTermsRaw =
      (session as any)?.synthesis?.missing_anchor_terms ??
      (session as any)?.synthesis?.missingAnchorTerms ??
      (session as any)?.missing_anchor_terms;

    const overlapDisplay = typeof overlapRaw === 'number' && Number.isFinite(overlapRaw) ? overlapRaw.toFixed(2) : '—';
    const missingCountDisplay =
      typeof missingCountRaw === 'number' && Number.isFinite(missingCountRaw) ? String(missingCountRaw) : '—';
    const missingTerms =
      Array.isArray(missingTermsRaw) && missingTermsRaw.every((t) => typeof t === 'string') ? (missingTermsRaw as string[]) : null;

    return (
      <Stage>
        <ErrorBox error={error} />
        <div className="text-[32px] leading-tight font-semibold">Caliber</div>

        <div className="mt-10 mx-auto w-full max-w-[680px] text-center">
          <div className="text-[24px] font-semibold leading-tight">Calibration Core Mode</div>
          <div className="mt-6 text-[16px] leading-relaxed opacity-90">
            Pattern Summary is temporarily frozen while anchor extraction + overlap + gap surfaces are validated.
          </div>

          <div className="mt-6 mx-auto w-full max-w-[520px] rounded-md border border-[#2A2A2A] bg-transparent px-5 py-4 text-left">
            <div className="text-[12px] font-semibold opacity-70">Anchor Metrics</div>
            <div className="mt-3 text-[14px] leading-relaxed opacity-90">
              <div>Anchor overlap: {overlapDisplay}</div>
              <div className="mt-1">Missing anchors: {missingCountDisplay}</div>
              {missingTerms && missingTerms.length > 0 ? (
                <div className="mt-2 opacity-90">Missing terms: {missingTerms.join(', ')}</div>
              ) : null}
            </div>
          </div>

          <div className="mt-10 flex items-center justify-center">
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-3 rounded-md font-semibold bg-[#F2F2F2] text-[#0B0B0B]"
            >
              Restart
            </button>
          </div>
        </div>
      </Stage>
    );
  }

  // TITLE_HYPOTHESIS
  if (state === 'TITLE_HYPOTHESIS') {
    return (
      <Stage>
        <ErrorBox error={error} />
        <div className="text-[32px] leading-tight font-semibold">Caliber</div>

        <div className="mt-10 mx-auto w-full max-w-[640px] text-left">
          <div className="text-[14px] font-semibold opacity-90">Title Hypothesis</div>

          <div className="mt-6">
            <div className="text-[12px] font-semibold opacity-70">identitySummary</div>
            <div className="mt-2 text-[14px] leading-relaxed opacity-90 whitespace-pre-wrap">{session.synthesis?.identitySummary || ''}</div>
          </div>

          <div className="mt-6">
            <div className="text-[12px] font-semibold opacity-70">marketTitle</div>
            <div className="mt-2 text-[14px] leading-relaxed opacity-90 whitespace-pre-wrap">{session.synthesis?.marketTitle || ''}</div>
          </div>

          <div className="mt-6">
            <div className="text-[12px] font-semibold opacity-70">titleExplanation</div>
            <div className="mt-2 text-[14px] leading-relaxed opacity-90 whitespace-pre-wrap">{session.synthesis?.titleExplanation || ''}</div>
          </div>

          <div className="mt-8">
            <div className="text-[12px] font-semibold opacity-70">Reaction / feedback</div>
            <textarea
              value={titleFeedback}
              onChange={(e) => setTitleFeedback(e.target.value)}
              rows={5}
              className="mt-2 w-full resize-y rounded-md border border-[#2A2A2A] bg-transparent px-4 py-3 text-[14px] leading-relaxed outline-none focus:border-[#3A3A3A]"
              placeholder="Your reaction…"
            />
          </div>

          <div className="mt-6 flex items-center justify-end gap-3">
            <button
              onClick={() => sendEvent({ type: 'TITLE_FEEDBACK', sessionId: session.sessionId, feedback: titleFeedback } as CalibrationEvent)}
              disabled={isSubmitting || titleFeedback.trim().length === 0}
              className="px-6 py-3 rounded-md font-semibold bg-[#F2F2F2] text-[#0B0B0B] disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Submitting…' : 'Submit'}
            </button>

            <button
              onClick={() => sendEvent({ type: 'ADVANCE', sessionId: session.sessionId } as CalibrationEvent)}
              disabled={isSubmitting}
              className="px-6 py-3 rounded-md font-semibold border border-[#2A2A2A] text-[#F2F2F2] disabled:opacity-60 disabled:cursor-not-allowed hover:bg-[#111111]"
            >
              {isSubmitting ? 'Submitting…' : 'Continue'}
            </button>
          </div>
        </div>
      </Stage>
    );
  }

  // TITLE_DIALOGUE
  if (state === 'TITLE_DIALOGUE') {
    return (
      <Stage>
        <ErrorBox error={error} />
        <div className="text-[32px] leading-tight font-semibold">Caliber</div>

        <div className="mt-10 mx-auto w-full max-w-[640px] text-left">
          <div className="text-[14px] font-semibold opacity-90">Title Dialogue</div>

          <div className="mt-6">
            <div className="text-[12px] font-semibold opacity-70">marketTitle</div>
            <div className="mt-2 text-[14px] leading-relaxed opacity-90 whitespace-pre-wrap">{session.synthesis?.marketTitle || ''}</div>
          </div>

          <div className="mt-6">
            <div className="text-[12px] font-semibold opacity-70">titleExplanation</div>
            <div className="mt-2 text-[14px] leading-relaxed opacity-90 whitespace-pre-wrap">{session.synthesis?.titleExplanation || ''}</div>
          </div>

          {session.synthesis?.lastTitleFeedback && (
            <div className="mt-6">
              <div className="text-[12px] font-semibold opacity-70">lastTitleFeedback</div>
              <div className="mt-2 text-[14px] leading-relaxed opacity-90 whitespace-pre-wrap">{session.synthesis.lastTitleFeedback}</div>
            </div>
          )}

          <div className="mt-8">
            <div className="text-[12px] font-semibold opacity-70">Reaction / feedback</div>
            <textarea
              value={titleFeedback}
              onChange={(e) => setTitleFeedback(e.target.value)}
              rows={5}
              className="mt-2 w-full resize-y rounded-md border border-[#2A2A2A] bg-transparent px-4 py-3 text-[14px] leading-relaxed outline-none focus:border-[#3A3A3A]"
              placeholder="Your reaction…"
            />
          </div>

          <div className="mt-6 flex items-center justify-end gap-3">
            <button
              onClick={() => sendEvent({ type: 'TITLE_FEEDBACK', sessionId: session.sessionId, feedback: titleFeedback } as CalibrationEvent)}
              disabled={isSubmitting || titleFeedback.trim().length === 0}
              className="px-6 py-3 rounded-md font-semibold bg-[#F2F2F2] text-[#0B0B0B] disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Submitting…' : 'Submit'}
            </button>

            <button
              onClick={() => sendEvent({ type: 'ADVANCE', sessionId: session.sessionId } as CalibrationEvent)}
              disabled={isSubmitting}
              className="px-6 py-3 rounded-md font-semibold border border-[#2A2A2A] text-[#F2F2F2] disabled:opacity-60 disabled:cursor-not-allowed hover:bg-[#111111]"
            >
              {isSubmitting ? 'Submitting…' : 'Continue'}
            </button>
          </div>
        </div>
      </Stage>
    );
  }

  // JOB_INGEST
  if (state === 'JOB_INGEST') {
    return (
      <Stage>
        <ErrorBox error={error} />
        <div className="text-[32px] leading-tight font-semibold">Caliber</div>

        <div className="mt-10 mx-auto w-full max-w-[640px] text-left">
          <div className="text-[14px] font-semibold opacity-90">Job Ingest</div>

          <div className="mt-6">
            <div className="text-[12px] font-semibold opacity-70">Job description</div>
            <textarea
              value={jobText}
              onChange={(e) => setJobText(e.target.value)}
              rows={10}
              className="mt-2 w-full resize-y rounded-md border border-[#2A2A2A] bg-transparent px-4 py-3 text-[14px] leading-relaxed outline-none focus:border-[#3A3A3A]"
              placeholder="Paste the job description…"
            />
          </div>

          <div className="mt-6 flex items-center justify-end gap-3">
            <button
              onClick={() => sendEvent({ type: 'SUBMIT_JOB_TEXT', sessionId: session.sessionId, jobText } as CalibrationEvent)}
              disabled={isSubmitting || jobText.trim().length === 0}
              className="px-6 py-3 rounded-md font-semibold bg-[#F2F2F2] text-[#0B0B0B] disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Submitting…' : 'Submit'}
            </button>

            <button
              onClick={() => sendEvent({ type: 'ADVANCE', sessionId: session.sessionId } as CalibrationEvent)}
              disabled={isSubmitting}
              className="px-6 py-3 rounded-md font-semibold border border-[#2A2A2A] text-[#F2F2F2] disabled:opacity-60 disabled:cursor-not-allowed hover:bg-[#111111]"
            >
              {isSubmitting ? 'Submitting…' : 'Continue'}
            </button>
          </div>
        </div>
      </Stage>
    );
  }

  // ALIGNMENT_OUTPUT / TERMINAL_COMPLETE
  if (state === 'ALIGNMENT_OUTPUT' || state === 'TERMINAL_COMPLETE') {
    const hasResult = !!session.result;
    return (
      <Stage>
        <ErrorBox error={error} />
        <div className="text-[32px] leading-tight font-semibold">Caliber</div>

        <div className="mt-10 mx-auto w-full max-w-[640px] text-left">
          <div className="text-[14px] font-semibold opacity-90">Alignment Output</div>

          {!hasResult ? (
            <div className="mt-6 flex items-center justify-end">
              <button
                onClick={() => sendEvent({ type: 'COMPUTE_ALIGNMENT_OUTPUT', sessionId: session.sessionId } as CalibrationEvent)}
                disabled={isSubmitting}
                className="px-6 py-3 rounded-md font-semibold bg-[#F2F2F2] text-[#0B0B0B] disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isSubmitting ? 'Submitting…' : 'Compute'}
              </button>
            </div>
          ) : (
            <pre className="mt-6 whitespace-pre-wrap break-words text-[12px] opacity-90">{JSON.stringify(session.result, null, 2)}</pre>
          )}
        </div>
      </Stage>
    );
  }

  // Fallback (non-debug)
  return (
    <Stage>
      <ErrorBox error={error} />
      <div className="text-[32px] leading-tight font-semibold">Caliber</div>
      <div className="mt-8 text-[16px] opacity-90">Loading…</div>
    </Stage>
  );
}