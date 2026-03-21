import { prisma } from "@/lib/prisma";

export interface TelemetryEvent {
  event: string;
  timestamp: string;
  userId: string | null;
  sessionId: string | null;
  surfaceKey: string | null;
  jobId: string | null;
  jobTitle: string | null;
  company: string | null;
  jobUrl: string | null;
  score: number | null;
  source: "extension" | "web" | null;
  scoreSource: string | null;
  signalPreference: string | null;
  meta: Record<string, unknown> | null;
}

const VALID_EVENTS = new Set([
  "search_surface_opened",
  "job_score_rendered",
  "job_opened",
  "strong_match_viewed",
  "pipeline_save",
  "tailor_used",
]);

export function isValidEventName(name: unknown): name is string {
  return typeof name === "string" && VALID_EVENTS.has(name);
}

export async function appendTelemetryEvent(event: TelemetryEvent): Promise<void> {
  await prisma.telemetryEvent.create({
    data: {
      event: event.event,
      timestamp: new Date(event.timestamp),
      userId: event.userId,
      sessionId: event.sessionId,
      surfaceKey: event.surfaceKey,
      jobId: event.jobId,
      jobTitle: event.jobTitle,
      company: event.company,
      jobUrl: event.jobUrl,
      score: event.score,
      source: event.source,
      scoreSource: event.scoreSource,
      signalPreference: event.signalPreference,
      meta: event.meta ? JSON.stringify(event.meta) : null,
    },
  });
}
