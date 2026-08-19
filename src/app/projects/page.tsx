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
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-6 px-4 py-16">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Your projects</h1>
        <NewProjectButton />
      </div>

      {projects.length === 0 ? (
        // A dead end otherwise: somebody signing in for the first time
        // has nothing here and no idea what to do next.
        <div className="flex flex-col gap-2 rounded border border-dashed p-4">
          <p className="font-medium">Nothing here yet</p>
          <p className="text-sm text-zinc-600">
            Start a project for a group assignment, then send your
            teammates the invite link. Everyone gets their own copy to work
            on, and the final version only changes when someone agrees to
            it.
          </p>
          <p className="text-sm text-zinc-600">
            If a teammate has already made one, ask them for the link —
            you don&apos;t need to create your own.
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {projects.map((project) => {
            const locked =
              project.deadline !== null &&
              new Date(project.deadline) < new Date();

            return (
              <li key={project.id}>
                <Link
                  href={`/projects/${project.id}`}
                  className="flex items-center justify-between gap-3 rounded border px-3 py-2 hover:bg-zinc-50"
                >
                  <span>{project.name}</span>
                  {project.deadline && (
                    <span
                      className={`shrink-0 text-xs ${
                        locked
                          ? "text-zinc-500"
                          : isDueSoon(project.deadline)
                            ? "font-medium text-red-600"
                            : "text-zinc-600"
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

      <div className="mt-8 flex items-center justify-between border-t pt-4 text-sm text-zinc-600">
        <span>Signed in as {user.email}</span>
        <form action="/auth/signout" method="post">
          <button type="submit" className="underline">
            Sign out
          </button>
        </form>
      </div>
    </main>
  );
}
