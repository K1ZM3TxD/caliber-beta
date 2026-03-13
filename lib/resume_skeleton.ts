// lib/resume_skeleton.ts — Generate ATS-friendly base resume skeleton from 3 prompts

import { requireOpenAIKey } from "./env";

export interface ResumeSkeletonInput {
  experience: string;   // Prompt 1: what they've done
  strengths: string;    // Prompt 2: what they do unusually well
  targetRole: string;   // Prompt 3: what role they're targeting
}

export interface ResumeSkeletonOutput {
  raw: string; // Full ATS-friendly resume text
}

const SYSTEM_PROMPT = `You are a professional resume writer creating an ATS-friendly base resume skeleton.

You will receive three inputs from a user:
1. What they've done (roles, projects, responsibilities)
2. What they do unusually well (strengths, what people rely on them for)
3. What role they are targeting next

Your job is to create a clean, structured, ATS-friendly base resume skeleton using ONLY the information provided. This skeleton will later be tailored for specific job applications.

OUTPUT FORMAT — use these exact section headers, in this order:

TARGET HEADLINE
(A clear 1-line professional headline aligned with their target role)

PROFESSIONAL SUMMARY
(3-4 sentences synthesizing their experience and strengths toward the target role. Professional and clear.)

CORE STRENGTHS
(6-10 bullet points drawn from their stated strengths and experience. Use concise professional language.)

EXPERIENCE HIGHLIGHTS
(3-6 bullet points capturing their most notable responsibilities and work. Each bullet should start with a strong action verb. Use the details they provided — do not invent employers, titles, dates, or metrics they did not mention.)

SELECTED IMPACT / ACHIEVEMENTS
(2-4 bullet points about concrete impact or achievements, drawn only from what they stated. If specific metrics or outcomes were not provided, describe the type of impact in general professional terms without fabricating numbers.)

RULES:
- NEVER fabricate experience, job titles, company names, dates, metrics, or credentials.
- If the user's input is vague, generalize professionally without inventing specifics.
- Use plain text formatting only — no markdown, no bold, no italic, no columns.
- Use "- " for bullet points.
- Keep language clear, professional, and active.
- This is a base skeleton for later tailoring — it should be solid and usable, not generic filler.
- Output ONLY the resume text. No commentary, no explanations, no "here is your resume" preamble.`;

export async function generateResumeSkeleton(
  input: ResumeSkeletonInput
): Promise<ResumeSkeletonOutput> {
  const apiKey = (process.env.OPENAI_API_KEY || "").trim();
  if (!apiKey) throw new Error("OPENAI_API_KEY not configured");

  const model = (process.env.OPENAI_MODEL_RESUME_SKELETON || "gpt-4o-mini").trim();

  const userPrompt = `WHAT I'VE DONE:
${input.experience.trim()}

WHAT I DO UNUSUALLY WELL:
${input.strengths.trim()}

TARGET ROLE:
${input.targetRole.trim()}`;

  const resp = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0.35,
      max_tokens: 1500,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
    }),
  });

  if (!resp.ok) {
    const txt = await resp.text().catch(() => "");
    throw new Error(`OpenAI error: ${resp.status} ${txt}`);
  }

  const data = (await resp.json()) as Record<string, unknown>;
  const choices = data?.choices as Array<{ message?: { content?: string } }> | undefined;
  const content = String(choices?.[0]?.message?.content ?? "").trim();

  if (!content) throw new Error("Empty response from model");

  return { raw: content };
}
