// lib/calibration_store.ts

import type { CalibrationSession } from "@/lib/calibration_types"

type Store = Map<string, CalibrationSession>

function getStore(): Store {
  const g: any = globalThis as any
  if (!g.__CALIBER_CALIBRATION_STORE__) {
    g.__CALIBER_CALIBRATION_STORE__ = new Map<string, CalibrationSession>()
  }
  return g.__CALIBER_CALIBRATION_STORE__ as Store
}

export function storeGet(sessionId: string): CalibrationSession | null {
  return getStore().get(sessionId) ?? null
}

export function storeSet(session: CalibrationSession): void {
  getStore().set(session.sessionId, session)
}

/** Return the most recently created session (by sessionId timestamp hex suffix). */
export function storeLatest(): CalibrationSession | null {
  const store = getStore()
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