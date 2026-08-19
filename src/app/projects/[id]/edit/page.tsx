import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getBranch } from "@/modules/projects/branches";
import { getProject } from "@/modules/projects/projects";
import {
  createAccessToken,
  encodeFileId,
  getEditorUrl,
} from "@/modules/editor/wopi";
import { CollaboraEditor } from "./collabora-editor";

/**
 * Collabora runs in Docker, so "localhost" inside that container is the
 * container itself. host.docker.internal is how it reaches this app.
 */
const WOPI_HOST = process.env.WOPI_HOST ?? "http://host.docker.internal:4000";

/** What Collabora can genuinely edit. */
const EDITABLE = new Set([
  "doc",
  "docx",
  "odt",
  "xls",
  "xlsx",
  "ods",
  "ppt",
  "pptx",
  "odp",
]);

export default async function EditFilePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ file?: string; branch?: string }>;
}) {
  const { id } = await params;
  const { file, branch: branchId } = await searchParams;

  if (!file || !branchId) {
    notFound();
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const [project, branch] = await Promise.all([
    getProject(supabase, id),
    getBranch(supabase, branchId),
  ]);

  // Guard against a version id from another project being pasted in.
  if (!project || !branch || branch.projectId !== id) {
    notFound();
  }

  const extension = file.split(".").pop()?.toLowerCase() ?? "";

  if (!EDITABLE.has(extension)) {
    return (
      <main className="flex flex-1 items-center justify-center px-4 text-center">
        <p className="text-sm leading-relaxed text-text-muted">
          &quot;{file}&quot; can&apos;t be opened in the in-browser editor
          (only Word, Excel and PowerPoint files can). Download it from the
          project page instead.
        </p>
      </main>
    );
  }

  const editorUrl = await getEditorUrl(file);

  if (!editorUrl) {
    return (
      <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-3 px-4 text-center">
        <p className="text-sm font-medium">The editor isn&apos;t running</p>
        <p className="text-sm leading-relaxed text-text-muted">
          Start it with{" "}
          <code className="rounded bg-surface-muted px-1">
            docker start collabora
          </code>{" "}
          and reload.
        </p>
      </main>
    );
  }

  const backTo = branch.isFinal
    ? `/projects/${id}`
    : `/projects/${id}/copies/${branch.id}`;

  // A passed deadline closes the final. Copies stay editable, so this
  // only ever locks the submitted version.
  const canWrite = !(project.isLocked && branch.isFinal);

  const fileId = encodeFileId(id, branch.id, file);
  const { token, expiresAtMs } = createAccessToken({
    projectId: id,
    branchId: branch.id,
    filename: file,
    userId: user.id,
    userName: user.email ?? "Someone",
    canWrite,
  });

  return (
    <main className="flex flex-1 flex-col">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border-subtle bg-surface px-4 py-2.5 text-sm">
        <span className="min-w-0 truncate text-text-muted">
          {project.name} / {branch.name} / {file}
        </span>
        <span className="flex items-center gap-3">
          {!canWrite && (
            <span className="text-xs text-text-subtle">
              Read only — the due date has passed
            </span>
          )}
          <Link href={backTo} className="btn btn-secondary py-1.5">
            Done
          </Link>
        </span>
      </div>

      <CollaboraEditor
        editorUrl={editorUrl}
        wopiSrc={`${WOPI_HOST}/wopi/files/${fileId}`}
        accessToken={token}
        accessTokenTtl={expiresAtMs}
        filename={file}
      />
    </main>
  );
}
