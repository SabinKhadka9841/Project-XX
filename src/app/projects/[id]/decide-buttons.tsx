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
          className="btn btn-primary px-2.5 py-1.5 text-xs"
        >
          {pending === "approve" ? "Adding in..." : "Add it in"}
        </button>
        <button
          onClick={() => handleClick("reject")}
          disabled={pending !== null}
          className="btn btn-secondary px-2.5 py-1.5 text-xs"
        >
          {pending === "reject" ? "Saying no..." : "Say no"}
        </button>
      </div>
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}
