import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  isDueSoon,
  timeLeftInWords,
} from "@/modules/projects/deadline-wording";
import { NewProjectButton } from "./new-project-button";

export default async function ProjectsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data, error } = await supabase
    .from("projects")
    .select("id, name, deadline, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  const projects = data as {
    id: string;
    name: string;
    deadline: string | null;
    created_at: string;
  }[];

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-5 px-4 py-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">
          Your projects
        </h1>
        <NewProjectButton />
      </div>

      {projects.length === 0 ? (
        // A dead end otherwise: somebody signing in for the first time
        // has nothing here and no idea what to do next.
        <div className="card flex flex-col gap-2 border-dashed p-6">
          <p className="font-medium">Nothing here yet</p>
          <p className="text-sm leading-relaxed text-text-muted">
            Start a project for a group assignment, then send your teammates
            the invite link. Everyone gets their own copy to work on, and the
            final version only changes when someone agrees to it.
          </p>
          <p className="text-sm leading-relaxed text-text-muted">
            If a teammate has already made one, ask them for the link — you
            don&apos;t need to create your own.
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {projects.map((project) => {
            const locked =
              project.deadline !== null &&
              new Date(project.deadline) < new Date();
            const soon = project.deadline !== null && isDueSoon(project.deadline);

            return (
              <li key={project.id}>
                <Link
                  href={`/projects/${project.id}`}
                  className="card group flex items-center justify-between gap-3 px-4 py-3.5 transition-colors hover:border-border-strong hover:bg-surface-muted"
                >
                  <span className="flex min-w-0 items-center gap-3">
                    <span className="truncate font-medium">{project.name}</span>
                  </span>

                  {project.deadline && (
                    <span
                      className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${
                        locked
                          ? "bg-surface-muted text-text-subtle"
                          : soon
                            ? "bg-danger-soft text-danger"
                            : "bg-surface-muted text-text-muted"
                      }`}
                    >
                      {timeLeftInWords(project.deadline)}
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
