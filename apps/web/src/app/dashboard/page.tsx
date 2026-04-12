import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import Header from "@/components/Header";
import DeleteVideoButton from "@/components/DeleteVideoButton";

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/onboarding");
  if (user.role !== "CREATOR") {
    return (
      <div className="flex-1">
        <Header />
        <main className="p-10 max-w-4xl mx-auto">
          <h1 className="text-2xl font-bold text-white mb-2">Dashboard</h1>
          <p className="text-gray-400">
            Only creators can view this page. Contact an admin to upgrade your
            account.
          </p>
        </main>
      </div>
    );
  }

  // Load videos + past payouts
  const videos = await prisma.video.findMany({
    where: { creatorId: user.id },
    orderBy: { createdAt: "desc" },
    include: { watchSessions: { select: { weightedSeconds: true } } },
  });

  const creatorPayouts = await prisma.creatorPayout.findMany({
    where: { creatorId: user.id },
    orderBy: { payoutPeriod: { periodEnd: "desc" } },
    include: { payoutPeriod: true },
  });

  const totalEarnings = creatorPayouts.reduce(
    (sum, p) => sum + Number(p.usdcAmount),
    0,
  );

  const lastPayout = creatorPayouts[0];
  const previousPayout = creatorPayouts[1];

  // Last 30 days watch hours for live metric
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const recentSessions = await prisma.watchSession.findMany({
    where: {
      startedAt: { gte: thirtyDaysAgo },
      video: { creatorId: user.id },
    },
    select: { weightedSeconds: true },
  });
  const recentWatchHours =
    recentSessions.reduce((s, x) => s + x.weightedSeconds, 0) / 3600;

  // Per-video aggregate hours
  const videoRows = videos.map((v) => {
    const seconds = v.watchSessions.reduce(
      (s, x) => s + x.weightedSeconds,
      0,
    );
    return {
      id: v.id,
      title: v.title,
      createdAt: v.createdAt,
      thumbnailUrl: v.thumbnailUrl,
      hours: seconds / 3600,
    };
  });

  return (
    <div className="flex-1">
      <Header />

      <main className="p-6 md:p-10 max-w-screen-xl mx-auto">
        <div className="flex justify-between items-start mb-8 flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white tracking-tight">
              Creator Dashboard
            </h1>
            <p className="text-gray-400 mt-1">
              Your earnings, watch time, and videos
            </p>
          </div>
          <Link
            href="/dashboard/upload"
            className="bg-violet-600 hover:bg-violet-500 text-white font-semibold px-5 py-2.5 rounded-lg transition-colors shadow-lg shadow-violet-600/20"
          >
            Upload video
          </Link>
        </div>

        {/* Metric cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
          <MetricCard
            label="Total earnings"
            value={`$${totalEarnings.toFixed(2)}`}
            suffix="USDC"
          />
          <MetricCard
            label="Watch time (30d)"
            value={formatWatchDuration(recentWatchHours)}
          />
          <MetricCard
            label="Last payout"
            value={
              lastPayout
                ? `$${Number(lastPayout.usdcAmount).toFixed(2)}`
                : "—"
            }
            suffix={
              lastPayout
                ? `${Number(lastPayout.sharePercentage).toFixed(2)}% share`
                : "no payouts yet"
            }
            trend={
              lastPayout && previousPayout
                ? Number(lastPayout.usdcAmount) -
                  Number(previousPayout.usdcAmount)
                : undefined
            }
          />
        </div>

        {/* Videos table */}
        <section className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
          <div className="flex justify-between items-center p-6 border-b border-white/10">
            <h2 className="text-xl font-bold text-white">Your videos</h2>
            <span className="text-sm text-gray-500">
              {videoRows.length} {videoRows.length === 1 ? "video" : "videos"}
            </span>
          </div>
          {videoRows.length === 0 ? (
            <div className="p-12 text-center text-gray-500">
              No videos yet.{" "}
              <Link
                href="/dashboard/upload"
                className="text-violet-400 hover:text-violet-300"
              >
                Upload your first video
              </Link>
              .
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <th className="px-6 py-3">Video</th>
                  <th className="px-6 py-3">Uploaded</th>
                  <th className="px-6 py-3 text-right">Watch time</th>
                  <th className="px-6 py-3 text-right w-20">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {videoRows.map((v) => (
                  <tr
                    key={v.id}
                    className="hover:bg-white/5 transition-colors"
                  >
                    <td className="px-6 py-4">
                      <Link
                        href={`/watch/${v.id}`}
                        className="text-white font-medium hover:text-violet-400 transition-colors"
                      >
                        {v.title}
                      </Link>
                    </td>
                    <td className="px-6 py-4 text-gray-400 text-sm">
                      {v.createdAt.toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-right text-gray-300 tabular-nums">
                      {formatWatchDuration(v.hours)}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <DeleteVideoButton videoId={v.id} videoTitle={v.title} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        {/* Payout history */}
        {creatorPayouts.length > 0 && (
          <section className="mt-10 bg-white/5 border border-white/10 rounded-xl overflow-hidden">
            <div className="p-6 border-b border-white/10">
              <h2 className="text-xl font-bold text-white">Payout history</h2>
            </div>
            <table className="w-full">
              <thead>
                <tr className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <th className="px-6 py-3">Period</th>
                  <th className="px-6 py-3">Watch hours</th>
                  <th className="px-6 py-3">Share</th>
                  <th className="px-6 py-3 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {creatorPayouts.map((p) => (
                  <tr key={p.id}>
                    <td className="px-6 py-4 text-gray-300 text-sm">
                      {p.payoutPeriod.periodStart.toLocaleDateString()} –{" "}
                      {p.payoutPeriod.periodEnd.toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-gray-300 tabular-nums">
                      {Number(p.watchHours).toFixed(1)}
                    </td>
                    <td className="px-6 py-4 text-gray-300 tabular-nums">
                      {Number(p.sharePercentage).toFixed(2)}%
                    </td>
                    <td className="px-6 py-4 text-right text-white font-semibold tabular-nums">
                      ${Number(p.usdcAmount).toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}
      </main>
    </div>
  );
}

function formatWatchDuration(hours: number): string {
  const totalSeconds = Math.round(hours * 3600);
  if (totalSeconds < 60) return `${totalSeconds}s`;
  if (totalSeconds < 3600) return `${Math.round(totalSeconds / 60)}m`;
  return `${hours.toFixed(1)}h`;
}

function MetricCard({
  label,
  value,
  suffix,
  trend,
}: {
  label: string;
  value: string;
  suffix?: string;
  trend?: number;
}) {
  return (
    <div className="p-6 rounded-xl border bg-violet-600/10 border-violet-600/30">
      <p className="text-sm text-gray-400 mb-2">{label}</p>
      <div className="flex items-baseline gap-2">
        <span className="text-3xl font-bold tabular-nums text-violet-300">
          {value}
        </span>
        {suffix && <span className="text-sm text-gray-500">{suffix}</span>}
      </div>
      {trend !== undefined && (
        <p
          className={`text-xs mt-2 ${
            trend >= 0 ? "text-emerald-400" : "text-red-400"
          }`}
        >
          {trend >= 0 ? "▲" : "▼"} ${Math.abs(trend).toFixed(2)} vs prior
          period
        </p>
      )}
    </div>
  );
}
