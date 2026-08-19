import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function JoinProjectPage({
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
    redirect(`/login?next=/projects/${id}/join`);
  }

  // No separate "does this project exist" check: the members table's
  // SELECT policy only lets members see a project, and a brand-new
  // joiner isn't one yet — checking first always found nothing and
  // sent every genuine new member to a false 404. The insert's own
  // foreign key catches a bad id just as well.
  const { error } = await supabase
    .from("members")
    .insert({ project_id: id, user_id: user.id });

  if (error) {
    if (error.code === "23505") {
      // Already a member. Fine, just continue.
    } else if (error.code === "23503") {
      // No project with this id.
      notFound();
    } else {
      throw new Error(error.message);
    }
  }

  redirect(`/projects/${id}`);
}
