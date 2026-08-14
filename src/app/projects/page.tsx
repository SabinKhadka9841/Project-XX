import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { NewProjectButton } from "./new-project-button";

export default async function ProjectsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: projects, error } = await supabase
    .from("projects")
    .select("id, name, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-6 px-4 py-16">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Your projects</h1>
        <NewProjectButton />
      </div>

      {projects.length === 0 ? (
        <p className="text-zinc-600">You&apos;re not in any projects yet.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {projects.map((project) => (
            <li key={project.id}>
              <Link
                href={`/projects/${project.id}`}
                className="block rounded border px-3 py-2 hover:bg-zinc-50"
              >
                {project.name}
              </Link>
            </li>
          ))}
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
