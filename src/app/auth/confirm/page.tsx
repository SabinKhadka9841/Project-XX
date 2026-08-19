"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/**
 * Where a sign-in link lands.
 *
 * This has to run in the browser, not on the server. Supabase can hand
 * the session back two different ways, and one of them is invisible to
 * a server:
 *
 *   ?code=...        exchanged for a session (PKCE flow)
 *   #access_token=   set directly (implicit flow)
 *
 * The second is a URL *fragment*, and browsers never send fragments to
 * the server. This page used to be a server route handler that only
 * looked for `code`, so every implicit-flow link silently fell through
 * to the "something went wrong" branch and bounced back to /login —
 * i.e. clicking the emailed link never signed anybody in.
 *
 * Handling both here means it works whichever flow the project is
 * configured for, instead of depending on that staying put.
 */
function Confirm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState("");

  useEffect(() => {
    const supabase = createClient();

    const rawNext = searchParams.get("next");
    const next = rawNext && rawNext.startsWith("/") ? rawNext : "/projects";

    (async () => {
      const code = searchParams.get("code");
      const hash = new URLSearchParams(window.location.hash.slice(1));
      const accessToken = hash.get("access_token");
      const refreshToken = hash.get("refresh_token");

      // Supabase reports failures in the fragment too.
      const linkError =
        hash.get("error_description") ?? searchParams.get("error_description");

      if (linkError) {
        setError(linkError);
        return;
      }

      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) {
          setError(error.message);
          return;
        }
      } else if (accessToken && refreshToken) {
        const { error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        if (error) {
          setError(error.message);
          return;
        }
      } else {
        setError("That link didn't carry a sign-in with it.");
        return;
      }

      // replace() so the tokens don't sit in history.
      router.replace(next);
    })();
  }, [router, searchParams]);

  if (error) {
    return (
      <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-3 px-4 py-16">
        <h1 className="text-2xl font-semibold tracking-tight">
          That link didn&apos;t work
        </h1>
        <p className="text-sm leading-relaxed text-text-muted">{error}</p>
        <p className="text-sm leading-relaxed text-text-muted">
          Sign-in links expire, and each one only works once. Ask for a fresh
          one and it should go straight through.
        </p>
        <a href="/login" className="btn btn-primary self-start">
          Get a new link
        </a>
      </main>
    );
  }

  return (
    <main className="flex flex-1 items-center justify-center px-4">
      <p className="text-sm text-text-muted">Signing you in…</p>
    </main>
  );
}

export default function ConfirmPage() {
  return (
    <Suspense>
      <Confirm />
    </Suspense>
  );
}
