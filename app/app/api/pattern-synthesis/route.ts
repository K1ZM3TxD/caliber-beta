import { NextRequest, NextResponse } from "next/server";
import { generatePatternSynthesis } from "@/lib/pattern_synthesis";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { resumeText = "", promptAnswers = [] } = body;

    const result = generatePatternSynthesis(resumeText, promptAnswers);

    return NextResponse.json(result);
  } catch (_error) {
    return NextResponse.json(
      { error: "Failed to generate pattern synthesis" },
      { status: 500 }
    );
  }
}
