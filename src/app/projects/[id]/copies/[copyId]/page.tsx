import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  getBranch,
  listBranchFilesWithUrls,
} from "@/modules/projects/branches";
import { getPendingRequestForBranch } from "@/modules/change-requests";
import { countMembers } from "@/modules/projects/members";
import { getFinalBranch } from "@/modules/projects/branches";
import { findOverwriteRisk } from "@/modules/diffing";
import { OverwriteWarning } from "../../overwrite-warning";
import { uploadFile } from "../../actions";
import { AskButton } from "./ask-button";

const EDITABLE_EXTENSIONS = ["doc", "docx", "xls", "xlsx", "ppt", "pptx"];

function isEditable(filename: string) {
  const extension = filename.split(".").pop()?.toLowerCase();
  return extension ? EDITABLE_EXTENSIONS.includes(extension) : false;
}

export default async function CopyPage({
  params,
}: {
  params: Promise<{ id: string; copyId: string }>;
}) {
  const { id, copyId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Independent of each other, so fetch both at once rather than waiting
  // for one round trip to finish before starting the next.
  const [{ data: project }, copy] = await Promise.all([
    supabase.from("projects").select("name").eq("id", id).single(),
    getBranch(supabase, copyId),
  ]);

  // Guard against a copy id from a different project being pasted in.
  if (!project || !copy || copy.projectId !== id || copy.isFinal) {
    notFound();
  }

  const [files, pendingRequest, memberCount, final] = await Promise.all([
    listBranchFilesWithUrls(supabase, id, copy.id),
    getPendingRequestForBranch(supabase, copy.id),
    countMembers(supabase, id),
    getFinalBranch(supabase, id),
  ]);

  const isSolo = memberCount === 1;

  // Would adding this in quietly revert somebody else's work?
  const risk = final
    ? await findOverwriteRisk(supabase, id, copy.id, final.id)
    : { filenames: [], peopleWhoChangedIt: [] };

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-5 px-4 py-10">
      <div className="flex flex-col gap-1.5">
        <Link
          href={`/projects/${id}`}
          className="link self-start text-sm text-text-muted"
        >
          ← {project.name}
        </Link>
        <div className="flex items-center justify-between gap-3">
          <h1 className="min-w-0 truncate text-2xl font-semibold tracking-tight">
            {copy.name}
          </h1>
          {files.length > 0 && (
            <a
              href={`/projects/${id}/export?branch=${copy.id}`}
              className="btn btn-secondary shrink-0"
            >
              Download all
            </a>
          )}
        </div>
        <p className="text-sm text-text-muted">
          Changes here don&apos;t affect the final until they&apos;re added
          in.
        </p>
      </div>

      {files.length === 0 ? (
        <p className="card p-5 text-sm text-text-muted">No files yet.</p>
      ) : (
        <ul className="card flex flex-col divide-y divide-border-subtle px-5">
          {files.map((file) => (
            <li key={file.name} className="flex items-center gap-1">
              <a
                href={file.url ?? undefined}
                className="link min-w-0 truncate py-2.5 text-sm"
                target="_blank"
                rel="noreferrer"
              >
                {file.name}
              </a>
              {isEditable(file.name) && (
                <Link
                  href={`/projects/${id}/edit?branch=${copy.id}&file=${encodeURIComponent(file.name)}`}
                  className="btn btn-ghost shrink-0 py-2.5 text-accent"
                >
                  Open
                </Link>
              )}
            </li>
          ))}
        </ul>
      )}

      <form
        action={uploadFile.bind(null, id, copy.id)}
        className="card flex items-center gap-2 p-5"
      >
        <input
          type="file"
          name="file"
          required
          className="min-w-0 flex-1 text-sm text-text-muted file:mr-3 file:rounded-md file:border-0 file:bg-surface-muted file:px-3 file:py-1.5 file:text-sm file:text-text"
        />
        <button type="submit" className="btn btn-secondary">
          Upload
        </button>
      </form>

      <div className="card flex flex-col gap-3 p-5">
        <OverwriteWarning risk={risk} viewerEmail={user.email} />

        {pendingRequest ? (
          <p className="text-sm leading-relaxed text-text-muted">
            {isSolo ? (
              <>
                Ready to go in. You&apos;re the only person on this project,
                so add it in yourself from the{" "}
                <Link href={`/projects/${id}`} className="link">
                  project page
                </Link>
                .
              </>
            ) : (
              <>
                You&apos;ve asked for this to be added in. Waiting for a
                teammate to say yes.
              </>
            )}
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            <p className="text-sm leading-relaxed text-text-muted">
              {isSolo
                ? "Happy with these changes? Mark them ready, then add them into the final yourself."
                : "Happy with these changes? Ask a teammate to add them into the final."}
            </p>
            <AskButton projectId={id} copyId={copy.id} />
          </div>
        )}
      </div>
    </main>
  );
}
