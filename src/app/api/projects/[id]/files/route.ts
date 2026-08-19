import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type {
  ApiError,
  ListProjectFilesResponse,
  UploadProjectFileResponse,
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

  const { data: storageFiles, error } = await supabase.storage
    .from("project-files")
    .list(id);

  if (error) {
    return NextResponse.json<ApiError>(
      { error: error.message },
      { status: 500 },
    );
  }

  const files: ListProjectFilesResponse = await Promise.all(
    (storageFiles ?? []).map(async (file) => {
      const { data: signed } = await supabase.storage
        .from("project-files")
        .createSignedUrl(`${id}/${file.name}`, 60);

      return {
        name: file.name,
        sizeBytes: file.metadata?.size ?? 0,
        lastModified: file.updated_at ?? file.created_at,
        url: signed?.signedUrl ?? null,
        projectId: id,
      };
    }),
  );

  return NextResponse.json<ListProjectFilesResponse>(files);
}

export async function POST(
  request: Request,
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
    .upload(`${id}/${file.name}`, file, { upsert: true });

  if (error) {
    return NextResponse.json<ApiError>(
      { error: error.message },
      { status: 500 },
    );
  }

  return NextResponse.json<UploadProjectFileResponse>(
    { name: file.name, sizeBytes: file.size, projectId: id },
    { status: 201 },
  );
}
