import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

// OnlyOffice calls this endpoint directly, server-to-server, with no
// signed-in user — there's no login cookie to check. So this uses the
// service role key (full access, bypasses every permission rule) instead
// of the normal signed-in-user client. This key must never be exposed to
// the browser — it only ever lives here, on the server.
function supabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

export async function POST(request: Request) {
  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get("projectId");
  const filename = searchParams.get("filename");

  if (!projectId || !filename) {
    return NextResponse.json({ error: 1 });
  }

  const body = await request.json();

  // status 2 = editing finished, ready to save. status 6 = force-saved
  // while people are still editing. Every other status (still editing,
  // closed with no changes, an error) needs no action from us.
  if (body.status === 2 || body.status === 6) {
    const fileResponse = await fetch(body.url);

    if (!fileResponse.ok) {
      return NextResponse.json({ error: 1 });
    }

    const fileBlob = await fileResponse.blob();

    const { error } = await supabaseAdmin()
      .storage.from("project-files")
      .upload(`${projectId}/${filename}`, fileBlob, { upsert: true });

    if (error) {
      return NextResponse.json({ error: 1 });
    }
  }

  return NextResponse.json({ error: 0 });
}
