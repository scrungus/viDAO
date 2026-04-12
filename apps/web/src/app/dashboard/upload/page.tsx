"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getAccessToken } from "@privy-io/react-auth";
import Header from "@/components/Header";

export default function UploadPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);

  const acceptFile = (f: File | undefined | null) => {
    if (!f) return;
    if (!f.type.startsWith("video/")) {
      setError("Only video files are allowed.");
      return;
    }
    setError(null);
    setFile(f);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    acceptFile(e.dataTransfer.files?.[0]);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!file) {
      setError("Please select a video file.");
      return;
    }
    if (!title.trim()) {
      setError("Please enter a title.");
      return;
    }

    setSubmitting(true);
    try {
      const accessToken = await getAccessToken();
      const formData = new FormData();
      formData.append("file", file);
      formData.append("title", title);
      formData.append("description", description);

      const res = await fetch("/api/videos/upload", {
        method: "POST",
        headers: accessToken
          ? { Authorization: `Bearer ${accessToken}` }
          : undefined,
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `Upload failed (${res.status})`);
      }

      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
      setSubmitting(false);
    }
  };

  return (
    <div className="flex-1">
      <Header />

      <main className="flex items-center justify-center p-6 min-h-[calc(100vh-73px)]">
        <div className="max-w-2xl w-full bg-white/5 border border-white/10 rounded-xl p-8 shadow-2xl backdrop-blur-sm">
          <div className="mb-8">
            <Link
              href="/dashboard"
              className="inline-flex items-center text-violet-400 hover:text-violet-300 transition-colors mb-6 text-sm"
            >
              ← Back to dashboard
            </Link>
            <h1 className="text-2xl font-bold text-white tracking-tight">
              Upload a new video
            </h1>
            <p className="text-gray-400 mt-1">
              Your video will be available to all subscribers instantly
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Upload zone */}
            <div
              onClick={() => fileInputRef.current?.click()}
              onDragOver={handleDragOver}
              onDragEnter={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`cursor-pointer relative border-2 border-dashed rounded-xl p-10 flex flex-col items-center justify-center transition-colors ${
                dragActive
                  ? "border-violet-400 bg-violet-500/20"
                  : "border-violet-500/50 bg-white/5 hover:bg-violet-500/10"
              }`}
            >
              <div className="w-14 h-14 bg-violet-600/20 rounded-full flex items-center justify-center mb-3">
                <svg
                  width="28"
                  height="28"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className="text-violet-400"
                >
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" />
                </svg>
              </div>
              {file ? (
                <>
                  <p className="text-white font-medium">{file.name}</p>
                  <p className="text-gray-500 text-sm mt-1">
                    {(file.size / 1024 / 1024).toFixed(1)} MB — click or drop
                    to change
                  </p>
                </>
              ) : (
                <>
                  <p className="text-white font-medium">
                    {dragActive
                      ? "Drop the video here"
                      : "Drag a video here or click to browse"}
                  </p>
                  <p className="text-gray-500 text-sm mt-1">MP4 up to 500MB</p>
                </>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="video/mp4"
                className="hidden"
                onChange={(e) => acceptFile(e.target.files?.[0])}
              />
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-300">
                Title<span className="text-violet-500 ml-1">*</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Give your video a descriptive title"
                className="w-full bg-white/5 border border-white/10 rounded-lg py-3 px-4 text-white placeholder:text-gray-500 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition-colors"
              />
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-300">
                Description
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                placeholder="Tell viewers what this video is about..."
                className="w-full bg-white/5 border border-white/10 rounded-lg py-3 px-4 text-white placeholder:text-gray-500 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition-colors resize-none"
              />
            </div>

            {error && (
              <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg p-3">
                {error}
              </p>
            )}

            <div className="pt-2 flex flex-col space-y-3">
              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-violet-600 hover:bg-violet-500 disabled:bg-violet-900 disabled:cursor-not-allowed text-white py-3 rounded-lg font-semibold transition-colors shadow-lg shadow-violet-600/20"
              >
                {submitting ? "Uploading..." : "Publish video"}
              </button>
              <Link
                href="/dashboard"
                className="w-full text-center py-3 text-gray-400 hover:text-white font-medium transition-colors"
              >
                Cancel
              </Link>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}
