import { redirect } from "next/navigation";
import Link from "next/link";
import Header from "@/components/Header";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AttestationType } from "@/generated/prisma/client";
import CopyWalletButton from "@/components/profile/CopyWalletButton";
import EnrollPasskeyButton from "@/components/profile/EnrollPasskeyButton";
import SignOutButton from "@/components/profile/SignOutButton";

const SUBSCRIPTION_PERIOD_DAYS = 30;
const MONTHLY_CAP_HOURS = 50;

export default async function ProfilePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/onboarding");

  const now = new Date();
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const monthlyTotal = await prisma.monthlyWatchTotal.findUnique({
    where: { userId_month: { userId: user.id, month } },
  });
  const currentMonthHours = monthlyTotal ? Number(monthlyTotal.weightedHours) : 0;
  const monthlyProgressPct = Math.min(
    100,
    (currentMonthHours / MONTHLY_CAP_HOURS) * 100,
  );

  const isActive = user.subscribedUntil ? user.subscribedUntil > now : false;
  const msRemaining = user.subscribedUntil
    ? user.subscribedUntil.getTime() - now.getTime()
    : 0;
  const daysRemaining = Math.max(
    0,
    Math.ceil(msRemaining / (1000 * 60 * 60 * 24)),
  );
  const subscriptionProgressPct = Math.max(
    0,
    Math.min(100, (daysRemaining / SUBSCRIPTION_PERIOD_DAYS) * 100),
  );

  const emailInitial = user.email.charAt(0).toUpperCase();
  const walletDisplay = user.walletAddress
    ? `${user.walletAddress.slice(0, 6)}...${user.walletAddress.slice(-4)}`
    : null;

  const isHardware =
    user.webauthnAttestationType === AttestationType.HARDWARE;

  return (
    <div className="flex-1">
      <Header />

      <main className="max-w-[768px] mx-auto px-6 py-12 space-y-6 relative">
        {/* Background glow */}
        <div className="fixed top-0 left-0 w-full h-full pointer-events-none -z-10 overflow-hidden">
          <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[50%] bg-violet-600/5 blur-[120px] rounded-full" />
          <div className="absolute bottom-[-5%] left-[-5%] w-[40%] h-[40%] bg-indigo-600/5 blur-[100px] rounded-full" />
        </div>

        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">
            Profile
          </h1>
          <p className="text-gray-400 mt-1">
            Manage your account, subscription, and device security
          </p>
        </div>

        {/* Section 1: Account */}
        <section className="bg-white/5 border border-white/10 rounded-xl p-6 transition-all hover:bg-white/[0.07]">
          <div className="flex flex-col sm:flex-row items-center gap-6">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-violet-600 to-indigo-800 flex items-center justify-center text-3xl font-bold text-white shadow-lg shadow-violet-600/20">
              {emailInitial}
            </div>
            <div className="flex-1 text-center sm:text-left min-w-0">
              <h2 className="text-2xl font-bold text-white tracking-tight break-all">
                {user.email}
              </h2>
              {walletDisplay && user.walletAddress ? (
                <div className="mt-2 inline-flex items-center gap-2 text-gray-400 font-mono text-sm bg-black/40 px-3 py-1.5 rounded-lg border border-white/5">
                  <span>{walletDisplay}</span>
                  <CopyWalletButton wallet={user.walletAddress} />
                </div>
              ) : (
                <p className="mt-2 text-sm text-gray-500">No wallet linked</p>
              )}
            </div>
          </div>
        </section>

        {/* Section 2: Subscription */}
        <section className="bg-white/5 border border-white/10 rounded-xl p-6">
          <div className="flex justify-between items-start mb-6">
            <div>
              <h2 className="text-gray-400 text-sm font-medium uppercase tracking-wider mb-1">
                Subscription
              </h2>
              <p className="text-xl font-bold text-white">viDAO monthly</p>
            </div>
            {isActive ? (
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-violet-600/20 text-violet-400 border border-violet-600/30">
                Active
              </span>
            ) : (
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-red-400/10 text-red-400 border border-red-400/30">
                Expired
              </span>
            )}
          </div>
          <div className="space-y-3 mb-6">
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">
                {isActive && user.subscribedUntil
                  ? `Renews ${user.subscribedUntil.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}`
                  : user.subscribedUntil
                    ? `Expired ${user.subscribedUntil.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}`
                    : "No active subscription"}
              </span>
              {isActive && (
                <span className="text-white font-medium tabular-nums">
                  {daysRemaining} {daysRemaining === 1 ? "day" : "days"} left
                </span>
              )}
            </div>
            <div className="h-2 w-full bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full bg-violet-600 rounded-full transition-all"
                style={{ width: `${subscriptionProgressPct}%` }}
              />
            </div>
          </div>
          {!isActive && (
            <Link
              href="/subscribe"
              className="inline-block bg-violet-600 hover:bg-violet-500 text-white font-semibold px-5 py-2.5 rounded-lg transition-colors shadow-lg shadow-violet-600/20"
            >
              Subscribe now
            </Link>
          )}
        </section>

        {/* Section 3: Monthly watch time */}
        <section className="bg-white/5 border border-white/10 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-violet-400"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
            <h2 className="text-gray-400 text-sm font-medium uppercase tracking-wider">
              Monthly watch time
            </h2>
          </div>
          <div className="mb-4">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold text-white tabular-nums">
                {currentMonthHours.toFixed(1)}
              </span>
              <span className="text-gray-500 font-medium">
                / {MONTHLY_CAP_HOURS} hours
              </span>
            </div>
          </div>
          <div className="h-2 w-full bg-white/10 rounded-full overflow-hidden mb-4">
            <div
              className="h-full bg-violet-600 rounded-full transition-all"
              style={{ width: `${monthlyProgressPct}%` }}
            />
          </div>
          <div className="flex gap-2 items-start p-3 bg-violet-600/5 rounded-lg border border-violet-600/10">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-violet-400 mt-0.5 shrink-0"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="16" x2="12" y2="12" />
              <line x1="12" y1="8" x2="12.01" y2="8" />
            </svg>
            <p className="text-xs text-gray-400 leading-relaxed">
              Weighted watch time counts toward creator payouts, capped at{" "}
              {MONTHLY_CAP_HOURS} hours per month. Only hardware-backed passkey
              sessions count.
            </p>
          </div>
        </section>

        {/* Section 4: Device security */}
        <section className="bg-white/5 border border-white/10 rounded-xl p-6">
          <div className="flex items-start gap-4">
            <div
              className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${
                isHardware ? "bg-green-400/10" : "bg-amber-400/10"
              }`}
            >
              {isHardware ? (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-green-400"
                  aria-hidden="true"
                >
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                  <polyline points="9 12 11 14 15 10" />
                </svg>
              ) : (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-amber-400"
                  aria-hidden="true"
                >
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                  <line x1="12" y1="9" x2="12" y2="13" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
              )}
            </div>
            <div className="flex-1 min-w-0">
              {isHardware ? (
                <>
                  <h2 className="font-bold text-white mb-1">
                    Hardware-backed passkey enrolled
                  </h2>
                  <p className="text-sm text-gray-400">
                    Your watch time counts toward creator payouts. This device
                    is verified as secure.
                  </p>
                  <div className="mt-3 flex items-center gap-2 text-green-400 text-xs font-bold uppercase tracking-widest">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                      aria-hidden="true"
                    >
                      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
                    </svg>
                    Verified
                  </div>
                </>
              ) : (
                <>
                  <h2 className="font-bold text-white mb-1">
                    No hardware passkey registered
                  </h2>
                  <p className="text-sm text-gray-400">
                    Your watch time won&apos;t count toward creator payouts
                    until you enroll a hardware-backed passkey on this device.
                  </p>
                  <EnrollPasskeyButton />
                </>
              )}
            </div>
          </div>
        </section>

        {/* Section 5: Account actions */}
        <section className="bg-white/5 border border-white/10 rounded-xl p-6">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-4">
              <div
                className={`px-3 py-1 rounded text-[10px] font-black tracking-widest border uppercase ${
                  user.role === "CREATOR"
                    ? "bg-violet-600/10 text-violet-400 border-violet-600/30"
                    : "bg-white/5 text-gray-400 border-white/10"
                }`}
              >
                {user.role}
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Account role</h3>
                <p className="text-xs text-gray-500">
                  {user.role === "CREATOR"
                    ? "Upload videos and receive payouts"
                    : "Standard viewer permissions"}
                </p>
              </div>
            </div>
            <SignOutButton />
          </div>
        </section>
      </main>
    </div>
  );
}
