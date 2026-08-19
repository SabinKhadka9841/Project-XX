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
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 py-16">
      <div className="flex flex-col gap-1">
        <Link href={`/projects/${id}`} className="text-sm underline">
          ← {project.name}
        </Link>
        <h1 className="text-2xl font-semibold">Who did what</h1>
        <p className="text-sm text-zinc-600">
          Everything that has happened on this project, most recent first.
        </p>
      </div>

      {events.length === 0 ? (
        <p className="text-sm text-zinc-600">
          Nothing has happened yet. Once someone makes a copy and asks for it
          to be added in, it&apos;ll show up here.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {events.map((event) => (
            <li key={event.id} className="flex flex-col gap-0.5 text-sm">
              <span>
                <span className="font-medium">{event.actorName}</span>{" "}
                {describe(event)}
              </span>
              <span className="text-xs text-zinc-500">
                {formatWhen(event.at)}
              </span>
            </li>
          ))}
        </ul>
      )}

      <p className="border-t pt-4 text-xs text-zinc-500">
        This is a record of what happened, not a score. It deliberately
        doesn&apos;t rank anyone or work out percentages — plenty of real
        work (reading, planning, checking someone else&apos;s writing)
        never shows up as a file changing.
      </p>
    </main>
  );
}
