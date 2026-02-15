// Role Vector Extraction

import { openai } from './client';
import { RoleExtractionResponse } from '../types';

/**
 * Extracts role vector (6 dimensions, each 0|1|2) and requirements list from job description.
 * Uses structured output with JSON schema validation.
 */
export async function extractRoleVector(
  jobDescription: string
): Promise<RoleExtractionResponse> {
  const prompt = `You are an expert at analyzing job descriptions and extracting structural requirements.

Analyze the following job description to extract a role vector across 6 dimensions and a list of specific requirements.

JOB DESCRIPTION:
${jobDescription}

Extract a vector across these 6 dimensions, where each dimension is scored 0, 1, or 2:

1. **structural_maturity**: 0=emerging/fluid, 1=moderate structure, 2=established/mature
2. **authority_scope**: 0=individual contributor, 1=collaborative decision-making, 2=high autonomy/authority
3. **revenue_orientation**: 0=indirect/unclear impact, 1=some visibility, 2=direct revenue impact
4. **role_ambiguity**: 0=clearly defined roles, 1=moderate flexibility, 2=high ambiguity/boundary-spanning
5. **breadth_vs_depth**: 0=deep specialist, 1=balanced, 2=broad generalist/integrator
6. **stakeholder_density**: 0=few stakeholders, 1=moderate, 2=high multi-stakeholder complexity

Also extract a list of specific requirements from the job description (skills, experiences, responsibilities).

Return your analysis as a JSON object matching this schema:
{
  "role_vector": {
    "structural_maturity": 0|1|2,
    "authority_scope": 0|1|2,
    "revenue_orientation": 0|1|2,
    "role_ambiguity": 0|1|2,
    "breadth_vs_depth": 0|1|2,
    "stakeholder_density": 0|1|2
  },
  "requirements": ["requirement1", "requirement2", ...]
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
        name: 'role_extraction',
        strict: true,
        schema: {
          type: 'object',
          properties: {
            role_vector: {
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
            requirements: {
              type: 'array',
              items: { type: 'string' },
            },
          },
          required: ['role_vector', 'requirements'],
          additionalProperties: false,
        },
      },
    },
  });

  const content = response.choices[0].message.content;
  if (!content) {
    throw new Error('No content in OpenAI response');
  }

  return JSON.parse(content) as RoleExtractionResponse;
}
