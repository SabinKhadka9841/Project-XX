import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  listBranchFilesWithUrls,
  listBranches,
} from "@/modules/projects/branches";
import { listChangeRequests } from "@/modules/change-requests";
import {
  listExpectedTeammates,
  listMembers,
} from "@/modules/projects/members";
import { PeoplePanel } from "./people-panel";
import { getProject } from "@/modules/projects/projects";
import { findOverwriteRisk } from "@/modules/diffing";
import { OverwriteWarning } from "./overwrite-warning";
import { DeadlinePanel } from "./deadline-panel";
import { DecideButtons } from "./decide-buttons";
import { MakeCopyButton } from "./make-copy-button";
import { uploadFile } from "./actions";

const EDITABLE_EXTENSIONS = ["doc", "docx", "xls", "xlsx", "ppt", "pptx"];

/** Two copies by the same person otherwise look identical. */
function madeOn(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
  });
}

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
  const [files, expected] = await Promise.all([
    listBranchFilesWithUrls(supabase, id, final.id),
    // Needs the member list to work out who's turned up, so it can't
    // join the batch above.
    listExpectedTeammates(supabase, id, members),
  ]);

  // For anything waiting, work out whether saying yes would revert a
  // teammate's work, so the person deciding sees it before they click.
  const risksByRequestId = new Map(
    await Promise.all(
      changeRequests
        .filter((request) => request.status === "pending")
        .map(
          async (request) =>
            [
              request.id,
              await findOverwriteRisk(
                supabase,
                id,
                request.sourceBranchId,
                final.id,
              ),
            ] as const,
        ),
    ),
  );

  const pending = changeRequests.filter(
    (request) => request.status === "pending",
  );
  const branchNameById = new Map(
    branches.map((branch) => [branch.id, branch.name]),
  );

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-10">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">
          {project.name}
        </h1>
        <Link
          href={`/projects/${id}/timeline`}
          className="btn btn-secondary"
        >
          Who did what
        </Link>
      </div>

      {joined === "1" && (
        <div className="mb-5 rounded-card border border-accent bg-accent-soft p-4 text-sm">
          <p className="font-medium">You&apos;re in.</p>
          <p className="mt-1 leading-relaxed text-text-muted">
            To change anything, make your own copy — you can edit it freely
            without touching the final. When you&apos;re happy, ask a
            teammate to add it in.
          </p>
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
      <div className="flex flex-col gap-5">
      <section className="card flex flex-col gap-3 p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-medium">The final</h2>
          {files.length > 0 && (
            <a
              href={`/projects/${id}/export`}
              className="btn btn-ghost -mr-3.5"
            >
              Download all
            </a>
          )}
        </div>

        {files.length === 0 ? (
          <p className="text-sm text-text-muted">Nothing in the final yet.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-border-subtle">
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
                    href={`/projects/${id}/edit?branch=${final.id}&file=${encodeURIComponent(file.name)}`}
                    className="btn btn-ghost shrink-0 py-2.5 text-accent"
                  >
                    Open
                  </Link>
                )}
              </li>
            ))}
          </ul>
        )}

        {project.isLocked ? (
          <p className="rounded-md bg-surface-muted px-3 py-2 text-sm text-text-muted">
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
              className="min-w-0 flex-1 text-sm text-text-muted file:mr-3 file:rounded-md file:border-0 file:bg-surface-muted file:px-3 file:py-1.5 file:text-sm file:text-text"
            />
            <button type="submit" className="btn btn-secondary">
              Upload
            </button>
          </form>
        )}
      </section>

      <section className="card flex flex-col gap-3 p-5">
        <h2 className="font-medium">Waiting for someone to say yes</h2>

        {pending.length === 0 ? (
          <p className="text-sm text-text-muted">
            Nothing is waiting to be added in.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {pending.map((request) => (
              <li
                key={request.id}
                className="flex flex-col gap-1 text-sm"
              >
                <div className="flex items-center justify-between gap-3">
                <span>
                  <Link
                    href={`/projects/${id}/copies/${request.sourceBranchId}`}
                    className="link -my-1 inline-block py-2"
                  >
                    {branchNameById.get(request.sourceBranchId) ?? "A copy"}
                  </Link>{" "}
                  <span className="text-text-muted">wants to be added in</span>
                </span>
                {project.isLocked ? (
                  <span className="shrink-0 text-xs text-text-subtle">
                    Closed
                  </span>
                ) : request.authorId === user.id && !isSolo ? (
                  <span className="shrink-0 text-xs text-text-subtle">
                    Waiting on a teammate
                  </span>
                ) : (
                  <DecideButtons projectId={id} changeRequestId={request.id} />
                )}
                </div>
                {!project.isLocked && (
                  <OverwriteWarning
                    risk={
                      risksByRequestId.get(request.id) ?? {
                        filenames: [],
                        peopleWhoChangedIt: [],
                      }
                    }
                    viewerEmail={user.email}
                    tone="short"
                  />
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card flex flex-col gap-3 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-medium">Copies</h2>
          <MakeCopyButton projectId={id} />
        </div>

        <p className="text-sm leading-relaxed text-text-muted">
          A copy is yours to change freely. The final above stays exactly as
          it is until your changes are added in.
        </p>

        {copies.length === 0 ? (
          <p className="text-sm text-text-muted">Nobody has made a copy yet.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-border-subtle">
            {copies.map((copy) => (
              <li key={copy.id}>
                <Link
                  href={`/projects/${id}/copies/${copy.id}`}
                  className="flex items-baseline gap-2 py-2.5"
                >
                  <span className="link min-w-0 truncate text-sm">
                    {copy.name}
                  </span>
                  <span className="shrink-0 text-xs text-text-subtle">
                    · {madeOn(copy.createdAt)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      </div>

      <aside className="flex flex-col gap-5">
      <PeoplePanel
        projectId={id}
        projectName={project.name}
        members={members}
        expected={expected}
        currentUserId={user.id}
      />

      <DeadlinePanel
        projectId={id}
        deadline={project.deadline}
        isLocked={project.isLocked}
        pendingCount={pending.length}
      />
      </aside>
      </div>
    </main>
  );
}
