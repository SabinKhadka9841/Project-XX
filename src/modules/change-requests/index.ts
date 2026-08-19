// Asking for a copy's changes to go into the final, and (later)
// approving or rejecting that ask.
//
// UI wording: "ask to add this in", never merge/pull request.
//
// This module talks to projects/branches through their module, not by
// reaching into their tables directly.

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  branchFolder,
  getBranch,
  getFinalBranch,
  listBranchFiles,
} from "@/modules/projects/branches";
import { isSoloProject } from "@/modules/projects/members";

const BUCKET = "project-files";

export type ChangeRequestStatus = "pending" | "approved" | "rejected";

export interface ChangeRequest {
  id: string;
  projectId: string;
  sourceBranchId: string;
  targetBranchId: string;
  authorId: string | null;
  message: string | null;
  status: ChangeRequestStatus;
  reviewedBy: string | null;
  reviewedAt: string | null;
  createdAt: string;
}

interface ChangeRequestRow {
  id: string;
  project_id: string;
  source_branch_id: string;
  target_branch_id: string;
  author_id: string | null;
  message: string | null;
  status: ChangeRequestStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
}

const COLUMNS =
  "id, project_id, source_branch_id, target_branch_id, author_id, message, status, reviewed_by, reviewed_at, created_at";

function toChangeRequest(row: ChangeRequestRow): ChangeRequest {
  return {
    id: row.id,
    projectId: row.project_id,
    sourceBranchId: row.source_branch_id,
    targetBranchId: row.target_branch_id,
    authorId: row.author_id,
    message: row.message,
    status: row.status,
    reviewedBy: row.reviewed_by,
    reviewedAt: row.reviewed_at,
    createdAt: row.created_at,
  };
}

export async function listChangeRequests(
  supabase: SupabaseClient,
  projectId: string,
): Promise<ChangeRequest[]> {
  const { data, error } = await supabase
    .from("change_requests")
    .select(COLUMNS)
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return (data as ChangeRequestRow[]).map(toChangeRequest);
}

