// lib/feedback_store.ts — Append-only structured feedback event log (beta)
// Writes JSONL to data/feedback_events.jsonl for aggregation/analysis.

import fs from "fs";
import path from "path";

export interface FeedbackEvent {
  timestamp: string;
  surface: "extension" | "calibration_results" | "title_suggestion";
  site: string | null;
  company_name: string | null;
  job_title: string | null;
  search_title: string | null;
  calibration_title_direction: string | null;
  fit_score: number | null;
  decision_label: string | null;
  hiring_reality_band: string | null;
  better_search_title_suggestion: string | null;
  feedback_type: "thumbs_up" | "thumbs_down";
  feedback_reason: string | null;
  optional_comment: string | null;
  behavioral_signals: {
    jobs_viewed_in_session: number | null;
    scores_below_6_count: number | null;
    highest_score_seen: number | null;
    better_title_suggestion_shown: boolean;
    better_title_suggestion_clicked: boolean;
  };
}

const DATA_DIR = path.join(process.cwd(), "data");
const LOG_PATH = path.join(DATA_DIR, "feedback_events.jsonl");

export function appendFeedbackEvent(event: FeedbackEvent): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  const line = JSON.stringify(event) + "\n";
  fs.appendFileSync(LOG_PATH, line, "utf-8");
}

export function readFeedbackEvents(): FeedbackEvent[] {
  if (!fs.existsSync(LOG_PATH)) return [];
  const lines = fs.readFileSync(LOG_PATH, "utf-8").split("\n").filter(Boolean);
  return lines.map((l) => JSON.parse(l));
}
