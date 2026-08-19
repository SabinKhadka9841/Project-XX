"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { SignInForm } from "./sign-in-form";

function LoginContent() {
  const searchParams = useSearchParams();
  const rawNext = searchParams.get("next");
  // Only ever redirect somewhere inside this app.
  const next = rawNext && rawNext.startsWith("/") ? rawNext : "/projects";

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-5 px-4 py-16">
      <div className="flex flex-col gap-1.5">
        <h1 className="text-2xl font-semibold tracking-tight">
          Sign in to Project Vault
        </h1>
        <p className="text-sm text-text-muted">
          Your group&apos;s work, with one version everyone agrees on.
        </p>
      </div>
      <SignInForm next={next} />
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginContent />
    </Suspense>
  );
}
