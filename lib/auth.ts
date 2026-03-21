// lib/auth.ts — NextAuth v5 configuration
// Providers: Email magic-link (passwordless) + Credentials (beta fallback)
import NextAuth from "next-auth";
import Nodemailer from "next-auth/providers/nodemailer";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";

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
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
      // Find or create user by email
      let user = await prisma.user.findUnique({ where: { email } });
      if (!user) {
        user = await prisma.user.create({ data: { email } });
      }
      return { id: user.id, email: user.email, name: user.name };
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
});
