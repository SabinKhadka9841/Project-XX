"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Mode = "link" | "password";

/**
 * Two ways in, because waiting on an email is miserable when you're
 * testing, and some people simply prefer a password.
 *
 * The magic link stays the default: it's the lowest-friction option for
 * a student joining from a group chat, who won't want to invent a
 * password to look at one file.
 */
export function SignInForm({
  next,
  submitLabel = "Email me a sign-in link",
}: {
  next: string;
  submitLabel?: string;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("link");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<"idle" | "working" | "sent" | "error">(
    "idle",
  );
  const [error, setError] = useState("");

  async function sendLink(event: FormEvent) {
    event.preventDefault();
    setStatus("working");
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

  async function withPassword(event: FormEvent) {
    event.preventDefault();
    setStatus("working");
    setError("");

    const supabase = createClient();

    // Try signing in first; if there's no account yet, make one. Saves
    // a separate "sign up" screen for what is, to the person, one step.
    const attempt = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (attempt.error) {
      const created = await supabase.auth.signUp({ email, password });

      if (created.error) {
        setStatus("error");
        // The sign-in error is the more useful one: a wrong password on
        // an existing account fails sign-up with a confusing message.
        setError(
          created.error.message.toLowerCase().includes("already")
            ? "That email already has an account, and that password doesn't match it."
            : created.error.message,
        );
        return;
      }

      // With email confirmation switched on, signUp returns no session.
      if (!created.data.session) {
        setStatus("error");
        setError(
          "Account created, but this project requires email confirmation before signing in. Use the emailed link instead, or turn confirmation off in Supabase → Authentication → Sign In / Providers.",
        );
        return;
      }
    }

    router.replace(next);
    router.refresh();
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
        <div className="flex flex-wrap gap-1">
          <button
            onClick={() => setStatus("idle")}
            className="btn btn-ghost -ml-3.5"
          >
            Use a different address
          </button>
          <button
            onClick={() => {
              setStatus("idle");
              setMode("password");
            }}
            className="btn btn-ghost"
          >
            Use a password instead
          </button>
        </div>
      </div>
    );
  }

  return (
    <form
      onSubmit={mode === "link" ? sendLink : withPassword}
      className="flex w-full flex-col gap-3"
    >
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

      {mode === "password" && (
        <input
          type="password"
          required
          minLength={6}
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="Password (at least 6 characters)"
          className="field py-2.5"
        />
      )}

      <button
        type="submit"
        disabled={status === "working"}
        className="btn btn-primary py-2.5"
      >
        {status === "working"
          ? mode === "link"
            ? "Sending…"
            : "Signing in…"
          : mode === "link"
            ? submitLabel
            : "Sign in"}
      </button>

      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-text-subtle">
          {mode === "link"
            ? "No password needed — we email you a link."
            : "Signs you in, or makes an account if you don't have one."}
        </p>
        <button
          type="button"
          onClick={() => {
            setMode(mode === "link" ? "password" : "link");
            setError("");
          }}
          className="btn btn-ghost shrink-0 text-xs"
        >
          {mode === "link" ? "Use a password" : "Email me a link"}
        </button>
      </div>

      {status === "error" && (
        <p className="rounded-md border border-danger-border bg-danger-soft px-3 py-2 text-sm leading-relaxed text-danger">
          {error}
        </p>
      )}
    </form>
  );
}
