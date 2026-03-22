// lib/tailor_store.ts — Prepare + store tailored resume artifacts
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { normalizeJobUrl } from "./pipeline_store";
import { requireOpenAIKey } from "./env";

export interface TailorPrep {
  id: string;
  sessionId: string;
  userId?: string;
  jobTitle: string;
  company: string;
  jobUrl: string;
  jobText: string;
  score: number;
  createdAt: string;
}

export interface TailorResult {
  id: string;
  prepId: string;
  sessionId: string;
  userId?: string;
  tailoredText: string; // the generated resume text
  createdAt: string;
}

const DATA_DIR =
  process.env.VERCEL === "1" || process.env.VERCEL
    ? "/tmp/.caliber-tailor"
    : path.join(process.cwd(), ".caliber-tailor");

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

export function tailorPrepSave(
  data: Omit<TailorPrep, "id" | "createdAt">
): TailorPrep {
  ensureDir();
  const prep: TailorPrep = {
    ...data,
    id: "tp_" + crypto.randomBytes(8).toString("hex"),
    createdAt: new Date().toISOString(),
  };
  fs.writeFileSync(
    path.join(DATA_DIR, `prep_${prep.id}.json`),
    JSON.stringify(prep, null, 2),
    "utf-8"
  );
  return prep;
}

export function tailorPrepGet(id: string): TailorPrep | null {
  ensureDir();
  const file = path.join(DATA_DIR, `prep_${id}.json`);
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, "utf-8"));
  } catch {
    return null;
  }
}

export function tailorResultSave(
  data: Omit<TailorResult, "id" | "createdAt">
): TailorResult {
  ensureDir();
  const result: TailorResult = {
    ...data,
    id: "tr_" + crypto.randomBytes(8).toString("hex"),
    createdAt: new Date().toISOString(),
  };
  fs.writeFileSync(
    path.join(DATA_DIR, `result_${result.id}.json`),
    JSON.stringify(result, null, 2),
    "utf-8"
  );
  return result;
}

export function tailorResultGet(id: string): TailorResult | null {
  ensureDir();
  const file = path.join(DATA_DIR, `result_${id}.json`);
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, "utf-8"));
  } catch {
    return null;
  }
}

/**
 * Generate a tailored resume using the user's existing resume and a job description.
 * Returns the tailored resume text.
 */

/**
 * Generate a tailored resume using the user's existing resume and a job description.
 * Returns the tailored resume text and internal debug trace.
 * @param resumeText The user's resume
 * @param jobTitle The job title
 * @param company The company
 * @param jobDescription The job description
 * @param score (optional) The match score (float, 0-10)
 */
export async function generateTailoredResume(
  resumeText: string,
  jobTitle: string,
  company: string,
  jobDescription: string,
  score?: number
): Promise<string> {
  const apiKey = requireOpenAIKey();
  const model = (process.env.OPENAI_MODEL_TAILOR || "gpt-4o-mini").trim();

  const matchBand = typeof score === "number" && score >= 7.0 ? "STRONG" : "WEAK";

  const systemPrompt = `You are a strict, factual resume tailoring assistant.

## ABSOLUTE GUARDRAILS (never violate):
1. Every word in the tailored resume MUST be traceable to the ORIGINAL RESUME. If a skill, industry, tool, domain, title, metric, or term does not appear in the original resume, you are FORBIDDEN from adding it — even if it appears in the job description.
2. You MUST NOT introduce: quota, SaaS, enterprise, technical sales, engineering-driven, or ANY domain/industry claim not in the original resume.
3. Do not invent metrics, percentages, headcounts, revenue figures, or performance claims.
4. Do not upgrade a job title, role scope, or seniority beyond what the resume states.

## MATCH BAND BEHAVIOR:
- WEAK match (score < 7.0): Use conservative language. Only reorder and lightly rephrase existing evidence. Do NOT foreground skills or domains absent from the resume. Acknowledge limited fit implicitly by staying grounded in the candidate's actual background.
- STRONG match (score >= 7.0): Be assertive in elevating and foregrounding relevant evidence. Sharpen language, prioritize matching bullets, rewrite the summary to lead with the strongest fit — but ONLY using what's in the resume. Still blocked from fabrication.

## OUTPUT FORMAT (MANDATORY):
First, output the complete tailored resume text (ready to use, professional formatting).
Then, output exactly the following separator on its own line:
===INTERNAL_DEBUG_TRACE===
Then, for EACH section you modified, output:
SECTION: <name>
SOURCE: <exact quote or paraphrase from original resume used>
TRANSFORM: <one of: reframe | compress | elevate | preserve>
BLOCKED: <list any JD terms you considered but blocked because they lacked resume evidence, or "none">
---

Do not skip the debug trace. It is required for every response.`;

  const userPrompt = `TARGET ROLE: ${jobTitle} at ${company}
MATCH BAND: ${matchBand} (score: ${typeof score === "number" ? score : "unknown"})

JOB DESCRIPTION:
${jobDescription.slice(0, 6000)}

ORIGINAL RESUME:
${resumeText.slice(0, 8000)}

Produce the tailored resume now. Follow ALL guardrails. After the resume, output the ===INTERNAL_DEBUG_TRACE=== section exactly as specified.`;

  const resp = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0.3,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    }),
  });

  if (!resp.ok) {
    const txt = await resp.text().catch(() => "");
    throw new Error(`OpenAI error: ${resp.status} ${txt}`);
  }

  const data = (await resp.json()) as any;
  const content = String(
    data?.choices?.[0]?.message?.content ?? ""
  ).trim();
  if (!content) throw new Error("OpenAI returned empty tailored resume");

  return content;
}

/**
 * Find a prep context by sessionId + jobUrl (normalized match).
 * Returns the most recent matching prep if multiple exist.
 */
export function tailorPrepFindByJob(
  sessionId: string,
  jobUrl: string
): TailorPrep | null {
  ensureDir();
  const canonical = normalizeJobUrl(jobUrl);
  if (!canonical) return null;
  let best: TailorPrep | null = null;
  const files = fs.readdirSync(DATA_DIR).filter(
    (f) => f.startsWith("prep_") && f.endsWith(".json")
  );
  for (const file of files) {
    try {
      const prep: TailorPrep = JSON.parse(
        fs.readFileSync(path.join(DATA_DIR, file), "utf-8")
      );
      if (
        prep.sessionId === sessionId &&
        normalizeJobUrl(prep.jobUrl) === canonical
      ) {
        if (!best || prep.createdAt > best.createdAt) best = prep;
      }
    } catch {
      continue;
    }
  }
  return best;
}
