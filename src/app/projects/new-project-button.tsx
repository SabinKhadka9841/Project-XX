"use client";

import { useState } from "react";
import { createProject } from "./actions";

export function NewProjectButton() {
  const [pending, setPending] = useState(false);

  async function handleClick() {
    const name = window.prompt("Project name:");
    if (!name) {
      return;
    }

    setPending(true);
    try {
      await createProject(name);
    } finally {
      setPending(false);
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={pending}
      className="rounded bg-black px-3 py-2 text-white disabled:opacity-50"
    >
      {pending ? "Creating..." : "New project"}
    </button>
  );
}
