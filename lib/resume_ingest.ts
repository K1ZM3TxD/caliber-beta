// lib/resume_ingest.ts
// Milestone 2.4 (Part 1): Deterministic “Most Recent Role” Extraction Contract

export type MostRecentRole = {
  title: string;
  organization?: string;
  startDate?: string;
  endDate?: string;
  rawBlock: string;
};

export type ResumeRoleExtractionError = {
  name: "ResumeRoleExtractionError";
  code: "NO_ROLE_DETECTED";
  detail: string;
};

const MONTHS: Record<string, number> = {
  jan: 1,
  january: 1,
  feb: 2,
  february: 2,
  mar: 3,
  march: 3,
  apr: 4,
  april: 4,
  may: 5,
  jun: 6,
  june: 6,
  jul: 7,
  july: 7,
  aug: 8,
  august: 8,
  sep: 9,
  sept: 9,
  september: 9,
  oct: 10,
  october: 10,
  nov: 11,
  november: 11,
  dec: 12,
  december: 12,
};

const DASH = "[\\-\\u2013\\u2014]"; // -, en-dash, em-dash

function normalizeWhitespace(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

function isBlankLine(line: string): boolean {
  return line.trim().length === 0;
}

function isBulletLine(line: string): boolean {
  return /^\s*([-*•]|(\d+\.))\s+/.test(line);
}

function isHeadingLine(line: string): boolean {
  const t = line.trim();
  if (!t) return false;
  // Basic headings; deterministic list (v1).
  return /^(experience|work experience|education|skills|projects|certifications|summary|profile|contact)$/i.test(
    t
  );
}

function parseMonthToken(token: string): number | null {
  const key = token.trim().toLowerCase().replace(/\./g, "");
  return MONTHS[key] ?? null;
}

function asComparableYYYYMM(year: number, month: number): number {
  // month: 1..12
  return year * 100 + month;
}

function parseDateTokenToComparable(
  tokenRaw: string
): { comparable: number; normalized: string } | null {
  const token = normalizeWhitespace(tokenRaw).replace(/[,]/g, "");
  if (!token) return null;

  // Present-ish tokens.
  if (/^(present|current|now)$/i.test(token)) {
    return { comparable: 999912, normalized: "Present" };
  }

  // MM/YYYY or M/YYYY
  const mmyyyy = token.match(/^(\d{1,2})\/(\d{4})$/);
  if (mmyyyy) {
    const mm = Number(mmyyyy[1]);
    const yy = Number(mmyyyy[2]);
    if (mm >= 1 && mm <= 12) {
      return { comparable: asComparableYYYYMM(yy, mm), normalized: `${String(mm).padStart(2, "0")}/${yy}` };
    }
    return null;
  }

  // Month YYYY (Jan 2021, January 2021)
  const monthYear = token.match(/^([A-Za-z]{3,9})\s+(\d{4})$/);
  if (monthYear) {
    const m = parseMonthToken(monthYear[1]);
    const y = Number(monthYear[2]);
    if (m && y >= 1900 && y <= 2100) {
      const normMonth = monthYear[1].replace(/\./g, "");
      const norm = `${normMonth.charAt(0).toUpperCase()}${normMonth.slice(1).toLowerCase()} ${y}`;
      return { comparable: asComparableYYYYMM(y, m), normalized: norm };
    }
    return null;
  }

  // YYYY
  const yyyy = token.match(/^(\d{4})$/);
  if (yyyy) {
    const y = Number(yyyy[1]);
    if (y >= 1900 && y <= 2100) {
      // Year-only: treat as end-of-year for “end” comparisons, and start-of-year for “start” comparisons handled elsewhere.
      return { comparable: asComparableYYYYMM(y, 12), normalized: `${y}` };
    }
    return null;
  }

  return null;
}

function extractDateRangeFromLine(
  line: string
):
  | {
      startComparable: number;
      endComparable: number;
      startDate?: string;
      endDate?: string;
      matchIndex: number;
    }
  | null {
  // Supported patterns (v1 minimal but flexible):
  // “Jan 2021 – Present”
  // “2021–2023”
  // “03/2019 – 06/2022”
  // “2022 – Present”
  const raw = line;

  // Build token patterns:
  const monthYearTok = "([A-Za-z]{3,9}\\.?\\s+\\d{4})";
  const mmyyyyTok = "(\\d{1,2}\\/\\d{4})";
  const yyyyTok = "(\\d{4})";
  const presentTok = "(Present|present|CURRENT|current|Now|now)";

  const token = `(?:${monthYearTok}|${mmyyyyTok}|${yyyyTok}|${presentTok})`;
  const re = new RegExp(`${token}\\s*${DASH}\\s*${token}`, "g");

  const m = re.exec(raw);
  if (!m) return null;

  const matchIndex = m.index;

  // Because token has multiple alternations, take the full matched string and split on dash.
  const matched = m[0];
  const parts = matched.split(new RegExp(`\\s*${DASH}\\s*`));
  if (parts.length !== 2) return null;

  const startParsed = parseDateTokenToComparable(parts[0]);
  const endParsed = parseDateTokenToComparable(parts[1]);
  if (!startParsed || !endParsed) return null;

  // Start comparable:
  // - If start token is year-only, treat as Jan of that year for ordering vs other starts.
  let startComparable = startParsed.comparable;
  const startIsYearOnly = /^\d{4}$/.test(normalizeWhitespace(parts[0]));
  if (startIsYearOnly) {
    const y = Number(parts[0].trim());
    startComparable = asComparableYYYYMM(y, 1);
  }

  // End comparable:
  // - If end token is year-only, parseDateTokenToComparable returns Dec already (good).
  const endComparable = endParsed.comparable;

  return {
    startComparable,
    endComparable,
    startDate: startParsed.normalized,
    endDate: endParsed.normalized,
    matchIndex,
  };
}

function splitTitleAndOrg(titleLine: string): { title: string; organization?: string } {
  const s = normalizeWhitespace(titleLine);

  // Common separators in resumes: "Title — Org", "Title - Org", "Title | Org", "Title, Org"
  const parts = s.split(/\s*(?:\||,|\s-\s|\s–\s|\s—\s|\s@\s|\sat\s)\s*/i).filter(Boolean);

  if (parts.length >= 2) {
    const title = parts[0].trim();
    const organization = parts[1].trim();
    if (title) return { title, organization: organization || undefined };
  }

  return { title: s };
}

function buildRawBlock(lines: string[], startIdx: number, hintIdx: number): string {
  // Deterministic block capture:
  // - start at startIdx
  // - include through the first blank line AFTER hintIdx, or up to 10 lines, whichever comes first
  const maxLines = 10;
  let endIdx = Math.min(lines.length - 1, startIdx + maxLines - 1);

  for (let i = Math.max(hintIdx, startIdx); i < lines.length; i++) {
    if (i > hintIdx && isBlankLine(lines[i])) {
      endIdx = i - 1;
      break;
    }
    if (i - startIdx + 1 >= maxLines) {
      endIdx = i;
      break;
    }
  }

  const block = lines.slice(startIdx, endIdx + 1).join("\n").trimEnd();
  return block;
}

function findPrevNonBlankLine(lines: string[], fromIndex: number): number | null {
  for (let i = fromIndex; i >= 0; i--) {
    if (!isBlankLine(lines[i])) return i;
  }
  return null;
}

function findExperienceSection(lines: string[]): { start: number; end: number } | null {
  let start = -1;

  for (let i = 0; i < lines.length; i++) {
    const t = lines[i].trim();
    if (/^(work experience|experience)$/i.test(t)) {
      start = i + 1;
      break;
    }
  }

  if (start === -1) return null;

  let end = lines.length - 1;
  for (let i = start; i < lines.length; i++) {
    if (i !== start && isHeadingLine(lines[i])) {
      end = i - 1;
      break;
    }
  }

  return { start, end };
}

function pickFirstRoleInExperienceSection(lines: string[], section: { start: number; end: number }): MostRecentRole | null {
  for (let i = section.start; i <= section.end; i++) {
    const line = lines[i];
    if (isBlankLine(line)) continue;
    if (isBulletLine(line)) continue;

    const t = normalizeWhitespace(line);
    if (!t) continue;

    // Heuristic (deterministic): choose the first non-bullet, non-heading line with letters.
    if (/[A-Za-z]/.test(t)) {
      const { title, organization } = splitTitleAndOrg(t);
      if (!title) continue;

      const rawBlock = buildRawBlock(lines, i, i);
      return {
        title,
        organization,
        rawBlock,
      };
    }
  }

  return null;
}

export function extractMostRecentRole(resumeText: string): MostRecentRole {
  const lines = (resumeText ?? "").replace(/\r\n/g, "\n").split("\n");

  type Candidate = {
    title: string;
    organization?: string;
    startDate?: string;
    endDate?: string;
    startComparable: number;
    endComparable: number;
    rawBlock: string;
    lineIndex: number;
  };

  const candidates: Candidate[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const dr = extractDateRangeFromLine(line);
    if (!dr) continue;

    // Identify the role/title line:
    // - If there is text BEFORE the matched date range on the same line, use that.
    // - Else use the previous non-blank line.
    let titleLineIndex: number | null = null;
    let titleLine = "";

    const before = normalizeWhitespace(line.slice(0, dr.matchIndex));
    if (before && /[A-Za-z]/.test(before)) {
      titleLineIndex = i;
      titleLine = before;
    } else {
      const prevIdx = findPrevNonBlankLine(lines, i - 1);
      if (prevIdx !== null) {
        titleLineIndex = prevIdx;
        titleLine = lines[prevIdx];
      }
    }

    titleLine = normalizeWhitespace(titleLine);
    if (!titleLine || !/[A-Za-z]/.test(titleLine)) continue;
    if (isHeadingLine(titleLine)) continue;

    const { title, organization } = splitTitleAndOrg(titleLine);
    if (!title) continue;

    const rawBlock = buildRawBlock(lines, titleLineIndex ?? i, i);

    candidates.push({
      title,
      organization,
      startDate: dr.startDate,
      endDate: dr.endDate,
      startComparable: dr.startComparable,
      endComparable: dr.endComparable,
      rawBlock,
      lineIndex: i,
    });
  }

  if (candidates.length > 0) {
    // Select role with most recent end date (Present treated as max).
    // Deterministic tie-breakers:
    // 1) higher endComparable
    // 2) higher startComparable
    // 3) lower lineIndex (earlier appearance)
    candidates.sort((a, b) => {
      if (b.endComparable !== a.endComparable) return b.endComparable - a.endComparable;
      if (b.startComparable !== a.startComparable) return b.startComparable - a.startComparable;
      return a.lineIndex - b.lineIndex;
    });

    const best = candidates[0];
    return {
      title: best.title,
      organization: best.organization,
      startDate: best.startDate,
      endDate: best.endDate,
      rawBlock: best.rawBlock,
    };
  }

  // Fallback path: Experience / Work Experience section, first role block.
  const section = findExperienceSection(lines);
  if (section) {
    const role = pickFirstRoleInExperienceSection(lines, section);
    if (role) return role;
  }

  const err: ResumeRoleExtractionError = {
    name: "ResumeRoleExtractionError",
    code: "NO_ROLE_DETECTED",
    detail: "Unable to detect most recent role from resume text.",
  };
  throw err;
}