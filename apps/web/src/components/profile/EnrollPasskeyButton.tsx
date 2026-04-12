"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  useMfaEnrollment,
  usePrivy,
  getAccessToken,
  type PasskeyWithMetadata,
} from "@privy-io/react-auth";

export default function EnrollPasskeyButton() {
  const router = useRouter();
  const { user } = usePrivy();
  const { initEnrollmentWithPasskey, submitEnrollmentWithPasskey } =
    useMfaEnrollment();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleEnroll = async () => {
    setError(null);
    setLoading(true);
    try {
      await initEnrollmentWithPasskey();

      const credentialIds = (user?.linkedAccounts ?? [])
        .filter(
          (account): account is PasskeyWithMetadata =>
            account.type === "passkey",
        )
        .map((x) => x.credentialId);

      await submitEnrollmentWithPasskey({ credentialIds });

      const accessToken = await getAccessToken();
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify({
          attestationType: "HARDWARE",
          webauthnCredentialId: credentialIds[0],
        }),
      });

      if (!res.ok) throw new Error(`Register failed (${res.status})`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Passkey enrollment failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mt-4">
      <button
        type="button"
        onClick={handleEnroll}
        disabled={loading}
        className="bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white font-semibold px-4 py-2 rounded-lg transition-colors text-sm"
      >
        {loading ? "Enrolling..." : "Enroll passkey"}
      </button>
      {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
    </div>
  );
}
