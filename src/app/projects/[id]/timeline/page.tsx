import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  getProjectTimeline,
  type TimelineEvent,
} from "@/modules/attribution";

function describe(event: TimelineEvent) {
  const copy = event.branchName ?? "a copy";

  switch (event.type) {
    case "copy_made":
      return `made ${copy}`;
    case "asked_to_add_in":
      return `asked to add ${copy} in`;
    case "added_in":
      return `added ${copy} into the final`;
    case "said_no":
      return `said no to ${copy}`;
  }
}

function formatWhen(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export default async function TimelinePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const [{ data: project }, events] = await Promise.all([
    supabase.from("projects").select("name").eq("id", id).single(),
    getProjectTimeline(supabase, id),
  ]);

  if (!project) {
    notFound();
  }

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-5 px-4 py-10">
      <div className="flex flex-col gap-1">
        <Link
          href={`/projects/${id}`}
          className="link self-start text-sm text-text-muted"
        >
          ← {project.name}
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">Who did what</h1>
        <p className="text-sm text-text-muted">
          Everything that has happened on this project, most recent first.
        </p>
      </div>

      {events.length === 0 ? (
        <p className="card p-5 text-sm leading-relaxed text-text-muted">
          Nothing has happened yet. Once someone makes a copy and asks for it
          to be added in, it&apos;ll show up here.
        </p>
      ) : (
        <ul className="card flex flex-col divide-y divide-border-subtle px-5">
          {events.map((event) => (
            <li key={event.id} className="flex flex-col gap-0.5 py-3.5 text-sm">
              <span className="leading-relaxed">
                <span className="font-medium">{event.actorName}</span>{" "}
                <span className="text-text-muted">{describe(event)}</span>
              </span>
              <span className="text-xs text-text-subtle">
                {formatWhen(event.at)}
              </span>
            </li>
          ))}
        </ul>
      )}

      <p className="text-xs leading-relaxed text-text-subtle">
        This is a record of what happened, not a score. It deliberately
        doesn&apos;t rank anyone or work out percentages — plenty of real
        work (reading, planning, checking someone else&apos;s writing)
        never shows up as a file changing.
      </p>
    </main>
  );
}
