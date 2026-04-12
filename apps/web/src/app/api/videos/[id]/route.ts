import { NextResponse } from "next/server";
import { unlink } from "fs/promises";
import path from "path";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const video = await prisma.video.findUnique({ where: { id } });
  if (!video) {
    return NextResponse.json({ error: "Video not found" }, { status: 404 });
  }
  if (video.creatorId !== user.id) {
    return NextResponse.json(
      { error: "Only the creator can delete this video" },
      { status: 403 },
    );
  }

  // Delete watch sessions first so the foreign key doesn't block the delete
  await prisma.watchSession.deleteMany({ where: { videoId: id } });
  await prisma.video.delete({ where: { id } });

  // Best-effort: remove on-disk assets. Failures shouldn't break the delete.
  const publicRoot = path.join(process.cwd(), "public");
  const tryUnlink = async (urlPath: string | null | undefined) => {
    if (!urlPath || !urlPath.startsWith("/")) return;
    try {
      await unlink(path.join(publicRoot, urlPath));
    } catch (err) {
      console.warn("[videos:delete] failed to remove", urlPath, err);
    }
  };
  await tryUnlink(video.videoPath);
  await tryUnlink(video.thumbnailUrl);

  return NextResponse.json({ ok: true });
}
