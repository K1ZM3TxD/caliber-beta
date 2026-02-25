const { validateAndRepairSynthesisOnce } = require('../lib/calibration_machine');

const v: [1,1,1,1,1,1] = [1,1,1,1,1,1];
const signals = {} as any;

function assertOutcome(name: string, input: string, expectedOutcome: string) {
  const result = validateAndRepairSynthesisOnce(input, v, signals, { log: false });
  if (result.outcome !== expectedOutcome) {
    console.error(`FAIL: ${name} — expected ${expectedOutcome}, got ${result.outcome}`);
    process.exit(1);
  }
}

// These lines are the output of buildSafeMinimalLines(0, {})
const passInput = "You don't just do the work — you set operating rules.\n\nWhen something isn't working, you don't force it — you tighten constraints.\n\nYou notice, clarify, and sequence.";
console.log('DEBUG PASS INPUT:', JSON.stringify(passInput));
console.log('DEBUG PASS RESULT:', validateAndRepairSynthesisOnce(passInput, v, signals, { log: false }));
assertOutcome('PASS', passInput, 'PASS');

assertOutcome('REPAIR_APPLIED', "You don't just inspire—you plan.\n\nWhen something isn't working, plan.\n\nYou plan, build, and test.", 'REPAIR_APPLIED');


// --- Cadence starter mismatch: RETRY_REQUIRED on pass 0, fallback on pass 1 ---
const cadenceMismatch = "You just do the work — you set operating rules.\n\nWhen something isn't working, you force it — you tighten constraints.\n\nYou notice, clarify, and sequence.";


// 1) RETRY_REQUIRED reachable on pass 0
const { validateAndRepairSynthesisOnce: validateAndRepairSynthesisOnce2 } = require('../lib/calibration_machine');
const resultRetry = validateAndRepairSynthesisOnce2(cadenceMismatch, v, signals, { log: false });
if (resultRetry.outcome !== 'RETRY_REQUIRED') {
  console.error(`FAIL: RETRY_REQUIRED (cadence mismatch, pass 0) — expected RETRY_REQUIRED, got ${resultRetry.outcome}`);
  process.exit(1);
}
// Should NOT be replaced with safe minimal lines (should match the original input)
const safeMinimal = "You don't just do the work — you set operating rules.\n\nWhen something isn't working, you don't force it — you tighten constraints.\n\nYou notice, clarify, and sequence.";
if (resultRetry.patternSummary.trim() === safeMinimal.trim()) {
  console.error('FAIL: RETRY_REQUIRED (cadence mismatch, pass 0) — patternSummary was replaced with safe lines');
  process.exit(1);
}

// 2) Fallback on pass 1
const resultFallback = require('../lib/calibration_machine').validateAndRepairSynthesisOnce(cadenceMismatch, v, signals, { log: false, pass: 1 });
if (resultFallback.outcome !== 'FALLBACK_STRUCTURE_INVALID') {
  console.error(`FAIL: FALLBACK_STRUCTURE_INVALID (cadence mismatch, pass 1) — expected FALLBACK_STRUCTURE_INVALID, got ${resultFallback.outcome}`);
  process.exit(1);
}
// Should be replaced with safe minimal lines
if (resultFallback.patternSummary.trim() !== safeMinimal.trim()) {
  console.error('FAIL: FALLBACK_STRUCTURE_INVALID (cadence mismatch, pass 1) — patternSummary was not replaced with safe lines');
  process.exit(1);
}

assertOutcome('FALLBACK_BLACKLIST_PHRASE', "You don't just plan—you plan.\n\nWhen something isn't working, plan.\n\nYou plan, build, and operating model.", 'FALLBACK_BLACKLIST_PHRASE');

assertOutcome('FALLBACK_STRUCTURE_INVALID', "", 'FALLBACK_STRUCTURE_INVALID');

assertOutcome('FALLBACK_ANCHOR_FAILURE', "You don't just plan—you plan.\n\nWhen something isn't working, plan.\n\nYou plan, build, and forbiddenword.", 'FALLBACK_ANCHOR_FAILURE');

console.log('PASS: All validator outcomes reached deterministically.');
