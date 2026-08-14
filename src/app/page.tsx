import Link from "next/link";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-12 px-4 py-16 text-center">
      <div className="flex max-w-xl flex-col gap-4">
        <h1 className="text-4xl font-semibold tracking-tight">
          Project Vault
        </h1>
        <p className="text-lg text-zinc-600">
          One final version of your group project. Everyone makes their own
          copy, proposes changes, and nothing reaches the final version
          without a teammate&apos;s okay.
        </p>
        <div className="mt-2 flex justify-center gap-3">
          <Link
            href="/login"
            className="rounded bg-black px-4 py-2 text-white"
          >
            Sign in
          </Link>
        </div>
      </div>

      <div className="grid w-full max-w-2xl gap-6 text-left sm:grid-cols-3">
        <div className="flex flex-col gap-1">
          <h2 className="font-medium">No lost work</h2>
          <p className="text-sm text-zinc-600">
            Make your own copy and edit freely. The final version stays safe
            until someone approves your changes.
          </p>
        </div>
        <div className="flex flex-col gap-1">
          <h2 className="font-medium">No guessing which file is current</h2>
          <p className="text-sm text-zinc-600">
            One protected final version, instead of files scattered across
            chats and drives.
          </p>
        </div>
        <div className="flex flex-col gap-1">
          <h2 className="font-medium">Know who did what</h2>
          <p className="text-sm text-zinc-600">
            Every accepted change is recorded, so contribution is never just
            a guess at the end.
          </p>
        </div>
      </div>
    </main>
  );
}
