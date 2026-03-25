// lib/feedback_store.ts — Durable feedback event persistence (Prisma/Postgres)

import { prisma } from "@/lib/prisma";

export interface FeedbackEvent {
  timestamp: string;
  userId: string | null;
  surface: "extension" | "calibration_results" | "title_suggestion";
  site: string | null;
  company_name: string | null;
  job_title: string | null;
  job_url: string | null;
  search_title: string | null;
  surface_key: string | null;
  session_id: string | null;
  calibration_title_direction: string | null;
  fit_score: number | null;
  decision_label: string | null;
  hiring_reality_band: string | null;
  better_search_title_suggestion: string | null;
  feedback_type: "thumbs_up" | "thumbs_down" | "bug_report";
  feedback_reason: string | null;
  bug_category: string | null;
  optional_comment: string | null;
  behavioral_signals: {
    jobs_viewed_in_session: number | null;
    scores_below_6_count: number | null;
    highest_score_seen: number | null;
    better_title_suggestion_shown: boolean;
    better_title_suggestion_clicked: boolean;
  };
}

export async function appendFeedbackEvent(event: FeedbackEvent): Promise<void> {
  await prisma.feedbackEvent.create({
    data: {
      timestamp: new Date(event.timestamp),
      userId: event.userId,
      surface: event.surface,
      site: event.site,
      companyName: event.company_name,
      jobTitle: event.job_title,
      jobUrl: event.job_url,
      searchTitle: event.search_title,
      surfaceKey: event.surface_key,
      sessionId: event.session_id,
      calibrationTitleDirection: event.calibration_title_direction,
      fitScore: event.fit_score,
      decisionLabel: event.decision_label,
      hiringRealityBand: event.hiring_reality_band,
      betterSearchTitleSuggestion: event.better_search_title_suggestion,
      feedbackType: event.feedback_type,
      feedbackReason: event.feedback_reason,
      bugCategory: event.bug_category,
      optionalComment: event.optional_comment,
      jobsViewedInSession: event.behavioral_signals.jobs_viewed_in_session,
      scoresBelowSixCount: event.behavioral_signals.scores_below_6_count,
      highestScoreSeen: event.behavioral_signals.highest_score_seen,
      betterTitleSuggestionShown: event.behavioral_signals.better_title_suggestion_shown,
      betterTitleSuggestionClicked: event.behavioral_signals.better_title_suggestion_clicked,
    },
  });
}
