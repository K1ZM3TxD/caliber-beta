// Person Vector Extraction

import { openai } from './client';
import { PersonExtractionResponse } from '../types';

/**
 * Extracts person vector (6 dimensions, each 0|1|2) from resume and prompt answers.
 * Uses structured output with JSON schema validation.
 */
export async function extractPersonVector(
  resume: string,
  promptAnswers: string[]
): Promise<PersonExtractionResponse> {
  const prompt = `You are an expert at analyzing professional background and extracting structural patterns.

Analyze the following resume and prompt answers to extract a person vector across 6 dimensions.

RESUME:
${resume}

PROMPT ANSWERS:
${promptAnswers.map((answer, i) => `${i + 1}. ${answer}`).join('\n')}

Extract a vector across these 6 dimensions, where each dimension is scored 0, 1, or 2:

1. **structural_maturity**: 0=emerging/fluid, 1=moderate structure, 2=established/mature
2. **authority_scope**: 0=individual contributor, 1=collaborative decision-making, 2=high autonomy/authority
3. **revenue_orientation**: 0=indirect/unclear impact, 1=some visibility, 2=direct revenue impact
4. **role_ambiguity**: 0=clearly defined roles, 1=moderate flexibility, 2=high ambiguity/boundary-spanning
5. **breadth_vs_depth**: 0=deep specialist, 1=balanced, 2=broad generalist/integrator
6. **stakeholder_density**: 0=few stakeholders, 1=moderate, 2=high multi-stakeholder complexity

For each dimension, provide:
- A score (0, 1, or 2)
- Evidence snippets from the resume/answers that support this score

Return your analysis as a JSON object matching this schema:
{
  "person_vector": {
    "structural_maturity": 0|1|2,
    "authority_scope": 0|1|2,
    "revenue_orientation": 0|1|2,
    "role_ambiguity": 0|1|2,
    "breadth_vs_depth": 0|1|2,
    "stakeholder_density": 0|1|2
  },
  "evidence": {
    "structural_maturity": ["snippet1", "snippet2"],
    "authority_scope": ["snippet1", "snippet2"],
    "revenue_orientation": ["snippet1", "snippet2"],
    "role_ambiguity": ["snippet1", "snippet2"],
    "breadth_vs_depth": ["snippet1", "snippet2"],
    "stakeholder_density": ["snippet1", "snippet2"]
  }
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
        name: 'person_extraction',
        strict: true,
        schema: {
          type: 'object',
          properties: {
            person_vector: {
              type: 'object',
              properties: {
                structural_maturity: { type: 'number', enum: [0, 1, 2] },
                authority_scope: { type: 'number', enum: [0, 1, 2] },
                revenue_orientation: { type: 'number', enum: [0, 1, 2] },
                role_ambiguity: { type: 'number', enum: [0, 1, 2] },
                breadth_vs_depth: { type: 'number', enum: [0, 1, 2] },
                stakeholder_density: { type: 'number', enum: [0, 1, 2] },
              },
              required: [
                'structural_maturity',
                'authority_scope',
                'revenue_orientation',
                'role_ambiguity',
                'breadth_vs_depth',
                'stakeholder_density',
              ],
              additionalProperties: false,
            },
            evidence: {
              type: 'object',
              properties: {
                structural_maturity: { type: 'array', items: { type: 'string' } },
                authority_scope: { type: 'array', items: { type: 'string' } },
                revenue_orientation: { type: 'array', items: { type: 'string' } },
                role_ambiguity: { type: 'array', items: { type: 'string' } },
                breadth_vs_depth: { type: 'array', items: { type: 'string' } },
                stakeholder_density: { type: 'array', items: { type: 'string' } },
              },
              required: [
                'structural_maturity',
                'authority_scope',
                'revenue_orientation',
                'role_ambiguity',
                'breadth_vs_depth',
                'stakeholder_density',
              ],
              additionalProperties: false,
            },
          },
          required: ['person_vector', 'evidence'],
          additionalProperties: false,
        },
      },
    },
  });

  const content = response.choices[0].message.content;
  if (!content) {
    throw new Error('No content in OpenAI response');
  }

  return JSON.parse(content) as PersonExtractionResponse;
}
