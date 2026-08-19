import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  branchFolder,
  getBranch,
  getFinalBranch,
  listBranchFilesWithUrls,
} from "@/modules/projects/branches";
import { getProject } from "@/modules/projects/projects";
import type {
  ApiError,
  ListProjectFilesResponse,
  UploadProjectFileResponse,
} from "@/shared/types";

/**
 * Resolves which version to act on: ?branchId=... if given, otherwise the
 * project's final version. Returns null if the id doesn't belong to this
 * project, so a version id from someone else's project can't be used.
 */
async function resolveBranch(
  supabase: Awaited<ReturnType<typeof createClient>>,
  projectId: string,
  branchId: string | null,
) {
  if (!branchId) {
    return await getFinalBranch(supabase, projectId);
  }

  const branch = await getBranch(supabase, branchId);
  return branch && branch.projectId === projectId ? branch : null;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const branchId = new URL(request.url).searchParams.get("branchId");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json<ApiError>(
      { error: "Not signed in" },
      { status: 401 },
    );
  }

  const branch = await resolveBranch(supabase, id, branchId);

  if (!branch) {
    return NextResponse.json<ApiError>({ error: "Not found" }, { status: 404 });
  }

  const storageFiles = await listBranchFilesWithUrls(supabase, id, branch.id);

  const files: ListProjectFilesResponse = storageFiles.map((file) => ({
    name: file.name,
    sizeBytes: file.sizeBytes,
    lastModified: file.lastModified,
    url: file.url,
    projectId: id,
    branchId: branch.id,
  }));

  return NextResponse.json<ListProjectFilesResponse>(files);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const branchId = new URL(request.url).searchParams.get("branchId");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json<ApiError>(
      { error: "Not signed in" },
      { status: 401 },
    );
  }

  const branch = await resolveBranch(supabase, id, branchId);

  if (!branch) {
    return NextResponse.json<ApiError>({ error: "Not found" }, { status: 404 });
  }

  // Checked up front so a locked project gives a readable reason
  // rather than a raw database error from the policy that also
  // enforces this.
  if (branch.isFinal) {
    const project = await getProject(supabase, id);

    if (project?.isLocked) {
      return NextResponse.json<ApiError>(
        {
          error:
            "This project is closed — its due date has passed, so the final can't be changed.",
        },
        { status: 409 },
      );
    }
  }

  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json<ApiError>(
      { error: "Choose a file first." },
      { status: 400 },
    );
  }

  const { error } = await supabase.storage
    .from("project-files")
    .upload(`${branchFolder(id, branch.id)}/${file.name}`, file, {
      upsert: true,
    });

  if (error) {
    return NextResponse.json<ApiError>(
      { error: error.message },
      { status: 500 },
    );
  }

  return NextResponse.json<UploadProjectFileResponse>(
    {
      name: file.name,
      sizeBytes: file.size,
      projectId: id,
      branchId: branch.id,
    },
    { status: 201 },
  );
}
