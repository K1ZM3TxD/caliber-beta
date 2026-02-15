// Type definitions for Caliber Beta v1

// Six locked dimensions (each can be 0, 1, or 2)
export type DimensionValue = 0 | 1 | 2;

export interface Vector {
  structural_maturity: DimensionValue;
  authority_scope: DimensionValue;
  revenue_orientation: DimensionValue;
  role_ambiguity: DimensionValue;
  breadth_vs_depth: DimensionValue;
  stakeholder_density: DimensionValue;
}

export interface Evidence {
  structural_maturity: string[];
  authority_scope: string[];
  revenue_orientation: string[];
  role_ambiguity: string[];
  breadth_vs_depth: string[];
  stakeholder_density: string[];
}

// Person Extraction Response
export interface PersonExtractionResponse {
  person_vector: Vector;
  evidence: Evidence;
}

// Role Extraction Response
export interface RoleExtractionResponse {
  role_vector: Vector;
  requirements: string[];
}

// Requirement Classification
export type RequirementCategory = "grounded" | "adjacent" | "new";

export interface ClassifiedRequirement {
  requirement: string;
  category: RequirementCategory;
  scope_matched_outcome: boolean;
}

export interface RequirementClassificationResponse {
  classified_requirements: ClassifiedRequirement[];
}

// API Input/Output types
export interface CalibrateInput {
  resume: string;
  promptAnswers: string[];
  jobDescription: string;
}

// Scoring results
export interface AlignmentResult {
  score: number; // 0-10, rounded to 1 decimal
  severeMismatches: number;
  moderateMismatches: number;
}

export interface SkillMatchResult {
  score: number; // 0-10, rounded to 1 decimal
  groundedCount: number;
  adjacentCount: number;
  newCount: number;
  total: number;
}

export interface StretchLoadResult {
  percentage: number; // 0-100, rounded to nearest integer
}

export interface PatternSynthesisResult {
  titleHypothesis: string; // 2-4 words
  patternSummary: string; // exactly 3 sentences
  operateBest: string[]; // 3-5 bullets, ≤8 words each
  loseEnergy: string[]; // 3-5 bullets, ≤8 words each
  structuralTensions: string | null; // only if S ≥ 1
}

// Final calibration output
export interface CalibrationResult {
  alignment: AlignmentResult;
  skillMatch: SkillMatchResult;
  stretchLoad: StretchLoadResult;
  patternSynthesis: PatternSynthesisResult;
  personVector: Vector;
  roleVector: Vector;
  evidence: Evidence;
  classifiedRequirements: ClassifiedRequirement[];
}