export async function getChangeRequest(
  supabase: SupabaseClient,
  changeRequestId: string,
): Promise<ChangeRequest | null> {
  const { data, error } = await supabase
    .from("change_requests")
    .select(COLUMNS)
    .eq("id", changeRequestId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data ? toChangeRequest(data as ChangeRequestRow) : null;
}

/** The still-waiting request for a copy, if there is one. */
export async function getPendingRequestForBranch(
  supabase: SupabaseClient,
  sourceBranchId: string,
): Promise<ChangeRequest | null> {
  const { data, error } = await supabase
    .from("change_requests")
    .select(COLUMNS)
    .eq("source_branch_id", sourceBranchId)
    .eq("status", "pending")
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data ? toChangeRequest(data as ChangeRequestRow) : null;
}

/**
 * Thrown for situations the person can actually do something about, so
 * callers can show the message rather than a generic failure.
 */
export class ChangeRequestError extends Error {}

/**
 * Ask for a copy's changes to go into the project's final version.
 *
 * Deliberately does not move any files — that only happens on approval.
 */
export async function createChangeRequest(
  supabase: SupabaseClient,
  {
    projectId,
    sourceBranchId,
    authorId,
    message,
  }: {
    projectId: string;
    sourceBranchId: string;
    authorId: string;
    message?: string | null;
  },
): Promise<ChangeRequest> {
  const [source, target] = await Promise.all([
    getBranch(supabase, sourceBranchId),
    getFinalBranch(supabase, projectId),
  ]);

  if (!source || source.projectId !== projectId) {
    throw new ChangeRequestError("That copy isn't part of this project.");
  }

  if (source.isFinal) {
    throw new ChangeRequestError(
      "The final can't be added into itself — ask from a copy instead.",
    );
  }

  if (!target) {
    throw new ChangeRequestError("This project has no final version yet.");
  }

  const existing = await getPendingRequestForBranch(supabase, sourceBranchId);

  if (existing) {
    throw new ChangeRequestError(
      "You've already asked for this copy to be added in. It's still waiting on a teammate.",
    );
  }

  const { data, error } = await supabase
    .from("change_requests")
    .insert({
      project_id: projectId,
      source_branch_id: source.id,
      target_branch_id: target.id,
      author_id: authorId,
      message: message ?? null,
    })
    .select(COLUMNS)
    .single();

  if (error) {
    // The partial unique index catches a double-click that slips past
    // the check above.
    if (error.code === "23505") {
      throw new ChangeRequestError(
        "You've already asked for this copy to be added in.",
      );
    }
    throw new Error(error.message);
  }

  return toChangeRequest(data as ChangeRequestRow);
}

/**
 * Approve a change request: the copy's files replace the final's, and
 * only then does the status flip.
 *
 * Whole-file replace, on purpose — no diffing or merging. Every file in
 * the copy overwrites the same-named file in the final. A copy starts
 * as a full duplicate of the final, so this naturally carries over
 * everything; nothing is deleted from the final by an approval.
 */
export async function approveChangeRequest(
  supabase: SupabaseClient,
  {
    changeRequestId,
    reviewerId,
  }: { changeRequestId: string; reviewerId: string },
): Promise<ChangeRequest> {
  const request = await getChangeRequest(supabase, changeRequestId);

  if (!request) {
    throw new ChangeRequestError("That request no longer exists.");
  }

  if (request.status !== "pending") {
    throw new ChangeRequestError("This has already been decided.");
  }

  // Working alone, there's nobody to ask, so approving your own is the
  // only way the final can ever change. The timeline still records
  // honestly that you did both halves.
  if (
    request.authorId === reviewerId &&
    !(await isSoloProject(supabase, request.projectId))
  ) {
    throw new ChangeRequestError(
      "You can't approve your own copy — ask a teammate to look at it.",
    );
  }

  const files = await listBranchFiles(
    supabase,
    request.projectId,
    request.sourceBranchId,
  );
  const sourceFolder = branchFolder(request.projectId, request.sourceBranchId);
  const targetFolder = branchFolder(request.projectId, request.targetBranchId);

  for (const file of files) {
    const { data: blob, error: downloadError } = await supabase.storage
      .from(BUCKET)
      .download(`${sourceFolder}/${file.name}`);

    if (downloadError || !blob) {
      throw new Error(
        downloadError?.message ?? `Couldn't read ${file.name} from the copy.`,
      );
    }

    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(`${targetFolder}/${file.name}`, blob, { upsert: true });

    if (uploadError) {
      throw new Error(uploadError.message);
    }
  }

  // The status check here (not just the id) matters: it stops two
  // people clicking "approve" at nearly the same moment from both
  // succeeding and copying files twice.
  const { data, error } = await supabase
    .from("change_requests")
    .update({
      status: "approved",
      reviewed_by: reviewerId,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", changeRequestId)
    .eq("status", "pending")
    .select(COLUMNS)
    .single();

  if (error || !data) {
    throw new Error(
      error?.message ??
        "The files copied across, but the request couldn't be marked approved. Refresh and check before trying again.",
    );
  }

  return toChangeRequest(data as ChangeRequestRow);
}

export async function rejectChangeRequest(
  supabase: SupabaseClient,
  {
    changeRequestId,
    reviewerId,
  }: { changeRequestId: string; reviewerId: string },
): Promise<ChangeRequest> {
  const request = await getChangeRequest(supabase, changeRequestId);

  if (!request) {
    throw new ChangeRequestError("That request no longer exists.");
  }

  if (request.status !== "pending") {
    throw new ChangeRequestError("This has already been decided.");
  }

  if (
    request.authorId === reviewerId &&
    !(await isSoloProject(supabase, request.projectId))
  ) {
    throw new ChangeRequestError(
      "You can't reject your own request — a teammate needs to decide.",
    );
  }

  const { data, error } = await supabase
    .from("change_requests")
    .update({
      status: "rejected",
      reviewed_by: reviewerId,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", changeRequestId)
    .eq("status", "pending")
    .select(COLUMNS)
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Couldn't reject this request.");
  }

  return toChangeRequest(data as ChangeRequestRow);
}
