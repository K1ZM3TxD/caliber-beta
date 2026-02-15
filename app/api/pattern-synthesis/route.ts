/**
 * Pattern Synthesis API Route - Milestone 2.3
 * Minimal API endpoint that returns mocked Pattern Synthesis output
 * NO OpenAI, NO alignment scoring, NO skill match
 */

import { NextRequest, NextResponse } from "next/server";
import { generatePatternSynthesis } from "@/lib/pattern_synthesis";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { resumeText = "", promptAnswers = [] } = body;

    // Generate mocked pattern synthesis
    const result = generatePatternSynthesis(resumeText, promptAnswers);

    return NextResponse.json(result);
  } catch {
    return NextResponse.json(
      { error: "Failed to generate pattern synthesis" },
      { status: 500 }
    );
  }
}
