"use client";

import { useState } from "react";
import { createProject } from "./actions";

/**
 * An inline form rather than window.prompt(). The browser dialog looks
 * like a scam popup, can't be styled, and some browsers suppress it
 * outright — a bad thing to hit on the very first action someone takes.
 */
export function NewProjectButton() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [pending, setPending] = useState(false);

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded bg-black px-3 py-2 text-sm text-white"
      >
        New project
      </button>
    );
  }

  return (
    <form
      onSubmit={async (event) => {
        event.preventDefault();
        const trimmed = name.trim();
        if (!trimmed) return;

        setPending(true);
        try {
          await createProject(trimmed);
        } finally {
          setPending(false);
        }
      }}
      className="flex items-center gap-2"
    >
      <input
        autoFocus
        value={name}
        onChange={(event) => setName(event.target.value)}
        placeholder="e.g. Biology report"
        className="w-44 rounded border px-2 py-1 text-sm"
        onKeyDown={(event) => {
          if (event.key === "Escape") setOpen(false);
        }}
      />
      <button
        type="submit"
        disabled={pending || name.trim() === ""}
        className="rounded bg-black px-3 py-1 text-sm text-white disabled:opacity-50"
      >
        {pending ? "Creating..." : "Create"}
      </button>
      <button
        type="button"
        onClick={() => setOpen(false)}
        className="text-sm text-zinc-600 underline"
      >
        Cancel
      </button>
    </form>
  );
}
