import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

/**
 * The one piece of chrome every signed-in page shares, so the app feels
 * like a place you're inside rather than a series of loose documents.
 *
 * Hidden entirely when signed out: the marketing page and the invite
 * page are both first impressions, and a half-empty app bar on them
 * just gets in the way.
 */
export async function SiteHeader() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  return (
    <header className="sticky top-0 z-10 border-b border-border-subtle bg-surface/80 backdrop-blur">
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-4 py-3">
        <Link
          href="/projects"
          className="-my-1 flex items-center gap-2 py-1.5 font-semibold tracking-tight"
        >
          <VaultMark />
          Project Vault
        </Link>

        <div className="flex items-center gap-3">
          <span
            className="hidden text-sm text-text-muted sm:inline"
            title={user.email ?? undefined}
          >
            {user.email}
          </span>
          <form action="/auth/signout" method="post">
            <button type="submit" className="btn btn-ghost">
              Sign out
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}

/** A small closed-vault mark: a rounded square with a dial. */
function VaultMark() {
  return (
    <span
      aria-hidden="true"
      className="grid h-6 w-6 place-items-center rounded-md bg-accent text-accent-fg"
    >
      <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none">
        <circle
          cx="8"
          cy="8"
          r="4.25"
          stroke="currentColor"
          strokeWidth="1.6"
        />
        <path
          d="M8 5.5V8l1.75 1.25"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
      </svg>
    </span>
  );
}
