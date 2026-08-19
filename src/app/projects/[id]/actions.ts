"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function uploadFile(projectId: string, formData: FormData) {
  const file = formData.get("file");

  if (!(file instanceof File) || file.size === 0) {
    throw new Error("Choose a file first.");
  }

  const supabase = await createClient();

  const { error } = await supabase.storage
    .from("project-files")
    .upload(`${projectId}/${file.name}`, file, { upsert: true });

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath(`/projects/${projectId}`);
}
