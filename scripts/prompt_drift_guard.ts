// scripts/prompt_drift_guard.ts

import fs from "fs";
import path from "path";

const ROOT = process.cwd();
const LOCKED_PROMPT_1 =
  "In your most recent role, what part of the work felt most like you?";
const DRIFT_STRING = "reliably ship";

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
  const content = fs.readFileSync(file, "utf8");

  if (content.includes(DRIFT_STRING)) {
    fail(`Drift string detected in ${rel}`);
  }

  if (
    content.includes(LOCKED_PROMPT_1) &&
    rel !== path.normalize("lib/calibration_prompts.ts")
  ) {
    fail(`Locked prompt string must not appear outside lib/calibration_prompts.ts (${rel})`);
  }
}

console.log("Prompt drift guard passed.");