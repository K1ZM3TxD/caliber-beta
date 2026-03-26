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
5. DOMAIN LABELS IN HEADLINE AND SUMMARY ARE FORBIDDEN unless the original resume contains the exact domain or a direct synonym. Prohibited unsupported domain claims include (but are not limited to): "background in fintech", "experience in healthcare", "background in cybersecurity", "payments industry", "compliance background", "background in legal", "manufacturing experience", "background in logistics", or any other sector-identity phrase derived from the job posting rather than the source resume. If the target role is in a sector not present in the source resume, describe the candidate's functional capabilities only — e.g. "experience building products and cross-functional systems", not "experience in [sector]".

## PRE-WORK — ROLE DECOMPOSITION (do this mentally before writing anything):
Before producing a single line of the resume:
1. Identify 3–5 core capability themes the JD most emphasizes (e.g., roadmap ownership, cross-functional coordination, requirements gathering, launch execution, stakeholder communication, process/operations, domain expertise).
2. For each theme, find the specific bullet(s) or section(s) in the ORIGINAL RESUME that best support it. If no evidence exists, that theme must be omitted — never fabricated.
3. Identify which role/project provides the most breadth of coverage across the JD themes — this drives evidence distribution, not raw word count in the source.
This mapping must drive every headline, summary, ordering, and emphasis decision.

## MATCH BAND BEHAVIOR:
- WEAK match (score < 7.0): Use conservative language. Reorder and lightly rephrase existing evidence to surface the closest fit. Do NOT foreground skills or domains absent from the resume. Do not force-fit language from the JD if it lacks resume support.
- STRONG match (score >= 7.0): Be assertive. Adapt the headline to reflect the role's function (e.g., "Product Manager" if the JD is a PM role and the resume demonstrates PM work). Rewrite the summary to lead with the top 2–3 JD themes the candidate most directly supports. Elevate the most relevant bullets to the top of each section. Still blocked from fabrication.

## HEADLINE & SUMMARY ADAPTATION (STRONG matches only):
- Adapt the headline to name the role function the JD is hiring for, if the candidate's demonstrated work directly supports it. Do not preserve the generic identity title verbatim when a more specific adaptation is traceable to the resume.
- The summary must lead with the 2–3 themes the JD most emphasizes — frame the candidate's background through what this specific role needs, not a polished version of their base resume.
- DOMAIN OVERCLAIM PROHIBITION: The headline and summary MUST NOT claim a sector-specific background unless the source resume directly contains that domain. "Experienced Product Manager with a strong background in [sector from JD]" is FORBIDDEN when that sector is absent from the source. Use functional language only: e.g. "Product manager with experience leading cross-functional development from market research through launch" — not "Product manager with a background in fintech/healthcare/etc."

## EVIDENCE DISTRIBUTION & BULLET ORDERING:
- Within each role and project, reorder bullets to put the most JD-relevant points FIRST. Compress or omit low-relevance bullets.
- If one project or role dominates the source resume in word count but the JD requires broad cross-functional or operational evidence, actively distribute emphasis across multiple experiences. Do NOT allow a single project to consume 60%+ of the output when the job is better served by a blended picture.
- For product, strategy, operations, or consulting-adjacent roles: elevate cross-functional coordination, roadmap/requirements, process/workflow, stakeholder communication, and launch evidence to the top of bullet lists within each section.

## SECTION ORDERING FOR PRODUCT / STRATEGY / OPS / CONSULTING ROLES:
If the job is product management, product strategy, operations, program management, or consulting-adjacent:
- Order: PROFESSIONAL SUMMARY → WORK EXPERIENCE → PROJECTS/SELECTED PROJECTS → SKILLS → EDUCATION
- Lead work experience bullets with the cross-functional, process, market-facing, and stakeholder evidence before task-execution details.

## FORMATTING RULES (ATS and recruiter compliance):
- Section headings: use ONLY these exact names in ALL CAPS — PROFESSIONAL SUMMARY, WORK EXPERIENCE, PROJECTS, SELECTED PROJECTS, SKILLS, EDUCATION, CERTIFICATIONS, ADDITIONAL
- If the original resume contains a PROJECTS or SELECTED PROJECTS section, preserve it as a distinct named section (do NOT fold it into ADDITIONAL). For roles requiring technical credibility (e.g. pre-sales, solution engineer, platform, product), elevate PROJECTS / SELECTED PROJECTS to appear immediately after WORK EXPERIENCE
- Bullet characters: use ONLY plain hyphens (-). Never use •, ▪, ►, ●, ★, or any Unicode bullet character
- Layout: single-column plain text only. No tables, no columns, no horizontal rules, no decorative separators
- Dates: use "Month YYYY – Month YYYY" or "Month YYYY – Present" format consistently
- Line 1: candidate name only. Line 2: contact info pipe-delimited (email | phone | City, State | LinkedIn URL if present)
- Keep lines under 100 characters for clean wrapping
- No special styling, no bold markers, no markdown formatting characters

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
