"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { usePrivy, getAccessToken } from "@privy-io/react-auth";

const TRANSAK_API_KEY = process.env.NEXT_PUBLIC_TRANSAK_API_KEY ?? "";
const TRANSAK_BASE_URL = "https://global-stg.transak.com";
const MOCK_TRANSAK = process.env.NEXT_PUBLIC_DEV_MOCK_TRANSAK === "true";

export default function SubscribeButton() {
  const { user } = usePrivy();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubscribe = useCallback(async () => {
    setError(null);

    if (MOCK_TRANSAK) {
      setLoading(true);
      const popup = window.open(
        "/dev/fake-transak",
        "vidao-fake-transak",
        "width=480,height=720,noopener=no",
      );
      if (!popup) {
        setError("Pop-up blocked — allow pop-ups for this site");
        setLoading(false);
        return;
      }
      const poll = window.setInterval(async () => {
        if (!popup.closed) return;
        window.clearInterval(poll);
        try {
          const accessToken = await getAccessToken();
          const res = await fetch("/api/subscription/status", {
            method: "POST",
            headers: accessToken
              ? { Authorization: `Bearer ${accessToken}` }
              : undefined,
          });
          const data = (await res.json().catch(() => null)) as {
            subscribed?: boolean;
          } | null;
          if (data?.subscribed) {
            router.push("/");
            return;
          }
        } catch {}
        setLoading(false);
        router.refresh();
      }, 500);
      return;
    }

    if (!TRANSAK_API_KEY) {
      setError("NEXT_PUBLIC_TRANSAK_API_KEY not configured");
      return;
    }

    const walletAddress =
      user?.wallet?.address ??
      process.env.NEXT_PUBLIC_PAYOUT_POOL_ADDRESS ??
      "";

    const params = new URLSearchParams({
      apiKey: TRANSAK_API_KEY,
      defaultFiatAmount: "10",
      defaultFiatCurrency: "USD",
      themeColor: "7c3aed",
    });
    if (walletAddress) {
      params.set("walletAddress", walletAddress);
      params.set("disableWalletAddressForm", "true");
    }

    window.open(
      `${TRANSAK_BASE_URL}?${params.toString()}`,
      "_blank",
      "noopener,noreferrer",
    );
  }, [user, router]);

  return (
    <>
      <button
        onClick={handleSubscribe}
        disabled={loading}
        className="w-full bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white font-bold py-4 px-6 rounded-lg transition-all active:scale-[0.98] shadow-lg shadow-violet-600/20"
      >
        {loading
          ? "Subscribing..."
          : MOCK_TRANSAK
            ? "Subscribe — $10/mo (dev mock)"
            : "Subscribe — $10/mo"}
      </button>
      {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
    </>
  );
}
