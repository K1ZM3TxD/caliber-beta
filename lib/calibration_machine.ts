// lib/calibration_machine.ts

import type { CalibrationEvent, CalibrationSession, CalibrationState, PromptSlot } from "@/lib/calibration_types"
import { storeGet, storeSet } from "@/lib/calibration_store"
import { ingestJob, isJobIngestError } from "@/lib/job_ingest"
import { computeSkillMatch } from "@/lib/skill_match"
import { computeStretchLoad } from "@/lib/stretch_load"
import { toResultContract } from "@/lib/result_contract"

type Ok = { ok: true; session: CalibrationSession }
type Err = { ok: false; error: { code: string; message: string } }
export type DispatchResult = Ok | Err

function nowIso(): string {
  return new Date().toISOString()
}

function bad(code: string, message: string): Err {
  return { ok: false, error: { code, message } }
}

function transition(s: CalibrationSession, to: CalibrationState, event: string): void {
  const from = s.state
  if (from !== to) {
    s.history.push({ at: nowIso(), from, to, event })
  }
  s.state = to
}

function assertNonEmptyString(field: string, v: unknown): { ok: true; value: string } | Err {
  if (typeof v !== "string") return bad("MISSING_REQUIRED_FIELD", `${field} must be a string`)
  if (v.trim().length === 0) return bad("MISSING_REQUIRED_FIELD", `${field} must be non-empty`)
  return { ok: true, value: v }
}

function promptQuestion(k: 1 | 2 | 3 | 4 | 5): string {
  if (k === 1) return "In your most recent role, what part of the work felt most like you?"
  if (k === 2) return "What part of the role drained you fastest?"
  if (k === 3) return "What do others come to you for that isn’t necessarily in your job description?"
  if (k === 4) return "What type of challenge feels exciting rather than overwhelming?"
  return "If you removed job titles entirely, how would you describe the work you’re best at?"
}

function clarifierQuestion(k: 1 | 2 | 3 | 4 | 5): string {
  if (k === 1) return "Name the exact work unit that felt most like you, and why."
  if (k === 2) return "Name the first activity that drained you, and what about it caused the drain."
  if (k === 3) return "List 2–3 things people ask you for that aren’t on your job description."
  if (k === 4) return "Describe one challenge that excites you, and what kind of difficulty it contains."
  return "Describe the work you’re best at using verbs + outputs, not titles."
}

// Minimal deterministic “signal threshold” gate (structure, not tone).
const MIN_LEN = 40
const MIN_WORDS = 8
function hasMinimumSignal(text: string): boolean {
  const t = text.trim()
  if (t.length < MIN_LEN) return false
  const words = t.split(/\s+/).filter(Boolean)
  return words.length >= MIN_WORDS
}

function makePromptSlot(k: 1 | 2 | 3 | 4 | 5): PromptSlot {
  return {
    question: promptQuestion(k),
    answer: null,
    accepted: false,
    frozen: false,
    clarifier: { asked: false, question: null, answer: null },
  }
}

function newSession(sessionId: string): CalibrationSession {
  return {
    sessionId,
    state: "RESUME_INGEST",
    resume: { rawText: null, completed: false, signals: null },
    prompts: {
      1: makePromptSlot(1),
      2: makePromptSlot(2),
      3: makePromptSlot(3),
      4: makePromptSlot(4),
      5: makePromptSlot(5),
    },
    personVector: { values: null, locked: false },
    encodingRitual: { completed: false },
    synthesis: null,
    job: {
      rawText: null,
      roleVector: null,
      completed: false,
    },
    result: null,
    history: [],
  }
}

function activePromptKFromState(state: CalibrationState): 1 | 2 | 3 | 4 | 5 | null {
  if (state === "PROMPT_1") return 1
  if (state === "PROMPT_2") return 2
  if (state === "PROMPT_3") return 3
  if (state === "PROMPT_4") return 4
  if (state === "PROMPT_5") return 5
  return null
}

