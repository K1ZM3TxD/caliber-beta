// lib/pipeline_store.ts — Simple job pipeline store (JSON file)
import fs from "fs";
import path from "path";
import crypto from "crypto";

export type PipelineStage =
  | "strong_match"
  | "tailored"
  | "applied"
  | "interviewing"
  | "offer"
  | "resume_prep"
  | "submitted"
  | "interview_prep"
  | "interview"
  | "archived";

export interface PipelineEntry {
  id: string;
  sessionId: string;
  jobTitle: string;
  company: string;
  jobUrl: string;
  score: number;
  stage: PipelineStage;
  createdAt: string; // ISO
  updatedAt: string; // ISO
  tailorId?: string; // link to tailor output if tailored
  jobText?: string; // job description for tailor context
}

const DATA_DIR =
  process.env.VERCEL === "1" || process.env.VERCEL
    ? "/tmp/.caliber-pipeline"
    : path.join(process.cwd(), ".caliber-pipeline");

const FILE = path.join(DATA_DIR, "pipeline.json");

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function readAll(): PipelineEntry[] {
  ensureDir();
  if (!fs.existsSync(FILE)) return [];
  try {
    return JSON.parse(fs.readFileSync(FILE, "utf-8"));
  } catch {
    return [];
  }
}

function writeAll(entries: PipelineEntry[]) {
  ensureDir();
  fs.writeFileSync(FILE, JSON.stringify(entries, null, 2), "utf-8");
}

export function pipelineList(sessionId?: string): PipelineEntry[] {
  const all = readAll();
  if (sessionId) return all.filter((e) => e.sessionId === sessionId);
  return all;
}

export function pipelineGet(id: string): PipelineEntry | null {
  return readAll().find((e) => e.id === id) ?? null;
}

/**
 * Normalize a job URL for consistent comparison.
 * Strips tracking query params, hash, and trailing slashes.
 * For LinkedIn /jobs/view/<id> URLs, extracts the canonical path.
 * Handles slug-style URLs like /jobs/view/title-at-company-12345/
 */
export function normalizeJobUrl(raw: string): string {
  if (!raw) return "";
  try {
    const u = new URL(raw);
    // LinkedIn: extract job ID from currentJobId param or /jobs/view/<id>
    const currentJobId = u.searchParams.get("currentJobId");
    if (currentJobId && /^\d+$/.test(currentJobId)) {
      return u.origin + "/jobs/view/" + currentJobId;
    }
    const jobViewMatch = u.pathname.match(/\/jobs\/view\/(\d+)/);
    if (jobViewMatch) {
      return u.origin + "/jobs/view/" + jobViewMatch[1];
    }
    // Slug-style: /jobs/view/title-at-company-12345
    const slugMatch = u.pathname.match(/\/jobs\/view\/[^/]*?-(\d{5,})(?:\/|$)/);
    if (slugMatch) {
      return u.origin + "/jobs/view/" + slugMatch[1];
    }
    // Generic: strip query and hash, trim trailing slash
    return (u.origin + u.pathname).replace(/\/+$/, "");
  } catch {
    return raw.split("?")[0].split("#")[0].replace(/\/+$/, "");
  }
}

export function pipelineFindByJob(
  sessionId: string,
  jobUrl: string
): PipelineEntry | null {
  const normalized = normalizeJobUrl(jobUrl);
  return (
    readAll().find(
      (e) => e.sessionId === sessionId && normalizeJobUrl(e.jobUrl) === normalized
    ) ?? null
  );
}

export function pipelineCreate(
  entry: Omit<PipelineEntry, "id" | "createdAt" | "updatedAt">
): PipelineEntry {
  const all = readAll();
  // Prevent duplicate entries for the same job URL within a session
  const normalized = normalizeJobUrl(entry.jobUrl);
  const existing = all.find(
    (e) => e.sessionId === entry.sessionId && normalizeJobUrl(e.jobUrl) === normalized
  );
  if (existing) return existing;

  const now = new Date().toISOString();
  const created: PipelineEntry = {
    ...entry,
    id: "pl_" + crypto.randomBytes(8).toString("hex"),
    createdAt: now,
    updatedAt: now,
  };
  all.push(created);
  writeAll(all);
  return created;
}

export function pipelineUpdateStage(
  id: string,
  stage: PipelineStage,
  extra?: Partial<Pick<PipelineEntry, "tailorId">>
): PipelineEntry | null {
  const all = readAll();
  const idx = all.findIndex((e) => e.id === id);
  if (idx === -1) return null;
  all[idx].stage = stage;
  all[idx].updatedAt = new Date().toISOString();
  if (extra?.tailorId) all[idx].tailorId = extra.tailorId;
  writeAll(all);
  return all[idx];
}
