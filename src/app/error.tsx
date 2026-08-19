"use client";

import Link from "next/link";

/**
 * Catches anything that throws while rendering a page, so people get a
 * plain explanation and a way out instead of a blank screen or a stack
 * trace they can't act on.
 */
export default function Error({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-3 px-4 py-16">
      <h1 className="text-2xl font-semibold tracking-tight">Something went wrong</h1>
      <p className="text-sm leading-relaxed text-text-muted">
        That&apos;s on us, not you. Nothing you&apos;ve saved has been lost —
        your files and copies are untouched.
      </p>
      <div className="flex items-center gap-3">
        <button
          onClick={reset}
          className="btn btn-primary"
        >
          Try again
        </button>
        <Link href="/projects" className="btn btn-ghost">
          Go to your projects
        </Link>
      </div>
    </main>
  );
}
