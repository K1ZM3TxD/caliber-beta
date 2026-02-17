// lib/calibration_machine.ts
import type { CalibrationEvent, CalibrationSession, CalibrationState, CalibrationError } from "@/lib/calibration_types"
import { storeGet, storeSet } from "@/lib/calibration_store"
import { ingestJob } from "@/lib/job_ingest"
import { runIntegrationSeam } from "@/lib/integration_seam"
import { toResultContract } from "@/lib/result_contract"

type Ok = { ok: true; session: CalibrationSession }
type Err = { ok: false; error: CalibrationError }
export type DispatchResult = Ok | Err

function nowIso(): string {
  return new Date().toISOString()
}

function bad(code: CalibrationError["code"], message: string): Err {
  return { ok: false, error: { code, message } }
}

function pushHistory(session: CalibrationSession, from: CalibrationState, to: CalibrationState, event: string): CalibrationSession {
  if (from === to) return session
  const next = {
    ...session,
    history: [
      ...(Array.isArray(session.history) ? session.history : []),
      { at: nowIso(), from, to, event },
    ],
  }
  return next
}

function mustGet(sessionId: string): CalibrationSession | Err {
  const s = storeGet(sessionId)
  if (!s) return bad("SESSION_NOT_FOUND", "Session not found")
  return s
}

function promptsComplete1to5(session: CalibrationSession): boolean {
  for (let i = 1 as const; i <= 5; i = (i + 1) as any) {
    const slot = session.prompts[i]
    if (!slot) return false
    if (!slot.accepted) return false
    if (typeof slot.answer !== "string" || slot.answer.trim().length === 0) return false
  }
  return true
}

function meetsSignal(text: string): boolean {
  return text.trim().length >= 40
}

function promptStateForIndex(n: 1 | 2 | 3 | 4 | 5): CalibrationState {
  return (`PROMPT_${n}` as CalibrationState)
}

function clarifierStateForIndex(n: 1 | 2 | 3 | 4 | 5): CalibrationState {
  return (`PROMPT_${n}_CLARIFIER` as CalibrationState)
}

function getPromptIndex(state: CalibrationState): 1 | 2 | 3 | 4 | 5 | null {
  switch (state) {
    case "PROMPT_1":
    case "PROMPT_1_CLARIFIER":
      return 1
    case "PROMPT_2":
    case "PROMPT_2_CLARIFIER":
      return 2
    case "PROMPT_3":
    case "PROMPT_3_CLARIFIER":
      return 3
    case "PROMPT_4":
    case "PROMPT_4_CLARIFIER":
      return 4
    case "PROMPT_5":
    case "PROMPT_5_CLARIFIER":
      return 5
    default:
      return null
  }
}

function nextPromptAfter(n: 1 | 2 | 3 | 4 | 5): CalibrationState {
  if (n === 1) return "PROMPT_2"
  if (n === 2) return "PROMPT_3"
  if (n === 3) return "PROMPT_4"
  if (n === 4) return "PROMPT_5"
  // After prompt 5 -> consolidation entry state (must be visible)
  return "CONSOLIDATION_PENDING"
}

function clampPct(n: number): number {
  if (!Number.isFinite(n)) return 0
  if (n < 0) return 0
  if (n > 100) return 100
  return Math.round(n)
}

// Deterministic “encoding” placeholder: stable per session based on already-collected text.
function encodePersonVectorOnce(session: CalibrationSession): CalibrationSession {
  if (session.personVector.locked && session.personVector.values) return session

  const parts: string[] = []
  if (typeof session.resume.rawText === "string") parts.push(session.resume.rawText)
  for (let i = 1 as const; i <= 5; i = (i + 1) as any) {
    const a = session.prompts[i]?.answer
    if (typeof a === "string") parts.push(a)
    const ca = session.prompts[i]?.clarifier?.answer
    if (typeof ca === "string") parts.push(ca)
  }
  const joined = parts.join("\n").trim()

  // Stable 6-dim vector in 0..2 derived from simple hash-like accumulation.
  let acc = 0
  for (let i = 0; i < joined.length; i += 1) {
    acc = (acc + joined.charCodeAt(i) * (i + 1)) >>> 0
  }
  const dims: [0 | 1 | 2, 0 | 1 | 2, 0 | 1 | 2, 0 | 1 | 2, 0 | 1 | 2, 0 | 1 | 2] = [
    ((acc + 11) % 3) as 0 | 1 | 2,
    ((acc + 23) % 3) as 0 | 1 | 2,
    ((acc + 37) % 3) as 0 | 1 | 2,
    ((acc + 41) % 3) as 0 | 1 | 2,
    ((acc + 59) % 3) as 0 | 1 | 2,
    ((acc + 71) % 3) as 0 | 1 | 2,
  ]

  return {
    ...session,
    personVector: { values: dims, locked: true },
    encodingRitual: { completed: true },
  }
}

