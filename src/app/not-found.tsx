import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-3 px-4 py-16">
      <h1 className="text-2xl font-semibold tracking-tight">We can&apos;t find that</h1>
      <p className="text-sm leading-relaxed text-text-muted">
        The link might be wrong, or it might be for a project you&apos;re not
        part of yet. If a teammate sent it, ask them to send it again — an
        invite link only works if it&apos;s the full, unbroken address.
      </p>
      <Link href="/projects" className="btn btn-secondary self-start">
        Go to your projects
      </Link>
    </main>
  );
}
