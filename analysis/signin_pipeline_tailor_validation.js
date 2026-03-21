// Sign-in completion + Pipeline access + Tailor resolution validation
// Validates the fixes for beta blocker: sign-in hang + "Pipeline entry not found"

const results = [];
let pass = 0;
let fail = 0;

function assert(id, label, condition, detail) {
  const ok = !!condition;
  results.push({ id, label, ok, detail });
  if (ok) pass++;
  else fail++;
}

// ── 1. Sign-in page: error handling ──────────────────────────────────

(function validateSignIn() {
  const fs = require("fs");
  const src = fs.readFileSync("app/signin/page.tsx", "utf-8");

  // 1.01 — try/catch wrapping
  assert("1.01", "signIn calls wrapped in try/catch",
    src.includes("try {") && src.includes("catch (err)"),
    "try/catch prevents unhandled promise rejection from leaving UI stuck");

  // 1.02 — setSending(false) in catch
  assert("1.02", "setSending(false) in catch block",
    /catch\s*\(err\)[^}]*setSending\(false\)/s.test(src),
    "Always clears sending state on error");

  // 1.03 — authError state
  assert("1.03", "authError state for inline error display",
    src.includes("const [authError, setAuthError] = useState"),
    "Dedicated error state for auth failures");

  // 1.04 — error displayed in form
  assert("1.04", "authError displayed in form UI",
    src.includes("authError") && src.includes("text-red-400"),
    "Error message shown to user inline");

  // 1.05 — debug logging on sign-in start
  assert("1.05", "debug logging on sign-in start",
    src.includes('[Caliber][auth] sign-in start'),
    "Console debug for auth request start");

  // 1.06 — debug logging on beta-email result
  assert("1.06", "debug logging on beta-email result",
    src.includes('[Caliber][auth] beta-email result'),
    "Console debug for auth result/failure");

  // 1.07 — no provider fallback
  assert("1.07", "no-provider fallback shows error",
    src.includes("no provider available") && src.includes("temporarily unavailable"),
    "Edge case: no providers returns user-facing error");

  // 1.08 — magic-link error handling
  assert("1.08", "magic-link path inside try/catch",
    /try\s*\{[^]*?hasNodemailer[^]*?catch/s.test(src),
    "Nodemailer signIn also caught");

  // 1.09 — beta-email error message on failure
  assert("1.09", "beta-email shows error on result.ok false",
    src.includes("Sign-in failed. Please try again."),
    "Inline error for beta-email failures");

  // 1.10 — setAuthError cleared on new attempt
  assert("1.10", "authError cleared on new sign-in attempt",
    /setSending\(true\)[^]*setAuthError\(""\)/s.test(src),
    "Previous errors cleared before new attempt");
})();

// ── 2. resolveEntry: DB lookup for all users ─────────────────────────

(function validateResolveEntry() {
  const fs = require("fs");
  const src = fs.readFileSync("app/api/pipeline/tailor/route.ts", "utf-8");

  // 2.01 — DB lookup not behind auth guard
  assert("2.01", "DB lookup not gated behind userId",
    !(/if\s*\(userId\)\s*\{[^}]*dbPipelineGet/s.test(src)),
    "dbPipelineGet called unconditionally — fixes unauthenticated tailor");

  // 2.02 — Always check DB first (in function body, not imports)
  const fnBody = src.slice(src.indexOf("async function resolveEntry"));
  assert("2.02", "dbPipelineGet called before filePipelineGet",
    fnBody.indexOf("dbPipelineGet") < fnBody.indexOf("filePipelineGet"),
    "DB is primary store, file is legacy fallback");

  // 2.03 — sessionId resolved from entry
  assert("2.03", "sessionId from entry preserved",
    src.includes("entry.sessionId"),
    "Uses entry's own sessionId for tailor prep lookup");

  // 2.04 — linked session fallback
  assert("2.04", "linked caliberSession fallback for sessionId",
    src.includes("getLinkedCaliberSession"),
    "Falls back to stored linkage if entry has no sessionId");

  // 2.05 — debug logging on resolve
  assert("2.05", "debug logging on resolveEntry",
    src.includes("[Caliber][tailor] resolveEntry start"),
    "Entry lookup inputs logged");

  // 2.06 — warn on not found
  assert("2.06", "warning log on entry not found",
    src.includes("[Caliber][tailor] resolveEntry NOT FOUND"),
    "Failed lookups logged for debugging");
})();

// ── 3. Pipeline PATCH: ownership check ───────────────────────────────

