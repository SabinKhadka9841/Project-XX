"use client";

import { useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * Shared by the plain login page and the invite landing page, so
 * somebody arriving from an invite never gets bounced to a separate
 * screen that's forgotten why they're here.
 */
export function SignInForm({
  next,
  submitLabel = "Email me a sign-in link",
}: {
  next: string;
  submitLabel?: string;
}) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">(
    "idle",
  );
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setStatus("sending");
    setError("");

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/confirm?next=${encodeURIComponent(next)}`,
      },
    });

    if (error) {
      setStatus("error");
      setError(error.message);
      return;
    }

    setStatus("sent");
  }

  if (status === "sent") {
    return (
      <div className="card flex flex-col gap-2 p-5">
        <div className="flex items-center gap-2">
          <span className="grid h-6 w-6 place-items-center rounded-full bg-success-soft text-success">
            <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none">
              <path
                d="M3.5 8.5l3 3 6-7"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
          <p className="font-medium">Check your email</p>
        </div>
        <p className="text-sm leading-relaxed text-text-muted">
          We sent a link to <span className="text-text">{email}</span>. Click
          it and you&apos;re straight in — there&apos;s no password to make up
          or remember.
        </p>
        <p className="text-sm leading-relaxed text-text-muted">
          Nothing yet? It can take a moment, and it sometimes lands in spam.
        </p>
        <button
          onClick={() => setStatus("idle")}
          className="btn btn-ghost -ml-3.5 self-start"
        >
          Use a different address
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex w-full flex-col gap-3">
      {/* autoComplete lets a phone offer the address instead of making
          someone type it on a phone keyboard, at the exact moment
          they're deciding whether this is worth the effort.
          autoCapitalize/spellCheck off because phones helpfully
          capitalise the first letter and underline the whole thing. */}
      <input
        type="email"
        required
        autoFocus
        autoComplete="email"
        autoCapitalize="off"
        spellCheck={false}
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        placeholder="you@example.com"
        className="field py-2.5"
      />
      <button
        type="submit"
        disabled={status === "sending"}
        className="btn btn-primary py-2.5"
      >
        {status === "sending" ? "Sending…" : submitLabel}
      </button>
      <p className="text-sm text-text-subtle">
        No password needed — we email you a link that signs you in.
      </p>
      {status === "error" && (
        <p className="rounded-md border border-danger-border bg-danger-soft px-3 py-2 text-sm text-danger">
          {error}
        </p>
      )}
    </form>
  );
}
