"use client";

import Link from "next/link";
import { usePrivy, getAccessToken } from "@privy-io/react-auth";
import { useState, useEffect } from "react";

export default function Header() {
  const { ready, authenticated, logout, user } = usePrivy();
  const [subscribed, setSubscribed] = useState<boolean | null>(null);
  const [isCreator, setIsCreator] = useState(false);

  useEffect(() => {
    if (!ready || !authenticated) return;
    (async () => {
      try {
        const accessToken = await getAccessToken();
        const res = await fetch("/api/subscription/status", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
          },
        });
        if (res.ok) {
          const data = await res.json();
          setSubscribed(data.subscribed);
          setIsCreator(data.role === "CREATOR");
        }
      } catch {
        // Silent — default to not subscribed
      }
    })();
  }, [ready, authenticated]);

  return (
    <header className="bg-[#0a0a0f] sticky top-0 z-50 border-b border-white/10 shadow-xl">
      <div className="flex justify-between items-center px-6 py-4 w-full max-w-screen-2xl mx-auto">
        <Link href="/" className="text-2xl font-bold text-white tracking-tight hover:text-violet-400 transition-colors">
          viDAO
        </Link>
        <div className="flex items-center gap-4">
          {!ready ? (
            <div className="w-20 h-8 bg-white/5 rounded-lg animate-pulse" />
          ) : authenticated ? (
            <>
              {subscribed && (
                <span className="text-xs font-medium text-violet-400 bg-violet-600/10 border border-violet-600/30 px-3 py-1 rounded-full">
                  Subscribed
                </span>
              )}
              {isCreator && (
                <Link
                  href="/dashboard"
                  className="text-sm text-gray-300 hover:text-white transition-colors font-medium"
                >
                  Dashboard
                </Link>
              )}
              <span className="text-sm text-gray-400 hidden sm:inline">
                {user?.email?.address ?? "Connected"}
              </span>
              {subscribed === false && (
                <Link
                  href="/subscribe"
                  className="bg-violet-600 text-white px-4 py-2 rounded-lg font-semibold text-sm hover:bg-violet-500 transition-colors"
                >
                  Subscribe
                </Link>
              )}
              <button
                onClick={logout}
                className="text-gray-400 hover:text-white transition-colors px-4 py-2 font-medium text-sm"
              >
                Sign out
              </button>
            </>
          ) : (
            <>
              <Link
                href="/onboarding"
                className="text-gray-400 hover:text-white transition-colors px-4 py-2 font-medium"
              >
                Sign in
              </Link>
              <Link
                href="/onboarding"
                className="bg-violet-600 text-white px-6 py-2 rounded-lg font-semibold hover:bg-violet-500 transition-colors"
              >
                Subscribe
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
