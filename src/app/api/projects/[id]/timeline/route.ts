import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getProjectTimeline } from "@/modules/attribution";
import type { ApiError, GetTimelineResponse } from "@/shared/types";

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

  const events = await getProjectTimeline(supabase, id);

  return NextResponse.json<GetTimelineResponse>(events);
}
