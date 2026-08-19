"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  branchFolder,
  copyBranch,
  getFinalBranch,
} from "@/modules/projects/branches";

export async function uploadFile(
  projectId: string,
  branchId: string,
  formData: FormData,
) {
  const file = formData.get("file");

  if (!(file instanceof File) || file.size === 0) {
    throw new Error("Choose a file first.");
  }

  const supabase = await createClient();

  const { error } = await supabase.storage
    .from("project-files")
    .upload(`${branchFolder(projectId, branchId)}/${file.name}`, file, {
      upsert: true,
    });

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath(`/projects/${projectId}`);
}

export async function makeCopy(projectId: string) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const final = await getFinalBranch(supabase, projectId);

  if (!final) {
    throw new Error("This project has no final version yet.");
  }

  const copy = await copyBranch(
    supabase,
    projectId,
    final.id,
    `${user.email ?? "Someone"}'s copy`,
    user.id,
  );

  redirect(`/projects/${projectId}/copies/${copy.id}`);
}
