import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { branchFolder } from "@/modules/projects/branches";
import { decodeFileId, readAccessToken } from "@/modules/editor/wopi";

/**
 * CheckFileInfo — the first thing Collabora asks: what is this file,
 * how big, and what is this person allowed to do with it.
 *
 * Called by the editor server, not a browser, so there's no session
 * cookie. The access_token is the whole basis for trusting it, which is
 * why it's signed and carries the user and their permission.
 */

function admin() {
  // Service role because the caller is Collabora, not a signed-in
  // browser. Permission has already been decided when the token was
  // minted, and is re-checked below.
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ fileId: string }> },
) {
  const { fileId } = await params;
  const token = new URL(request.url).searchParams.get("access_token");
  const claims = readAccessToken(token);
  const file = decodeFileId(fileId);

  if (!claims || !file) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // The token is bound to one file: a valid token for your own document
  // must not open somebody else's by swapping the id in the URL.
  if (
    claims.projectId !== file.projectId ||
    claims.branchId !== file.branchId ||
    claims.filename !== file.filename
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = admin();
  const folder = branchFolder(file.projectId, file.branchId);

  const { data: listed, error } = await supabase.storage
    .from("project-files")
    .list(folder, { search: file.filename });

  const found = listed?.find((entry) => entry.name === file.filename);

  if (error || !found) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({
    BaseFileName: file.filename,
    Size: found.metadata?.size ?? 0,
    OwnerId: claims.userId,
    UserId: claims.userId,
    UserFriendlyName: claims.userName,
    UserCanWrite: claims.canWrite,
    UserCanNotWriteRelative: true, // no "save as" into our storage
    // Changes whenever the stored file changes, so the editor can tell
    // its cached copy from a newer one.
    Version: found.updated_at ?? found.created_at ?? "0",
    PostMessageOrigin: process.env.APP_ORIGIN ?? "http://localhost:4000",
  });
}
