import { handlers } from "@/lib/auth";

// Guard: if AUTH_SECRET is missing the NextAuth JWT layer will fail on every request,
// surfacing an opaque "server configuration" error. Catch it here so the Vercel
// Function log contains a clear, actionable message.
if (!process.env.AUTH_SECRET) {
  console.error(
    "[Caliber][auth] FATAL: AUTH_SECRET env var is not set. " +
    "Set it in Vercel Environment Variables and redeploy. " +
    "All sign-in requests will fail until this is resolved."
  );
}

export const { GET, POST } = handlers;
