import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { ApiError, GetMeResponse } from "@/shared/types";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !user.email) {
    return NextResponse.json<ApiError>(
      { error: "Not signed in" },
      { status: 401 },
    );
  }

  return NextResponse.json<GetMeResponse>({ id: user.id, email: user.email });
}
