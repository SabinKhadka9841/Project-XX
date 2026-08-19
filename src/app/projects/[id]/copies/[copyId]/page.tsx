import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  getBranch,
  listBranchFilesWithUrls,
} from "@/modules/projects/branches";
import { getPendingRequestForBranch } from "@/modules/change-requests";
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

  const [files, pendingRequest] = await Promise.all([
    listBranchFilesWithUrls(supabase, id, copy.id),
    getPendingRequestForBranch(supabase, copy.id),
  ]);

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 py-16">
      <div className="flex flex-col gap-1">
        <Link href={`/projects/${id}`} className="text-sm underline">
          ← {project.name}
        </Link>
        <h1 className="text-2xl font-semibold">{copy.name}</h1>
        <p className="text-sm text-zinc-600">
          Changes here don&apos;t affect the final until they&apos;re added
          in.
        </p>
      </div>

      {files.length === 0 ? (
        <p className="text-sm text-zinc-600">No files yet.</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {files.map((file) => (
            <li key={file.name} className="flex items-center gap-3">
              <a
                href={file.url ?? undefined}
                className="text-sm underline"
                target="_blank"
                rel="noreferrer"
              >
                {file.name}
              </a>
              {isEditable(file.name) && (
                <Link
                  href={`/projects/${id}/edit?branch=${copy.id}&file=${encodeURIComponent(file.name)}`}
                  className="text-sm text-zinc-600 underline"
                >
                  Open
                </Link>
              )}
            </li>
          ))}
        </ul>
      )}

      <form action={uploadFile.bind(null, id, copy.id)} className="flex gap-2">
        <input type="file" name="file" required className="flex-1 text-sm" />
        <button
          type="submit"
          className="rounded border px-3 py-2 text-sm hover:bg-zinc-50"
        >
          Upload
        </button>
      </form>

      <div className="border-t pt-6">
        {pendingRequest ? (
          <p className="text-sm text-zinc-600">
            You&apos;ve asked for this to be added in. Waiting for a teammate
            to say yes.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            <p className="text-sm text-zinc-600">
              Happy with these changes? Ask a teammate to add them into the
              final.
            </p>
            <AskButton projectId={id} copyId={copy.id} />
          </div>
        )}
      </div>
    </main>
  );
}
