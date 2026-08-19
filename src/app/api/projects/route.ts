import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type {
  ApiError,
  CreateProjectRequest,
  CreateProjectResponse,
  ListProjectsResponse,
} from "@/shared/types";

export async function GET() {
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

  const { data: projects, error } = await supabase
    .from("projects")
    .select("id, name, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json<ApiError>(
      { error: error.message },
      { status: 500 },
    );
  }

  return NextResponse.json<ListProjectsResponse>(
    projects.map((project) => ({
      id: project.id,
      name: project.name,
      createdAt: project.created_at,
    })),
  );
}

export async function POST(request: Request) {
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

  const body: Partial<CreateProjectRequest> | null = await request
    .json()
    .catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";

  if (!name) {
    return NextResponse.json<ApiError>(
      { error: "Project name is required" },
      { status: 400 },
    );
  }

  // Generated here, not read back from the database, because a brand-new
  // project has no member row yet — see the same note in
  // src/app/projects/actions.ts for why that matters.
  const projectId = randomUUID();

  const { error: projectError } = await supabase
    .from("projects")
    .insert({ id: projectId, name });

  if (projectError) {
    return NextResponse.json<ApiError>(
      { error: projectError.message },
      { status: 500 },
    );
  }

  const { error: memberError } = await supabase
    .from("members")
    .insert({ project_id: projectId, user_id: user.id, role: "owner" });

  if (memberError) {
    return NextResponse.json<ApiError>(
      { error: memberError.message },
      { status: 500 },
    );
  }

  return NextResponse.json<CreateProjectResponse>(
    { id: projectId, name, createdAt: new Date().toISOString() },
    { status: 201 },
  );
}
