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
      <div className="flex flex-col gap-2 rounded border p-4">
        <p className="font-medium">Check your email</p>
        <p className="text-sm text-zinc-600">
          We sent a link to <span className="font-medium">{email}</span>.
          Click it and you&apos;ll be straight in — there&apos;s no password
          to make up or remember.
        </p>
        <p className="text-sm text-zinc-600">
          Nothing yet? It can take a moment, and it sometimes lands in spam.
        </p>
        <button
          onClick={() => setStatus("idle")}
          className="self-start text-sm underline"
        >
          Use a different address
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex w-full flex-col gap-3">
      <input
        type="email"
        required
        autoFocus
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        placeholder="you@example.com"
        className="rounded border px-3 py-2"
      />
      <button
        type="submit"
        disabled={status === "sending"}
        className="rounded bg-black px-3 py-2 text-white disabled:opacity-50"
      >
        {status === "sending" ? "Sending..." : submitLabel}
      </button>
      <p className="text-sm text-zinc-600">
        No password needed — we email you a link that signs you in.
      </p>
      {status === "error" && <p className="text-sm text-red-600">{error}</p>}
    </form>
  );
}
