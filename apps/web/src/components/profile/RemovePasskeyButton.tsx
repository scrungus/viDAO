"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { getAccessToken } from "@privy-io/react-auth";

export default function RemovePasskeyButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [removing, setRemoving] = useState(false);

  const handleRemove = async () => {
    if (
      !confirm(
        "Remove your hardware passkey? Your watch time will no longer count toward creator payouts until you enroll a new one.",
      )
    ) {
      return;
    }
    setRemoving(true);
    try {
      const accessToken = await getAccessToken();
      const res = await fetch("/api/profile/remove-passkey", {
        method: "POST",
        headers: accessToken
          ? { Authorization: `Bearer ${accessToken}` }
          : undefined,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.error ?? `Remove failed (${res.status})`);
        setRemoving(false);
        return;
      }
      startTransition(() => router.refresh());
    } catch (err) {
      alert(err instanceof Error ? err.message : "Remove failed");
      setRemoving(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleRemove}
      disabled={removing || pending}
      className="mt-3 text-sm text-red-400 hover:text-red-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
    >
      {removing || pending ? "Removing..." : "Remove passkey"}
    </button>
  );
}
