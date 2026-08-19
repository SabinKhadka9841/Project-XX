import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center gap-14 px-4 py-20">
      <div className="flex flex-col items-center gap-5 text-center">
        <span className="inline-flex items-center gap-2 rounded-full border border-border-subtle bg-surface px-3 py-1 text-xs font-medium text-text-muted">
          For group assignments
        </span>

        <h1 className="max-w-2xl text-balance text-4xl font-semibold tracking-tight sm:text-5xl">
          One final version.
          <br />
          <span className="text-text-muted">Nobody overwrites anybody.</span>
        </h1>

        <p className="max-w-xl text-balance text-lg text-text-muted">
          Everyone works on their own copy. Changes only reach the final
          when a teammate agrees — so the version you hand in is never a
          surprise.
        </p>

        <div className="mt-2 flex flex-wrap items-center justify-center gap-3">
          <Link
            href={user ? "/projects" : "/login"}
            className="btn btn-primary px-5 py-2.5"
          >
            {user ? "Your projects" : "Get started"}
          </Link>
          {!user && (
            <span className="text-sm text-text-subtle">
              No password to make up
            </span>
          )}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Feature title="Nothing gets lost">
          Edit your own copy as freely as you like. The final stays exactly
          as it is until someone approves your changes.
        </Feature>
        <Feature title="One current version">
          No more guessing which file in the group chat is the latest one.
        </Feature>
        <Feature title="It remembers who did what">
          Every accepted change is recorded, so who did what isn&apos;t an
          argument at the end.
        </Feature>
      </div>
    </main>
  );
}

function Feature({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="card flex flex-col gap-1.5 p-5">
      <h2 className="font-medium">{title}</h2>
      <p className="text-sm leading-relaxed text-text-muted">{children}</p>
    </div>
  );
}
