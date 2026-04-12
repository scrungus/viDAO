"use client";

import { useState, useEffect, useCallback } from "react";
import {
  usePrivy,
  useMfaEnrollment,
  getAccessToken,
  type PasskeyWithMetadata,
} from "@privy-io/react-auth";
import { useRouter } from "next/navigation";

type Step = "login" | "passkey" | "complete";

export default function OnboardingPage() {
  const { ready, authenticated, login, user } = usePrivy();
  const { initEnrollmentWithPasskey, submitEnrollmentWithPasskey } =
    useMfaEnrollment();
  const router = useRouter();
  const [step, setStep] = useState<Step>("login");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // After Privy login completes, move to passkey step
  useEffect(() => {
    if (ready && authenticated && step === "login") {
      setStep("passkey");
    }
  }, [ready, authenticated, step]);

  const handleLogin = useCallback(() => {
    setError(null);
    login();
  }, [login]);

  const handlePasskeyEnrollment = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      await initEnrollmentWithPasskey();

      // Get credential IDs from linked passkey accounts
      const credentialIds = (user?.linkedAccounts ?? [])
        .filter(
          (account): account is PasskeyWithMetadata =>
            account.type === "passkey",
        )
        .map((x) => x.credentialId);

      await submitEnrollmentWithPasskey({ credentialIds });

      // Sync user to our database
      const accessToken = await getAccessToken();
      await fetch("/api/auth/register", {
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

      setStep("complete");
      // Redirect to homepage after brief delay
      setTimeout(() => router.push("/"), 1500);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Passkey enrollment failed";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [initEnrollmentWithPasskey, submitEnrollmentWithPasskey, user, router]);

  const handleSkipPasskey = useCallback(async () => {
    setLoading(true);
    try {
      // Register without hardware attestation
      const accessToken = await getAccessToken();
      await fetch("/api/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify({ attestationType: "SOFTWARE" }),
      });

      setStep("complete");
      setTimeout(() => router.push("/"), 1500);
    } catch {
      setError("Registration failed");
    } finally {
      setLoading(false);
    }
  }, [router]);

  const steps: Step[] = ["login", "passkey", "complete"];
  const currentIndex = steps.indexOf(step);

  if (!ready) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-pulse text-gray-400">Loading...</div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex items-center justify-center p-6 relative">
      {/* Background glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-violet-600/10 blur-[120px] rounded-full -z-10" />

      <div className="w-full max-w-[448px] bg-white/5 border border-white/10 p-8 rounded-xl shadow-2xl backdrop-blur-sm">
        {/* Step indicator */}
        <div className="flex items-center justify-between mb-10 px-4 relative">
          <div className="absolute top-1/2 left-0 w-full h-[2px] bg-white/10 -translate-y-1/2 z-0">
            {currentIndex > 0 && (
              <div
                className="absolute top-0 left-0 h-full bg-violet-600 transition-all duration-300"
                style={{ width: `${(currentIndex / (steps.length - 1)) * 100}%` }}
              />
            )}
          </div>
          {steps.map((s, i) => (
            <div key={s} className="relative z-10 flex flex-col items-center gap-2">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ring-4 ring-[#0a0a0f] transition-all ${
                  i < currentIndex
                    ? "bg-violet-600 text-white"
                    : i === currentIndex
                      ? "bg-violet-600 text-white shadow-[0_0_15px_rgba(124,58,237,0.5)]"
                      : "bg-[#1a1a24] border-2 border-white/10 text-gray-500"
                }`}
              >
                {i < currentIndex ? "✓" : i + 1}
              </div>
            </div>
          ))}
        </div>

        {/* Step 1: Login */}
        {step === "login" && (
          <div className="text-center">
            <h1 className="text-3xl font-bold text-white mb-3">
              Create your account
            </h1>
            <p className="text-gray-400 mb-8">
              Sign up with your email to start watching
            </p>
            <button
              onClick={handleLogin}
              className="w-full h-14 bg-violet-600 hover:bg-violet-500 text-white font-bold rounded-lg transition-all active:scale-[0.98]"
            >
              Sign up with email
            </button>
          </div>
        )}

        {/* Step 2: Passkey enrollment */}
        {step === "passkey" && (
          <div className="text-center">
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
                <path d="M12 10a2 2 0 0 0-2 2c0 1.02.1 2.51.412 4.12C10.857 18.18 11.476 20 12 20s1.143-1.82 1.588-3.88c.313-1.61.412-3.1.412-4.12a2 2 0 0 0-2-2z" />
                <path d="M12 10V6.5" />
                <path d="M12 10c-3.314 0-6 2.239-6 5s2.686 5 6 5 6-2.239 6-5-2.686-5-6-5z" />
                <path d="M12 2a4 4 0 0 0-4 4.5" />
                <path d="M12 2a4 4 0 0 1 4 4.5" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-white mb-3">
              Register your device
            </h1>
            <p className="text-gray-400 mb-10 leading-relaxed">
              Enable biometrics for faster, more secure access. Without device
              registration, your watch time won&apos;t count toward creator
              payouts.
            </p>
            <div className="space-y-4">
              <button
                onClick={handlePasskeyEnrollment}
                disabled={loading}
                className="w-full bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white font-bold py-4 px-6 rounded-lg transition-all active:scale-[0.98] shadow-lg shadow-violet-600/20"
              >
                {loading ? "Registering..." : "Register device"}
              </button>
              <div className="pt-2">
                <button
                  onClick={handleSkipPasskey}
                  disabled={loading}
                  className="text-gray-500 hover:text-white text-sm font-medium transition-colors"
                >
                  Skip for now
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Complete */}
        {step === "complete" && (
          <div className="text-center">
            <div className="text-green-400 text-6xl mb-4">✓</div>
            <h1 className="text-2xl font-bold text-white mb-3">
              You&apos;re all set!
            </h1>
            <p className="text-gray-400">Redirecting to the homepage...</p>
          </div>
        )}

        {/* Error display */}
        {error && (
          <p className="mt-4 text-center text-red-400 text-sm">{error}</p>
        )}
      </div>
    </div>
  );
}
