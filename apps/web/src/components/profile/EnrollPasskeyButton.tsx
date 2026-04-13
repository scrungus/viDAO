"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  useLinkWithPasskey,
  usePrivy,
  getAccessToken,
  type PasskeyWithMetadata,
  type User,
} from "@privy-io/react-auth";

export default function EnrollPasskeyButton() {
  const router = useRouter();
  const { ready, user } = usePrivy();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const syncPasskeyToBackend = async (credentialId: string | undefined) => {
    const accessToken = await getAccessToken();
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      body: JSON.stringify({
        attestationType: "HARDWARE",
        webauthnCredentialId: credentialId,
      }),
    });
    if (!res.ok) throw new Error(`Register failed (${res.status})`);
    router.refresh();
  };

  const { linkWithPasskey } = useLinkWithPasskey({
    onSuccess: async ({ user: updatedUser }: { user: User }) => {
      try {
        const passkeys = (updatedUser.linkedAccounts ?? []).filter(
          (account): account is PasskeyWithMetadata =>
            account.type === "passkey",
        );
        await syncPasskeyToBackend(
          passkeys[passkeys.length - 1]?.credentialId,
        );
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Account update failed",
        );
      } finally {
        setLoading(false);
      }
    },
    onError: (err) => {
      setError(err || "Passkey enrollment failed");
      setLoading(false);
    },
  });

  const handleEnroll = async () => {
    if (!ready) {
      setError("Privy not ready yet — try again in a moment");
      return;
    }
    setError(null);
    setLoading(true);

    // Privy allows only one passkey per user. If one is already linked
    // (e.g. user signed up with passkey inside the Privy modal, then clicked
    // "Skip" in onboarding), calling linkWithPasskey would hit
    // cannot_link_more_of_type. Just sync the existing credential instead.
    const existing = (user?.linkedAccounts ?? []).find(
      (account): account is PasskeyWithMetadata => account.type === "passkey",
    );
    if (existing) {
      try {
        await syncPasskeyToBackend(existing.credentialId);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Account update failed",
        );
      } finally {
        setLoading(false);
      }
      return;
    }
    linkWithPasskey();
  };

  return (
    <div className="mt-4">
      <button
        type="button"
        onClick={handleEnroll}
        disabled={loading || !ready}
        className="bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white font-semibold px-4 py-2 rounded-lg transition-colors text-sm"
      >
        {loading ? "Enrolling..." : "Enroll passkey"}
      </button>
      {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
    </div>
  );
}