function activeClarifierKFromState(state: CalibrationState): 1 | 2 | 3 | 4 | 5 | null {
  if (state === "PROMPT_1_CLARIFIER") return 1
  if (state === "PROMPT_2_CLARIFIER") return 2
  if (state === "PROMPT_3_CLARIFIER") return 3
  if (state === "PROMPT_4_CLARIFIER") return 4
  if (state === "PROMPT_5_CLARIFIER") return 5
  return null
}

function nextPromptState(k: 1 | 2 | 3 | 4 | 5): CalibrationState {
  if (k === 1) return "PROMPT_2"
  if (k === 2) return "PROMPT_3"
  if (k === 3) return "PROMPT_4"
  if (k === 4) return "PROMPT_5"
  return "CONSOLIDATION_PENDING"
}

function toRoleVectorTuple(
  v: number[],
): [0 | 1 | 2, 0 | 1 | 2, 0 | 1 | 2, 0 | 1 | 2, 0 | 1 | 2, 0 | 1 | 2] | null {
  if (!Array.isArray(v) || v.length !== 6) return null
  const out: number[] = []
  for (const n of v) {
    if (n !== 0 && n !== 1 && n !== 2) return null
    out.push(n)
  }
  return out as [0 | 1 | 2, 0 | 1 | 2, 0 | 1 | 2, 0 | 1 | 2, 0 | 1 | 2, 0 | 1 | 2]
}

// Deterministic personVector placeholder (smallest shippable):
// Encode a stable 6-dim vector in {0,1,2} from text using coarse keyword rules.
// (No new dimensions introduced; names/length are locked.)
function computePersonVector(
  text: string,
): [0 | 1 | 2, 0 | 1 | 2, 0 | 1 | 2, 0 | 1 | 2, 0 | 1 | 2, 0 | 1 | 2] {
  const t = text.toLowerCase()

  function score(r0: RegExp[], r2: RegExp[]): 0 | 1 | 2 {
    for (const r of r2) if (r.test(t)) return 2
    for (const r of r0) if (r.test(t)) return 0
    return 1
  }

  const structuralMaturity = score([/execute|ticket|backlog|assigned/], [/design|strategy|direction|system/])
  const authorityScope = score([/\bic\b|individual contributor|own my tasks/], [/manage|lead team|director|head of/])
  const revenueOrientation = score([/internal|ops|support|enablement/], [/sales|revenue|pipeline|growth|pricing|gtm/])
  const roleAmbiguity = score([/clear requirements|defined scope/], [/ambiguous|0 to 1|unstructured|unknown/])
  const breadthVsDepth = score([/specialist|expert|focused|deep dive/], [/generalist|end-to-end|cross-functional/])
  const stakeholderDensity = score([/few stakeholders|single partner/], [/many stakeholders|exec|leadership|multiple teams|matrix/])

  return [structuralMaturity, authorityScope, revenueOrientation, roleAmbiguity, breadthVsDepth, stakeholderDensity]
}

// Locked alignment scoring mechanics (project kernel) — deterministic.
function computeAlignmentScore(args: {
  personVector: number[]
  roleVector: number[]
}): { score: number; explanation: string; signals: any } {
  const P = args.personVector
  const R = args.roleVector

  const d = [0, 1, 2, 3, 4, 5].map((i) => Math.abs((P[i] ?? 1) - (R[i] ?? 1)))

  const C = d.filter((x) => x >= 2).length // severe contradictions
  const M = d.filter((x) => x === 1).length // mild tensions

  const W = 1.5 * C + 0.5 * M
  let score = Math.max(0, Math.min(10, 10 - W))

  const round1 = Math.round(score * 10) / 10
  score = round1

  const explanation = `Alignment computed from locked vectors. Severe contradictions=${C}, mild tensions=${M}, weighted penalty=${W.toFixed(
    1,
  )}.`

  return {
    score,
    explanation,
    signals: {
      personVector: P,
      roleVector: R,
      deltas: d,
      severeContradictions: C,
      mildTensions: M,
      penaltyWeight: W,
    },
  }
}

function combinedText(s: CalibrationSession): string {
  const resume = s.resume.rawText ?? ""
  const prompts = ([1, 2, 3, 4, 5] as const).map((k) => s.prompts[k].answer ?? "").join("\n")
  return `${resume}\n${prompts}`.trim()
}

