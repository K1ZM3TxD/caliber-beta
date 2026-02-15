// Requirement Classification

import { openai } from './client';
import { RequirementClassificationResponse } from '../types';

/**
 * Classifies requirements against resume.
 * For each requirement:
 *   - category: "grounded" | "adjacent" | "new"
 *   - scope_matched_outcome: boolean
 *   - final_effective_category: grounded ONLY if category=="grounded" AND scope_matched_outcome==true
 * 
 * Uses structured output with JSON schema validation.
 */
export async function classifyRequirements(
  requirements: string[],
  resume: string
): Promise<RequirementClassificationResponse> {
  const prompt = `You are an expert at analyzing candidate qualifications against job requirements.

Analyze each requirement from the job description against the candidate's resume and classify it.

RESUME:
${resume}

REQUIREMENTS TO CLASSIFY:
${requirements.map((req, i) => `${i + 1}. ${req}`).join('\n')}

For each requirement, determine:

1. **category**: 
   - "grounded": The candidate has demonstrated this exact capability in prior roles
   - "adjacent": The candidate has related experience that could transfer
   - "new": The candidate has no relevant background for this requirement

2. **scope_matched_outcome**: (boolean)
   - true: The candidate has operated at the same or higher scope/complexity level
   - false: The candidate's experience is at a lower scope level

Note: A requirement is only truly "grounded" if BOTH category=="grounded" AND scope_matched_outcome==true.
If category=="grounded" but scope_matched_outcome==false, it should be treated as "adjacent" in scoring.

Return your analysis as a JSON object matching this schema:
{
  "classified_requirements": [
    {
      "requirement": "string",
      "category": "grounded"|"adjacent"|"new",
      "scope_matched_outcome": boolean
    }
  ]
}`;

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-2024-08-06',
    messages: [
      {
        role: 'user',
        content: prompt,
      },
    ],
    response_format: {
      type: 'json_schema',
      json_schema: {
        name: 'requirement_classification',
        strict: true,
        schema: {
          type: 'object',
          properties: {
            classified_requirements: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  requirement: { type: 'string' },
                  category: {
                    type: 'string',
                    enum: ['grounded', 'adjacent', 'new'],
                  },
                  scope_matched_outcome: { type: 'boolean' },
                },
                required: ['requirement', 'category', 'scope_matched_outcome'],
                additionalProperties: false,
              },
            },
          },
          required: ['classified_requirements'],
          additionalProperties: false,
        },
      },
    },
  });

  const content = response.choices[0].message.content;
  if (!content) {
    throw new Error('No content in OpenAI response');
  }

  return JSON.parse(content) as RequirementClassificationResponse;
}
