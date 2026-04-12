import { NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import { spawn } from "child_process";
import path from "path";
import { randomBytes } from "crypto";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_SIZE = 500 * 1024 * 1024; // 500MB

function extractThumbnail(videoPath: string, outPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const ff = spawn("ffmpeg", [
      "-y",
      "-ss", "00:00:01",
      "-i", videoPath,
      "-frames:v", "1",
      "-vf", "scale=640:-1",
      "-q:v", "3",
      outPath,
    ]);
    let stderr = "";
    ff.stderr.on("data", (d) => { stderr += d.toString(); });
    ff.on("error", reject);
    ff.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg exited ${code}: ${stderr.slice(-400)}`));
    });
  });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (user.role !== "CREATOR") {
    return NextResponse.json(
      { error: "Only creators can upload videos" },
      { status: 403 },
    );
  }

  const formData = await request.formData();
  const file = formData.get("file");
  const title = formData.get("title");
  const description = formData.get("description");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "file required" }, { status: 400 });
  }
  if (typeof title !== "string" || !title.trim()) {
    return NextResponse.json({ error: "title required" }, { status: 400 });
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json(
      { error: "File too large (max 500MB)" },
      { status: 413 },
    );
  }
  if (!file.type.startsWith("video/")) {
    return NextResponse.json(
      { error: "File must be a video" },
      { status: 400 },
    );
  }

  const videoDir = process.env.VIDEO_UPLOAD_DIR ?? "./public/videos";
  const thumbDir = process.env.THUMBNAIL_UPLOAD_DIR ?? "./public/thumbnails";
  await mkdir(videoDir, { recursive: true });
  await mkdir(thumbDir, { recursive: true });

  const basename = randomBytes(12).toString("hex");
  const ext = path.extname(file.name) || ".mp4";
  const videoFilename = `${basename}${ext}`;
  const thumbFilename = `${basename}.jpg`;
  const videoAbsPath = path.join(videoDir, videoFilename);
  const thumbAbsPath = path.join(thumbDir, thumbFilename);

  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(videoAbsPath, buffer);

  let thumbnailUrl: string | null = null;
  try {
    await extractThumbnail(videoAbsPath, thumbAbsPath);
    thumbnailUrl = `/thumbnails/${thumbFilename}`;
  } catch (err) {
    console.warn("[upload] thumbnail generation failed:", err);
  }

  const video = await prisma.video.create({
    data: {
      creatorId: user.id,
      title: title.trim(),
      description:
        typeof description === "string" ? description.trim() : null,
      videoPath: `/videos/${videoFilename}`,
      thumbnailUrl,
    },
  });

  return NextResponse.json({
    id: video.id,
    videoPath: video.videoPath,
    thumbnailUrl: video.thumbnailUrl,
  });
}
