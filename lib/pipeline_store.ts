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

export function pipelineFindByJob(
  sessionId: string,
  jobUrl: string
): PipelineEntry | null {
  return (
    readAll().find((e) => e.sessionId === sessionId && e.jobUrl === jobUrl) ??
    null
  );
}

export function pipelineCreate(
  entry: Omit<PipelineEntry, "id" | "createdAt" | "updatedAt">
): PipelineEntry {
  const all = readAll();
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
