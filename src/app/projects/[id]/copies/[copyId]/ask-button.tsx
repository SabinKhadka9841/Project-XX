"use client";

import { useState } from "react";
import { askToAddThisIn } from "../../actions";

export function AskButton({
  projectId,
  copyId,
}: {
  projectId: string;
  copyId: string;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function handleClick() {
    setPending(true);
    setError("");
    try {
      const result = await askToAddThisIn(projectId, copyId, null);
      if (result?.error) {
        setError(result.error);
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        onClick={handleClick}
        disabled={pending}
        className="btn btn-primary self-start"
      >
        {pending ? "Asking..." : "Ask to add this in"}
      </button>
      {error && <p className="text-sm text-danger">{error}</p>}
    </div>
  );
}
