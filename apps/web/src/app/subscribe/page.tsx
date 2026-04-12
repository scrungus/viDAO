"use client";

import { usePrivy } from "@privy-io/react-auth";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import Header from "@/components/Header";
import SubscribeButton from "@/components/SubscribeButton";

export default function SubscribePage() {
  const { ready, authenticated } = usePrivy();
  const router = useRouter();

  useEffect(() => {
    if (ready && !authenticated) {
      router.push("/onboarding");
    }
  }, [ready, authenticated, router]);

  if (!ready || !authenticated) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-pulse text-gray-400">Loading...</div>
      </div>
    );
  }

  return (
    <div className="flex-1">
      <Header />

      <main className="flex-1 flex items-center justify-center p-6 relative min-h-[calc(100vh-73px)]">
        {/* Background glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-violet-600/10 blur-[120px] rounded-full -z-10" />

        <div className="w-full max-w-lg bg-white/5 border border-white/10 p-10 rounded-xl shadow-2xl backdrop-blur-sm text-center">
          <div className="mb-6 inline-flex p-4 rounded-full bg-violet-600/10 text-violet-500">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="40"
              height="40"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
            </svg>
          </div>

          <h1 className="text-3xl font-bold text-white mb-3">
            Subscribe to viDAO
          </h1>
          <p className="text-gray-400 mb-8 leading-relaxed max-w-sm mx-auto">
            Your $10/month subscription funds creator payouts. Watch time with a
            registered device counts toward the pool — creators earn based on
            real engagement.
          </p>

          <div className="space-y-6">
            {/* Price breakdown */}
            <div className="bg-white/5 border border-white/5 rounded-lg p-4">
              <div className="flex justify-between items-center mb-2">
                <span className="text-gray-400 text-sm">Monthly subscription</span>
                <span className="text-white font-bold">$10.00</span>
              </div>
              <div className="flex justify-between items-center text-xs text-gray-500">
                <span>Paid in USDC on Arbitrum</span>
                <span>via Transak</span>
              </div>
            </div>

            <SubscribeButton />

            <p className="text-gray-600 text-xs">
              Payment is processed by Transak. Your subscription activates
              immediately and lasts 30 days.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
