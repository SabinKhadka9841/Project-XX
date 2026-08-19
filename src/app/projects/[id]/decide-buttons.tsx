"use client";

import { useState } from "react";
import { decideChangeRequest } from "./actions";

export function DecideButtons({
  projectId,
  changeRequestId,
}: {
  projectId: string;
  changeRequestId: string;
}) {
  const [pending, setPending] = useState<"approve" | "reject" | null>(null);
  const [error, setError] = useState("");

  async function handleClick(decision: "approve" | "reject") {
    setPending(decision);
    setError("");
    try {
      const result = await decideChangeRequest(
        projectId,
        changeRequestId,
        decision,
      );
      if (result?.error) {
        setError(result.error);
      }
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex gap-2">
        <button
          onClick={() => handleClick("approve")}
          disabled={pending !== null}
          className="rounded bg-black px-2 py-1 text-xs text-white disabled:opacity-50"
        >
          {pending === "approve" ? "Adding in..." : "Add it in"}
        </button>
        <button
          onClick={() => handleClick("reject")}
          disabled={pending !== null}
          className="rounded border px-2 py-1 text-xs hover:bg-zinc-50 disabled:opacity-50"
        >
          {pending === "reject" ? "Saying no..." : "Say no"}
        </button>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
