"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { getAccessToken } from "@privy-io/react-auth";

export default function CancelSubscriptionButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [cancelling, setCancelling] = useState(false);

  const handleCancel = async () => {
    if (
      !confirm(
        "Cancel your subscription? You'll lose access to videos immediately and won't be refunded for unused days.",
      )
    ) {
      return;
    }
    setCancelling(true);
    try {
      const accessToken = await getAccessToken();
      const res = await fetch("/api/subscription/cancel", {
        method: "POST",
        headers: accessToken
          ? { Authorization: `Bearer ${accessToken}` }
          : undefined,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.error ?? `Cancel failed (${res.status})`);
        setCancelling(false);
        return;
      }
      startTransition(() => router.refresh());
    } catch (err) {
      alert(err instanceof Error ? err.message : "Cancel failed");
      setCancelling(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleCancel}
      disabled={cancelling || pending}
      className="inline-block text-sm text-red-400 hover:text-red-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
    >
      {cancelling || pending ? "Cancelling..." : "Cancel subscription"}
    </button>
  );
}