// Internal “auto-step” run when we leave PROMPT_5 and enter post states.
// Encoding ritual is instant; synthesis/title are set deterministically.
function runPostPrompt5Pipeline(s: CalibrationSession, eventName: string): void {
  // CONSOLIDATION_PENDING
  transition(s, "CONSOLIDATION_PENDING", eventName)

  const text = combinedText(s)
  s.personVector.values = computePersonVector(text)
  s.personVector.locked = true

  // ENCODING_RITUAL (instant)
  transition(s, "ENCODING_RITUAL", eventName)
  s.encodingRitual.completed = true

  // PATTERN_SYNTHESIS (minimal deterministic placeholder; no tone)
  transition(s, "PATTERN_SYNTHESIS", eventName)
  s.synthesis = {
    titleHypothesis: "Structural Operator",
    patternSummary: "Structural pattern captured. Person vector encoded and locked. Proceeding to scoring without blending.",
    operateBest: ["Clear ownership", "Structured scope", "Known stakeholders", "Defined success criteria"],
    loseEnergy: ["Ambiguous authority", "Constant context switching", "Unbounded requests", "Conflicting priorities"],
  }

  transition(s, "TITLE_HYPOTHESIS", eventName)
  transition(s, "TITLE_DIALOGUE", eventName)
  transition(s, "JOB_INGEST", eventName)
}

function submitJobText(s: CalibrationSession, jobText: string): DispatchResult {
  if (
    s.state !== "TITLE_DIALOGUE" &&
    s.state !== "JOB_INGEST" &&
    s.state !== "ALIGNMENT_OUTPUT" &&
    s.state !== "TERMINAL_COMPLETE"
  ) {
    return bad(
      "INVALID_EVENT_FOR_STATE",
      "SUBMIT_JOB_TEXT is only valid in TITLE_DIALOGUE, JOB_INGEST, ALIGNMENT_OUTPUT, TERMINAL_COMPLETE",
    )
  }

  const j = assertNonEmptyString("jobText", jobText)
  if (!j.ok) return j

  const normalizedJobText = j.value.trim()

  try {
    const ingest = ingestJob(normalizedJobText)
    const roleVector = toRoleVectorTuple(ingest.roleVector)
    if (!roleVector) {
      return bad("JOB_ENCODING_INCOMPLETE", "Job encoding did not produce a valid 6-dimension role vector")
    }

    s.job.rawText = normalizedJobText
    s.job.roleVector = roleVector
    s.job.completed = true
    s.result = null
    transition(s, "JOB_INGEST", "SUBMIT_JOB_TEXT")

    storeSet(s)
    return { ok: true, session: s }
  } catch (err: unknown) {
    if (isJobIngestError(err)) {
      return bad("JOB_ENCODING_INCOMPLETE", err.detail)
    }
    return bad("JOB_ENCODING_INCOMPLETE", "Unable to encode job text")
  }
}

