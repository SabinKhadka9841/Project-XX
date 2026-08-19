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
      <h1 className="text-xl font-semibold">Something went wrong</h1>
      <p className="text-sm text-zinc-600">
        That&apos;s on us, not you. Nothing you&apos;ve saved has been lost —
        your files and copies are untouched.
      </p>
      <div className="flex items-center gap-3">
        <button
          onClick={reset}
          className="rounded bg-black px-3 py-2 text-sm text-white"
        >
          Try again
        </button>
        <Link href="/projects" className="text-sm underline">
          Go to your projects
        </Link>
      </div>
    </main>
  );
}
