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
  return {
    ...session,
    history: [
      ...(Array.isArray(session.history) ? session.history : []),
      { at: nowIso(), from, to, event },
    ],
  }
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

type ContrastPair = { x: string; y: string } // identity contrast
type InterventionPair = { a: string; b: string } // intervention contrast

function pickFirst<T>(items: T[], fallback: T): T {
  return items.length > 0 ? items[0] : fallback
}

function coherenceStrong(vec: [0 | 1 | 2, 0 | 1 | 2, 0 | 1 | 2, 0 | 1 | 2, 0 | 1 | 2, 0 | 1 | 2]): boolean {
  // Earned consequence drop only when the vector shows clear shape (enough non-neutral dimensions).
  let nonNeutral = 0
  for (const v of vec) if (v !== 1) nonNeutral += 1
  return nonNeutral >= 4
}

// Deterministic synthesis: MUST conform to SYNTHESIS_PATTERN locked form.
// patternSummary becomes the 4-layer contrast block only (no narrative paragraph).
function synthesizeOnce(session: CalibrationSession): CalibrationSession {
  if (session.synthesis?.patternSummary && session.synthesis?.operateBest && session.synthesis?.loseEnergy) return session
  const vec = session.personVector.values
  if (!vec || vec.length !== 6) return session

  const v = vec as [0 | 1 | 2, 0 | 1 | 2, 0 | 1 | 2, 0 | 1 | 2, 0 | 1 | 2, 0 | 1 | 2]

  // Dimension-driven phrase banks (no adjectives, no praise).
  const identityByDim: Record<number, Record<0 | 1 | 2, ContrastPair>> = {
    0: {
      0: { x: "handle tasks", y: "set an operating structure" },
      1: { x: "ship work", y: "stabilize the work system" },
      2: { x: "ship work", y: "build an operating structure" },
    },
    1: {
      0: { x: "support decisions", y: "route decisions to the right owner" },
      1: { x: "take ownership", y: "define decision boundaries" },
      2: { x: "take ownership", y: "set decision boundaries and hold them" },
    },
    2: {
      0: { x: "do the work", y: "separate signal from incentives" },
      1: { x: "hit targets", y: "maintain measurement integrity" },
      2: { x: "hit targets", y: "design measurement and incentives" },
    },
    3: {
      0: { x: "follow a plan", y: "enforce scope boundaries" },
      1: { x: "work across scope", y: "anchor scope to constraints" },
      2: { x: "work across scope", y: "re-anchor scope to constraints" },
    },
    4: {
      0: { x: "cover many topics", y: "reduce the problem to a single thread" },
      1: { x: "learn quickly", y: "choose a depth path" },
      2: { x: "go deep", y: "build a depth path and stay on it" },
    },
    5: {
      0: { x: "coordinate updates", y: "reduce stakeholder noise" },
      1: { x: "coordinate stakeholders", y: "map dependencies" },
      2: { x: "coordinate stakeholders", y: "map dependencies and set handoffs" },
    },
  }

  const interventionByDim: Record<number, Record<0 | 1 | 2, InterventionPair>> = {
    0: {
      0: { a: "push through", b: "set a cadence and constraints" },
      1: { a: "do more", b: "tighten the operating structure" },
      2: { a: "do more", b: "tighten the operating structure" },
    },
    1: {
      0: { a: "take over", b: "route the decision to the owner" },
      1: { a: "wait", b: "claim the decision boundary" },
      2: { a: "wait", b: "claim the decision boundary" },
    },
    2: {
      0: { a: "optimize output", b: "fix the measurement" },
      1: { a: "argue for targets", b: "fix the incentives" },
      2: { a: "argue for targets", b: "fix the incentives" },
    },
    3: {
      0: { a: "adapt silently", b: "reject scope drift" },
      1: { a: "accept ambiguity", b: "re-anchor the scope" },
      2: { a: "accept ambiguity", b: "re-anchor the scope" },
    },
    4: {
      0: { a: "add more options", b: "choose one depth path" },
      1: { a: "keep exploring", b: "pick a track and commit" },
      2: { a: "keep exploring", b: "pick a track and commit" },
    },
    5: {
      0: { a: "reply to everyone", b: "set a single handoff path" },
      1: { a: "keep everyone aligned", b: "map dependencies and set handoffs" },
      2: { a: "keep everyone aligned", b: "map dependencies and set handoffs" },
    },
  }

  const constructionByDim: Record<number, string[]> = {
    0: ["notice drift", "diagnose constraints", "build cadence"],
    1: ["map ownership", "diagnose decision paths", "build boundaries"],
    2: ["track signal", "diagnose incentives", "build measures"],
    3: ["notice ambiguity", "diagnose scope", "build constraints"],
    4: ["notice sprawl", "diagnose the core thread", "build depth"],
    5: ["notice dependency loops", "diagnose handoffs", "build routing"],
  }

  // Choose a “primary” dimension deterministically: first non-neutral; else dim 0.
  let primaryDim = 0
  for (let i = 0; i < 6; i += 1) {
    if (v[i] !== 1) {
      primaryDim = i
      break
    }
  }

  const id = identityByDim[primaryDim][v[primaryDim]]
  const iv = interventionByDim[primaryDim][v[primaryDim]]
  const verbs = constructionByDim[primaryDim] ?? ["notice", "diagnose", "build"]

  // 4-layer locked block (exact order)
  const identityContrast = `You don’t just ${id.x} — you ${id.y}.`
  const interventionContrast = `When something isn’t working, you don’t ${iv.a} — you ${iv.b}.`
  const constructionLayer = `You ${verbs[0]}, ${verbs[1]}, and ${verbs[2]}.`

  let consequenceDrop: string | null = null
  if (coherenceStrong(v)) {
    const consequenceByDim: Record<number, string> = {
      0: "You change the system’s cadence.",
      1: "You change the decision boundary.",
      2: "You change the measurement rules.",
      3: "You change the scope boundary.",
      4: "You change the depth path.",
      5: "You change the handoff path.",
    }
    consequenceDrop = consequenceByDim[primaryDim] ?? "You change how the system operates."
  }

  const blockLines: string[] = [identityContrast, interventionContrast, constructionLayer]
  if (consequenceDrop) blockLines.push(consequenceDrop)

  const patternSummary = blockLines.join("\n\n")

  // Keep “Operate Best” + “Lose Energy” below, structural, no “strongest signal”, no praise.
  const operateBest: string[] = []
  const loseEnergy: string[] = []

  // Build deterministic sections from up to 3 dimensions each.
  const highDims: number[] = []
  const lowDims: number[] = []
  for (let i = 0; i < 6; i += 1) {
    if (v[i] === 2) highDims.push(i)
    if (v[i] === 0) lowDims.push(i)
  }

  const operateBestByDim: Record<number, string> = {
    0: "Work with stable cadence and explicit constraints.",
    1: "Work with explicit ownership and decision boundaries.",
    2: "Work where measures and incentives are consistent.",
    3: "Work where scope is explicit and drift is rejected.",
    4: "Work where depth is rewarded over constant context switching.",
    5: "Work where dependencies are mapped and handoffs are explicit.",
  }

  const loseEnergyByDim: Record<number, string> = {
    0: "Work where cadence is missing and constraints reset each cycle.",
    1: "Work where ownership is unclear and decisions have no owner.",
    2: "Work where measures change mid-cycle or incentives conflict.",
    3: "Work where scope is unbounded and priorities shift without constraints.",
    4: "Work where the thread changes before it can be reduced to a stable path.",
    5: "Work where handoffs are undefined and stakeholder routing is unclear.",
  }

  const operateFallback = [
    "Work with explicit scope, ownership, and a stable cadence.",
    "Work where dependencies can be made explicit and handoffs are defined.",
    "Work where measures are stable across cycles.",
  ]

  const loseFallback = [
    "Work where ownership is unclear and scope drift is accepted.",
    "Work where priorities reset each cycle without constraints.",
    "Work where dependencies are implicit and routing is inconsistent.",
  ]

  const opDims = highDims.length > 0 ? highDims : [primaryDim]
  for (const d of opDims.slice(0, 3)) operateBest.push(operateBestByDim[d] ?? operateFallback[0])

  const leDims = lowDims.length > 0 ? lowDims : [primaryDim]
  for (const d of leDims.slice(0, 3)) loseEnergy.push(loseEnergyByDim[d] ?? loseFallback[0])

  // Ensure length exactly 3 for each section.
  while (operateBest.length < 3) operateBest.push(pickFirst(operateFallback.filter((x) => !operateBest.includes(x)), operateFallback[0]))
  while (loseEnergy.length < 3) loseEnergy.push(pickFirst(loseFallback.filter((x) => !loseEnergy.includes(x)), loseFallback[0]))
  operateBest.splice(3)
  loseEnergy.splice(3)

  return {
    ...session,
    synthesis: {
      patternSummary,
      operateBest,
      loseEnergy,
      identitySummary: session.synthesis?.identitySummary ?? null,
      marketTitle: session.synthesis?.marketTitle ?? null,
      titleExplanation: session.synthesis?.titleExplanation ?? null,
      lastTitleFeedback: session.synthesis?.lastTitleFeedback ?? null,
    },
  }
}

