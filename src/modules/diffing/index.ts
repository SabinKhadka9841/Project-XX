// Spotting when adding a copy in would quietly throw away somebody
// else's work.
//
// The product deliberately does no merging: approving a copy replaces
// the final's files wholesale. That's fine when you're the only one who
// moved, and destructive when you aren't — if a teammate's changes were
// added to the final after you made your copy, approving yours silently
// reverts theirs.
//
// The plan's instruction is explicit: "one set of changes is discarded —
// show a plain warning, don't engineer around it yet." So this detects
// and explains; it never blocks, and never tries to merge.

import type { SupabaseClient } from "@supabase/supabase-js";
import { getBranch, listBranchFiles } from "@/modules/projects/branches";

export interface OverwriteRisk {
  /** Files that exist in both, changed in the final since the copy was made. */
  filenames: string[];
  /** Who changed the final in that window, if we can tell. */
  peopleWhoChangedIt: string[];
}

/**
 * Which files would be reverted if this copy were added into the final.
 *
 * A file is at risk when it exists in both versions and the final's
 * copy of it was modified *after* this copy was made — meaning somebody
 * else's work landed in the meantime.
 *
 * Timestamps rather than content hashes: cheap, no extra storage, and
 * it only ever errs toward warning about a file that turns out to be
 * identical. A false warning is a moment's confusion; a missed one is
 * lost coursework.
 */
export async function findOverwriteRisk(
  supabase: SupabaseClient,
  projectId: string,
  copyId: string,
  finalId: string,
): Promise<OverwriteRisk> {
  const copy = await getBranch(supabase, copyId);

  if (!copy) {
    return { filenames: [], peopleWhoChangedIt: [] };
  }

  const [copyFiles, finalFiles] = await Promise.all([
    listBranchFiles(supabase, projectId, copyId),
    listBranchFiles(supabase, projectId, finalId),
  ]);

  const copyFilenames = new Set(copyFiles.map((file) => file.name));
  const copyMadeAt = new Date(copy.createdAt).getTime();

  const filenames = finalFiles
    .filter((file) => {
      if (!copyFilenames.has(file.name)) return false;
      if (!file.lastModified) return false;
      return new Date(file.lastModified).getTime() > copyMadeAt;
    })
    .map((file) => file.name);

  if (filenames.length === 0) {
    return { filenames: [], peopleWhoChangedIt: [] };
  }

  // Who moved the final in that window. We don't record which files a
  // given request touched, so this is the set of people whose work
  // landed since — right for the common case of one approval, and
  // honest enough for more.
  const { data: approvals } = await supabase
    .from("change_requests")
    .select("author_id")
    .eq("project_id", projectId)
    .eq("status", "approved")
    .gt("reviewed_at", copy.createdAt);

  const authorIds = [
    ...new Set(
      ((approvals ?? []) as { author_id: string | null }[])
        .map((row) => row.author_id)
        .filter((id): id is string => id !== null),
    ),
  ];

  if (authorIds.length === 0) {
    return { filenames, peopleWhoChangedIt: [] };
  }

  const { data: profiles } = await supabase
    .from("profiles")
    .select("email")
    .in("id", authorIds);

  return {
    filenames,
    peopleWhoChangedIt: ((profiles ?? []) as { email: string }[]).map(
      (row) => row.email,
    ),
  };
}
