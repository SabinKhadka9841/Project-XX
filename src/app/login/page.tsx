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
    <main className="mx-auto flex w-full max-w-xs flex-1 flex-col justify-center gap-4 px-4">
      <h1 className="text-xl font-semibold">Sign in to Project Vault</h1>
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
