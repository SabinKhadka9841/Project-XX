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
        className="btn btn-primary"
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
        className="field w-48"
        onKeyDown={(event) => {
          if (event.key === "Escape") setOpen(false);
        }}
      />
      <button
        type="submit"
        disabled={pending || name.trim() === ""}
        className="btn btn-primary"
      >
        {pending ? "Creating..." : "Create"}
      </button>
      <button
        type="button"
        onClick={() => setOpen(false)}
        className="btn btn-ghost"
      >
        Cancel
      </button>
    </form>
  );
}
