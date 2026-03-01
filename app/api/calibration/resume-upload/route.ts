// app/api/calibration/resume-upload/route.ts

import { dispatchCalibrationEvent } from "@/lib/calibration_machine"
import type { CalibrationEvent } from "@/lib/calibration_types"
import { extractResumeText } from "@/lib/resume_extract"

function apiBad(code: string, message: string) {
  return { ok: false as const, error: { code, message } }
}

function getExt(name: string): string {
  const n = (name || "").trim().toLowerCase()
  const idx = n.lastIndexOf(".")
  if (idx < 0) return ""
  return n.slice(idx + 1)
}

function isAllowedFile(file: File): { ok: true } | { ok: false; code: string; message: string } {
  const ext = getExt(file?.name || "")
  const mime = (file as any)?.type ? String((file as any).type).toLowerCase() : ""

  const allowedExt = ext === "pdf" || ext === "docx" || ext === "txt"
  const allowedMime =
    mime === "application/pdf" ||
    mime === "text/plain" ||
    mime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    mime === ""

  if (!allowedExt) {
    return { ok: false, code: "UNSUPPORTED_FILE_TYPE", message: `Unsupported file type: .${ext || "(none)"}` }
  }
  if (!allowedMime) {
    return { ok: false, code: "UNSUPPORTED_FILE_TYPE", message: `Unsupported MIME type: ${mime}` }
  }

  return { ok: true }
}

export async function GET() {
  return Response.json(apiBad("METHOD_NOT_ALLOWED", "Method not allowed"), { status: 405 })
}

export async function POST(req: Request) {
  try {
    const form = await req.formData()
    const sessionId = String(form.get("sessionId") ?? "").trim()
    const file = form.get("file")

    if (!sessionId) {
      return Response.json(apiBad("BAD_REQUEST", "Missing sessionId"), { status: 400 })
    }

    if (!file || !(file instanceof File)) {
      return Response.json(apiBad("BAD_REQUEST", "Missing file"), { status: 400 })
    }

    const allowed = isAllowedFile(file)
    if (!allowed.ok) {
      return Response.json(apiBad(allowed.code, allowed.message), { status: 415 })
    }

    let resumeText = ""
    try {
      resumeText = await extractResumeText(file)
    } catch (e: any) {
      const msg = String(e?.message ?? "Failed to parse resume")
      const lower = msg.toLowerCase();
      if (lower.includes("unsupported")) {
        return Response.json(apiBad("UNSUPPORTED_FILE_TYPE", msg), { status: 415 })
      }
      if (lower.includes("bad xref") || lower.includes("xref")) {
        return Response.json(
          apiBad(
            "RESUME_PARSE_FAILED",
            "We couldn’t read text from this PDF (PDF parse error). Try: (1) re-export/Print to PDF, or (2) upload DOCX/TXT instead."
          ),
          { status: 400 }
        );
      }
      if (msg.includes("RESUME_PARSE_FAILED")) {
        return Response.json(apiBad("RESUME_PARSE_FAILED", msg.replace("RESUME_PARSE_FAILED: ", "")), { status: 400 })
      }
      return Response.json(apiBad("PARSE_ERROR", msg), { status: 400 })
    }

    try {
      const submit = await dispatchCalibrationEvent({
        type: "SUBMIT_RESUME",
        sessionId,
        resumeText,
      } as CalibrationEvent)

      if (!submit.ok) {
        return Response.json(apiBad(submit.error.code, submit.error.message), { status: 400 })
      }

      // Deterministically advance away from RESUME_INGEST after successful submission.
      const adv = await dispatchCalibrationEvent({
        type: "ADVANCE",
        sessionId,
      } as CalibrationEvent)

      if (!adv.ok) {
        return Response.json(apiBad(adv.error.code, adv.error.message), { status: 400 })
      }

      return Response.json({ ok: true, session: adv.session }, { status: 200 })
    } catch (e: any) {
      return Response.json(apiBad("DISPATCH_ERROR", String(e?.message ?? "Calibration dispatch failed")), { status: 500 })
    }
  } catch (e: any) {
    return Response.json(apiBad("BAD_REQUEST", String(e?.message ?? "Invalid multipart form data")), { status: 400 })
  }
}