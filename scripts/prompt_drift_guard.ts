// scripts/prompt_drift_guard.ts

import fs from "fs";
import path from "path";

const ROOT = process.cwd();
const SELF_GUARD_PATH = "scripts/prompt_drift_guard.ts";
const LOCKED_PROMPT_1 =
  "In your most recent role, what part of the work felt most like you?";
const DRIFT_STRING = "reliably ship";
const LOCKED_PROMPT_ALLOWLIST = new Set([
  path.normalize("lib/calibration_prompts.ts"),
  path.normalize("scripts/calibration_prompts_guard_smoke.ts"),
  path.normalize("Bootstrap/Archive/project_kernel.md"),
  path.normalize("Bootstrap/Archive/milestones.md"),
]);

function walk(dir: string, files: string[] = []): string[] {
  const entries = fs.readdirSync(dir);
  for (const entry of entries) {
    if (entry === "node_modules" || entry === ".next" || entry === ".git") continue;
    const full = path.join(dir, entry);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      walk(full, files);
    } else {
      files.push(full);
    }
  }
  return files;
}

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

const allFiles = walk(ROOT);

for (const file of allFiles) {
  const rel = path.relative(ROOT, file);
  const normalizedFilePath = path.normalize(file);
  if (normalizedFilePath.endsWith(path.normalize(SELF_GUARD_PATH))) {
    continue;
  }

  const content = fs.readFileSync(file, "utf8");

  if (content.includes(DRIFT_STRING)) {
    fail(`Drift string detected in ${rel}`);
  }

  if (
    content.includes(LOCKED_PROMPT_1) &&
    !LOCKED_PROMPT_ALLOWLIST.has(path.normalize(rel))
  ) {
    fail(`Locked prompt string must not appear outside lib/calibration_prompts.ts (${rel})`);
  }
}

console.log("Prompt drift guard passed.");