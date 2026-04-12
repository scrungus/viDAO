"use client";

import { useState } from "react";
import { getAccessToken } from "@privy-io/react-auth";

const MOCK_ENABLED = process.env.NEXT_PUBLIC_DEV_MOCK_TRANSAK === "true";

export default function FakeTransakPage() {
  const [status, setStatus] = useState<"idle" | "paying" | "done" | "error">(
    "idle",
  );
  const [error, setError] = useState<string | null>(null);

  if (!MOCK_ENABLED) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a] text-white p-6">
        <p className="text-gray-400">Not found.</p>
      </div>
    );
  }

  const handlePay = async () => {
    setStatus("paying");
    setError(null);
    try {
      const accessToken = await getAccessToken();
      const res = await fetch("/api/dev/fake-subscribe", {
        method: "POST",
        headers: accessToken
          ? { Authorization: `Bearer ${accessToken}` }
          : undefined,
      });
      if (!res.ok) throw new Error(`Fake subscribe failed (${res.status})`);
      setStatus("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Payment failed");
      setStatus("error");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a] p-6">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden">
        <div className="bg-gradient-to-br from-indigo-600 to-violet-700 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-white font-bold text-sm">
              T
            </div>
            <span className="text-white font-bold tracking-tight">
              Transak
            </span>
          </div>
          <span className="text-[10px] font-bold uppercase tracking-widest bg-amber-400 text-amber-950 px-2 py-1 rounded">
            Dev mock
          </span>
        </div>

        <div className="p-6 space-y-5 text-gray-900">
          {status === "done" ? (
            <div className="text-center py-6">
              <div className="mx-auto w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mb-4">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="32"
                  height="32"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-green-600"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <h2 className="text-xl font-bold mb-1">Order completed</h2>
              <p className="text-sm text-gray-600 mb-5">
                Your subscription is now active.
              </p>
              <button
                type="button"
                onClick={() => window.close()}
                className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 rounded-lg transition-colors"
              >
                Close window
              </button>
              <p className="mt-3 text-xs text-gray-500">
                You can return to the viDAO tab to continue.
              </p>
            </div>
          ) : (
            <>
              <div>
                <h2 className="text-xl font-bold tracking-tight">
                  Confirm your order
                </h2>
                <p className="text-sm text-gray-500 mt-1">
                  Review your purchase before completing payment.
                </p>
              </div>

              <div className="border border-gray-200 rounded-lg divide-y divide-gray-200">
                <div className="flex justify-between items-center px-4 py-3">
                  <span className="text-sm text-gray-600">
                    viDAO monthly subscription
                  </span>
                  <span className="text-sm font-bold">$10.00</span>
                </div>
                <div className="flex justify-between items-center px-4 py-3">
                  <span className="text-sm text-gray-600">Network fee</span>
                  <span className="text-sm font-bold">$0.00</span>
                </div>
                <div className="flex justify-between items-center px-4 py-3 bg-gray-50">
                  <span className="text-sm font-bold">Total</span>
                  <div className="text-right">
                    <div className="text-base font-bold">$10.00</div>
                    <div className="text-[11px] text-gray-500">
                      ≈ 10 USDC on Arbitrum
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-900 leading-relaxed">
                This is a development mock — no real payment is taken and no
                on-chain transfer happens. The subscription flag is flipped
                directly in the database.
              </div>

              {error && (
                <p className="text-sm text-red-600 font-medium">{error}</p>
              )}

              <button
                type="button"
                onClick={handlePay}
                disabled={status === "paying"}
                className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3.5 rounded-lg transition-colors"
              >
                {status === "paying" ? "Processing..." : "Pay $10"}
              </button>

              <button
                type="button"
                onClick={() => window.close()}
                className="w-full text-sm text-gray-500 hover:text-gray-700 transition-colors"
              >
                Cancel
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