// Deterministic synthesis: stable once produced.
function synthesizeOnce(session: CalibrationSession): CalibrationSession {
  if (session.synthesis?.patternSummary && session.synthesis?.operateBest && session.synthesis?.loseEnergy) return session
  const vec = session.personVector.values
  if (!vec || vec.length !== 6) return session

  // Map dims to deterministic structural bullets (no “tone”).
  const labels = [
    "Structural Maturity",
    "Authority Scope",
    "Revenue Orientation",
    "Role Ambiguity",
    "Breadth vs Depth",
    "Stakeholder Density",
  ] as const

  const high: string[] = []
  const low: string[] = []
  for (let i = 0; i < 6; i += 1) {
    const v = vec[i]
    const name = labels[i]
    if (v === 2) high.push(name)
    if (v === 0) low.push(name)
  }

  const summary = [
    `Your pattern centers on repeatable structure and forward motion under clear constraints.`,
    `You perform best when the work has explicit ownership boundaries and measurable outcomes.`,
    `Energy loss clusters where constraints are missing or the system changes faster than it can be stabilized.`,
  ].join(" ")

  const operateBest = [
    `Work with explicit scope and decision rights (${high[1] ? `strongest signal: ${high[1]}` : "stable authority boundaries"}).`,
    `Roles with clear success metrics and cadence (${high[0] ? `strongest signal: ${high[0]}` : "structural repeatability"}).`,
    `High-context coordination where dependencies can be made explicit (${high[5] ? `strongest signal: ${high[5]}` : "stakeholder mapping"}).`,
  ].slice(0, 3)

  const loseEnergy = [
    `Ambiguous ownership or shifting mandates (${low[1] ? `strongest signal: ${low[1]}` : "authority ambiguity"}).`,
    `Unbounded roles where priorities are not stable across cycles (${low[3] ? `strongest signal: ${low[3]}` : "role ambiguity"}).`,
    `Diffuse work that cannot be reduced to a stable operating system (${low[0] ? `strongest signal: ${low[0]}` : "low structural maturity"}).`,
  ].slice(0, 3)

  return {
    ...session,
    synthesis: {
      patternSummary: summary,
      operateBest,
      loseEnergy,
      // Title phase placeholders (filled later)
      identitySummary: session.synthesis?.identitySummary ?? null,
      marketTitle: session.synthesis?.marketTitle ?? null,
      titleExplanation: session.synthesis?.titleExplanation ?? null,
      lastTitleFeedback: session.synthesis?.lastTitleFeedback ?? null,
    },
  }
}

function newSessionId(): string {
  // Avoid crypto import constraints; deterministic enough for local dev.
  return `sess_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`
}

function makeDefaultPrompt(question: string): any {
  return {
    question,
    answer: null,
    accepted: false,
    frozen: false,
    clarifier: {
      asked: false,
      question: null,
      answer: null,
    },
  }
}

function createSession(): CalibrationSession {
  const sessionId = newSessionId()
  const session: CalibrationSession = {
    sessionId,
    state: "RESUME_INGEST",
    resume: {
      rawText: null,
      completed: false,
      signals: null,
    },
    prompts: {
      1: makeDefaultPrompt("Prompt 1: Describe the kind of work you reliably ship when you are operating at your best."),
      2: makeDefaultPrompt("Prompt 2: Describe the environments where you consistently lose time or momentum (structural factors only)."),
      3: makeDefaultPrompt("Prompt 3: Describe the decisions you take ownership of and the decisions you escalate."),
      4: makeDefaultPrompt("Prompt 4: Describe the scope and complexity you handle without strain."),
      5: makeDefaultPrompt("Prompt 5: Describe the conditions you need for sustained energy and repeatable delivery."),
    },
    personVector: { values: null, locked: false },
    encodingRitual: { completed: false },
    consolidationRitual: {
      startedAtIso: null,
      lastTickAtIso: null,
      progressPct: 0,
      step: 0,
      message: null,
      completed: false,
    },
    synthesis: null,
    job: { rawText: null, roleVector: null, completed: false },
    result: null,
    history: [],
  }
  storeSet(session)
  return session
}

