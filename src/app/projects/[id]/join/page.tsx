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

  const { data: project } = await supabase
    .from("projects")
    .select("id")
    .eq("id", id)
    .single();

  if (!project) {
    notFound();
  }

  const { error } = await supabase
    .from("members")
    .insert({ project_id: id, user_id: user.id });

  // Error code 23505 = already a member. That's fine, just continue.
  if (error && error.code !== "23505") {
    throw new Error(error.message);
  }

  redirect(`/projects/${id}`);
}
