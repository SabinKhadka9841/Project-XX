import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function ProjectsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4">
      <p>Signed in as {user.email}</p>
      <form action="/auth/signout" method="post">
        <button type="submit" className="rounded border px-3 py-2">
          Sign out
        </button>
      </form>
    </main>
  );
}
