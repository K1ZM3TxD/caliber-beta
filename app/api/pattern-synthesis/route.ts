import { NextRequest, NextResponse } from "next/server";
import { generatePatternSynthesis } from "@/lib/pattern_synthesis";

type PatternSynthesisValidationError = {
  name: "PatternSynthesisValidationError";
  code: string;
  detail: string;
  meta?: Record<string, any>;
};

function isPatternSynthesisValidationError(
  err: unknown
): err is PatternSynthesisValidationError {
  return (
    typeof err === "object" &&
    err !== null &&
    (err as any).name === "PatternSynthesisValidationError" &&
    typeof (err as any).code === "string" &&
    typeof (err as any).detail === "string"
  );
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { resumeText = "", promptAnswers = [] } = body ?? {};

    const result = generatePatternSynthesis(resumeText, promptAnswers);

    return NextResponse.json(result);
  } catch (error: unknown) {
    // Minimal server-side observability
    console.error("Pattern synthesis generation failed:", error);

    if (isPatternSynthesisValidationError(error)) {
      return NextResponse.json(
        {
          error: {
            name: error.name,
            code: error.code,
            detail: error.detail,
          },
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: { name: "Error", code: "INTERNAL_ERROR", detail: "Failed to generate pattern synthesis" } },
      { status: 500 }
    );
  }
}