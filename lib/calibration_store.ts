// lib/calibration_store.ts

import type { CalibrationSession } from "@/lib/calibration_types"
import * as fs from "fs"
import * as path from "path"

type Store = Map<string, CalibrationSession>

// Use /tmp/ on serverless (Vercel) where cwd is read-only; fall back to cwd for local dev
const PERSIST_DIR = (() => {
  const cwdDir = path.join(process.cwd(), ".caliber-sessions")
  try { fs.mkdirSync(cwdDir, { recursive: true }); return cwdDir } catch { /* cwd not writable */ }
  const tmpDir = path.join("/tmp", ".caliber-sessions")
  try { fs.mkdirSync(tmpDir, { recursive: true }); return tmpDir } catch { /* neither writable */ }
  return cwdDir // fallback; writeToDisk will silently fail
})()

function ensurePersistDir(): void {
  try { fs.mkdirSync(PERSIST_DIR, { recursive: true }) } catch { /* exists */ }
}

function sessionFilePath(sessionId: string): string {
  // Sanitize sessionId to prevent path traversal
  const safe = sessionId.replace(/[^a-zA-Z0-9_-]/g, "_")
  return path.join(PERSIST_DIR, `${safe}.json`)
}

function writeToDisk(session: CalibrationSession): void {
  try {
    ensurePersistDir()
    fs.writeFileSync(sessionFilePath(session.sessionId), JSON.stringify(session), "utf-8")
  } catch { /* best-effort persistence */ }
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
      } catch { /* skip corrupt files */ }
    }
    return sessions
  } catch { return [] }
}

function getStore(): Store {
  const g: any = globalThis as any
  if (!g.__CALIBER_CALIBRATION_STORE__) {
    g.__CALIBER_CALIBRATION_STORE__ = new Map<string, CalibrationSession>()
    // Rehydrate from disk on first access
    for (const s of readAllFromDisk()) {
      g.__CALIBER_CALIBRATION_STORE__.set(s.sessionId, s)
    }
  }
  return g.__CALIBER_CALIBRATION_STORE__ as Store
}

export function storeGet(sessionId: string): CalibrationSession | null {
  const mem = getStore().get(sessionId)
  if (mem) return mem
  // Fallback: try disk (may have been written by another worker)
  const disk = readFromDisk(sessionId)
  if (disk) { getStore().set(sessionId, disk) }
  return disk
}

export function storeSet(session: CalibrationSession): void {
  getStore().set(session.sessionId, session)
  writeToDisk(session)
}

/**
 * Import a full session blob (e.g. restored from client-side localStorage).
 * Validates minimal shape before storing. Returns true if accepted.
 */
export function storeImport(blob: unknown): boolean {
  if (!blob || typeof blob !== "object") return false
  const s = blob as any
  if (typeof s.sessionId !== "string" || !s.sessionId.startsWith("sess_")) return false
  if (typeof s.state !== "string") return false
  if (!s.personVector || typeof s.personVector !== "object") return false
  // Accept it — store like any other session
  const session = s as CalibrationSession
  getStore().set(session.sessionId, session)
  writeToDisk(session)
  return true
}

/** Return the most recently created session (by sessionId timestamp hex suffix). */
export function storeLatest(): CalibrationSession | null {
  const store = getStore()
  // Also check disk for sessions that may not be in memory
  for (const s of readAllFromDisk()) {
    if (!store.has(s.sessionId)) store.set(s.sessionId, s)
  }
  let best: CalibrationSession | null = null
  let bestTs = 0
  for (const s of store.values()) {
    // sessionId format: sess_<hex>_<hex-timestamp>
    const parts = s.sessionId.split("_")
    const ts = parseInt(parts[parts.length - 1] ?? "0", 16) || 0
    if (ts > bestTs) { bestTs = ts; best = s }
  }
  return best
}