// lib/pipeline_store_db.ts — User-bound pipeline persistence via Prisma
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import type { PipelineEntry as PrismaEntry } from "@prisma/client";
import {
  pipelineList as filePipelineList,
  normalizeJobUrl as fileNormalizeJobUrl,
} from "@/lib/pipeline_store";

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
  userId: string;
  jobTitle: string;
  company: string;
  jobUrl: string;
  score: number;
  stage: PipelineStage;
  createdAt: string;
  updatedAt: string;
  tailorId?: string;
}

function toApi(e: PrismaEntry): PipelineEntry {
  return {
    id: e.id,
    userId: e.userId,
    jobTitle: e.jobTitle,
    company: e.company,
    jobUrl: e.jobUrl,
    score: e.score,
    stage: e.stage as PipelineStage,
    createdAt: e.createdAt.toISOString(),
    updatedAt: e.updatedAt.toISOString(),
    tailorId: e.tailorId ?? undefined,
  };
}

/**
 * Normalize a job URL for consistent comparison.
 */
export function normalizeJobUrl(raw: string): string {
  if (!raw) return "";
  try {
    const u = new URL(raw);
    const jobViewMatch = u.pathname.match(/\/jobs\/view\/(\d+)/);
    const currentJobId = u.searchParams.get("currentJobId");
    if (currentJobId && /^\d+$/.test(currentJobId)) {
      return u.origin + "/jobs/view/" + currentJobId;
    }
    if (jobViewMatch) {
      return u.origin + "/jobs/view/" + jobViewMatch[1];
    }
    return (u.origin + u.pathname).replace(/\/+$/, "");
  } catch {
    return raw.split("?")[0].split("#")[0].replace(/\/+$/, "");
  }
}

export async function pipelineList(userId: string): Promise<PipelineEntry[]> {
  const rows = await prisma.pipelineEntry.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
  });
  return rows.map(toApi);
}

export async function pipelineGet(id: string): Promise<PipelineEntry | null> {
  const row = await prisma.pipelineEntry.findUnique({ where: { id } });
  return row ? toApi(row) : null;
}

export async function pipelineFindByJob(
  userId: string,
  jobUrl: string
): Promise<PipelineEntry | null> {
  const normalized = normalizeJobUrl(jobUrl);
  // Prisma SQLite doesn't support complex URL normalization in query,
  // so we fetch user entries and filter in-memory.
  const rows = await prisma.pipelineEntry.findMany({ where: { userId } });
  const match = rows.find((e) => normalizeJobUrl(e.jobUrl) === normalized);
  return match ? toApi(match) : null;
}

export async function pipelineCreate(
  entry: Omit<PipelineEntry, "id" | "createdAt" | "updatedAt">
): Promise<PipelineEntry> {
  // Prevent duplicates for same job URL per user
  const normalized = normalizeJobUrl(entry.jobUrl);
  const existing = await pipelineFindByJob(entry.userId, normalized);
  if (existing) return existing;

  const row = await prisma.pipelineEntry.create({
    data: {
      id: "pl_" + crypto.randomBytes(8).toString("hex"),
      userId: entry.userId,
      jobTitle: entry.jobTitle,
      company: entry.company,
      jobUrl: entry.jobUrl,
      score: entry.score,
      stage: entry.stage,
      tailorId: entry.tailorId ?? null,
    },
  });
  return toApi(row);
}

export async function pipelineUpdateStage(
  id: string,
  stage: PipelineStage,
  extra?: Partial<Pick<PipelineEntry, "tailorId">>
): Promise<PipelineEntry | null> {
  try {
    const row = await prisma.pipelineEntry.update({
      where: { id },
      data: {
        stage,
        ...(extra?.tailorId ? { tailorId: extra.tailorId } : {}),
      },
    });
    return toApi(row);
  } catch {
    return null;
  }
}

/**
 * Migrate file-based pipeline entries (created by extension with sessionId)
 * into the DB under the authenticated user. Skips duplicates by jobUrl.
 */
export async function migrateFileEntriesToUser(
  sessionId: string,
  userId: string
): Promise<number> {
  const fileEntries = filePipelineList(sessionId);
  if (fileEntries.length === 0) return 0;

  // Get existing DB entries for this user to avoid duplicates
  const existing = await prisma.pipelineEntry.findMany({ where: { userId } });
  const existingUrls = new Set(existing.map((e) => fileNormalizeJobUrl(e.jobUrl)));

  let migrated = 0;
  for (const fe of fileEntries) {
    const normalized = fileNormalizeJobUrl(fe.jobUrl);
    if (existingUrls.has(normalized)) continue;

    await prisma.pipelineEntry.create({
      data: {
        id: fe.id,
        userId,
        jobTitle: fe.jobTitle,
        company: fe.company,
        jobUrl: fe.jobUrl,
        score: fe.score,
        stage: fe.stage,
        tailorId: fe.tailorId ?? null,
      },
    });
    existingUrls.add(normalized);
    migrated++;
  }
  return migrated;
}
