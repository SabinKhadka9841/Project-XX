import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  copyBranch,
  getFinalBranch,
  listBranches,
} from "@/modules/projects/branches";
import type {
  ApiError,
  CreateCopyResponse,
  ListCopiesResponse,
} from "@/shared/types";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
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

  const branches = await listBranches(supabase, id);

  return NextResponse.json<ListCopiesResponse>(
    branches
      .filter((branch) => !branch.isFinal)
      .map((branch) => ({
        id: branch.id,
        projectId: branch.projectId,
        name: branch.name,
        createdBy: branch.createdBy,
        createdAt: branch.createdAt,
      })),
  );
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
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

  const final = await getFinalBranch(supabase, id);

  if (!final) {
    return NextResponse.json<ApiError>({ error: "Not found" }, { status: 404 });
  }

  const copy = await copyBranch(
    supabase,
    id,
    final.id,
    `${user.email ?? "Someone"}'s copy`,
    user.id,
  );

  return NextResponse.json<CreateCopyResponse>(
    {
      id: copy.id,
      projectId: copy.projectId,
      name: copy.name,
      createdBy: copy.createdBy,
      createdAt: copy.createdAt,
    },
    { status: 201 },
  );
}
