#!/usr/bin/env node
/**
 * Auth Gate (Beta Gate 4) — Validation Script
 *
 * Validates: sign-in system, session→user migration, pipeline persistence,
 * telemetry userId binding, feedback userId binding.
 *
 * Usage: node analysis/auth_gate_validation.js
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

function readFile(rel) {
  return fs.readFileSync(path.join(__dirname, "..", rel), "utf8");
}

function fileExists(rel) {
  return fs.existsSync(path.join(__dirname, "..", rel));
}

// ═══════════════════════════════════════════════════════════════
// 1. AUTH CONFIGURATION
// ═══════════════════════════════════════════════════════════════

const authTs = readFile("lib/auth.ts");

assert(
  "1.01 — auth.ts exists and exports auth/handlers",
  /export\s+(const|function).*\{.*handlers.*auth/.test(authTs) ||
    authTs.includes("export const { handlers, auth"),
  "Expected exports: handlers, auth, signIn, signOut"
);

assert(
  "1.02 — Google OAuth provider configured",
  authTs.includes("Google(") || authTs.includes("Google({"),
  "Missing Google provider"
);

assert(
  "1.03 — Nodemailer magic-link provider configured",
  authTs.includes("Nodemailer("),
  "Missing Nodemailer provider"
);

assert(
  "1.04 — Beta credentials provider (email-only)",
  authTs.includes('"beta-email"') || authTs.includes("'beta-email'"),
  "Missing beta-email credentials provider"
);

assert(
  "1.05 — JWT session strategy",
  authTs.includes('strategy: "jwt"') || authTs.includes("strategy: 'jwt'"),
  "Expected JWT session strategy"
);

assert(
  "1.06 — 30-day session maxAge",
  authTs.includes("30 * 24 * 60 * 60"),
  "Missing 30-day session configuration"
);

assert(
  "1.07 — PrismaAdapter configured",
  authTs.includes("PrismaAdapter("),
  "Missing PrismaAdapter"
);

assert(
  "1.08 — JWT callback sets token.sub = user.id",
  authTs.includes("token.sub = user.id") || authTs.includes("token.sub=user.id"),
  "JWT callback must persist user.id into token.sub"
);

assert(
  "1.09 — Session callback injects user.id",
  authTs.includes("session.user.id = token.sub"),
  "Session callback must inject token.sub into session.user.id"
);

assert(
  "1.10 — Beta credentials: find-or-create user",
  authTs.includes("findUnique") && authTs.includes("create({ data:"),
  "Beta provider must find-or-create user by email"
);

assert(
  "1.11 — Beta credentials: email validation regex",
  authTs.includes("@[^\\s@]+\\.[^\\s@]+") || authTs.includes("@[^") || authTs.includes("test(email"),
  "Beta provider must validate email format"
);

assert(
  "1.12 — Custom sign-in page configured",
  authTs.includes('signIn: "/signin"') || authTs.includes("signIn: '/signin'"),
  "Custom sign-in page not configured"
);

// ═══════════════════════════════════════════════════════════════
// 2. SIGN-IN UI
// ═══════════════════════════════════════════════════════════════

const signinPage = readFile("app/signin/page.tsx");

assert(
  "2.01 — Sign-in page exists",
  signinPage.length > 100,
  "app/signin/page.tsx missing or trivial"
);

assert(
  "2.02 — Google sign-in button",
  signinPage.includes("google") || signinPage.includes("Google"),
  "Missing Google sign-in option"
);

assert(
  "2.03 — Email/beta sign-in form",
  signinPage.includes("beta-email") || signinPage.includes("email"),
  "Missing beta email sign-in"
);

assert(
  "2.04 — Error handling (OAuthAccountNotLinked)",
  signinPage.includes("OAuthAccountNotLinked"),
  "Missing OAuth error handling"
);

assert(
  "2.05 — Redirect to pipeline after sign-in",
  signinPage.includes("/pipeline") || signinPage.includes("callbackUrl"),
  "Missing redirect to pipeline"
);

// ═══════════════════════════════════════════════════════════════
// 3. SESSION PROVIDER
// ═══════════════════════════════════════════════════════════════

const layoutTsx = readFile("app/layout.tsx");
const sessionProvider = readFile("app/components/session_provider.tsx");

assert(
  "3.01 — SessionProvider wraps app layout",
  layoutTsx.includes("SessionProvider") || layoutTsx.includes("AuthSessionProvider"),
  "Layout must wrap children in SessionProvider"
);

assert(
  "3.02 — SessionProvider client component",
  sessionProvider.includes('"use client"') || sessionProvider.includes("'use client'"),
  "SessionProvider must be a client component"
);

assert(
  "3.03 — SessionProvider imports from next-auth/react",
  sessionProvider.includes("next-auth/react"),
  "Must use next-auth/react SessionProvider"
);

// ═══════════════════════════════════════════════════════════════
// 4. PRISMA SCHEMA — AUTH MODELS
// ═══════════════════════════════════════════════════════════════

const schema = readFile("prisma/schema.prisma");

assert(
  "4.01 — User model exists",
  schema.includes("model User {"),
  "Missing User model"
);

assert(
  "4.02 — User.caliberSessionId field",
  schema.includes("caliberSessionId") && schema.includes("String?"),
  "User must have caliberSessionId for session linkage"
);

assert(
  "4.03 — Account model (NextAuth)",
  schema.includes("model Account {"),
  "Missing Account model"
);

assert(
  "4.04 — Session model (NextAuth)",
  schema.includes("model Session {"),
  "Missing Session model"
);

assert(
  "4.05 — VerificationToken model (NextAuth)",
  schema.includes("model VerificationToken {"),
  "Missing VerificationToken model"
);

// ═══════════════════════════════════════════════════════════════
// 5. PRISMA SCHEMA — PIPELINE DUAL-MODE
// ═══════════════════════════════════════════════════════════════

assert(
  "5.01 — PipelineEntry model exists",
  schema.includes("model PipelineEntry {"),
  "Missing PipelineEntry model"
);

assert(
  "5.02 — PipelineEntry.userId field",
  /PipelineEntry[\s\S]*?userId\s+String\?/.test(schema),
  "PipelineEntry must have optional userId"
);

assert(
  "5.03 — PipelineEntry.sessionId field",
  /PipelineEntry[\s\S]*?sessionId\s+String\?/.test(schema),
  "PipelineEntry must have optional sessionId"
);

assert(
  "5.04 — PipelineEntry dual index (userId, sessionId)",
  schema.includes("@@index([userId])") && schema.includes("@@index([sessionId])"),
  "PipelineEntry must index both userId and sessionId"
);

// ═══════════════════════════════════════════════════════════════
// 6. PRISMA SCHEMA — TELEMETRY userId
// ═══════════════════════════════════════════════════════════════

// Extract TelemetryEvent model block
const telemetryModelMatch = schema.match(/model TelemetryEvent \{[\s\S]*?\n\}/);
const telemetryModel = telemetryModelMatch ? telemetryModelMatch[0] : "";

assert(
  "6.01 — TelemetryEvent model exists",
  telemetryModel.length > 10,
  "Missing TelemetryEvent model"
);

assert(
  "6.02 — TelemetryEvent.userId field added",
  telemetryModel.includes("userId") && telemetryModel.includes("String?"),
  "TelemetryEvent must have userId String? field"
);

assert(
  "6.03 — TelemetryEvent.userId index",
  telemetryModel.includes("@@index([userId])"),
  "TelemetryEvent must index userId"
);

assert(
  "6.04 — TelemetryEvent.sessionId still present",
  telemetryModel.includes("sessionId"),
  "TelemetryEvent must retain sessionId field"
);

// ═══════════════════════════════════════════════════════════════
// 7. PRISMA SCHEMA — FEEDBACK userId
// ═══════════════════════════════════════════════════════════════

const feedbackModelMatch = schema.match(/model FeedbackEvent \{[\s\S]*?\n\}/);
const feedbackModel = feedbackModelMatch ? feedbackModelMatch[0] : "";

assert(
  "7.01 — FeedbackEvent model exists",
  feedbackModel.length > 10,
  "Missing FeedbackEvent model"
);

assert(
  "7.02 — FeedbackEvent.userId field added",
  feedbackModel.includes("userId") && feedbackModel.includes("String?"),
  "FeedbackEvent must have userId String? field"
);

assert(
  "7.03 — FeedbackEvent.userId index",
  feedbackModel.includes("@@index([userId])"),
  "FeedbackEvent must index userId"
);

// ═══════════════════════════════════════════════════════════════
// 8. TELEMETRY STORE — userId BINDING
// ═══════════════════════════════════════════════════════════════

const telemetryStore = readFile("lib/telemetry_store.ts");

assert(
  "8.01 — TelemetryEvent interface has userId",
  telemetryStore.includes("userId: string | null") || telemetryStore.includes("userId:"),
  "TelemetryEvent interface must include userId"
);

assert(
  "8.02 — appendTelemetryEvent writes userId to DB",
  telemetryStore.includes("userId: event.userId"),
  "appendTelemetryEvent must persist userId"
);

// ═══════════════════════════════════════════════════════════════
// 9. FEEDBACK STORE — userId BINDING
// ═══════════════════════════════════════════════════════════════

const feedbackStore = readFile("lib/feedback_store.ts");

assert(
  "9.01 — FeedbackEvent interface has userId",
  feedbackStore.includes("userId: string | null") || feedbackStore.includes("userId:"),
  "FeedbackEvent interface must include userId"
);

assert(
  "9.02 — appendFeedbackEvent writes userId to DB",
  feedbackStore.includes("userId: event.userId"),
  "appendFeedbackEvent must persist userId"
);

// ═══════════════════════════════════════════════════════════════
// 10. EVENTS API ROUTE — userId RESOLUTION
// ═══════════════════════════════════════════════════════════════

const eventsRoute = readFile("app/api/events/route.ts");

assert(
  "10.01 — Events route imports auth",
  eventsRoute.includes('from "@/lib/auth"') || eventsRoute.includes("from '@/lib/auth'"),
  "Events route must import auth for userId resolution"
);

assert(
  "10.02 — Events route resolves userId",
  eventsRoute.includes("resolveUserId") || eventsRoute.includes("auth()"),
  "Events route must resolve userId (auth or sessionId lookup)"
);

assert(
  "10.03 — Events route passes userId to event",
  eventsRoute.includes("userId") && eventsRoute.includes("userId,"),
  "Events route must include userId in TelemetryEvent"
);

assert(
  "10.04 — Events route CORS still present",
  eventsRoute.includes("Access-Control-Allow-Origin"),
  "Events route must maintain CORS headers"
);

assert(
  "10.05 — Events route event validation still present",
  eventsRoute.includes("isValidEventName"),
  "Events route must validate event names"
);

// ═══════════════════════════════════════════════════════════════
// 11. FEEDBACK API ROUTE — userId RESOLUTION
// ═══════════════════════════════════════════════════════════════

const feedbackRoute = readFile("app/api/feedback/route.ts");

assert(
  "11.01 — Feedback route imports auth",
  feedbackRoute.includes('from "@/lib/auth"') || feedbackRoute.includes("from '@/lib/auth'"),
  "Feedback route must import auth for userId resolution"
);

assert(
  "11.02 — Feedback route resolves userId",
  feedbackRoute.includes("resolveUserId") || feedbackRoute.includes("auth()"),
  "Feedback route must resolve userId (auth or sessionId lookup)"
);

assert(
  "11.03 — Feedback route passes userId to event",
  feedbackRoute.includes("userId") && feedbackRoute.includes("userId,"),
  "Feedback route must include userId in FeedbackEvent"
);

assert(
  "11.04 — Feedback route CORS still present",
  feedbackRoute.includes("Access-Control-Allow-Origin"),
  "Feedback route must maintain CORS headers"
);

assert(
  "11.05 — Feedback route surface validation still present",
  feedbackRoute.includes("VALID_SURFACES"),
  "Feedback route must validate surfaces"
);

assert(
  "11.06 — Feedback route feedback_type validation still present",
  feedbackRoute.includes("VALID_FEEDBACK_TYPES"),
  "Feedback route must validate feedback types"
);

// ═══════════════════════════════════════════════════════════════
// 12. PIPELINE MIGRATION — SESSION→USER
// ═══════════════════════════════════════════════════════════════

const pipelineStore = readFile("lib/pipeline_store_db.ts");

assert(
  "12.01 — linkCaliberSession function exists",
  pipelineStore.includes("linkCaliberSession"),
  "Must have linkCaliberSession for session→user binding"
);

assert(
  "12.02 — getLinkedCaliberSession function exists",
  pipelineStore.includes("getLinkedCaliberSession"),
  "Must have getLinkedCaliberSession for recovery"
);

assert(
  "12.03 — migrateSessionEntriesToUser function exists",
  pipelineStore.includes("migrateSessionEntriesToUser"),
  "Must have migrateSessionEntriesToUser for pipeline migration"
);

assert(
  "12.04 — migrateFileEntriesToUser function exists",
  pipelineStore.includes("migrateFileEntriesToUser"),
  "Must have migrateFileEntriesToUser for legacy file migration"
);

// ═══════════════════════════════════════════════════════════════
// 13. PIPELINE API — AUTH-AWARE
// ═══════════════════════════════════════════════════════════════

const pipelineRoute = readFile("app/api/pipeline/route.ts");

assert(
  "13.01 — Pipeline route imports auth",
  pipelineRoute.includes('from "@/lib/auth"'),
  "Pipeline route must import auth"
);

assert(
  "13.02 — Pipeline GET triggers migration on auth",
  pipelineRoute.includes("migrateSessionEntriesToUser") &&
    pipelineRoute.includes("migrateFileEntriesToUser"),
  "Pipeline GET must trigger session→user migration"
);

assert(
  "13.03 — Pipeline POST supports dual-mode (userId + sessionId)",
  pipelineRoute.includes("userId") && pipelineRoute.includes("sessionId"),
  "Pipeline POST must support both userId and sessionId creation"
);

assert(
  "13.04 — Pipeline PATCH has IDOR protection",
  pipelineRoute.includes("Ownership check") ||
    pipelineRoute.includes("existing.userId !== session.user.id"),
  "Pipeline PATCH must verify ownership"
);

assert(
  "13.05 — Pipeline route recovers caliberSessionId from DB",
  pipelineRoute.includes("getLinkedCaliberSession"),
  "Pipeline GET must recover caliberSessionId if cookie expired"
);

// ═══════════════════════════════════════════════════════════════
// 14. PIPELINE PAGE — AUTH-AWARE UI
// ═══════════════════════════════════════════════════════════════

const pipelinePage = readFile("app/pipeline/page.tsx");

assert(
  "14.01 — Pipeline page uses useSession",
  pipelinePage.includes("useSession"),
  "Pipeline page must use useSession hook"
);

assert(
  "14.02 — Pipeline page has sign-in CTA for unauthenticated",
  pipelinePage.includes("Sign in") || pipelinePage.includes("sign in"),
  "Pipeline page must show sign-in prompt for unauthenticated users"
);

// ═══════════════════════════════════════════════════════════════
// 15. EXTENSION SESSION CHAIN
// ═══════════════════════════════════════════════════════════════

const bgJs = readFile("extension/background.js");

assert(
  "15.01 — Extension discovers session",
  bgJs.includes("discoverSession") || bgJs.includes("CALIBER_SESSION"),
  "Extension must have session discovery"
);

assert(
  "15.02 — Extension handles CALIBER_SESSION_HANDOFF",
  bgJs.includes("CALIBER_SESSION_HANDOFF"),
  "Extension must handle session handoff from web"
);

assert(
  "15.03 — Extension enriches telemetry with sessionId",
  bgJs.includes("CALIBER_TELEMETRY") && bgJs.includes("sessionId"),
  "Extension must relay telemetry with sessionId"
);

assert(
  "15.04 — Extension has session backup/restore",
  bgJs.includes("sessionBackup") || bgJs.includes("session_backup"),
  "Extension must backup session for recovery"
);

// ═══════════════════════════════════════════════════════════════
// 16. ENVIRONMENT CONFIGURATION
// ═══════════════════════════════════════════════════════════════

assert(
  "16.01 — .env file exists",
  fileExists(".env") || fileExists(".env.development") || fileExists(".env.local"),
  "Environment file required for auth secrets"
);

// ═══════════════════════════════════════════════════════════════
// RESULTS
// ═══════════════════════════════════════════════════════════════

console.log("\n╔══════════════════════════════════════════════════════════╗");
console.log("║        AUTH GATE (BETA GATE 4) VALIDATION              ║");
console.log("╠══════════════════════════════════════════════════════════╣");

for (const r of results) {
  const icon = r.status === "PASS" ? "✅" : "❌";
  console.log(`║ ${icon} ${r.label}`);
  if (r.detail) console.log(`║    → ${r.detail}`);
}

console.log("╠══════════════════════════════════════════════════════════╣");
console.log(`║  TOTAL: ${pass + fail}  |  PASS: ${pass}  |  FAIL: ${fail}`);
console.log("╚══════════════════════════════════════════════════════════╝");

if (fail > 0) {
  console.log(`\n⚠️  ${fail} assertion(s) FAILED — gate NOT closed.`);
  process.exit(1);
} else {
  console.log(`\n✅  All ${pass} assertions PASSED — gate 4 (auth/memory) CLOSED.`);
}
