"use client";

import { useState } from "react";

export function InviteLink({
  projectId,
  projectName,
}: {
  projectId: string;
  projectName: string;
}) {
  const [copied, setCopied] = useState(false);

  async function handleClick() {
    const url = `${window.location.origin}/projects/${projectId}/join`;

    // Copies a whole message, not a naked URL. A bare link pasted into a
    // group chat gives the reader nothing to go on and is easy to
    // ignore; saying what it is and that it takes one tap is the
    // difference between someone joining and someone scrolling past.
    const message = `Join our group project "${projectName}" — everything's in one place and nothing gets overwritten. Tap to join, no password needed: ${url}`;

    await navigator.clipboard.writeText(message);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  return (
    <button
      onClick={handleClick}
      className="btn btn-secondary"
      title="Copies a short message with the link, ready to paste into your group chat"
    >
      {copied ? "Copied — paste it in your chat" : "Invite"}
    </button>
  );
}
