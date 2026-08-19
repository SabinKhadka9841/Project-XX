// The contribution timeline: a plain chronological record of who did
// what on a project.
//
// Deliberately NO percentages, scores, counts-as-ranking, or "top
// contributor" anything. Raw metrics start arguments and punish the
// person who did the reading and thinking rather than the typing. The
// timeline is evidence for a conversation, not a verdict.
//
// This module reads from other domains through their modules and by
// querying their tables read-only; it owns no tables of its own. The
// log falls out of data that already exists — that's the whole point.

import type { SupabaseClient } from "@supabase/supabase-js";

export type TimelineEventType =
  | "copy_made"
  | "asked_to_add_in"
  | "added_in"
  | "said_no";

export interface TimelineEvent {
  id: string;
  type: TimelineEventType;
  at: string;
  actorId: string | null;
  actorName: string;
  /** The copy involved, when there is one. */
  branchId: string | null;
  branchName: string | null;
}

/** Emails only exist for people you share a project with (see RLS). */
async function getNamesByUserId(
  supabase: SupabaseClient,
  userIds: string[],
): Promise<Map<string, string>> {
  const unique = [...new Set(userIds)];

  if (unique.length === 0) {
    return new Map();
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("id, email")
    .in("id", unique);

  if (error) {
    throw new Error(error.message);
  }

  return new Map(
    (data as { id: string; email: string }[]).map((row) => [row.id, row.email]),
  );
}

/**
 * Everything that has happened on a project, newest first.
 *
 * Note what is NOT in here: uploading or editing a file. Storage
 * doesn't record who put a file there, so attributing those would mean
 * guessing. Better to show less than to show something we can't stand
 * behind — an attribution log that's sometimes wrong is worse than one
 * that's narrow.
 */
export async function getProjectTimeline(
  supabase: SupabaseClient,
  projectId: string,
): Promise<TimelineEvent[]> {
  const [branchesResult, requestsResult] = await Promise.all([
    supabase
      .from("branches")
      .select("id, name, created_by, created_at, is_final")
      .eq("project_id", projectId),
    supabase
      .from("change_requests")
      .select(
        "id, source_branch_id, author_id, created_at, status, reviewed_by, reviewed_at",
      )
      .eq("project_id", projectId),
  ]);

  if (branchesResult.error) {
    throw new Error(branchesResult.error.message);
  }
  if (requestsResult.error) {
    throw new Error(requestsResult.error.message);
  }

  const branches = branchesResult.data as {
    id: string;
    name: string;
    created_by: string | null;
    created_at: string;
    is_final: boolean;
  }[];

  const requests = requestsResult.data as {
    id: string;
    source_branch_id: string;
    author_id: string | null;
    created_at: string;
    status: "pending" | "approved" | "rejected";
    reviewed_by: string | null;
    reviewed_at: string | null;
  }[];

  const branchById = new Map(branches.map((branch) => [branch.id, branch]));

  const actorIds = [
    ...branches.map((branch) => branch.created_by),
    ...requests.map((request) => request.author_id),
    ...requests.map((request) => request.reviewed_by),
  ].filter((id): id is string => id !== null);

  const namesById = await getNamesByUserId(supabase, actorIds);
  const nameFor = (id: string | null) =>
    (id ? namesById.get(id) : null) ?? "Someone who has left";

  const events: TimelineEvent[] = [];

  // The final isn't "made" by anyone in a meaningful sense — it's
  // created automatically with the project — so it isn't an event.
  for (const branch of branches) {
    if (branch.is_final) continue;

    events.push({
      id: `copy:${branch.id}`,
      type: "copy_made",
      at: branch.created_at,
      actorId: branch.created_by,
      actorName: nameFor(branch.created_by),
      branchId: branch.id,
      branchName: branch.name,
    });
  }

  for (const request of requests) {
    const branch = branchById.get(request.source_branch_id);

    events.push({
      id: `asked:${request.id}`,
      type: "asked_to_add_in",
      at: request.created_at,
      actorId: request.author_id,
      actorName: nameFor(request.author_id),
      branchId: request.source_branch_id,
      branchName: branch?.name ?? null,
    });

    if (request.status !== "pending" && request.reviewed_at) {
      events.push({
        id: `decided:${request.id}`,
        type: request.status === "approved" ? "added_in" : "said_no",
        at: request.reviewed_at,
        actorId: request.reviewed_by,
        actorName: nameFor(request.reviewed_by),
        branchId: request.source_branch_id,
        branchName: branch?.name ?? null,
      });
    }
  }

  return events.sort(
    (a, b) => new Date(b.at).getTime() - new Date(a.at).getTime(),
  );
}
