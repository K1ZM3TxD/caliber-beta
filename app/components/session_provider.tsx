"use client";
// app/components/session_provider.tsx — NextAuth SessionProvider wrapper
import { SessionProvider, useSession } from "next-auth/react";
import { useEffect } from "react";

/** Dev-only: logs session state once on mount */
function AuthDebugLogger() {
  const { data: session, status } = useSession();
  useEffect(() => {
    if (status === "loading") return;
    if (session?.user) {
      console.debug("[Caliber][auth] AUTH: session found", { email: session.user.email, id: session.user.id });
    } else {
      console.debug("[Caliber][auth] AUTH: no session");
    }
  }, [status, session]);
  return null;
}

export default function AuthSessionProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SessionProvider>
      {process.env.NODE_ENV !== "production" && <AuthDebugLogger />}
      {children}
    </SessionProvider>
  );
}
