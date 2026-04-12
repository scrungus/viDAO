import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { prisma } from "@/lib/prisma";
import VideoPlayer from "@/components/VideoPlayer";
import Header from "@/components/Header";

export default async function WatchPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const video = await prisma.video.findUnique({
    where: { id },
    include: { creator: { select: { email: true, role: true } } },
  });

  if (!video) notFound();

  const recentVideos = await prisma.video.findMany({
    where: { id: { not: video.id } },
    include: { creator: { select: { email: true } } },
    orderBy: { createdAt: "desc" },
    take: 6,
  });

  const creatorName = video.creator.email.split("@")[0];

  return (
    <div className="flex-1">
      <Header />

      <main className="pt-6 px-6 max-w-[1600px] mx-auto">
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Main video area */}
          <div className="flex-1 min-w-0">
            <VideoPlayer videoId={video.id} src={video.videoPath} />

            <div className="mt-6">
              <h1 className="text-2xl lg:text-3xl font-bold tracking-tight mb-4">
                {video.title}
              </h1>
              <div className="flex items-center gap-3 py-4 border-b border-white/10">
                <div>
                  <span className="font-bold text-white">{creatorName}</span>
                </div>
              </div>
              {video.description && (
                <div className="mt-6 bg-white/5 rounded-xl p-4 border border-white/5">
                  <p className="text-gray-400 text-sm leading-relaxed">
                    {video.description}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Sidebar — recent videos */}
          <aside className="w-full lg:w-80 shrink-0">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold">More videos</h2>
            </div>
            <div className="space-y-4">
              {recentVideos.map((v) => {
                const vCreator = v.creator.email.split("@")[0];
                return (
                  <Link
                    key={v.id}
                    href={`/watch/${v.id}`}
                    className="flex gap-3 group"
                  >
                    <div className="relative w-40 aspect-video rounded-lg overflow-hidden shrink-0 border border-white/10">
                      {v.thumbnailUrl ? (
                        <Image
                          src={v.thumbnailUrl}
                          alt={v.title}
                          fill
                          className="object-cover group-hover:scale-105 transition-transform duration-300"
                          sizes="160px"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-gray-800 text-gray-600 text-xs">
                          No thumbnail
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col min-w-0">
                      <h4 className="text-sm font-semibold line-clamp-2 leading-snug group-hover:text-violet-400 transition-colors">
                        {v.title}
                      </h4>
                      <p className="text-gray-500 text-xs mt-1">{vCreator}</p>
                    </div>
                  </Link>
                );
              })}
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}
