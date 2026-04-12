"use client";

import { useCallback } from "react";
import { usePrivy } from "@privy-io/react-auth";

const TRANSAK_API_KEY = process.env.NEXT_PUBLIC_TRANSAK_API_KEY ?? "";
const TRANSAK_BASE_URL = "https://global-stg.transak.com";

export default function SubscribeButton() {
  const { user } = usePrivy();

  const handleSubscribe = useCallback(() => {
    if (!TRANSAK_API_KEY) {
      console.error("[viDAO] NEXT_PUBLIC_TRANSAK_API_KEY not configured");
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
  }, [user]);

  return (
    <button
      onClick={handleSubscribe}
      className="w-full bg-violet-600 hover:bg-violet-500 text-white font-bold py-4 px-6 rounded-lg transition-all active:scale-[0.98] shadow-lg shadow-violet-600/20"
    >
      Subscribe — $10/mo
    </button>
  );
}
