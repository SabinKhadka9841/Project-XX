import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { branchFolder } from "@/modules/projects/branches";
import { getProject } from "@/modules/projects/projects";
import { decodeFileId, readAccessToken } from "@/modules/editor/wopi";

/**
 * GetFile / PutFile — the editor downloading the document, and posting
 * it back when it saves.
 *
 * Both are called by Collabora's server rather than a browser, so the
 * signed access_token is the only thing establishing who this is.
 */

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

/** Shared checks: valid token, and bound to the file being requested. */
async function authorise(request: Request, fileId: string) {
  const token = new URL(request.url).searchParams.get("access_token");
  const claims = readAccessToken(token);
  const file = decodeFileId(fileId);

  if (!claims || !file) return null;

  if (
    claims.projectId !== file.projectId ||
    claims.branchId !== file.branchId ||
    claims.filename !== file.filename
  ) {
    return null;
  }

  return { claims, file };
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ fileId: string }> },
) {
  const { fileId } = await params;
  const authorised = await authorise(request, fileId);

  if (!authorised) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { file } = authorised;
  const supabase = admin();

  const { data, error } = await supabase.storage
    .from("project-files")
    .download(`${branchFolder(file.projectId, file.branchId)}/${file.filename}`);

  if (error || !data) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return new NextResponse(await data.arrayBuffer(), {
    headers: { "Content-Type": "application/octet-stream" },
  });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ fileId: string }> },
) {
  const { fileId } = await params;
  const authorised = await authorise(request, fileId);

  if (!authorised) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { claims, file } = authorised;

  // A token minted for read-only viewing must not be able to save.
  if (!claims.canWrite) {
    return NextResponse.json({ error: "Read only" }, { status: 403 });
  }

  const supabase = admin();

  // Re-checked at save time, not just when the editor opened: a session
  // can sit open for hours, and the deadline may have passed in the
  // meantime. Otherwise leaving a tab open would be a way around the
  // lock.
  const project = await getProject(supabase, file.projectId);

  if (project?.isLocked) {
    return NextResponse.json(
      { error: "This project is closed — its due date has passed." },
      { status: 409 },
    );
  }

  const bytes = await request.arrayBuffer();

  // Collabora sends an empty body in some lifecycle calls; writing that
  // would truncate the document to nothing.
  if (bytes.byteLength === 0) {
    return NextResponse.json({ error: "Empty body ignored" }, { status: 400 });
  }

  const { error } = await supabase.storage
    .from("project-files")
    .upload(
      `${branchFolder(file.projectId, file.branchId)}/${file.filename}`,
      bytes,
      { upsert: true, contentType: "application/octet-stream" },
    );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({});
}
