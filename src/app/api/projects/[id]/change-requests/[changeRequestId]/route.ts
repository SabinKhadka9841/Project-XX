import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  ChangeRequestError,
  approveChangeRequest,
  rejectChangeRequest,
} from "@/modules/change-requests";
import type {
  ApiError,
  DecideChangeRequestRequest,
  DecideChangeRequestResponse,
} from "@/shared/types";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; changeRequestId: string }> },
) {
  const { changeRequestId } = await params;
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

  const body: Partial<DecideChangeRequestRequest> | null = await request
    .json()
    .catch(() => null);

  if (body?.decision !== "approve" && body?.decision !== "reject") {
    return NextResponse.json<ApiError>(
      { error: 'decision must be "approve" or "reject"' },
      { status: 400 },
    );
  }

  try {
    const decide =
      body.decision === "approve" ? approveChangeRequest : rejectChangeRequest;

    const result = await decide(supabase, {
      changeRequestId,
      reviewerId: user.id,
    });

    return NextResponse.json<DecideChangeRequestResponse>(result);
  } catch (error) {
    if (error instanceof ChangeRequestError) {
      return NextResponse.json<ApiError>(
        { error: error.message },
        { status: 409 },
      );
    }
    throw error;
  }
}
