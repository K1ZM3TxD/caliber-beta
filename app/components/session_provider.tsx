"use client";
// app/components/session_provider.tsx — NextAuth SessionProvider wrapper
import { SessionProvider } from "next-auth/react";

export default function AuthSessionProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  return <SessionProvider>{children}</SessionProvider>;
}
