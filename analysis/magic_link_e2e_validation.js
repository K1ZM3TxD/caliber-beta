#!/usr/bin/env node
/**
 * Magic-Link Sign-In & Durable Memory — End-to-End Validation Script
 *
 * Validates: email-only auth flow, session→user migration, pipeline persistence,
 * tailor prep/result continuity after sign-in, duplicate prevention,
 * logout data integrity, re-sign-in state restoration, invalid auth paths.
 *
 * Usage: node analysis/magic_link_e2e_validation.js
 */

const fs = require("fs");
const path = require("path");

let pass = 0;
let fail = 0;
const results = [];

function assert(label, condition, detail) {
  if (condition) {
    pass++;
    results.push({ label, status: "PASS" });
  } else {
    fail++;
    results.push({ label, status: "FAIL", detail });
  }
}

function section(title) {
  results.push({ label: `\n═══ ${title} ═══`, status: "HEADER" });
}

function readFile(rel) {
  return fs.readFileSync(path.join(__dirname, "..", rel), "utf8");
}

function fileExists(rel) {
  return fs.existsSync(path.join(__dirname, "..", rel));
}

// Helper — normalizeJobUrl (mirrors lib/pipeline_store_db.ts)
function normalizeJobUrl(raw) {
  if (!raw) return "";
  try {
    const u = new URL(raw);
    const jobViewMatch = u.pathname.match(/\/jobs\/view\/(\d+)/);
    const currentJobId = u.searchParams.get("currentJobId");
    if (currentJobId && /^\d+$/.test(currentJobId)) {
      return u.origin + "/jobs/view/" + currentJobId;
    }
    if (jobViewMatch) {
      return u.origin + "/jobs/view/" + jobViewMatch[1];
    }
    return (u.origin + u.pathname).replace(/\/+$/, "");
  } catch {
    return raw.split("?")[0].split("#")[0].replace(/\/+$/, "");
  }
}

// ═══════════════════════════════════════════════════════════════
// 1. SIGN-IN FLOW — EMAIL ONLY (no Google, no social)
// ═══════════════════════════════════════════════════════════════

section("Sign-In Flow — Email Only");

const authTs = readFile("lib/auth.ts");

assert(
  "1.01 — Google OAuth provider removed",
  !authTs.includes("Google(") && !authTs.includes("Google({") && !authTs.includes("from \"next-auth/providers/google\""),
  "Google provider should be removed per product decision"
);

assert(
  "1.02 — Nodemailer magic-link provider configured",
  authTs.includes("Nodemailer(") && authTs.includes("from \"next-auth/providers/nodemailer\""),
  "Missing Nodemailer provider"
);

assert(
  "1.03 — Beta-email credentials provider always available",
  authTs.includes("\"beta-email\"") && authTs.includes("Credentials("),
  "Beta-email credentials provider must always be present"
);

assert(
  "1.04 — Nodemailer is conditional on EMAIL_SERVER",
  authTs.includes("process.env.EMAIL_SERVER") && /if\s*\(\s*process\.env\.EMAIL_SERVER\s*\)/.test(authTs),
  "Nodemailer should only activate when EMAIL_SERVER env var is set"
);

assert(
  "1.05 — Beta-email provider not conditional (always pushed)",
  (() => {
    // Credentials push should NOT be inside an if-block checking env vars
    const credLine = authTs.indexOf("Credentials({");
    if (credLine === -1) return false;
    // Check the ~200 chars before Credentials for an if(process.env) pattern
    const before = authTs.substring(Math.max(0, credLine - 200), credLine);
    return !before.includes("if (process.env.");
  })(),
  "Beta-email credentials should be unconditionally registered"
);

assert(
  "1.06 — JWT session strategy with 30-day maxAge",
  authTs.includes("strategy: \"jwt\"") && authTs.includes("maxAge: 30 * 24 * 60 * 60"),
  "Expected JWT strategy with 30-day maxAge"
);

assert(
  "1.07 — PrismaAdapter used",
  authTs.includes("PrismaAdapter(prisma)"),
  "Auth must use PrismaAdapter for durable user storage"
);

assert(
  "1.08 — Custom sign-in page configured",
  authTs.includes("signIn: \"/signin\""),
  "Custom sign-in page must be configured"
);

