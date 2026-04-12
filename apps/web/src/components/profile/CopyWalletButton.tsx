"use client";

import { useState } from "react";

export default function CopyWalletButton({ wallet }: { wallet: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(wallet);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // silently fail on clipboard denial
    }
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="hover:text-violet-400 transition-colors"
      aria-label="Copy wallet address"
    >
      {copied ? (
        <span className="text-xs font-semibold text-violet-400">Copied</span>
      ) : (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
        </svg>
      )}
    </button>
  );
}
