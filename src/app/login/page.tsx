"use client";

import { useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
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
        emailRedirectTo: `${window.location.origin}/auth/confirm`,
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
      <main className="flex flex-1 items-center justify-center">
        <p>Check your email for a sign-in link.</p>
      </main>
    );
  }

  return (
    <main className="flex flex-1 items-center justify-center">
      <form
        onSubmit={handleSubmit}
        className="flex w-full max-w-xs flex-col gap-4"
      >
        <h1 className="text-xl font-semibold">Sign in to Project Vault</h1>
        <input
          type="email"
          required
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
          {status === "sending" ? "Sending..." : "Email me a sign-in link"}
        </button>
        {status === "error" && (
          <p className="text-sm text-red-600">{error}</p>
        )}
      </form>
    </main>
  );
}
