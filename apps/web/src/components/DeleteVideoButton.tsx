"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { getAccessToken } from "@privy-io/react-auth";

export default function DeleteVideoButton({
  videoId,
  videoTitle,
}: {
  videoId: string;
  videoTitle: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (
      !confirm(
        `Delete "${videoTitle}"? This removes the video, its thumbnail, and all watch sessions.`,
      )
    ) {
      return;
    }
    setDeleting(true);
    try {
      const accessToken = await getAccessToken();
      const res = await fetch(`/api/videos/${videoId}`, {
        method: "DELETE",
        headers: accessToken
          ? { Authorization: `Bearer ${accessToken}` }
          : undefined,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.error ?? `Delete failed (${res.status})`);
        setDeleting(false);
        return;
      }
      startTransition(() => router.refresh());
    } catch (err) {
      alert(err instanceof Error ? err.message : "Delete failed");
      setDeleting(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleDelete}
      disabled={deleting || pending}
      className="text-sm text-red-400 hover:text-red-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
    >
      {deleting || pending ? "Deleting..." : "Delete"}
    </button>
  );
}
