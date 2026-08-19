"use server";

import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createFinalBranch } from "@/modules/projects/branches";

export async function createProject(name: string) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Generated here (not read back from the database) because a brand-new
  // project has no member row yet, so the "members can view their
  // projects" policy would block reading it back until after the next
  // insert below.
  const projectId = randomUUID();

  const { error: projectError } = await supabase
    .from("projects")
    .insert({ id: projectId, name });

  if (projectError) {
    throw new Error(projectError.message);
  }

  const { error: memberError } = await supabase
    .from("members")
    .insert({ project_id: projectId, user_id: user.id, role: "owner" });

  if (memberError) {
    throw new Error(memberError.message);
  }

  // Every project starts with one protected final version. Created after
  // the member row above, because the policy that lets you create a
  // version checks that you're already a member of the project.
  await createFinalBranch(supabase, projectId, user.id);

  redirect(`/projects/${projectId}`);
}