function newSessionId(): string {
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

// Strict allowlist: current_state -> allowed event types.
// (CREATE_SESSION is handled before session lookup.)
const ALLOWLIST: Record<CalibrationState, ReadonlyArray<CalibrationEvent["type"]>> = {
  RESUME_INGEST: ["SUBMIT_RESUME", "ADVANCE"],
  PROMPT_1: ["SUBMIT_PROMPT_ANSWER"],
  PROMPT_1_CLARIFIER: ["SUBMIT_PROMPT_CLARIFIER_ANSWER"],
  PROMPT_2: ["SUBMIT_PROMPT_ANSWER"],
  PROMPT_2_CLARIFIER: ["SUBMIT_PROMPT_CLARIFIER_ANSWER"],
  PROMPT_3: ["SUBMIT_PROMPT_ANSWER"],
  PROMPT_3_CLARIFIER: ["SUBMIT_PROMPT_CLARIFIER_ANSWER"],
  PROMPT_4: ["SUBMIT_PROMPT_ANSWER"],
  PROMPT_4_CLARIFIER: ["SUBMIT_PROMPT_CLARIFIER_ANSWER"],
  PROMPT_5: ["SUBMIT_PROMPT_ANSWER"],
  PROMPT_5_CLARIFIER: ["SUBMIT_PROMPT_CLARIFIER_ANSWER"],
  CONSOLIDATION_PENDING: ["ADVANCE"],
  CONSOLIDATION_RITUAL: ["ADVANCE"],
  ENCODING_RITUAL: ["ADVANCE"],
  PATTERN_SYNTHESIS: ["ADVANCE"],
  TITLE_HYPOTHESIS: ["ADVANCE", "TITLE_FEEDBACK"],
  TITLE_DIALOGUE: ["ADVANCE", "TITLE_FEEDBACK", "SUBMIT_JOB_TEXT"],
  JOB_INGEST: ["ADVANCE", "SUBMIT_JOB_TEXT", "COMPUTE_ALIGNMENT_OUTPUT"],
  ALIGNMENT_OUTPUT: ["ADVANCE", "COMPUTE_ALIGNMENT_OUTPUT", "SUBMIT_JOB_TEXT"],
  TERMINAL_COMPLETE: ["SUBMIT_JOB_TEXT", "COMPUTE_ALIGNMENT_OUTPUT"],
}

function ensureAllowed(session: CalibrationSession, eventType: CalibrationEvent["type"]): Err | null {
  const allowed = ALLOWLIST[session.state] ?? []
  if (!allowed.includes(eventType)) {
    return bad("INVALID_EVENT_FOR_STATE", `Event ${eventType} not allowed in state ${session.state}`)
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

    const sessionId = (event as any).sessionId
    if (typeof sessionId !== "string" || sessionId.trim().length === 0) {
      return bad("MISSING_REQUIRED_FIELD", "Missing sessionId")
    }

    const got = mustGet(sessionId)
    if ((got as any).ok === false) return got as Err
    let session = got as CalibrationSession

    const allowErr = ensureAllowed(session, event.type)
    if (allowErr) return allowErr

    const from = session.state

    switch (event.type) {
      case "SUBMIT_RESUME": {
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

        // Deterministic: remain in RESUME_INGEST; UI (or user) triggers ADVANCE explicitly.
        storeSet(session)
        return { ok: true, session }
      }

      case "ADVANCE": {
        if (session.state === "RESUME_INGEST") {
          if (!session.resume.completed) return bad("MISSING_REQUIRED_FIELD", "Resume must be submitted before advancing")
          const to: CalibrationState = "PROMPT_1"
          session = pushHistory({ ...session, state: to }, from, to, event.type)
          storeSet(session)
          return { ok: true, session }
        }

        if (session.state === "CONSOLIDATION_PENDING") {
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

          // Ritual completes -> move to ENCODING_RITUAL (externally visible).
          // NO synthesis is emitted here (kernel: no synthesis before encoding).
          const to: CalibrationState = "ENCODING_RITUAL"
          let next = {
            ...session,
            state: to,
            consolidationRitual: nextRitual,
            encodingRitual: { completed: false },
          }
          next = pushHistory(next, from, to, event.type)
          storeSet(next)
          return { ok: true, session: next }
        }

        if (session.state === "ENCODING_RITUAL") {
          // Single visible step: ENCODING_RITUAL -> PATTERN_SYNTHESIS.
          // Do encoding + synthesis exactly once, then transition ONE state.
          let next = encodePersonVectorOnce(session)
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

        let roleVector: any = null
        try {
          const ingest = ingestJob(jobText.trim())
          roleVector = ingest.roleVector as any
        } catch (e: any) {
          return bad("BAD_REQUEST", String(e?.detail ?? e?.message ?? "Invalid job text"))
        }

        const to: CalibrationState = "JOB_INGEST"
        session = {
          ...session,
          job: { rawText: jobText.trim(), roleVector, completed: true },
          result: null,
        }
        session = pushHistory({ ...session, state: to }, from, to, event.type)
        storeSet(session)
        return { ok: true, session }
      }

      case "COMPUTE_ALIGNMENT_OUTPUT": {
        if (session.state !== "ALIGNMENT_OUTPUT") {
          return bad("INVALID_EVENT_FOR_STATE", `Event ${event.type} not allowed in state ${session.state}`)
        }
        if (!session.job.completed || !session.job.rawText) return bad("JOB_REQUIRED", "Submit a job description first")
        if (!session.personVector.values) return bad("JOB_ENCODING_INCOMPLETE", "Missing person vector")

        const seam = runIntegrationSeam({
          jobText: session.job.rawText,
          experienceVector: session.personVector.values as any,
        })

        if (!seam.ok) {
          return bad("BAD_REQUEST", seam.error.message)
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
        // Kept for compatibility; encoding is now guarded + run as part of ENCODING_RITUAL ADVANCE.
        return bad("INVALID_EVENT_FOR_STATE", "ENCODING_COMPLETE is not a public event in v1 flow")
      }

      default:
        return bad("BAD_REQUEST", `Unknown event type: ${(event as any).type}`)
    }
  } catch (e: any) {
    return bad("INTERNAL", String(e?.message ?? "Unexpected error"))
  }
}