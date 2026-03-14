import fs from "fs";
import path from "path";

export interface TelemetryEvent {
  event: string;
  timestamp: string;
  sessionId: string | null;
  surfaceKey: string | null;
  jobId: string | null;
  jobTitle: string | null;
  company: string | null;
  jobUrl: string | null;
  score: number | null;
  source: "extension" | "web" | null;
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

const DATA_DIR = path.join(process.cwd(), "data");
const LOG_PATH = path.join(DATA_DIR, "telemetry_events.jsonl");

export function isValidEventName(name: unknown): name is string {
  return typeof name === "string" && VALID_EVENTS.has(name);
}

export function appendTelemetryEvent(event: TelemetryEvent): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  const line = JSON.stringify(event) + "\n";
  fs.appendFileSync(LOG_PATH, line, "utf-8");
}
