// lib/resume_parser.ts — Parse tailored resume text into structured sections for document generation

export interface ParsedResume {
  name: string;
  contact: string;
  sections: ResumeSection[];
  raw: string;
}

export interface ResumeSection {
  heading: string;
  type: "summary" | "experience" | "skills" | "education" | "other";
  items: ResumeItem[];
}

export type ResumeItem =
  | { kind: "text"; text: string }
  | { kind: "entry"; text: string }
  | { kind: "bullet"; text: string };

const DEBUG_SEP = "===INTERNAL_DEBUG_TRACE===";

export function stripDebugTrace(text: string): string {
  const i = text.indexOf(DEBUG_SEP);
  return (i >= 0 ? text.slice(0, i) : text).trim();
}

const HEADER_MAP: [RegExp, ResumeSection["type"]][] = [
  // Summary / profile variants — cast wide net to prevent LLM heading drift into 'other'
  [/^(PROFESSIONAL\s+|CAREER\s+|EXECUTIVE\s+|PERSONAL\s+)?SUMMARY$/i, "summary"],
  [/^(PROFESSIONAL\s+|CAREER\s+|CANDIDATE\s+)?PROFILE$/i, "summary"],
  [/^PROFESSIONAL\s+OVERVIEW$/i, "summary"],
  [/^CAREER\s+OVERVIEW$/i, "summary"],
  [/^(CAREER\s+)?OBJECTIVE$/i, "summary"],
  [/^ABOUT(\s+ME)?$/i, "summary"],
  [/^OVERVIEW$/i, "summary"],
  [/^INTRODUCTION$/i, "summary"],
  [/^BACKGROUND$/i, "summary"],
  [/^HIGHLIGHTS?$/i, "summary"],
  [/^SUMMARY\s+OF\s+(QUALIFICATIONS?|EXPERIENCE)$/i, "summary"],
  [/^TARGET\s+HEADLINE$/i, "summary"],
  [/^(WORK\s+|PROFESSIONAL\s+)?EXPERIENCE$/i, "experience"],
  [/^EMPLOYMENT(\s+HISTORY)?$/i, "experience"],
  [/^(CORE\s+|TECHNICAL\s+|KEY\s+|RELEVANT\s+)?SKILLS(\s+(&|AND)\s+\w+)?$/i, "skills"],
  [/^(AREAS?\s+OF\s+)?EXPERTISE$/i, "skills"],
  [/^TECHNICAL\s+PROFICIEN/i, "skills"],
  [/^QUALIFICATIONS?$/i, "skills"],
  [/^EDUCATION(\s+(&|AND)\s+\w+)?$/i, "education"],
  [/^ACADEMIC\s+BACKGROUND$/i, "education"],
  [/^SELECTED\s+PROJECTS?$/i, "other"],
  [/^CERTIFIC/i, "other"],
  [/^LICENSES?$/i, "other"],
  [/^HONORS?$/i, "other"],
  [/^AWARDS?$/i, "other"],
  [/^LANGUAGES?$/i, "other"],
  [/^ADDITIONAL/i, "other"],
  [/^VOLUNTEER/i, "other"],
  [/^PROJECTS?$/i, "other"],
  [/^PUBLICATIONS?$/i, "other"],
  [/^INTERESTS?$/i, "other"],
  [/^ACTIVITIES$/i, "other"],
  [/^REFERENCES$/i, "other"],
  [/^AFFILIATIONS?$/i, "other"],
  [/^TRAINING$/i, "other"],
  [/^LEADERSHIP$/i, "other"],
];

// Canonical headings for standard ATS/LinkedIn section labels.
// Parser normalizes any LLM variant (e.g. "PROFESSIONAL EXPERIENCE", "CORE SKILLS")
// to these standard labels so the exported resume uses recruiter-familiar headings.
const CANONICAL_HEADING: Record<ResumeSection["type"], string> = {
  summary: "Summary",
  experience: "Experience",
  skills: "Skills",
  education: "Education",
  other: "", // preserve original for certifications, projects, etc.
};

function classifyHeader(text: string): ResumeSection["type"] | null {
  const clean = text.replace(/[\s:\-_=]+$/, "").trim();
  if (!clean || clean.length > 60) return null;

  for (const [re, type] of HEADER_MAP) {
    if (re.test(clean)) return type;
  }

  // ALL-CAPS line with 3+ alpha chars (catch-all header detection)
  if (/^[A-Z][A-Z\s&\/,]{2,}$/.test(clean) && /[A-Z]{3,}/.test(clean)) {
    return "other";
  }

  return null;
}

function extractBullet(line: string): string | null {
  const m = line.match(/^\s*[•\-\*▪▸►●○◦‣⁃]\s+(.+)/);
  return m ? m[1].replace(/^[\u2022\u25AA\u25BA\u25CF\u2023\u25E6\u2043*\-•]+\s*/, "").trim() : null;
}

