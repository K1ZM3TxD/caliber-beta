const { validateAndRepairSynthesisOnce } = require('./calibration_machine.ts');

const v: [1,1,1,1,1,1] = [1,1,1,1,1,1];
const signals = {} as any;

function testCase(name: string, input: string, expectedOutcome: string) {
  const result = validateAndRepairSynthesisOnce(input, v, signals, { log: false });
  console.log(`${name}:`, result.outcome === expectedOutcome ? 'PASS' : 'FAIL', result);
}

testCase('PASS', "You don't just plan—you plan.\nWhen something isn't working, plan.\nYou plan, build, and test.", 'PASS');

testCase('REPAIR_APPLIED', "You don't just inspire—you plan.\nWhen something isn't working, plan.\nYou plan, build, and test.", 'REPAIR_APPLIED');

testCase('RETRY_REQUIRED', "You don't just plan—you plan.\nWhen something isn't working, plan.\nYou plan, build, and plan and plan and plan.", 'RETRY_REQUIRED');

testCase('FALLBACK_BLACKLIST_PHRASE', "You don't just plan—you plan.\nWhen something isn't working, plan.\nYou plan, build, and operating model.", 'FALLBACK_BLACKLIST_PHRASE');

testCase('FALLBACK_STRUCTURE_INVALID', "", 'FALLBACK_STRUCTURE_INVALID');

testCase('FALLBACK_ANCHOR_FAILURE', "You don't just plan—you plan.\nWhen something isn't working, plan.\nYou plan, build, and forbiddenword.", 'FALLBACK_ANCHOR_FAILURE');
