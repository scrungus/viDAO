"use client";

import { useRef, useEffect, useCallback } from "react";
import { getAccessToken } from "@privy-io/react-auth";

const HEARTBEAT_INTERVAL_MS = 5_000; // TODO: restore to 30_000 for production

export default function VideoPlayer({
  videoId,
  src,
}: {
  videoId: string;
  src: string;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const sessionIdRef = useRef<string | null>(null);
  const heartbeatTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isPlayingRef = useRef(false);

  const authFetch = useCallback(async (url: string, body: object) => {
    const accessToken = await getAccessToken();
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (accessToken) headers["Authorization"] = `Bearer ${accessToken}`;
    return fetch(url, { method: "POST", headers, body: JSON.stringify(body) });
  }, []);

  const startSession = useCallback(async () => {
    try {
      const res = await authFetch("/api/watch/start", { videoId });
      if (res.ok) {
        const data = await res.json();
        sessionIdRef.current = data.sessionId;
        console.log("[viDAO] Watch session started:", data.sessionId);
      } else {
        console.log("[viDAO] Start session failed:", res.status);
      }
    } catch {
      // Silent failure per spec
    }
  }, [videoId, authFetch]);

  const sendHeartbeat = useCallback(async () => {
    if (!sessionIdRef.current) return;
    try {
      const res = await authFetch("/api/watch/heartbeat", { sessionId: sessionIdRef.current });
      console.log("[viDAO] Heartbeat sent:", res.status);
    } catch {
      // Silent failure per spec
    }
  }, [authFetch]);

  const endSession = useCallback(async () => {
    if (!sessionIdRef.current) return;
    try {
      await authFetch("/api/watch/end", { sessionId: sessionIdRef.current });
    } catch {
      // Silent failure
    }
    sessionIdRef.current = null;
  }, [authFetch]);

  const isEngaged = useCallback(() => {
    if (typeof document === "undefined") return false;
    if (document.visibilityState !== "visible") return false;
    if (typeof document.hasFocus === "function" && !document.hasFocus()) {
      return false;
    }
    return true;
  }, []);

  const startHeartbeat = useCallback(() => {
    if (heartbeatTimerRef.current) return;
    heartbeatTimerRef.current = setInterval(sendHeartbeat, HEARTBEAT_INTERVAL_MS);
  }, [sendHeartbeat]);

  const stopHeartbeat = useCallback(() => {
    if (heartbeatTimerRef.current) {
      clearInterval(heartbeatTimerRef.current);
      heartbeatTimerRef.current = null;
    }
  }, []);

  const reconcileHeartbeat = useCallback(() => {
    if (isPlayingRef.current && isEngaged()) {
      startHeartbeat();
    } else {
      stopHeartbeat();
    }
  }, [isEngaged, startHeartbeat, stopHeartbeat]);

  // Handle play/pause events
  const handlePlay = useCallback(async () => {
    if (!sessionIdRef.current) {
      await startSession();
    }
    isPlayingRef.current = true;
    reconcileHeartbeat();
  }, [startSession, reconcileHeartbeat]);

  const handlePause = useCallback(() => {
    isPlayingRef.current = false;
    stopHeartbeat();
  }, [stopHeartbeat]);

  const handleEnded = useCallback(() => {
    isPlayingRef.current = false;
    stopHeartbeat();
    endSession();
  }, [stopHeartbeat, endSession]);

  // Listen for tab visibility + window focus changes
  useEffect(() => {
    const onVisibility = () => reconcileHeartbeat();
    const onBlur = () => stopHeartbeat();
    const onFocus = () => reconcileHeartbeat();
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("blur", onBlur);
    window.addEventListener("focus", onFocus);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("focus", onFocus);
    };
  }, [reconcileHeartbeat, stopHeartbeat]);

  // Cleanup on unmount or video change
  useEffect(() => {
    return () => {
      stopHeartbeat();
      if (sessionIdRef.current) {
        // Best-effort end session on unmount
        navigator.sendBeacon(
          "/api/watch/end",
          JSON.stringify({ sessionId: sessionIdRef.current }),
        );
      }
    };
  }, [stopHeartbeat]);

  return (
    <div className="aspect-video bg-black rounded-xl overflow-hidden">
      <video
        ref={videoRef}
        src={src}
        className="w-full h-full"
        controls
        playsInline
        onPlay={handlePlay}
        onPause={handlePause}
        onEnded={handleEnded}
      />
    </div>
  );
}
