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