import Link from "next/link";
import Image from "next/image";
import { prisma } from "@/lib/prisma";
import Header from "@/components/Header";

export default async function HomePage() {
  const videos = await prisma.video.findMany({
    include: { creator: { select: { email: true } } },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="flex-1">
      <Header />

      {/* Main Content */}
      <main className="p-6 md:p-10 max-w-screen-2xl mx-auto">
        {/* Section Header */}
        <div className="flex justify-between items-end mb-8">
          <div>
            <h2 className="text-2xl font-bold text-white mb-1">Browse Videos</h2>
            <div className="h-1 w-12 bg-violet-600 rounded-full"></div>
          </div>
        </div>

        {videos.length === 0 ? (
          <p className="text-gray-400">No videos yet.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6">
            {videos.map((video) => (
              <Link key={video.id} href={`/watch/${video.id}`} className="group cursor-pointer">
                <div className="aspect-video rounded-lg overflow-hidden mb-3 relative bg-white/5">
                  {video.thumbnailUrl ? (
                    <Image
                      src={video.thumbnailUrl}
                      alt={video.title}
                      fill
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                      className="object-cover group-hover:brightness-110 group-hover:scale-105 transition-all duration-300"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-600">
                      No thumbnail
                    </div>
                  )}
                  <div className="absolute inset-0 bg-white/0 group-hover:bg-white/5 transition-colors"></div>
                </div>
                <h3 className="text-white font-semibold leading-snug line-clamp-2 group-hover:text-violet-400 transition-colors">
                  {video.title}
                </h3>
                <p className="text-gray-500 text-sm mt-1">
                  {video.creator.email.split("@")[0]}
                </p>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
