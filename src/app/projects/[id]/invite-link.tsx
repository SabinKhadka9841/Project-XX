"use client";

import { useState } from "react";

export function InviteLink({ projectId }: { projectId: string }) {
  const [copied, setCopied] = useState(false);

  async function handleClick() {
    const url = `${window.location.origin}/projects/${projectId}/join`;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <button
      onClick={handleClick}
      className="rounded border px-3 py-2 text-sm hover:bg-zinc-50"
    >
      {copied ? "Link copied!" : "Copy invite link"}
    </button>
  );
}
