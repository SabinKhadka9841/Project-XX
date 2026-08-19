// Asking for a copy's changes to go into the final, and (later)
// approving or rejecting that ask.
//
// UI wording: "ask to add this in", never merge/pull request.
//
// This module talks to projects/branches through their module, not by
// reaching into their tables directly.

import type { SupabaseClient } from "@supabase/supabase-js";
import { getBranch, getFinalBranch } from "@/modules/projects/branches";

export type ChangeRequestStatus = "pending" | "approved" | "rejected";

export interface ChangeRequest {
  id: string;
  projectId: string;
  sourceBranchId: string;
  targetBranchId: string;
  authorId: string | null;
  message: string | null;
  status: ChangeRequestStatus;
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
  created_at: string;
}

const COLUMNS =
  "id, project_id, source_branch_id, target_branch_id, author_id, message, status, created_at";

function toChangeRequest(row: ChangeRequestRow): ChangeRequest {
  return {
    id: row.id,
    projectId: row.project_id,
    sourceBranchId: row.source_branch_id,
    targetBranchId: row.target_branch_id,
    authorId: row.author_id,
    message: row.message,
    status: row.status,
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
