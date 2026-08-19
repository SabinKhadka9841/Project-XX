import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  listBranchFilesWithUrls,
  listBranches,
} from "@/modules/projects/branches";
import { listChangeRequests } from "@/modules/change-requests";
import { listMembers } from "@/modules/projects/members";
import { PeoplePanel } from "./people-panel";
import { getProject } from "@/modules/projects/projects";
import { DeadlinePanel } from "./deadline-panel";
import { DecideButtons } from "./decide-buttons";
import { MakeCopyButton } from "./make-copy-button";
import { uploadFile } from "./actions";

const EDITABLE_EXTENSIONS = ["doc", "docx", "xls", "xlsx", "ppt", "pptx"];

function isEditable(filename: string) {
  const extension = filename.split(".").pop()?.toLowerCase();
  return extension ? EDITABLE_EXTENSIONS.includes(extension) : false;
}

export default async function ProjectPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ joined?: string }>;
}) {
  const { id } = await params;
  const { joined } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Supabase is in a different region, so each call is a slow round trip.
  // These two don't depend on each other, so ask for them at the same
  // time instead of waiting for one before starting the other.
  const [project, branches, changeRequests, members] = await Promise.all([
    getProject(supabase, id),
    listBranches(supabase, id),
    listChangeRequests(supabase, id),
    listMembers(supabase, id),
  ]);

  // On your own there's nobody to ask, so you decide your own requests
  // — otherwise a solo project could never change its final at all.
  const isSolo = members.length === 1;

  // listBranches already returned every version, so pick the final one
  // out of it rather than asking the database a second time.
  const final = branches.find((branch) => branch.isFinal);

  if (!project || !final) {
    notFound();
  }

  const copies = branches.filter((branch) => !branch.isFinal);
  const files = await listBranchFilesWithUrls(supabase, id, final.id);

  const pending = changeRequests.filter(
    (request) => request.status === "pending",
  );
  const branchNameById = new Map(
    branches.map((branch) => [branch.id, branch.name]),
  );

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-8 px-4 py-16">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{project.name}</h1>
        <Link href={`/projects/${id}/timeline`} className="text-sm underline">
          Who did what
        </Link>
      </div>

      {joined === "1" && (
        <div className="rounded border border-zinc-300 bg-zinc-50 p-4 text-sm">
          <p className="font-medium">You&apos;re in.</p>
          <p className="mt-1 text-zinc-600">
            To change anything, make your own copy — you can edit it freely
            without touching the final. When you&apos;re happy, ask a
            teammate to add it in.
          </p>
        </div>
      )}

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="font-medium">The final</h2>
          {files.length > 0 && (
            <a
              href={`/projects/${id}/export`}
              className="text-sm underline"
            >
              Download all
            </a>
          )}
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
                    href={`/projects/${id}/edit?branch=${final.id}&file=${encodeURIComponent(file.name)}`}
                    className="text-sm text-zinc-600 underline"
                  >
                    Open
                  </Link>
                )}
              </li>
            ))}
          </ul>
        )}

        {project.isLocked ? (
          <p className="text-sm text-zinc-600">
            The due date has passed, so the final is closed to changes.
          </p>
        ) : (
          <form
            action={uploadFile.bind(null, id, final.id)}
            className="flex gap-2"
          >
            <input
              type="file"
              name="file"
              required
              className="flex-1 text-sm"
            />
            <button
              type="submit"
              className="rounded border px-3 py-2 text-sm hover:bg-zinc-50"
            >
              Upload
            </button>
          </form>
        )}
      </section>

      <PeoplePanel
        projectId={id}
        projectName={project.name}
        members={members}
        currentUserId={user.id}
      />

      <DeadlinePanel
        projectId={id}
        deadline={project.deadline}
        isLocked={project.isLocked}
        pendingCount={pending.length}
      />

      <section className="flex flex-col gap-3 border-t pt-6">
        <h2 className="font-medium">Waiting for someone to say yes</h2>

        {pending.length === 0 ? (
          <p className="text-sm text-zinc-600">
            Nothing is waiting to be added in.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {pending.map((request) => (
              <li
                key={request.id}
                className="flex items-center justify-between gap-3 text-sm"
              >
                <span>
                  <Link
                    href={`/projects/${id}/copies/${request.sourceBranchId}`}
                    className="underline"
                  >
                    {branchNameById.get(request.sourceBranchId) ?? "A copy"}
                  </Link>{" "}
                  <span className="text-zinc-600">wants to be added in</span>
                </span>
                {project.isLocked ? (
                  <span className="shrink-0 text-xs text-zinc-500">
                    Closed
                  </span>
                ) : request.authorId === user.id && !isSolo ? (
                  <span className="shrink-0 text-xs text-zinc-500">
                    Waiting on a teammate
                  </span>
                ) : (
                  <DecideButtons projectId={id} changeRequestId={request.id} />
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-3 border-t pt-6">
        <div className="flex items-center justify-between">
          <h2 className="font-medium">Copies</h2>
          <MakeCopyButton projectId={id} />
        </div>

        <p className="text-sm text-zinc-600">
          A copy is yours to change freely. The final above stays exactly as
          it is until your changes are added in.
        </p>

        {copies.length === 0 ? (
          <p className="text-sm text-zinc-600">Nobody has made a copy yet.</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {copies.map((copy) => (
              <li key={copy.id}>
                <Link
                  href={`/projects/${id}/copies/${copy.id}`}
                  className="text-sm underline"
                >
                  {copy.name}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
