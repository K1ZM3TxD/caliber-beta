// Calibrate API Route - Full Pipeline Orchestration

import { NextRequest, NextResponse } from 'next/server';
import { extractPersonVector } from '@/lib/openai/personExtract';
import { extractRoleVector } from '@/lib/openai/roleExtract';
import { classifyRequirements } from '@/lib/openai/requirementsClassify';
import { computeAlignment } from '@/lib/alignment';
import { computeSkillMatch } from '@/lib/skillMatch';
import { computeStretchLoad } from '@/lib/stretch';
import { generatePatternSynthesis } from '@/lib/patternSynthesis';
import { CalibrateInput, CalibrationResult } from '@/lib/types';

export async function POST(request: NextRequest) {
  try {
    const input: CalibrateInput = await request.json();

    // Validate input
    if (!input.resume || !input.jobDescription || !input.promptAnswers) {
      return NextResponse.json(
        { error: 'Missing required fields: resume, jobDescription, promptAnswers' },
        { status: 400 }
      );
    }

    if (!Array.isArray(input.promptAnswers) || input.promptAnswers.length !== 5) {
      return NextResponse.json(
        { error: 'promptAnswers must be an array of exactly 5 strings' },
        { status: 400 }
      );
    }

    // Step 1: Extract person vector
    const personExtraction = await extractPersonVector(
      input.resume,
      input.promptAnswers
    );

    // Step 2: Extract role vector
    const roleExtraction = await extractRoleVector(input.jobDescription);

    // Step 3: Classify requirements
    const requirementClassification = await classifyRequirements(
      roleExtraction.requirements,
      input.resume
    );

    // Step 4: Compute alignment score
    const alignment = computeAlignment(
      personExtraction.person_vector,
      roleExtraction.role_vector
    );

    // Step 5: Compute skill match score
    const skillMatch = computeSkillMatch(
      requirementClassification.classified_requirements
    );

    // Step 6: Compute stretch load
    const stretchLoad = computeStretchLoad(skillMatch);

    // Step 7: Generate pattern synthesis
    const patternSynthesis = generatePatternSynthesis(
      personExtraction.person_vector,
      alignment
    );

    // Construct final result
    const result: CalibrationResult = {
      alignment,
      skillMatch,
      stretchLoad,
      patternSynthesis,
      personVector: personExtraction.person_vector,
      roleVector: roleExtraction.role_vector,
      evidence: personExtraction.evidence,
      classifiedRequirements: requirementClassification.classified_requirements,
    };

    return NextResponse.json(result);
  } catch (error) {
    console.error('Calibration error:', error);
    return NextResponse.json(
      {
        error: 'Failed to process calibration',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
