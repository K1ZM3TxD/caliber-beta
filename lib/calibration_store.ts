// lib/calibration_store.ts
//
// Three-tier session storage: in-memory Map → filesystem → Postgres (durable).
// Reads check memory first, then disk, then DB.  Writes go to all three.
// DB writes are fire-and-forget so they never block the hot path.

import type { CalibrationSession } from "@/lib/calibration_types"
import * as fs from "fs"
import * as path from "path"

type Store = Map<string, CalibrationSession>

// ── Filesystem tier (fast, ephemeral on Vercel) ────────────────

const PERSIST_DIR = (() => {
  const cwdDir = path.join(process.cwd(), ".caliber-sessions")
  try { fs.mkdirSync(cwdDir, { recursive: true }); return cwdDir } catch { /* cwd not writable */ }
  const tmpDir = path.join("/tmp", ".caliber-sessions")
  try { fs.mkdirSync(tmpDir, { recursive: true }); return tmpDir } catch { /* neither writable */ }
  return cwdDir
})()

function ensurePersistDir(): void {
  try { fs.mkdirSync(PERSIST_DIR, { recursive: true }) } catch { /* exists */ }
}

function sessionFilePath(sessionId: string): string {
  const safe = sessionId.replace(/[^a-zA-Z0-9_-]/g, "_")
  return path.join(PERSIST_DIR, `${safe}.json`)
}

function writeToDisk(session: CalibrationSession): void {
  try {
    ensurePersistDir()
    fs.writeFileSync(sessionFilePath(session.sessionId), JSON.stringify(session), "utf-8")
  } catch { /* best-effort */ }
}

function readFromDisk(sessionId: string): CalibrationSession | null {
  try {
    const data = fs.readFileSync(sessionFilePath(sessionId), "utf-8")
    return JSON.parse(data) as CalibrationSession
  } catch { return null }
}

function readAllFromDisk(): CalibrationSession[] {
  try {
    ensurePersistDir()
    const files = fs.readdirSync(PERSIST_DIR).filter(f => f.endsWith(".json"))
    const sessions: CalibrationSession[] = []
    for (const f of files) {
      try {
        const data = fs.readFileSync(path.join(PERSIST_DIR, f), "utf-8")
        sessions.push(JSON.parse(data) as CalibrationSession)
      } catch { /* skip corrupt */ }
    }
    return sessions
  } catch { return [] }
}

// ── Database tier (durable, survives Lambda recycles) ──────────

function getPrisma() {
  try {
    // Dynamic import avoids hard dep when DATABASE_URL is absent (e.g. local dev without DB)
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { prisma } = require("@/lib/prisma")
    return prisma
  } catch { return null }
}

/** Fire-and-forget DB write. Never throws, never blocks. */
function writeToDb(session: CalibrationSession): void {
  const db = getPrisma()
  if (!db) return
  const locked = Boolean(session.personVector?.values && session.personVector.locked)
  db.calibrationSessionRecord.upsert({
    where: { sessionId: session.sessionId },
    update: { data: JSON.stringify(session), locked, updatedAt: new Date() },
    create: { sessionId: session.sessionId, data: JSON.stringify(session), locked },
  }).catch(() => { /* best-effort — DB may be unreachable locally */ })
}

async function readFromDb(sessionId: string): Promise<CalibrationSession | null> {
  const db = getPrisma()
  if (!db) return null
  try {
    const row = await db.calibrationSessionRecord.findUnique({ where: { sessionId } })
    if (!row) return null
    return JSON.parse(row.data) as CalibrationSession
  } catch { return null }
}

async function readLatestFromDb(): Promise<CalibrationSession | null> {
  const db = getPrisma()
  if (!db) return null
  try {
    const row = await db.calibrationSessionRecord.findFirst({
      where: { locked: true },
      orderBy: { updatedAt: "desc" },
    })
    if (!row) return null
    return JSON.parse(row.data) as CalibrationSession
  } catch { return null }
}

// ── In-memory tier ─────────────────────────────────────────────

function getStore(): Store {
  const g: any = globalThis as any
  if (!g.__CALIBER_CALIBRATION_STORE__) {
    g.__CALIBER_CALIBRATION_STORE__ = new Map<string, CalibrationSession>()
    for (const s of readAllFromDisk()) {
      g.__CALIBER_CALIBRATION_STORE__.set(s.sessionId, s)
    }
  }
  return g.__CALIBER_CALIBRATION_STORE__ as Store
}

// ── Public API ─────────────────────────────────────────────────

export function storeGet(sessionId: string): CalibrationSession | null {
  const mem = getStore().get(sessionId)
  if (mem) return mem
  const disk = readFromDisk(sessionId)
  if (disk) { getStore().set(sessionId, disk); return disk }
  return null
}

/** Async variant that also checks the database when memory + disk miss. */
export async function storeGetAsync(sessionId: string): Promise<CalibrationSession | null> {
  const sync = storeGet(sessionId)
  if (sync) return sync
  const dbSession = await readFromDb(sessionId)
  if (dbSession) {
    getStore().set(dbSession.sessionId, dbSession)
    writeToDisk(dbSession) // warm the local cache for subsequent sync reads
  }
  return dbSession
}

export function storeSet(session: CalibrationSession): void {
  getStore().set(session.sessionId, session)
  writeToDisk(session)
  writeToDb(session)
}

export function storeImport(blob: unknown): boolean {
  if (!blob || typeof blob !== "object") return false
  const s = blob as any
  if (typeof s.sessionId !== "string" || !s.sessionId.startsWith("sess_")) return false
  if (typeof s.state !== "string") return false
  if (!s.personVector || typeof s.personVector !== "object") return false
  const session = s as CalibrationSession
  getStore().set(session.sessionId, session)
  writeToDisk(session)
  writeToDb(session)
  return true
}

/** Return the most recently created session (sync: memory + disk only).
 *  Prefers locked (completed) sessions so extension endpoints get a usable profile. */
export function storeLatest(): CalibrationSession | null {
  const store = getStore()
  for (const s of readAllFromDisk()) {
    if (!store.has(s.sessionId)) store.set(s.sessionId, s)
  }
  let bestLocked: CalibrationSession | null = null
  let bestLockedTs = 0
  let bestAny: CalibrationSession | null = null
  let bestAnyTs = 0
  for (const s of store.values()) {
    const parts = s.sessionId.split("_")
    const ts = parseInt(parts[parts.length - 1] ?? "0", 16) || 0
    if (ts > bestAnyTs) { bestAnyTs = ts; bestAny = s }
    const locked = Boolean(s.personVector?.values && s.personVector.locked)
    if (locked && ts > bestLockedTs) { bestLockedTs = ts; bestLocked = s }
  }
  return bestLocked ?? bestAny
}

/** Async variant: checks DB when memory + disk are empty (cold Lambda). */
export async function storeLatestAsync(): Promise<CalibrationSession | null> {
  const sync = storeLatest()
  if (sync) return sync
  const dbSession = await readLatestFromDb()
  if (dbSession) {
    getStore().set(dbSession.sessionId, dbSession)
    writeToDisk(dbSession)
  }
  return dbSession
}