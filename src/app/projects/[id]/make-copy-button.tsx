"use client";

import { useState } from "react";
import { makeCopy } from "./actions";

export function MakeCopyButton({ projectId }: { projectId: string }) {
  const [pending, setPending] = useState(false);

  async function handleClick() {
    setPending(true);
    try {
      await makeCopy(projectId);
    } finally {
      setPending(false);
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={pending}
      className="rounded bg-black px-3 py-2 text-sm text-white disabled:opacity-50"
    >
      {pending ? "Making a copy..." : "Make my own copy"}
    </button>
  );
}
