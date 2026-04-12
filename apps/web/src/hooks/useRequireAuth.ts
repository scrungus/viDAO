"use client";

import { usePrivy } from "@privy-io/react-auth";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * Redirects unauthenticated users to /onboarding.
 * Returns { ready, authenticated, user } from Privy.
 */
export function useRequireAuth() {
  const { ready, authenticated, user } = usePrivy();
  const router = useRouter();

  useEffect(() => {
    if (ready && !authenticated) {
      router.replace("/onboarding");
    }
  }, [ready, authenticated, router]);

  return { ready, authenticated, user };
}
