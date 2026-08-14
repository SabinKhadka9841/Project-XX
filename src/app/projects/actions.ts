"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function createProject(name: string) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .insert({ name })
    .select("id")
    .single();

  if (projectError) {
    throw new Error(projectError.message);
  }

  const { error: memberError } = await supabase
    .from("members")
    .insert({ project_id: project.id, user_id: user.id, role: "owner" });

  if (memberError) {
    throw new Error(memberError.message);
  }

  redirect(`/projects/${project.id}`);
}
