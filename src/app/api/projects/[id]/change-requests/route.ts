import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  ChangeRequestError,
  createChangeRequest,
  listChangeRequests,
} from "@/modules/change-requests";
import type {
  ApiError,
  CreateChangeRequestRequest,
  CreateChangeRequestResponse,
  ListChangeRequestsResponse,
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

  const requests = await listChangeRequests(supabase, id);

  return NextResponse.json<ListChangeRequestsResponse>(requests);
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

  const body: Partial<CreateChangeRequestRequest> | null = await request
    .json()
    .catch(() => null);

  if (!body?.sourceBranchId) {
    return NextResponse.json<ApiError>(
      { error: "sourceBranchId is required" },
      { status: 400 },
    );
  }

  try {
    const created = await createChangeRequest(supabase, {
      projectId: id,
      sourceBranchId: body.sourceBranchId,
      authorId: user.id,
      message: body.message ?? null,
    });

    return NextResponse.json<CreateChangeRequestResponse>(created, {
      status: 201,
    });
  } catch (error) {
    // These are all things the person can act on, so they get a 409
    // with a readable message rather than a generic 500.
    if (error instanceof ChangeRequestError) {
      return NextResponse.json<ApiError>(
        { error: error.message },
        { status: 409 },
      );
    }
    throw error;
  }
}
