"use client";

import { useState } from "react";
import type { ExpectedTeammate } from "@/modules/projects/members";
import { addExpectedTeammate, removeExpectedTeammate } from "./actions";

export function ExpectedTeammates({
  projectId,
  projectName,
  expected,
}: {
  projectId: string;
  projectName: string;
  expected: ExpectedTeammate[];
}) {
  const [error, setError] = useState("");
  const [nudged, setNudged] = useState<string | null>(null);

  const missing = expected.filter((person) => !person.hasJoined);

  async function copyNudge(email: string) {
    const url = `${window.location.origin}/projects/${projectId}/join`;
    await navigator.clipboard.writeText(
      `Hey — still need you on "${projectName}". Takes one tap, no password: ${url}`,
    );
    setNudged(email);
    setTimeout(() => setNudged(null), 2500);
  }

  return (
    <div className="flex flex-col gap-2">
      {expected.length > 0 && (
        <ul className="flex flex-col gap-1">
          {expected.map((person) => (
            <li
              key={person.id}
              className="flex items-center justify-between gap-3 text-sm"
            >
              <span className={person.hasJoined ? "" : "text-zinc-600"}>
                {person.email}
                {person.hasJoined ? (
                  <span className="text-zinc-500"> — joined</span>
                ) : (
                  <span className="text-red-600"> — not yet</span>
                )}
              </span>

              {/* Generous vertical padding: these were 16px tall, which
                  on a phone means mis-taps — and one of them deletes. */}
              <span className="flex shrink-0 items-center gap-3">
                {!person.hasJoined && (
                  <button
                    onClick={() => copyNudge(person.email)}
                    className="-my-1 py-2 text-xs underline"
                  >
                    {nudged === person.email ? "Copied" : "Copy a nudge"}
                  </button>
                )}
                <button
                  onClick={() => removeExpectedTeammate(projectId, person.id)}
                  className="-my-1 py-2 text-xs text-zinc-500 underline"
                  title="Remove from the list"
                >
                  Remove
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}

      {missing.length > 0 && (
        <p className="text-sm text-red-600">
          {missing.length === 1
            ? "1 person hasn't joined yet."
            : `${missing.length} people haven't joined yet.`}{" "}
          They can&apos;t see the work, and nothing they do offline will show
          up in the record of who did what.
        </p>
      )}

      <form
        action={async (formData: FormData) => {
          setError("");
          const result = await addExpectedTeammate(projectId, formData);
          if (result?.error) setError(result.error);
        }}
        className="flex flex-wrap items-center gap-2"
      >
        <input
          type="email"
          name="email"
          placeholder="teammate@uni.edu"
          autoCapitalize="off"
          spellCheck={false}
          className="w-48 rounded border px-2 py-2 text-sm"
        />
        <button
          type="submit"
          className="rounded border px-3 py-2 text-sm hover:bg-zinc-50"
        >
          Add to the list
        </button>
      </form>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {expected.length === 0 && (
        <p className="text-sm text-zinc-600">
          Optional: list who&apos;s meant to be in the group, and you&apos;ll
          be able to see at a glance who still hasn&apos;t joined. It
          doesn&apos;t restrict anything — anyone with the link can still
          join.
        </p>
      )}
    </div>
  );
}
