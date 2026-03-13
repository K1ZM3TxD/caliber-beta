// lib/tailor_store.ts — Prepare + store tailored resume artifacts
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { normalizeJobUrl } from "./pipeline_store";
import { requireOpenAIKey } from "./env";

export interface TailorPrep {
  id: string;
  sessionId: string;
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
export async function generateTailoredResume(
  resumeText: string,
  jobTitle: string,
  company: string,
  jobDescription: string
): Promise<string> {
  const apiKey = requireOpenAIKey();

  const model = (
    process.env.OPENAI_MODEL_TAILOR || "gpt-4o-mini"
  ).trim();

  const systemPrompt = `You are a professional resume tailoring assistant. Your job is to rewrite a candidate's resume to better align with a specific job opportunity.

RULES:
- NEVER fabricate experience, skills, or accomplishments the candidate does not have.
- NEVER invent job titles, companies, or dates that are not in the original resume.
- Emphasize and foreground existing experience that is most relevant to the target role.
- Adjust wording, bullet points, and emphasis to align with the job description's language and priorities.
- Reorder sections or bullets to put the most relevant content first.
- Strengthen action verbs and quantify where the original allows.
- Remove or de-emphasize less relevant details to keep focus tight.
- Maintain professional tone and clean formatting.
- Output ONLY the tailored resume text, ready to use. No commentary or explanations.`;

  const userPrompt = `TARGET ROLE: ${jobTitle} at ${company}

JOB DESCRIPTION:
${jobDescription.slice(0, 6000)}

ORIGINAL RESUME:
${resumeText.slice(0, 8000)}

Produce the tailored resume now.`;

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
