import { evaluateWorkMode, generateWorkRealitySummary } from '../lib/work_mode';
import { ALL_USERS, ALL_JOBS } from '../lib/__fixtures__/work_mode_fixtures';

const seen = new Map<string, string>();

for (const user of ALL_USERS) {
  for (const job of ALL_JOBS) {
    const wm = evaluateWorkMode(7.5, user.resumeText, user.promptAnswers, job.text);
    const summary = generateWorkRealitySummary(wm);
    const key = JSON.stringify({
      roleType: wm.roleType,
      compat: wm.compatibility,
      eeTriggered: wm.executionEvidence.triggered,
      eeCategories: [...wm.executionEvidence.categories].sort(),
      jMode: wm.jobMode.mode,
    });
    if (!seen.has(key)) seen.set(key, summary);
  }
}

console.log("=== ALL UNIQUE BRANCH OUTPUTS ===\n");
for (const [key, summary] of seen) {
  const k = JSON.parse(key);
  console.log(`[roleType=${k.roleType ?? "null"} compat=${k.compat} ee=${k.eeTriggered} cat=${k.eeCategories.join(",") || "-"} jMode=${k.jMode}]`);
  console.log(`  ${summary}`);
  console.log();
}
