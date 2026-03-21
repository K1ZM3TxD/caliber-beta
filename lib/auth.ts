// lib/auth.ts — NextAuth v5 configuration
// Providers: Email magic-link (passwordless) + Credentials (beta fallback)
import NextAuth from "next-auth";
import Nodemailer from "next-auth/providers/nodemailer";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";

// ── env validation (log at init, not throw — let NextAuth surface its own error) ──
if (!process.env.AUTH_SECRET) {
  console.error("[Caliber][auth] CRITICAL: AUTH_SECRET is not set. NextAuth will fail to sign JWTs.");
}
if (!process.env.DATABASE_URL) {
  console.error("[Caliber][auth] CRITICAL: DATABASE_URL is not set. Prisma adapter will fail.");
}

const providers: any[] = [];

if (process.env.EMAIL_SERVER) {
  providers.push(
    Nodemailer({
      server: process.env.EMAIL_SERVER,
      from: process.env.EMAIL_FROM || "Caliber <noreply@caliber-app.com>",
    })
  );
}

// Beta credentials provider — email-only, no password.
// Always available so beta users can sign in without external OAuth/SMTP setup.
providers.push(
  Credentials({
    id: "beta-email",
    name: "Email",
    credentials: {
      email: { label: "Email", type: "email" },
    },
    async authorize(credentials) {
      const email = (credentials?.email as string | undefined)?.trim().toLowerCase();
      console.debug("[Caliber][auth] beta-email authorize called", { email: email ?? "none" });
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        console.debug("[Caliber][auth] beta-email rejected — invalid email");
        return null;
      }
      try {
        // Find or create user by email
        let user = await prisma.user.findUnique({ where: { email } });
        if (!user) {
          user = await prisma.user.create({ data: { email } });
          console.debug("[Caliber][auth] beta-email created user", { userId: user.id });
        } else {
          console.debug("[Caliber][auth] beta-email found user", { userId: user.id });
        }
        return { id: user.id, email: user.email, name: user.name };
      } catch (err) {
        // DB failure must NOT throw — that causes NextAuth "Configuration" error page.
        // Return null so NextAuth treats it as a normal CredentialsSignin failure.
        console.error("[Caliber][auth] beta-email authorize DB error", err);
        return null;
      }
    },
  })
);

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers,
  trustHost: true,
  pages: {
    signIn: "/signin",
    verifyRequest: "/signin?verify=1",
    error: "/signin",          // ← route auth errors to our page, not generic NextAuth error page
  },
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  callbacks: {
    jwt({ token, user }) {
      // On sign-in, persist user id into the JWT
      if (user) {
        token.sub = user.id;
        token.email = user.email;
        console.debug("[Caliber][auth] jwt callback — user attached", { sub: user.id, email: user.email });
      }
      return token;
    },
    session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub;
      }
      return session;
    },
  },
  logger: {
    error(error) {
      console.error("[Caliber][auth][error]", error);
    },
    warn(code) {
      console.warn("[Caliber][auth][warn]", code);
    },
  },
});
