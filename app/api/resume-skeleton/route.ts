// app/api/resume-skeleton/route.ts — Generate base resume skeleton from 3 prompts
import { NextRequest, NextResponse } from "next/server";
import { generateResumeSkeleton } from "@/lib/resume_skeleton";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { experience, strengths, targetRole } = body as {
      experience?: string;
      strengths?: string;
      targetRole?: string;
    };

    if (!experience?.trim() || !strengths?.trim() || !targetRole?.trim()) {
      return NextResponse.json(
        { ok: false, error: "All three prompts are required." },
        { status: 400 }
      );
    }

    const result = await generateResumeSkeleton({
      experience: experience.trim(),
      strengths: strengths.trim(),
      targetRole: targetRole.trim(),
    });

    return NextResponse.json({ ok: true, resume: result.raw });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Generation failed";
    console.error("[resume-skeleton] error:", message);
    return NextResponse.json(
      { ok: false, error: message },
      { status: 500 }
    );
  }
}