function isEntryHeader(line: string): boolean {
  return (
    /\d{4}\s*[-–—]\s*(Present|Current|\d{4})/i.test(line) ||
    (/\|/.test(line) && line.trim().length < 120 && !/^\s*[•\-\*]/.test(line))
  );
}

export function parseResume(rawText: string): ParsedResume {
  const text = stripDebugTrace(rawText);
  const lines = text.split("\n");

  let name = "";
  let contact = "";
  let startIdx = 0;

  // Extract name and contact from first few lines
  for (let i = 0; i < Math.min(lines.length, 6); i++) {
    const l = lines[i].trim();
    if (!l) continue;

    if (!name) {
      if (classifyHeader(l) !== null) break;
      name = l;
      startIdx = i + 1;
      continue;
    }

    if (classifyHeader(l) !== null) break;

    // Contact line: has email, phone, pipe, or URL pattern
    if (/[@]|[\(\)\d]{4,}|\|/.test(l) && l.length < 120) {
      contact = contact ? contact + " | " + l : l;
      startIdx = i + 1;
      continue;
    }

    // Short line (location, subtitle) before any section
    if (l.length < 80 && !extractBullet(l)) {
      contact = contact ? contact + " | " + l : l;
      startIdx = i + 1;
      continue;
    }

    break;
  }

  // Parse body into sections
  const sections: ResumeSection[] = [];
  let current: ResumeSection | null = null;

  for (let i = startIdx; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (!trimmed) continue;

    const htype = classifyHeader(trimmed);
    if (htype) {
      if (current) sections.push(current);
      const rawHeading = trimmed.replace(/[\s:\-_=]+$/, "").trim();
      const canonical = CANONICAL_HEADING[htype];
      current = {
        heading: canonical || rawHeading,
        type: htype,
        items: [],
      };
      continue;
    }

    if (!current) {
      current = { heading: "Summary", type: "summary", items: [] };
    }

    const bullet = extractBullet(trimmed);
    if (bullet) {
      current.items.push({ kind: "bullet", text: bullet });
      continue;
    }

    // Entry headers apply to experience, education, and other sections
    // (project title lines, degree lines, certification entries, etc.)
    const ENTRY_TYPES: ResumeSection["type"][] = ["experience", "education", "other"];
    if (ENTRY_TYPES.includes(current.type) && isEntryHeader(trimmed)) {
      // LLM often outputs role title on its own line, then "Company | Date" on the next.
      // The parser would classify the role title as `text` and the company|date line as
      // `entry` — inverting the visual hierarchy. Detect this pattern and merge:
      // if the previous item is a `text` kind with no pipe (i.e. a bare role title),
      // absorb it as the first segment of this entry → "Title | Company | Date"
      const prev = current.items.length > 0 ? current.items[current.items.length - 1] : null;
      if (prev && prev.kind === "text" && !prev.text.includes("|") && prev.text.length < 100) {
        current.items.pop();
        current.items.push({ kind: "entry", text: `${prev.text} | ${trimmed}` });
      } else {
        current.items.push({ kind: "entry", text: trimmed });
      }
      continue;
    }

    // In `other` sections (SELECTED PROJECTS, PROJECTS, CERTIFICATIONS, etc.),
    // any non-bullet line is a project/item title — always render as entry (bold).
    if (current.type === "other") {
      current.items.push({ kind: "entry", text: trimmed });
      continue;
    }

    current.items.push({ kind: "text", text: trimmed });
  }

  if (current) sections.push(current);

  // Fallback: if parsing found nothing, split raw text into plain paragraphs
  if (sections.length === 0 && text.length > 0) {
    sections.push({
      heading: "",
      type: "other",
      items: text
        .split("\n")
        .filter((l) => l.trim())
        .map((l) => {
          const b = extractBullet(l.trim());
          return b
            ? ({ kind: "bullet" as const, text: b })
            : ({ kind: "text" as const, text: l.trim() });
        }),
    });
  }

  return { name, contact, sections, raw: text };
}

/** Build a filename-safe string from person name or job metadata */
export function safeFilename(
  name: string,
  jobTitle: string,
  company: string,
): string {
  if (name) {
    const safeName = name
      .replace(/[^a-zA-Z\s]/g, "")
      .trim()
      .replace(/\s+/g, "_");
    if (safeName.length >= 3) return `${safeName}_Tailored_Resume`;
  }
  const safeCompany = company
    .replace(/[^a-zA-Z0-9\s]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .toLowerCase();
  const safeTitle = jobTitle
    .replace(/[^a-zA-Z0-9\s]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .toLowerCase();
  return `resume-${safeCompany}-${safeTitle}`;
}
