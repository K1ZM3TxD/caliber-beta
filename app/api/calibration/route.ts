// app/api/calibration/route.ts

import { NextResponse } from "next/server";
import { dispatchCalibrationEvent } from "@/lib/calibration_dispatch";

type NormalizedError = {
  code: string;
  message: string;
};

function normalizeError(err: unknown): NormalizedError {
  if (err && typeof err === "object") {
    const anyErr = err as any;
    const code = typeof anyErr.code === "string" ? anyErr.code : "UNKNOWN";
    const message =
      typeof anyErr.message === "string" ? anyErr.message : "Unknown error";
    return { code, message };
  }
  if (typeof err === "string") return { code: "UNKNOWN", message: err };
  return { code: "UNKNOWN", message: "Unknown error" };
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const event = body?.event;

    const res = await dispatchCalibrationEvent(event);

    if (!res || res.ok !== true) {
      const error = res?.error
        ? res.error
        : { code: "UNKNOWN", message: "Unknown error" };
      return NextResponse.json({ ok: false, error }, { status: 400 });
    }

    // FIX: dispatchCalibrationEvent returns { ok:true, session }, not { value }
    return NextResponse.json({ ok: true, session: res.session }, { status: 200 });
  } catch (err) {
    const error = normalizeError(err);
    return NextResponse.json({ ok: false, error }, { status: 500 });
  }
}