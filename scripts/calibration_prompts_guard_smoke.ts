// scripts/calibration_prompts_guard_smoke.ts

import { CALIBRATION_PROMPTS } from "@/lib/calibration_prompts"
import fs from "node:fs"
import path from "node:path"
import process from "node:process"

function assert(cond: any, msg: string) {
  if (!cond) throw new Error(msg)
}

const KERNEL_STRINGS: Record<1 | 2 | 3 | 4 | 5, string> = {
  1: "In your most recent role, what part of the work felt most like you?",
  2: "What part of the role drained you fastest?",
  3: "What do others come to you for that isn’t necessarily in your job description?",
  4: "What type of challenge feels exciting rather than overwhelming?",
  5: "If you removed job titles entirely, how would you describe the work you’re best at?",
}

for (let i = 1 as const; i <= 5; i = (i + 1) as any) {
  assert(CALIBRATION_PROMPTS[i] === KERNEL_STRINGS[i], `Prompt ${i} drifted from kernel`)
}

const ROOT = process.cwd()
const CANON_PATH = path.join(ROOT, "lib", "calibration_prompts.ts")

function walk(dir: string): string[] {
  const out: string[] = []
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  for (const e of entries) {
    if (e.name === "node_modules" || e.name === ".next" || e.name === ".git") continue
    const p = path.join(dir, e.name)
    if (e.isDirectory()) out.push(...walk(p))
    else out.push(p)
  }
  return out
}

const needles = Object.values(KERNEL_STRINGS)
const files = walk(ROOT)

for (const f of files) {
  if (f === CANON_PATH) continue
  if (!/\.(ts|tsx|js|jsx|md|txt|json)$/.test(f)) continue
  const txt = fs.readFileSync(f, "utf-8")
  for (const n of needles) {
    if (txt.includes(n)) {
      throw new Error(`Hardcoded calibration prompt found outside canonical module: ${path.relative(ROOT, f)}`)
    }
  }
}

console.log("OK: calibration prompts locked + no duplicates found.")