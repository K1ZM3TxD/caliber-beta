NEW FILE: scripts/prompt_drift_guard.ts

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { CALIBRATION_PROMPTS } from "@/lib/calibration_prompts";

type Finding = { file: string; needle: string };

const ROOT = process.cwd();
const CANON_REL = path.posix.join("lib", "calibration_prompts.ts");
const CANON_ABS = path.join(ROOT, "lib", "calibration_prompts.ts");

const IGNORE_DIRS = new Set([
  "node_modules",
  ".next",
  ".git",
  "dist",
  "build",
  "out",
  "coverage",
]);

const FAIL_NEEDLES: Array<{ label: string; re: RegExp }> = [
  { label: "reliably ship", re: /\breliably\s+ship\b/i },
  {
    label: "Prompt 1 drift string",
    re: /Prompt 1:\s*Describe the kind of work you reliably ship when you are operating at your best\./i,
  },
];

function isIgnoredDir(name: string): boolean {
  return IGNORE_DIRS.has(name);
}

function isTextFile(p: string): boolean {
  const ext = path.extname(p).toLowerCase();
  if (!ext) return true;
  if (ext === ".png" || ext === ".jpg" || ext === ".jpeg" || ext === ".gif" || ext === ".webp") return false;
  if (ext === ".ico" || ext === ".pdf" || ext === ".zip" || ext === ".gz" || ext === ".tgz") return false;
  if (ext === ".woff" || ext === ".woff2" || ext === ".ttf" || ext === ".otf") return false;
  return true;
}

function walk(dirAbs: string, out: string[]) {
  const entries = fs.readdirSync(dirAbs, { withFileTypes: true });
  for (const e of entries) {
    if (e.name.startsWith(".")) {
      if (e.name === ".env") continue;
    }
    const abs = path.join(dirAbs, e.name);
    if (e.isDirectory()) {
      if (isIgnoredDir(e.name)) continue;
      walk(abs, out);
      continue;
    }
    if (!e.isFile()) continue;
    out.push(abs);
  }
}

function readUtf8Safe(abs: string): string | null {
  try {
    const buf = fs.readFileSync(abs);
    if (buf.includes(0)) return null;
    return buf.toString("utf8");
  } catch {
    return null;
  }
}

function relPosix(abs: string): string {
  return path.relative(ROOT, abs).split(path.sep).join(path.posix.sep);
}

function main() {
  if (!fs.existsSync(CANON_ABS)) {
    console.error(`FAIL: missing canonical prompt module: ${CANON_REL}`);
    process.exit(1);
  }

  const allFiles: string[] = [];
  walk(ROOT, allFiles);

  const lockedPromptStrings = Object.values(CALIBRATION_PROMPTS);

  const findings: Finding[] = [];

  for (const abs of allFiles) {
    const rel = relPosix(abs);

    if (!isTextFile(rel)) continue;

    const txt = readUtf8Safe(abs);
    if (txt == null) continue;

    for (const n of FAIL_NEEDLES) {
      if (n.re.test(txt)) findings.push({ file: rel, needle: n.label });
    }

    if (rel === CANON_REL) continue;

    for (const s of lockedPromptStrings) {
      if (txt.includes(s)) {
        findings.push({ file: rel, needle: `locked prompt hardcoded: "${s}"` });
      }
    }
  }

  if (findings.length > 0) {
    console.error("FAIL: prompt drift guard triggered.");
    for (const f of findings) {
      console.error(`- ${f.file}: ${f.needle}`);
    }
    process.exit(1);
  }

  console.log("OK: prompt drift guard passed.");
}

main();