export function dispatchCalibrationEvent(event: CalibrationEvent): DispatchResult {
  // CREATE_SESSION
  if (event.type === "CREATE_SESSION") {
    const sessionId = `cal_${nowIso().replace(/[:.]/g, "")}_${Math.floor(Math.random() * 1e6)}`
    const s = newSession(sessionId)
    storeSet(s)
    return { ok: true, session: s }
  }

  // Everything else needs a session
  const sessionId = (event as any).sessionId
  if (typeof sessionId !== "string" || sessionId.trim().length === 0) {
    return bad("MISSING_REQUIRED_FIELD", "sessionId is required")
  }

  const s = storeGet(sessionId)
  if (!s) return bad("SESSION_NOT_FOUND", "Session not found")

  // SUBMIT_RESUME
  if (event.type === "SUBMIT_RESUME") {
    if (s.state !== "RESUME_INGEST") return bad("INVALID_EVENT_FOR_STATE", "SUBMIT_RESUME is only valid in RESUME_INGEST")
    const r = assertNonEmptyString("resumeText", event.resumeText)
    if (!r.ok) return r

    const raw = r.value.trim()
    s.resume.rawText = raw
    s.resume.completed = raw.length >= 80
    s.resume.signals = {
      charLen: raw.length,
      hasBullets: /[\n\r]\s*[-*•]/.test(raw),
      hasDates: /\b(19|20)\d{2}\b/.test(raw),
      hasTitles: /\b(manager|director|engineer|analyst|designer|founder|lead)\b/i.test(raw),
    }

    // Auto-advance out of RESUME_INGEST on successful submit.
    transition(s, "PROMPT_1", "SUBMIT_RESUME")

    storeSet(s)
    return { ok: true, session: s }
  }

  // SUBMIT_PROMPT_ANSWER (server infers k from state)
  if (event.type === "SUBMIT_PROMPT_ANSWER") {
    const k = activePromptKFromState(s.state)
    if (!k) return bad("INVALID_EVENT_FOR_STATE", "SUBMIT_PROMPT_ANSWER is only valid in PROMPT_1..PROMPT_5")

    const slot = s.prompts[k]
    if (slot.frozen) return bad("PROMPT_FROZEN", `Prompt ${k} is frozen`)

    const a = assertNonEmptyString("answer", event.answer)
    if (!a.ok) return a

    const ans = a.value.trim()
    slot.answer = ans

    if (hasMinimumSignal(ans)) {
      slot.accepted = true
      slot.frozen = true

      const next = nextPromptState(k)
      if (next === "CONSOLIDATION_PENDING") {
        runPostPrompt5Pipeline(s, "SUBMIT_PROMPT_ANSWER")
      } else {
        transition(s, next, "SUBMIT_PROMPT_ANSWER")
      }

      storeSet(s)
      return { ok: true, session: s }
    }

    // insufficient signal => clarifier state if not yet used
    if (!slot.clarifier.asked) {
      slot.clarifier.asked = true
      slot.clarifier.question = clarifierQuestion(k)
      transition(s, `PROMPT_${k}_CLARIFIER` as CalibrationState, "SUBMIT_PROMPT_ANSWER")
      storeSet(s)
      return { ok: true, session: s }
    }

    return bad("INSUFFICIENT_SIGNAL_AFTER_CLARIFIER", "Insufficient signal after clarifier")
  }

  // SUBMIT_PROMPT_CLARIFIER_ANSWER (only valid in PROMPT_k_CLARIFIER)
  if (event.type === "SUBMIT_PROMPT_CLARIFIER_ANSWER") {
    const k = activeClarifierKFromState(s.state)
    if (!k) return bad("INVALID_EVENT_FOR_STATE", "SUBMIT_PROMPT_CLARIFIER_ANSWER is only valid in PROMPT_k_CLARIFIER")

    const slot = s.prompts[k]
    if (slot.frozen) return bad("PROMPT_FROZEN", `Prompt ${k} is frozen`)
    if (!slot.clarifier.asked) return bad("INVALID_EVENT_FOR_STATE", "Clarifier was not asked")

    const a = assertNonEmptyString("answer", event.answer)
    if (!a.ok) return a

    const ans = a.value.trim()
    slot.clarifier.answer = ans

    if (!hasMinimumSignal(ans)) {
      return bad("INSUFFICIENT_SIGNAL_AFTER_CLARIFIER", "Insufficient signal after clarifier")
    }

    slot.accepted = true
    slot.frozen = true

    const next = nextPromptState(k)
    if (next === "CONSOLIDATION_PENDING") {
      runPostPrompt5Pipeline(s, "SUBMIT_PROMPT_CLARIFIER_ANSWER")
    } else {
      transition(s, next, "SUBMIT_PROMPT_CLARIFIER_ANSWER")
    }

    storeSet(s)
    return { ok: true, session: s }
  }

  if (event.type === "SUBMIT_JOB_TEXT") {
    return submitJobText(s, event.jobText)
  }

  // ADVANCE (forward-only)
  if (event.type === "ADVANCE") {
    if (s.state === "RESUME_INGEST") {
      if (!s.resume.completed) return bad("FORBIDDEN_TRANSITION", "Resume ingest must be completed before entering PROMPT_1")
      transition(s, "PROMPT_1", "ADVANCE")
      storeSet(s)
      return { ok: true, session: s }
    }

    const kPrompt = activePromptKFromState(s.state)
    if (kPrompt) {
      const slot = s.prompts[kPrompt]
      if (!slot.accepted) return bad("FORBIDDEN_TRANSITION", "Prompt must be accepted before advancing")

      // Freeze immediately upon advancing past prompt k
      slot.frozen = true

      const next = nextPromptState(kPrompt)
      if (next === "CONSOLIDATION_PENDING") {
        runPostPrompt5Pipeline(s, "ADVANCE")
      } else {
        transition(s, next, "ADVANCE")
      }

      storeSet(s)
      return { ok: true, session: s }
    }

    // ADVANCE out of clarifier state (same acceptance rule; freeze on leaving prompt k)
    const kClar = activeClarifierKFromState(s.state)
    if (kClar) {
      const slot = s.prompts[kClar]
      if (!slot.accepted) return bad("FORBIDDEN_TRANSITION", "Prompt must be accepted before advancing")

      slot.frozen = true

      const next = nextPromptState(kClar)
      if (next === "CONSOLIDATION_PENDING") {
        runPostPrompt5Pipeline(s, "ADVANCE")
      } else {
        transition(s, next, "ADVANCE")
      }

      storeSet(s)
      return { ok: true, session: s }
    }

    if (s.state === "TITLE_DIALOGUE") {
      transition(s, "JOB_INGEST", "ADVANCE")
      storeSet(s)
      return { ok: true, session: s }
    }

    if (s.state === "JOB_INGEST") {
      if (!s.job.completed || !s.job.roleVector) {
        return bad("FORBIDDEN_TRANSITION", "JOB_REQUIRED")
      }
      transition(s, "ALIGNMENT_OUTPUT", "ADVANCE")
      storeSet(s)
      return { ok: true, session: s }
    }

    // From ALIGNMENT_OUTPUT you don’t ADVANCE; you COMPUTE_ALIGNMENT_OUTPUT.
    if (s.state === "ALIGNMENT_OUTPUT") return bad("INVALID_EVENT_FOR_STATE", "Use COMPUTE_ALIGNMENT_OUTPUT in ALIGNMENT_OUTPUT")
    if (s.state === "TERMINAL_COMPLETE") return bad("FORBIDDEN_TRANSITION", "Session is complete")

    return bad("INVALID_EVENT_FOR_STATE", "ADVANCE not valid for current state")
  }

  // COMPUTE_ALIGNMENT_OUTPUT
  if (event.type === "COMPUTE_ALIGNMENT_OUTPUT") {
    if (s.state !== "ALIGNMENT_OUTPUT") return bad("INVALID_EVENT_FOR_STATE", "COMPUTE_ALIGNMENT_OUTPUT is only valid in ALIGNMENT_OUTPUT")
    if (!s.personVector.locked || !s.personVector.values) return bad("FORBIDDEN_TRANSITION", "Person vector must be locked before output")
    if (!s.encodingRitual.completed) return bad("FORBIDDEN_TRANSITION", "Encoding ritual must be completed before output")
    if (!s.job.completed || !s.job.roleVector) return bad("JOB_REQUIRED", "A valid encoded job is required before output")

    const personVector = s.personVector.values
    const roleVector = s.job.roleVector

    const alignment = computeAlignmentScore({ personVector, roleVector })
    const skillMatch = computeSkillMatch(roleVector, personVector)
    const stretchLoad = computeStretchLoad(skillMatch.finalScore)

    // Contract v1 keys only.
    s.result = toResultContract({
      alignment,
      skillMatch,
      stretchLoad,
    })

    transition(s, "TERMINAL_COMPLETE", "COMPUTE_ALIGNMENT_OUTPUT")
    storeSet(s)
    return { ok: true, session: s }
  }

  return bad("INVALID_EVENT_FOR_STATE", "Invalid event")
}