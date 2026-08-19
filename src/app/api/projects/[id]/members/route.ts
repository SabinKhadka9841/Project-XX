import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { listMembers } from "@/modules/projects/members";
import type { ApiError, ListMembersResponse } from "@/shared/types";

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

  const members = await listMembers(supabase, id);

  return NextResponse.json<ListMembersResponse>(members);
}