function ensureState(session: CalibrationSession, allowed: CalibrationState[], event: string): Err | null {
  if (!allowed.includes(session.state)) {
    return bad("INVALID_EVENT_FOR_STATE", `Event ${event} not allowed in state ${session.state}`)
  }
  return null
}

/**
 * Milestone 5.1 rule:
 * - Each dispatch may advance at most one state.
 * - No dead-end holds; UI can deterministically render from snapshot.
 */
export function dispatchCalibrationEvent(event: CalibrationEvent): DispatchResult {
  try {
    if (!event || typeof event !== "object" || typeof (event as any).type !== "string") {
      return bad("MISSING_REQUIRED_FIELD", "Missing event.type")
    }

    if (event.type === "CREATE_SESSION") {
      const session = createSession()
      return { ok: true, session }
    }

    // All other events require sessionId
    const sessionId = (event as any).sessionId
    if (typeof sessionId !== "string" || sessionId.trim().length === 0) {
      return bad("MISSING_REQUIRED_FIELD", "Missing sessionId")
    }

    const got = mustGet(sessionId)
    if ((got as any).ok === false) return got as Err
    let session = got as CalibrationSession

    const from = session.state

    switch (event.type) {
      case "SUBMIT_RESUME": {
        const err = ensureState(session, ["RESUME_INGEST"], event.type)
        if (err) return err
        const resumeText = (event as any).resumeText
        if (typeof resumeText !== "string" || resumeText.trim().length === 0) {
          return bad("MISSING_REQUIRED_FIELD", "resumeText must be a non-empty string")
        }

        const text = resumeText.trim()
        const hasBullets = /(^|\n)\s*[-*•]\s+/.test(text)
        const hasDates = /\b(19|20)\d{2}\b/.test(text)
        const hasTitles = /\b(Engineer|Manager|Director|VP|President|Lead|Head|Founder|Analyst|Consultant)\b/i.test(text)

        session = {
          ...session,
          resume: {
            rawText: text,
            completed: true,
            signals: {
              charLen: text.length,
              hasBullets,
              hasDates,
              hasTitles,
            },
          },
        }
        // Stay in RESUME_INGEST; user advances explicitly (or UI can).
        storeSet(session)
        return { ok: true, session }
      }

      case "ADVANCE": {
        // Server-authoritative auto progression for consolidation states (no user text required).
        if (session.state === "RESUME_INGEST") {
          if (!session.resume.completed) return bad("MISSING_REQUIRED_FIELD", "Resume must be submitted before advancing")
          const to: CalibrationState = "PROMPT_1"
          session = pushHistory({ ...session, state: to }, from, to, event.type)
          storeSet(session)
          return { ok: true, session }
        }

        if (session.state === "CONSOLIDATION_PENDING") {
          // Deterministic entry into visible ritual state on next dispatch.
          if (!promptsComplete1to5(session)) {
            return bad("RITUAL_NOT_READY", "Prompts 1–5 must be completed before consolidation ritual")
          }

          const to: CalibrationState = "CONSOLIDATION_RITUAL"
          const ritual = {
            startedAtIso: nowIso(),
            lastTickAtIso: nowIso(),
            progressPct: 0,
            step: 0,
            message: "Initializing consolidation…",
            completed: false,
          }

          session = pushHistory(
            {
              ...session,
              state: to,
              consolidationRitual: ritual,
            },
            from,
            to,
            event.type,
          )
          storeSet(session)
          return { ok: true, session }
        }

        if (session.state === "CONSOLIDATION_RITUAL") {
          const r = session.consolidationRitual
          const lastTick = r.lastTickAtIso ? new Date(r.lastTickAtIso).getTime() : 0
          const now = Date.now()
          const deltaMs = now - lastTick

          // Deterministic pacing: only advance a step if enough time elapsed.
          const stepAdvance = deltaMs >= 450 ? 1 : 0

          const nextStep = r.step + stepAdvance
          const nextPct = clampPct(r.progressPct + stepAdvance * 20)

          const messages = [
            "Consolidating signal…",
            "Encoding structural traits…",
            "Normalizing constraints…",
            "Locking person-vector…",
            "Preparing synthesis…",
          ]

          const nextMessage = messages[Math.min(nextStep, messages.length - 1)] ?? "Working…"

          const nextRitual = {
            ...r,
            startedAtIso: r.startedAtIso ?? nowIso(),
            lastTickAtIso: nowIso(),
            step: nextStep,
            progressPct: nextPct,
            message: nextMessage,
            completed: nextPct >= 100,
          }

          // If not complete, remain in CONSOLIDATION_RITUAL (no state change).
          if (!nextRitual.completed) {
            session = { ...session, consolidationRitual: nextRitual }
            storeSet(session)
            return { ok: true, session }
          }

          // Ritual completes -> encode exactly once -> synthesize exactly once -> transition ONE state to PATTERN_SYNTHESIS.
          let next = { ...session, consolidationRitual: nextRitual }
          next = encodePersonVectorOnce(next)
          next = synthesizeOnce(next)

          const to: CalibrationState = "PATTERN_SYNTHESIS"
          next = pushHistory({ ...next, state: to }, from, to, event.type)
          storeSet(next)
          return { ok: true, session: next }
        }

        if (session.state === "PATTERN_SYNTHESIS") {
          const to: CalibrationState = "TITLE_HYPOTHESIS"
          session = pushHistory({ ...session, state: to }, from, to, event.type)
          storeSet(session)
          return { ok: true, session }
        }

        if (session.state === "TITLE_HYPOTHESIS") {
          const to: CalibrationState = "TITLE_DIALOGUE"
          session = pushHistory({ ...session, state: to }, from, to, event.type)
          storeSet(session)
          return { ok: true, session }
        }

        if (session.state === "TITLE_DIALOGUE" || session.state === "JOB_INGEST") {
          if (!session.job.completed || !session.job.roleVector || !session.personVector.values) {
            return bad("JOB_REQUIRED", "Submit a job description before advancing")
          }
          const to: CalibrationState = "ALIGNMENT_OUTPUT"
          session = pushHistory({ ...session, state: to }, from, to, event.type)
          storeSet(session)
          return { ok: true, session }
        }

        return bad("INVALID_EVENT_FOR_STATE", `ADVANCE not supported in state ${session.state}`)
      }

      case "SUBMIT_PROMPT_ANSWER": {
        const idx = getPromptIndex(session.state)
        if (!idx) return bad("INVALID_EVENT_FOR_STATE", `Not in a prompt state: ${session.state}`)

        const slot = session.prompts[idx]
        if (slot.frozen) return bad("PROMPT_FROZEN", `Prompt ${idx} is frozen`)

        const answer = (event as any).answer
        if (typeof answer !== "string" || answer.trim().length === 0) {
          return bad("MISSING_REQUIRED_FIELD", "answer must be a non-empty string")
        }

        const trimmed = answer.trim()

        // Signal gate: if weak and clarifier not yet used, move to clarifier state (visible) WITHOUT accepting.
        if (!meetsSignal(trimmed) && !slot.clarifier.asked) {
          const to = clarifierStateForIndex(idx)
          const clarifierQ = "Please add concrete structural detail: scope, constraints, decisions, and measurable outcomes."

          const nextSlot = {
            ...slot,
            clarifier: {
              asked: true,
              question: clarifierQ,
              answer: null,
            },
          }

          session = {
            ...session,
            prompts: { ...session.prompts, [idx]: nextSlot } as any,
          }
          session = pushHistory({ ...session, state: to }, from, to, event.type)
          storeSet(session)
          return { ok: true, session }
        }

        // Accept and advance exactly one state.
        const nextSlot = {
          ...slot,
          answer: trimmed,
          accepted: true,
          frozen: true,
        }

        const to = nextPromptAfter(idx)
        session = {
          ...session,
          prompts: { ...session.prompts, [idx]: nextSlot } as any,
        }
        session = pushHistory({ ...session, state: to }, from, to, event.type)
        storeSet(session)
        return { ok: true, session }
      }

      case "SUBMIT_PROMPT_CLARIFIER_ANSWER": {
        const idx = getPromptIndex(session.state)
        if (!idx) return bad("INVALID_EVENT_FOR_STATE", `Not in a prompt clarifier state: ${session.state}`)
        if (session.state !== clarifierStateForIndex(idx)) {
          return bad("INVALID_EVENT_FOR_STATE", `Not in correct clarifier state for prompt ${idx}`)
        }

        const slot = session.prompts[idx]
        if (slot.frozen) return bad("PROMPT_FROZEN", `Prompt ${idx} is frozen`)

        const answer = (event as any).answer
        if (typeof answer !== "string" || answer.trim().length === 0) {
          return bad("MISSING_REQUIRED_FIELD", "answer must be a non-empty string")
        }

        const trimmed = answer.trim()

        // If still insufficient after clarifier, fail deterministically (no silent acceptance).
        if (!meetsSignal(trimmed)) {
          return bad("INSUFFICIENT_SIGNAL_AFTER_CLARIFIER", "Answer still too short after clarifier; add more structural detail")
        }

        const nextSlot = {
          ...slot,
          answer: trimmed,
          accepted: true,
          frozen: true,
          clarifier: {
            ...slot.clarifier,
            answer: trimmed,
          },
        }

        const to = nextPromptAfter(idx)
        session = {
          ...session,
          prompts: { ...session.prompts, [idx]: nextSlot } as any,
        }
        session = pushHistory({ ...session, state: to }, from, to, event.type)
        storeSet(session)
        return { ok: true, session }
      }

      case "TITLE_FEEDBACK": {
        const err = ensureState(session, ["TITLE_HYPOTHESIS", "TITLE_DIALOGUE"], event.type)
        if (err) return err
        const feedback = (event as any).feedback
        if (typeof feedback !== "string") return bad("MISSING_REQUIRED_FIELD", "feedback must be a string")
        session = {
          ...session,
          synthesis: {
            ...(session.synthesis ?? {
              patternSummary: null,
              operateBest: null,
              loseEnergy: null,
              identitySummary: null,
              marketTitle: null,
              titleExplanation: null,
              lastTitleFeedback: null,
            }),
            lastTitleFeedback: feedback,
          },
        }
        storeSet(session)
        return { ok: true, session }
      }

      case "SUBMIT_JOB_TEXT": {
        const jobText = (event as any).jobText
        if (typeof jobText !== "string" || jobText.trim().length === 0) {
          return bad("MISSING_REQUIRED_FIELD", "jobText must be a non-empty string")
        }
        if (!session.personVector.values || !session.personVector.locked) {
          return bad("JOB_ENCODING_INCOMPLETE", "Person vector must be encoded before job ingest")
        }

        // Ingest deterministically (may throw typed job_ingest errors; bubble as BAD_REQUEST).
        let roleVector: any = null
        try {
          const ingest = ingestJob(jobText.trim())
          roleVector = ingest.roleVector as any
        } catch (e: any) {
          return bad("BAD_REQUEST" as any, String(e?.detail ?? e?.message ?? "Invalid job text"))
        }

        const to: CalibrationState = "JOB_INGEST"
        session = {
          ...session,
          job: { rawText: jobText.trim(), roleVector, completed: true },
          result: null, // reset result on new job
        }
        session = pushHistory({ ...session, state: to }, from, to, event.type)
        storeSet(session)
        return { ok: true, session }
      }

      case "COMPUTE_ALIGNMENT_OUTPUT": {
        const err = ensureState(session, ["ALIGNMENT_OUTPUT"], event.type)
        if (err) return err
        if (!session.job.completed || !session.job.rawText) return bad("JOB_REQUIRED", "Submit a job description first")
        if (!session.personVector.values) return bad("JOB_ENCODING_INCOMPLETE", "Missing person vector")

        const seam = runIntegrationSeam({
          jobText: session.job.rawText,
          experienceVector: session.personVector.values as any,
        })

        if (!seam.ok) {
          return bad("BAD_REQUEST" as any, seam.error.message)
        }

        const contract = toResultContract({
          alignment: seam.result.alignment,
          skillMatch: seam.result.skillMatch,
          stretchLoad: seam.result.stretchLoad,
        })

        const to: CalibrationState = "TERMINAL_COMPLETE"
        session = {
          ...session,
          result: contract,
        }
        session = pushHistory({ ...session, state: to }, from, to, event.type)
        storeSet(session)
        return { ok: true, session }
      }

      case "ENCODING_COMPLETE": {
        // Kept for compatibility; encoding is now guarded + run as part of ritual completion.
        return bad("INVALID_EVENT_FOR_STATE", "ENCODING_COMPLETE is not a public event in v1 flow")
      }

      default:
        return bad("MISSING_REQUIRED_FIELD", `Unknown event type: ${(event as any).type}`)
    }
  } catch (e: any) {
    return bad("BAD_REQUEST" as any, String(e?.message ?? "Unexpected error"))
  }
}