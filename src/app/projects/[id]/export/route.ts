import { zip } from "fflate";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  branchFolder,
  getBranch,
  getFinalBranch,
  listBranchFiles,
} from "@/modules/projects/branches";
import { getProject } from "@/modules/projects/projects";

/** Keeps a project name usable as a filename across operating systems. */
function safeFilename(name: string) {
  return name.replace(/[^a-z0-9 _-]/gi, "").trim() || "project";
}

function zipAsync(files: Record<string, Uint8Array>): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    // level 0: these are .docx/.xlsx/.pptx, which are already zip
    // archives internally. Recompressing costs time and saves almost
    // nothing.
    zip(files, { level: 0 }, (error, data) =>
      error ? reject(error) : resolve(data),
    );
  });
}

/**
 * Download everything in one version as a single zip.
 *
 * A plain browser navigation, not a fetch: the point is that the file
 * lands in the person's Downloads folder ready to hand in.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const branchId = new URL(request.url).searchParams.get("branch");
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const [project, branch] = await Promise.all([
    getProject(supabase, id),
    branchId ? getBranch(supabase, branchId) : getFinalBranch(supabase, id),
  ]);

  if (!project || !branch || branch.projectId !== id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const files = await listBranchFiles(supabase, id, branch.id);

  if (files.length === 0) {
    return NextResponse.json(
      { error: "There are no files to export yet." },
      { status: 409 },
    );
  }

  const folder = branchFolder(id, branch.id);
  const contents: Record<string, Uint8Array> = {};

  for (const file of files) {
    const { data, error } = await supabase.storage
      .from("project-files")
      .download(`${folder}/${file.name}`);

    if (error || !data) {
      return NextResponse.json(
        { error: `Couldn't read ${file.name}.` },
        { status: 500 },
      );
    }

    contents[file.name] = new Uint8Array(await data.arrayBuffer());
  }

  const archive = await zipAsync(contents);
  const label = branch.isFinal ? "final" : safeFilename(branch.name);
  const filename = `${safeFilename(project.name)} - ${label}.zip`;

  return new NextResponse(archive as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/zip",
      // The quotes matter: project names contain spaces.
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": String(archive.byteLength),
    },
  });
}
