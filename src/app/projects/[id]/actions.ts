"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  branchFolder,
  copyBranch,
  getFinalBranch,
} from "@/modules/projects/branches";
import {
  ChangeRequestError,
  approveChangeRequest,
  createChangeRequest,
  rejectChangeRequest,
} from "@/modules/change-requests";

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

/**
 * Returns an error message rather than throwing, so the button can show
 * it. Everything here is something the person can act on ("you already
 * asked"), not a crash.
 */
export async function askToAddThisIn(
  projectId: string,
  copyId: string,
  message: string | null,
): Promise<{ error: string } | void> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  try {
    await createChangeRequest(supabase, {
      projectId,
      sourceBranchId: copyId,
      authorId: user.id,
      message,
    });
  } catch (error) {
    if (error instanceof ChangeRequestError) {
      return { error: error.message };
    }
    throw error;
  }

  revalidatePath(`/projects/${projectId}`);
  revalidatePath(`/projects/${projectId}/copies/${copyId}`);
}

/**
 * Same "return the error, don't throw" shape as askToAddThisIn — every
 * failure here is something the reviewer can understand ("you can't
 * approve your own copy"), not a crash.
 */
export async function decideChangeRequest(
  projectId: string,
  changeRequestId: string,
  decision: "approve" | "reject",
): Promise<{ error: string } | void> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  try {
    if (decision === "approve") {
      await approveChangeRequest(supabase, {
        changeRequestId,
        reviewerId: user.id,
      });
    } else {
      await rejectChangeRequest(supabase, {
        changeRequestId,
        reviewerId: user.id,
      });
    }
  } catch (error) {
    if (error instanceof ChangeRequestError) {
      return { error: error.message };
    }
    throw error;
  }

  revalidatePath(`/projects/${projectId}`);
}
