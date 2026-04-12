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
  const { ready } = usePrivy();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { linkWithPasskey } = useLinkWithPasskey({
    onSuccess: async ({ user }: { user: User }) => {
      try {
        const passkeys = (user.linkedAccounts ?? []).filter(
          (account): account is PasskeyWithMetadata =>
            account.type === "passkey",
        );
        const latestCredentialId = passkeys[passkeys.length - 1]?.credentialId;

        const accessToken = await getAccessToken();
        const res = await fetch("/api/auth/register", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
          },
          body: JSON.stringify({
            attestationType: "HARDWARE",
            webauthnCredentialId: latestCredentialId,
          }),
        });
        if (!res.ok) throw new Error(`Register failed (${res.status})`);
        router.refresh();
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

  const handleEnroll = () => {
    if (!ready) {
      setError("Privy not ready yet — try again in a moment");
      return;
    }
    setError(null);
    setLoading(true);
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