(function validatePatch() {
  const fs = require("fs");
  const src = fs.readFileSync("app/api/pipeline/route.ts", "utf-8");

  // 3.01 — ownership allows null-userId entries
  assert("3.01", "PATCH allows entries with no userId (session-based)",
    src.includes("existing.userId && existing.userId !== session.user.id"),
    "Entries without userId pass ownership check (pre-migration entries)");

  // 3.02 — ownership failure logged
  assert("3.02", "PATCH ownership failure logged",
    src.includes("[Caliber][pipeline][PATCH] ownership check failed"),
    "Debug visibility for ownership rejections");
})();

// ── 4. Pipeline GET: debug logging ───────────────────────────────────

(function validatePipelineGet() {
  const fs = require("fs");
  const src = fs.readFileSync("app/api/pipeline/route.ts", "utf-8");

  // 4.01 — auth resolution logged
  assert("4.01", "GET auth resolution logged",
    src.includes("[Caliber][pipeline][GET] auth resolved"),
    "userId + sessionId logged on pipeline load");

  // 4.02 — resolved sessionId logged
  assert("4.02", "GET resolved sessionId logged",
    src.includes("[Caliber][pipeline][GET] resolved sessionId"),
    "Session linkage recovery logged");
})();

// ── 5. Auth module: debug logging ────────────────────────────────────

(function validateAuth() {
  const fs = require("fs");
  const src = fs.readFileSync("lib/auth.ts", "utf-8");

  // 5.01 — authorize logged
  assert("5.01", "beta-email authorize logged",
    src.includes("[Caliber][auth] beta-email authorize"),
    "Auth request logged in authorize callback");

  // 5.02 — user creation logged
  assert("5.02", "user creation logged",
    src.includes("[Caliber][auth] beta-email created user"),
    "New user creation logged");

  // 5.03 — user found logged
  assert("5.03", "existing user logged",
    src.includes("[Caliber][auth] beta-email found user"),
    "Existing user lookup logged");
})();

// ── 6. Pipeline page: client-side logging ────────────────────────────

(function validatePipelinePage() {
  const fs = require("fs");
  const src = fs.readFileSync("app/pipeline/page.tsx", "utf-8");

  // 6.01 — load debug log
  assert("6.01", "pipeline page load logged",
    src.includes("[Caliber][pipeline] loading"),
    "Client-side pipeline load logged");

  // 6.02 — entry count logged
  assert("6.02", "loaded entry count logged",
    src.includes("[Caliber][pipeline] loaded"),
    "Entry count logged after load");

  // 6.03 — HTTP error logged
  assert("6.03", "HTTP error on pipeline load logged",
    src.includes("[Caliber][pipeline] load HTTP error"),
    "Server errors during load visible");
})();

// ── 7. Migration integrity ───────────────────────────────────────────

(function validateMigration() {
  const fs = require("fs");
  const src = fs.readFileSync("lib/pipeline_store_db.ts", "utf-8");

  // 7.01 — session-to-user preserves sessionId
  assert("7.01", "migrateSessionEntriesToUser preserves sessionId",
    /data:\s*\{\s*userId\s*\}/.test(src) &&
    !(/migrateSessionEntriesToUser[^]*?sessionId:\s*null/s.test(src)),
    "Prisma update only sets userId, sessionId stays intact");

  // 7.02 — file-to-user preserves sessionId
  assert("7.02", "migrateFileEntriesToUser records sessionId",
    src.includes("sessionId: fe.sessionId"),
    "File entries migrated with sessionId preserved");
})();

// ── Report ───────────────────────────────────────────────────────────

console.log("\n╔══════════════════════════════════════════════════════════════╗");
console.log("║  SIGN-IN + PIPELINE + TAILOR VALIDATION                    ║");
console.log("╠══════════════════════════════════════════════════════════════╣");

for (const r of results) {
  const status = r.ok ? "PASS" : "FAIL";
  const icon = r.ok ? "✓" : "✗";
  console.log(`║  ${icon} ${r.id} ${status.padEnd(4)} │ ${r.label.slice(0, 48).padEnd(48)} ║`);
}

console.log("╠══════════════════════════════════════════════════════════════╣");
console.log(`║  TOTAL: ${pass}/${results.length} passed${" ".repeat(48 - String(pass).length - String(results.length).length)}║`);
if (fail > 0) {
  console.log("║  FAILURES:                                                  ║");
  for (const r of results.filter(r => !r.ok)) {
    console.log(`║    ${r.id}: ${r.detail.slice(0, 54).padEnd(54)} ║`);
  }
}
console.log("╚══════════════════════════════════════════════════════════════╝\n");

process.exit(fail > 0 ? 1 : 0);