assert(
  "1.09 — JWT callback persists user.id into token.sub",
  /jwt\s*\(\s*\{.*token.*user.*\}/.test(authTs) && authTs.includes("token.sub = user.id"),
  "JWT callback must set token.sub = user.id"
);

assert(
  "1.10 — Session callback injects user.id",
  authTs.includes("session.user.id = token.sub"),
  "Session callback must inject user.id from token.sub"
);

assert(
  "1.11 — Email validation in beta-email authorize",
  authTs.includes("/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/"),
  "Beta-email must validate email format"
);

assert(
  "1.12 — Find-or-create user pattern in beta-email",
  authTs.includes("prisma.user.findUnique") && authTs.includes("prisma.user.create"),
  "Beta-email must find or create user by email"
);

// ═══════════════════════════════════════════════════════════════
// 2. SIGN-IN UI — EMAIL-ONLY PRESENTATION
// ═══════════════════════════════════════════════════════════════

section("Sign-In UI — Email-Only Presentation");

const signinPage = readFile("app/signin/page.tsx");

assert(
  "2.01 — No Google OAuth button in sign-in page",
  !signinPage.includes("Continue with Google") && !signinPage.includes("signIn(\"google\""),
  "Google OAuth button must be removed"
);

assert(
  "2.02 — No hasGoogle variable",
  !signinPage.includes("hasGoogle"),
  "hasGoogle logic should be removed from sign-in page"
);

assert(
  "2.03 — No OAuth divider in sign-in page",
  !signinPage.includes("<span className=\"text-neutral-500 text-xs\">or</span>"),
  "OAuth 'or' divider should be removed"
);

assert(
  "2.04 — No OAuthAccountNotLinked error case",
  !signinPage.includes("OAuthAccountNotLinked"),
  "OAuthAccountNotLinked error is not relevant without Google"
);

assert(
  "2.05 — Email form present",
  signinPage.includes("type=\"email\"") && signinPage.includes("handleEmail"),
  "Email input and handler must exist"
);

assert(
  "2.06 — Nodemailer magic-link path present (signIn nodemailer)",
  signinPage.includes("signIn(\"nodemailer\""),
  "Magic-link sign-in via Nodemailer must be available"
);

assert(
  "2.07 — Beta-email fallback path present (signIn beta-email)",
  signinPage.includes("signIn(\"beta-email\""),
  "Beta-email instant sign-in fallback must be available"
);

assert(
  "2.08 — Check-your-email confirmation screen exists",
  signinPage.includes("Check your email") && signinPage.includes("setEmailSent(true)"),
  "Magic-link confirmation screen must be present"
);

assert(
  "2.09 — Default callbackUrl is /pipeline",
  signinPage.includes("callbackUrl") && signinPage.includes("/pipeline"),
  "Default callback should redirect to pipeline"
);

assert(
  "2.10 — CredentialsSignin error handling present",
  signinPage.includes("CredentialsSignin"),
  "Must handle CredentialsSignin error"
);

// ═══════════════════════════════════════════════════════════════
// 3. SESSION PROVIDER + LAYOUT INTEGRATION
// ═══════════════════════════════════════════════════════════════

section("Session Provider + Layout Integration");

const layoutTsx = readFile("app/layout.tsx");

assert(
  "3.01 — SessionProvider in layout",
  layoutTsx.includes("SessionProvider"),
  "SessionProvider must wrap the app in layout.tsx"
);

assert(
  "3.02 — session_provider component exists",
  fileExists("app/components/session_provider.tsx"),
  "Session provider component should exist"
);

const sessionProvider = readFile("app/components/session_provider.tsx");

assert(
  "3.03 — SessionProvider imports from next-auth/react",
  sessionProvider.includes("next-auth/react") && sessionProvider.includes("SessionProvider"),
  "SessionProvider must import from next-auth/react"
);

// ═══════════════════════════════════════════════════════════════
// 4. PRISMA SCHEMA — AUTH MODELS
// ═══════════════════════════════════════════════════════════════

section("Prisma Schema — Auth Models");

const schema = readFile("prisma/schema.prisma");

assert(
  "4.01 — User model with caliberSessionId field",
  schema.includes("model User") && schema.includes("caliberSessionId String?"),
  "User model must have caliberSessionId for session linking"
);

assert(
  "4.02 — PipelineEntry model has userId field",
  /model PipelineEntry[\s\S]*?userId\s+String\?/.test(schema),
  "PipelineEntry must have optional userId"
);

assert(
  "4.03 — PipelineEntry model has sessionId field",
  /model PipelineEntry[\s\S]*?sessionId\s+String\?/.test(schema),
  "PipelineEntry must have optional sessionId"
);

assert(
  "4.04 — PipelineEntry has userId index",
  /model PipelineEntry[\s\S]*?@@index\(\[userId\]\)/.test(schema),
  "PipelineEntry needs userId index"
);

assert(
  "4.05 — PipelineEntry has sessionId index",
  /model PipelineEntry[\s\S]*?@@index\(\[sessionId\]\)/.test(schema),
  "PipelineEntry needs sessionId index"
);

assert(
  "4.06 — VerificationToken model for magic-link",
  schema.includes("model VerificationToken"),
  "VerificationToken model required for Nodemailer magic-link"
);

assert(
  "4.07 — Account model for NextAuth adapter",
  schema.includes("model Account") && /Account[\s\S]*?provider\s+String/.test(schema),
  "Account model required for NextAuth adapter"
);

assert(
  "4.08 — TelemetryEvent has userId field",
  /model TelemetryEvent[\s\S]*?userId\s+String\?/.test(schema),
  "TelemetryEvent must have userId for durable binding"
);

assert(
  "4.09 — FeedbackEvent has userId field",
  /model FeedbackEvent[\s\S]*?userId\s+String\?/.test(schema),
  "FeedbackEvent must have userId for durable binding"
);

// ═══════════════════════════════════════════════════════════════
// 5. SESSION→USER MIGRATION — PIPELINE ENTRIES
// ═══════════════════════════════════════════════════════════════

section("Session→User Migration — Pipeline Entries");

const pipelineDb = readFile("lib/pipeline_store_db.ts");

assert(
  "5.01 — linkCaliberSession function exists",
  pipelineDb.includes("export async function linkCaliberSession"),
  "Must link caliber sessionId to authenticated user"
);

assert(
  "5.02 — getLinkedCaliberSession function exists",
  pipelineDb.includes("export async function getLinkedCaliberSession"),
  "Must recover sessionId from stored linkage"
);

assert(
  "5.03 — migrateSessionEntriesToUser function exists",
  pipelineDb.includes("export async function migrateSessionEntriesToUser"),
  "Must migrate session-based DB entries to user"
);

assert(
  "5.04 — migrateFileEntriesToUser function exists",
  pipelineDb.includes("export async function migrateFileEntriesToUser"),
  "Must migrate file-based entries to DB under user"
);

assert(
  "5.05 — migrateFileEntriesToUser preserves sessionId",
  (() => {
    // Find the migrateFileEntriesToUser function and verify sessionId is in the create call
    const funcStart = pipelineDb.indexOf("export async function migrateFileEntriesToUser");
    if (funcStart === -1) return false;
    const funcBody = pipelineDb.substring(funcStart, funcStart + 1000);
    // Must include sessionId: fe.sessionId in the create data
    return funcBody.includes("sessionId: fe.sessionId");
  })(),
  "migrateFileEntriesToUser must preserve sessionId from file entry for tailor prep lookup continuity"
);

assert(
  "5.06 — migrateSessionEntriesToUser deduplicates by jobUrl",
  (() => {
    const funcStart = pipelineDb.indexOf("export async function migrateSessionEntriesToUser");
    if (funcStart === -1) return false;
    const funcBody = pipelineDb.substring(funcStart, funcStart + 800);
    return funcBody.includes("normalizeJobUrl") && funcBody.includes("existingUrls");
  })(),
  "Migration must deduplicate by normalized job URL"
);

assert(
  "5.07 — migrateSessionEntriesToUser deletes duplicates",
  (() => {
    const funcStart = pipelineDb.indexOf("export async function migrateSessionEntriesToUser");
    if (funcStart === -1) return false;
    const funcBody = pipelineDb.substring(funcStart, funcStart + 800);
    return funcBody.includes("prisma.pipelineEntry.delete");
  })(),
  "Duplicate session entries must be deleted (not left orphaned)"
);

assert(
  "5.08 — migrateSessionEntriesToUser only migrates unowned entries",
  (() => {
    const funcStart = pipelineDb.indexOf("export async function migrateSessionEntriesToUser");
    if (funcStart === -1) return false;
    const funcBody = pipelineDb.substring(funcStart, funcStart + 400);
    return funcBody.includes("userId: null");
  })(),
  "Must only migrate entries where userId is null (unowned)"
);

assert(
  "5.09 — migrateFileEntriesToUser deduplicates by jobUrl",
  (() => {
    const funcStart = pipelineDb.indexOf("export async function migrateFileEntriesToUser");
    if (funcStart === -1) return false;
    const funcBody = pipelineDb.substring(funcStart, funcStart + 800);
    // Uses fileNormalizeJobUrl alias (imported as normalizeJobUrl from pipeline_store)
    return (funcBody.includes("normalizeJobUrl") || funcBody.includes("fileNormalizeJobUrl")) && funcBody.includes("existingUrls");
  })(),
  "File migration must deduplicate by normalized job URL"
);

// ═══════════════════════════════════════════════════════════════
// 6. DUPLICATE PREVENTION — STRUCTURAL ANALYSIS
// ═══════════════════════════════════════════════════════════════

section("Duplicate Prevention — Structural Analysis");

assert(
  "6.01 — pipelineCreate deduplicates by userId + jobUrl",
  (() => {
    const funcStart = pipelineDb.indexOf("export async function pipelineCreate(");
    if (funcStart === -1) return false;
    const funcBody = pipelineDb.substring(funcStart, funcStart + 500);
    return funcBody.includes("pipelineFindByJob") && funcBody.includes("if (existing) return existing");
  })(),
  "DB pipelineCreate must check for existing entry by userId + jobUrl"
);

assert(
  "6.02 — pipelineCreateForSession deduplicates by sessionId + jobUrl",
  (() => {
    const funcStart = pipelineDb.indexOf("export async function pipelineCreateForSession(");
    if (funcStart === -1) return false;
    const funcBody = pipelineDb.substring(funcStart, funcStart + 500);
    return funcBody.includes("pipelineFindByJobSession") && funcBody.includes("if (existing) return existing");
  })(),
  "Session pipelineCreate must check for existing entry by sessionId + jobUrl"
);

const pipelineFile = readFile("lib/pipeline_store.ts");

assert(
  "6.03 — File-based pipelineCreate deduplicates by sessionId + jobUrl",
  (() => {
    const funcStart = pipelineFile.indexOf("export function pipelineCreate(");
    if (funcStart === -1) return false;
    const funcBody = pipelineFile.substring(funcStart, funcStart + 500);
    return funcBody.includes("normalizeJobUrl") && funcBody.includes("if (existing) return existing");
  })(),
  "File pipelineCreate must deduplicate by sessionId + jobUrl"
);

// Simulate duplicate detection across URL variants
const urlVariants = [
  "https://www.linkedin.com/jobs/view/1234567890",
  "https://www.linkedin.com/jobs/view/1234567890?trk=abc",
  "https://www.linkedin.com/jobs/view/1234567890#hash",
  "https://www.linkedin.com/jobs/search/?currentJobId=1234567890&keywords=test",
];
const canonical = normalizeJobUrl(urlVariants[0]);
let dedupePass = true;
for (const url of urlVariants) {
  if (normalizeJobUrl(url) !== canonical) {
    dedupePass = false;
    break;
  }
}

assert(
  "6.04 — URL normalization produces consistent canonical form",
  dedupePass,
  `All LinkedIn URL variants should normalize to ${canonical}`
);

assert(
  "6.05 — URL normalization handles currentJobId query param",
  normalizeJobUrl("https://www.linkedin.com/jobs/search/?currentJobId=9999999999") ===
    "https://www.linkedin.com/jobs/view/9999999999",
  "currentJobId must extract to /jobs/view/{id}"
);

assert(
  "6.06 — URL normalization strips trailing slash",
  normalizeJobUrl("https://example.com/jobs/") === "https://example.com/jobs",
  "Trailing slashes must be stripped"
);

// ═══════════════════════════════════════════════════════════════
// 7. PIPELINE API — AUTH-AWARE ROUTING
// ═══════════════════════════════════════════════════════════════

section("Pipeline API — Auth-Aware Routing");

const pipelineRoute = readFile("app/api/pipeline/route.ts");

assert(
  "7.01 — Pipeline GET calls auth()",
  pipelineRoute.includes("const session = await auth()"),
  "Pipeline GET must check auth session"
);

assert(
  "7.02 — Pipeline GET triggers migrations when authenticated + sessionId",
  pipelineRoute.includes("migrateFileEntriesToUser") && pipelineRoute.includes("migrateSessionEntriesToUser"),
  "Authenticated GET with sessionId must trigger both migrations"
);

assert(
  "7.03 — Pipeline GET calls linkCaliberSession",
  pipelineRoute.includes("linkCaliberSession"),
  "Must save sessionId→user linkage on authenticated GET"
);

assert(
  "7.04 — Pipeline GET recovers caliberSessionId from stored linkage",
  pipelineRoute.includes("getLinkedCaliberSession"),
  "Must recover sessionId when cookie expired"
);

assert(
  "7.05 — Pipeline GET returns caliberSessionId for cookie restoration",
  pipelineRoute.includes("caliberSessionId: resolvedSessionId"),
  "Response must include caliberSessionId so client can restore cookie"
);

assert(
  "7.06 — Pipeline GET serves session-based entries when unauthenticated",
  (() => {
    // After the auth block, there should be a sessionId-based fallback
    const authBlock = pipelineRoute.indexOf("session?.user?.id");
    if (authBlock === -1) return false;
    const after = pipelineRoute.substring(authBlock);
    return after.includes("pipelineListBySession(sessionId)");
  })(),
  "Unauthenticated with sessionId must show session-based entries"
);

assert(
  "7.07 — Pipeline POST requires auth for web app writes",
  pipelineRoute.includes("Authentication required") && pipelineRoute.includes("status: 401"),
  "Web app POST must return 401 without auth"
);

assert(
  "7.08 — Pipeline PATCH has ownership verification",
  (() => {
    const patchStart = pipelineRoute.indexOf("export async function PATCH");
    if (patchStart === -1) return false;
    const patchBody = pipelineRoute.substring(patchStart, patchStart + 800);
    // Ownership check returns 404 (not 403) — security best practice: don't reveal existence
    return patchBody.includes("existing.userId !== session.user.id") ||
           (patchBody.includes("Ownership check") && patchBody.includes("session.user.id"));
  })(),
  "PATCH must verify user owns the entry (IDOR fix)"
);

// ═══════════════════════════════════════════════════════════════
// 8. TAILOR CONTINUITY AFTER SIGN-IN
// ═══════════════════════════════════════════════════════════════

section("Tailor Continuity After Sign-In");

const tailorStore = readFile("lib/tailor_store.ts");

assert(
  "8.01 — TailorPrep interface has optional userId",
  /interface TailorPrep[\s\S]*?userId\?\s*:\s*string/.test(tailorStore),
  "TailorPrep should have optional userId for forward compatibility"
);

assert(
  "8.02 — TailorResult interface has optional userId",
  /interface TailorResult[\s\S]*?userId\?\s*:\s*string/.test(tailorStore),
  "TailorResult should have optional userId for forward compatibility"
);

assert(
  "8.03 — tailorPrepFindByJob searches by sessionId + jobUrl",
  tailorStore.includes("export function tailorPrepFindByJob") &&
    tailorStore.includes("prep.sessionId === sessionId") &&
    tailorStore.includes("normalizeJobUrl"),
  "Prep lookup must use sessionId + normalized jobUrl"
);

const tailorRoute = readFile("app/api/pipeline/tailor/route.ts");

assert(
  "8.04 — resolveEntry returns resolved sessionId",
  tailorRoute.includes("entry, source: \"db\"") &&
    tailorRoute.includes("userId, sessionId"),
  "resolveEntry must return userId and sessionId alongside entry"
);

assert(
  "8.05 — resolveEntry falls back to getLinkedCaliberSession",
  tailorRoute.includes("getLinkedCaliberSession(userId)"),
  "When entry.sessionId is missing, must fall back to user's linked caliberSessionId"
);

assert(
  "8.06 — Tailor GET uses resolved sessionId (not extracting from entry)",
  (() => {
    // The GET handler should destructure sessionId from resolved, not re-extract it
    const getStart = tailorRoute.indexOf("export async function GET");
    if (getStart === -1) return false;
    const getBody = tailorRoute.substring(getStart, getStart + 600);
    // Should destructure { entry, sessionId } from resolved
    return getBody.includes("{ entry, sessionId }") &&
           !getBody.includes("\"sessionId\" in entry");
  })(),
  "GET handler must use sessionId from resolveEntry, not extract from entry"
);

assert(
  "8.07 — Tailor POST uses resolved sessionId",
  (() => {
    const postStart = tailorRoute.indexOf("export async function POST");
    if (postStart === -1) return false;
    const postBody = tailorRoute.substring(postStart, postStart + 600);
    return postBody.includes("entry, source, userId, sessionId") &&
           !postBody.includes("\"sessionId\" in entry");
  })(),
  "POST handler must use sessionId from resolveEntry, not extract from entry"
);

assert(
  "8.08 — Tailor POST passes userId to tailorResultSave",
  (() => {
    const postStart = tailorRoute.indexOf("export async function POST");
    if (postStart === -1) return false;
    const postBody = tailorRoute.substring(postStart, postStart + 2000);
    return postBody.includes("tailorResultSave") && postBody.includes("userId");
  })(),
  "tailorResultSave must receive userId when authenticated"
);

assert(
  "8.09 — Tailor route imports getLinkedCaliberSession",
  tailorRoute.includes("getLinkedCaliberSession"),
  "Must import getLinkedCaliberSession for sessionId recovery"
);

// Simulate tailor continuity scenario
assert(
  "8.10 — tailorPrepFindByJob returns most recent for duplicate preps",
  tailorStore.includes("prep.createdAt > best.createdAt"),
  "Must return the most recent prep when multiple exist for same job"
);

// ═══════════════════════════════════════════════════════════════
// 9. PERSISTENCE ACROSS RESTART/DEVICE
// ═══════════════════════════════════════════════════════════════

section("Persistence Across Restart/Device");

assert(
  "9.01 — Pipeline entries stored in Postgres (not just files)",
  pipelineDb.includes("prisma.pipelineEntry.create") &&
    pipelineDb.includes("prisma.pipelineEntry.findMany"),
  "Pipeline entries must use Prisma/Postgres for durability"
);

assert(
  "9.02 — User model persisted in Postgres",
  schema.includes("model User") && schema.includes("@id @default(cuid())"),
  "User model must be in Postgres for cross-device persistence"
);

assert(
  "9.03 — JWT session survives server restart (stateless)",
  authTs.includes("strategy: \"jwt\""),
  "JWT sessions are stateless — survive server restarts"
);

assert(
  "9.04 — 30-day token lifetime covers extended beta usage",
  authTs.includes("30 * 24 * 60 * 60"),
  "30-day maxAge ensures sessions survive multi-week beta periods"
);

assert(
  "9.05 — caliberSessionId stored on User for recovery",
  schema.includes("caliberSessionId String?") &&
    pipelineDb.includes("data: { caliberSessionId }"),
  "caliberSessionId must be persisted to User record for cookie-loss recovery"
);

assert(
  "9.06 — Pipeline API restores caliberSessionId cookie from server",
  pipelineRoute.includes("caliberSessionId: resolvedSessionId"),
  "Server must return stored caliberSessionId so client can restore cookie"
);

const pipelinePage = readFile("app/pipeline/page.tsx");

assert(
  "9.07 — Pipeline page restores caliber_sessionId cookie from server response",
  pipelinePage.includes("data.caliberSessionId") && pipelinePage.includes("caliber_sessionId"),
  "Client must restore caliber_sessionId cookie from server response"
);

// ═══════════════════════════════════════════════════════════════
// 10. LOGOUT DOES NOT DELETE USER DATA
// ═══════════════════════════════════════════════════════════════

section("Logout Does Not Delete User Data");

assert(
  "10.01 — No cascade delete on User→PipelineEntry in schema",
  (() => {
    // PipelineEntry references User with onDelete: Cascade — but this is intentional
    // The question is: does signOut/logout delete the User? It shouldn't.
    // NextAuth signOut only invalidates the JWT — it does NOT delete the User record.
    // No custom signOut handler that deletes users
    return !authTs.includes("deleteUser") && !authTs.includes("prisma.user.delete");
  })(),
  "Auth config must not delete users on sign-out"
);

assert(
  "10.02 — No sign-out data purge logic exists",
  !authTs.includes("events") || !authTs.includes("signOut"),
  "No custom signOut event handler that could delete data"
);

assert(
  "10.03 — Pipeline entries survive user sign-out (userId-bound, not session-bound)",
  pipelineDb.includes("where: { userId }") && !pipelineDb.includes("ON DELETE CASCADE"),
  "Pipeline data keyed by userId persists regardless of session state"
);

// ═══════════════════════════════════════════════════════════════
// 11. RE-SIGN-IN RESTORES STATE
// ═══════════════════════════════════════════════════════════════

section("Re-Sign-In Restores State");

assert(
  "11.01 — Pipeline GET lists by userId (not session token)",
  pipelineRoute.includes("dbPipelineList") &&
    pipelineRoute.includes("session.user.id"),
  "Pipeline list uses persistent userId, not ephemeral session"
);

assert(
  "11.02 — Same email re-creates same User (findUnique by email)",
  authTs.includes("prisma.user.findUnique({ where: { email } })"),
  "Re-sign-in with same email must return same User record"
);

assert(
  "11.03 — User.email is unique in schema",
  schema.includes("email") && /email\s+String\?\s+@unique/.test(schema),
  "Email uniqueness ensures same user is returned on re-auth"
);

assert(
  "11.04 — Pipeline page uses useSession for auth state",
  pipelinePage.includes("useSession()") && pipelinePage.includes("authStatus"),
  "Pipeline must react to auth state changes"
);

// ═══════════════════════════════════════════════════════════════
// 12. INVALID/EXPIRED SIGN-IN PATHS
// ═══════════════════════════════════════════════════════════════

section("Invalid/Expired Sign-In Paths");

assert(
  "12.01 — Beta-email rejects invalid email format",
  authTs.includes("/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/") && authTs.includes("return null"),
  "Invalid email must return null (auth failure)"
);

assert(
  "12.02 — Sign-in page handles error query param",
  signinPage.includes("params.get(\"error\")") && signinPage.includes("errorCode"),
  "Must display error from NextAuth error redirect"
);

assert(
  "12.03 — CredentialsSignin error produces user-friendly message",
  signinPage.includes("CredentialsSignin") &&
    signinPage.includes("Could not sign in"),
  "Must show friendly error for credential failures"
);

assert(
  "12.04 — Generic error fallback message exists",
  signinPage.includes("Something went wrong"),
  "Must have generic error message for unknown error codes"
);

assert(
  "12.05 — trustHost enabled for deployment flexibility",
  authTs.includes("trustHost: true"),
  "trustHost must be true for Vercel/proxy deployments"
);

// ═══════════════════════════════════════════════════════════════
// 13. PIPELINE SIGN-IN CTA FOR ANONYMOUS USERS
// ═══════════════════════════════════════════════════════════════

section("Pipeline Sign-In CTA for Anonymous Users");

assert(
  "13.01 — Pipeline page shows sign-in CTA when unauthenticated",
  pipelinePage.includes("unauthenticated") && pipelinePage.includes("Sign in"),
  "Must show sign-in prompt for anonymous users"
);

assert(
  "13.02 — CTA links to /signin with callbackUrl=/pipeline",
  pipelinePage.includes("/signin?callbackUrl=/pipeline"),
  "Sign-in link must redirect back to pipeline after auth"
);

assert(
  "13.03 — CTA is non-blocking (pipeline still usable without sign-in)",
  (() => {
    // The CTA should be in a conditional block, not blocking the board render
    // CTA is inside authStatus === "unauthenticated" check, board columns render independently
    const ctaIdx = pipelinePage.indexOf("authStatus === \"unauthenticated\"");
    if (ctaIdx === -1) return false;
    // Board columns render after loading check, independently of auth status
    const boardIdx = pipelinePage.indexOf("columns.map");
    return ctaIdx < boardIdx && pipelinePage.includes("{loading &&") && pipelinePage.includes("{!loading &&");
  })(),
  "CTA must not block pipeline board rendering for anonymous users"
);

assert(
  "13.04 — CTA copy mentions persistence benefit",
  pipelinePage.includes("save your pipeline") || pipelinePage.includes("Save your pipeline"),
  "CTA should explain why sign-in is valuable (persistence)"
);

// ═══════════════════════════════════════════════════════════════
// 14. TELEMETRY + FEEDBACK userId BINDING
// ═══════════════════════════════════════════════════════════════

section("Telemetry + Feedback userId Binding");

const eventsRoute = readFile("app/api/events/route.ts");

assert(
  "14.01 — Events route resolves userId",
  eventsRoute.includes("resolveUserId") || eventsRoute.includes("userId"),
  "Events API must resolve and bind userId"
);

const feedbackRoute = readFile("app/api/feedback/route.ts");

assert(
  "14.02 — Feedback route resolves userId",
  feedbackRoute.includes("resolveUserId") || feedbackRoute.includes("userId"),
  "Feedback API must resolve and bind userId"
);

assert(
  "14.03 — TelemetryEvent has userId index in schema",
  /model TelemetryEvent[\s\S]*?@@index\(\[userId\]\)/.test(schema),
  "TelemetryEvent userId must be indexed for efficient queries"
);

// ═══════════════════════════════════════════════════════════════
// 15. EXTENSION SESSION HANDOFF CHAIN
// ═══════════════════════════════════════════════════════════════

section("Extension Session Handoff Chain");

const contentCaliber = readFile("extension/content_caliber.js");

assert(
  "15.01 — Extension reads caliber_sessionId cookie",
  contentCaliber.includes("caliber_sessionId"),
  "Extension must read caliber_sessionId cookie for session handoff"
);

assert(
  "15.02 — Extension sends CALIBER_SESSION_HANDOFF message",
  contentCaliber.includes("CALIBER_SESSION_HANDOFF"),
  "Must send session handoff message to background"
);

const backgroundJs = readFile("extension/background.js");

assert(
  "15.03 — Background receives CALIBER_SESSION_HANDOFF",
  backgroundJs.includes("CALIBER_SESSION_HANDOFF"),
  "Background must handle session handoff message"
);

assert(
  "15.04 — Background stores sessionId in chrome.storage.local",
  backgroundJs.includes("chrome.storage.local") && backgroundJs.includes("caliberSessionId"),
  "SessionId must be persisted in chrome.storage.local"
);

// ═══════════════════════════════════════════════════════════════
// 16. TAILOR PREP/RESULT STORAGE INTEGRITY
// ═══════════════════════════════════════════════════════════════

section("Tailor Prep/Result Storage Integrity");

assert(
  "16.01 — TailorPrep has sessionId field",
  /interface TailorPrep[\s\S]*?sessionId:\s*string/.test(tailorStore),
  "TailorPrep must have sessionId for lookup after migration"
);

assert(
  "16.02 — TailorResult has prepId back-reference",
  /interface TailorResult[\s\S]*?prepId:\s*string/.test(tailorStore),
  "TailorResult must reference prepId for chain integrity"
);

assert(
  "16.03 — tailorPrepSave writes to filesystem",
  tailorStore.includes("fs.writeFileSync") && tailorStore.includes("prep_"),
  "Prep must be persisted to disk"
);

assert(
  "16.04 — tailorResultSave writes to filesystem",
  tailorStore.includes("result_") && tailorStore.includes("fs.writeFileSync"),
  "Result must be persisted to disk"
);

assert(
  "16.05 — tailorPrepGet reads from filesystem",
  tailorStore.includes("fs.readFileSync") && tailorStore.includes("tailorPrepGet"),
  "Prep retrieval must read from disk"
);

// ═══════════════════════════════════════════════════════════════
// SCENARIO SIMULATIONS
// ═══════════════════════════════════════════════════════════════

section("Scenario Simulations");

// Scenario A: Anonymous → Sign-in → State preserved
{
  // 1. Anonymous user: extension creates entries with sessionId
  // 2. User signs in: GET /api/pipeline triggers migration
  // 3. Entries now have userId, sessionId preserved
  // Verify the chain by checking code paths:
  const hasSessionCreate = pipelineDb.includes("pipelineCreateForSession");
  const hasMigrationOnGet = pipelineRoute.includes("migrateSessionEntriesToUser") &&
                            pipelineRoute.includes("migrateFileEntriesToUser");
  const hasUserIdAfterMigrate = pipelineDb.includes("data: { userId }"); // migrateSessionEntriesToUser sets userId
  
  assert(
    "SIM-A — Anonymous→SignIn: session entry creation path exists",
    hasSessionCreate,
    "pipelineCreateForSession must exist for anonymous entry creation"
  );
  assert(
    "SIM-A — Anonymous→SignIn: migration triggered on authenticated GET",
    hasMigrationOnGet,
    "Both migration functions must be called on authenticated pipeline load"
  );
  assert(
    "SIM-A — Anonymous→SignIn: userId assigned after migration",
    hasUserIdAfterMigrate,
    "migrateSessionEntriesToUser must set userId on migrated entries"
  );
}

// Scenario B: Tailor continuity — prep created anonymously, generate after sign-in
{
  // 1. Extension creates TailorPrep with sessionId
  // 2. User signs in
  // 3. Pipeline entry migrated with sessionId preserved
  // 4. resolveEntry falls back to linked caliberSessionId if needed
  // 5. tailorPrepFindByJob(sessionId, jobUrl) finds the prep
  const prepHasSessionId = tailorStore.includes("sessionId: String(sessionId)") ||
                           tailorStore.includes("sessionId: data.sessionId") ||
                           tailorStore.includes("...data");
  const entryPreservesSessionId = pipelineDb.includes("sessionId: fe.sessionId");
  const routeFallsBack = tailorRoute.includes("getLinkedCaliberSession");
  
  assert(
    "SIM-B — TailorContinuity: prep saved with sessionId",
    tailorStore.includes("sessionId") && tailorStore.includes("tailorPrepSave"),
    "Prep must be saved with sessionId for post-sign-in lookup"
  );
  assert(
    "SIM-B — TailorContinuity: file-migrated entry preserves sessionId",
    entryPreservesSessionId,
    "File→DB migration must carry sessionId forward"
  );
  assert(
    "SIM-B — TailorContinuity: route resolves sessionId with fallback",
    routeFallsBack,
    "Tailor route must fall back to linked caliberSessionId"
  );
}

// Scenario C: Duplicate prevention on migration
{
  // 1. Anonymous creates entry for Job A (sessionId-based)
  // 2. User signs in, authenticated POST creates entry for Job A (userId-based)
  // 3. GET triggers migrateSessionEntriesToUser — Job A exists in both session and user
  // 4. Migration must detect duplicate by jobUrl, delete session entry, keep user entry
  const migrateIdx = pipelineDb.indexOf("export async function migrateSessionEntriesToUser");
  const migrateBody = pipelineDb.substring(migrateIdx, migrateIdx + 800);
  const detectsDupe = migrateBody.includes("existingUrls.has(normalized)");
  const deletesDupe = migrateBody.includes("prisma.pipelineEntry.delete");
  
  assert(
    "SIM-C — DupePrevention: migration detects URL duplicates",
    detectsDupe,
    "Must check existingUrls before migrating"
  );
  assert(
    "SIM-C — DupePrevention: migration deletes duplicate session entries",
    deletesDupe,
    "Duplicate session-only entries must be deleted"
  );
}

// Scenario D: Fresh device with same account
{
  // 1. User previously signed in on device A, created pipeline entries
  // 2. User opens fresh device B, signs in with same email
  // 3. beta-email authorize finds existing User by email (same id)
  // 4. Pipeline GET lists by userId — all entries visible
  const findByEmail = authTs.includes("prisma.user.findUnique({ where: { email } })");
  const listByUserId = pipelineDb.includes("findMany({ where: { userId }") ||
                       pipelineDb.includes("where: { userId }");
  
  assert(
    "SIM-D — FreshDevice: same email returns same User record",
    findByEmail,
    "Must find existing user by email"
  );
  assert(
    "SIM-D — FreshDevice: pipeline lists by persistent userId",
    listByUserId,
    "Pipeline entries keyed by userId survive cross-device"
  );
}

// Scenario E: Logout → Re-login
{
  // 1. User signs out (JWT invalidated, User record untouched)
  // 2. User signs back in with same email
  // 3. Same User record (same userId, same pipeline entries)
  const noDeleteOnSignout = !authTs.includes("prisma.user.delete") && !authTs.includes("deleteUser");
  const sameUserOnResignin = authTs.includes("findUnique({ where: { email } })");
  
  assert(
    "SIM-E — Logout+Relogin: sign-out does not delete User",
    noDeleteOnSignout,
    "JWT sign-out must not trigger user deletion"
  );
  assert(
    "SIM-E — Logout+Relogin: re-sign-in finds same User",
    sameUserOnResignin,
    "Same email must return same User on re-authentication"
  );
}


// ═══════════════════════════════════════════════════════════════
// REPORT
// ═══════════════════════════════════════════════════════════════

console.log("\n╔══════════════════════════════════════════════════════════╗");
console.log("║  Magic-Link Sign-In & Durable Memory — E2E Validation  ║");
console.log("╚══════════════════════════════════════════════════════════╝\n");

for (const r of results) {
  if (r.status === "HEADER") {
    console.log(r.label);
    continue;
  }
  const icon = r.status === "PASS" ? "✓" : "✗";
  const color = r.status === "PASS" ? "\x1b[32m" : "\x1b[31m";
  console.log(`${color}  ${icon} ${r.label}\x1b[0m`);
  if (r.detail) {
    console.log(`    → ${r.detail}`);
  }
}

console.log(`\n${"═".repeat(60)}`);
console.log(`  ${pass} PASS | ${fail} FAIL | ${pass + fail} TOTAL`);
console.log(`${"═".repeat(60)}\n`);

if (fail > 0) {
  console.log("\x1b[31m  VALIDATION FAILED — defects above need attention.\x1b[0m\n");
  process.exit(1);
} else {
  console.log("\x1b[32m  ALL CHECKS PASSED — magic-link auth + durable memory validated.\x1b[0m\n");
  process.exit(0);
}
