// Updated synthesis type in CalibrationSession to include anchor metrics fields.

export interface CalibrationSession {
    patternSummary: string | null;
    operateBest: string[] | null;
    loseEnergy: string[] | null;
    identitySummary: string | null;
    marketTitle: string | null;
    titleExplanation: string | null;
    lastTitleFeedback: string | null;
    // New anchor metrics fields
    anchor_overlap_score?: number;
    missing_anchor_count?: number;
    missing_anchor_terms?: string[];
}