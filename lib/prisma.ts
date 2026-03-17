// lib/prisma.ts — Prisma client singleton (Neon serverless adapter for Vercel Postgres)
// Lazy initialization: the client is created on first property access so that
// build-time page-data collection doesn't crash when DATABASE_URL is absent.
import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";

const globalForPrisma = globalThis as unknown as { _prisma?: PrismaClient };

function getClient(): PrismaClient {
  if (!globalForPrisma._prisma) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL is not set");
    const adapter = new PrismaNeon({ connectionString: url });
    globalForPrisma._prisma = new PrismaClient({ adapter } as any);
  }
  return globalForPrisma._prisma;
}

export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    return (getClient() as any)[prop];
  },
});
