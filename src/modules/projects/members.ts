// Who's in a project.
//
// Membership is readable by anyone else in the same project (see the
// members RLS policy), so these can be called from any page a member
// can already reach.

import type { SupabaseClient } from "@supabase/supabase-js";

export interface Member {
  userId: string;
  role: string;
  name: string;
}

export async function countMembers(
  supabase: SupabaseClient,
  projectId: string,
): Promise<number> {
  const { count, error } = await supabase
    .from("members")
    .select("user_id", { count: "exact", head: true })
    .eq("project_id", projectId);

  if (error) {
    throw new Error(error.message);
  }

  return count ?? 0;
}

/**
 * A project with exactly one member is a personal draft history rather
 * than a collaboration — the approval gate has nobody to ask, so the
 * usual "you can't approve your own work" rule is relaxed.
 */
export async function isSoloProject(
  supabase: SupabaseClient,
  projectId: string,
): Promise<boolean> {
  return (await countMembers(supabase, projectId)) === 1;
}

export interface ExpectedTeammate {
  id: string;
  email: string;
  hasJoined: boolean;
}

/**
 * Who you're expecting, and whether they've turned up.
 *
 * Matched to actual members by email, case-insensitively. Someone who
 * joins with a different address than the one noted down shows as still
 * missing — which is a bit wrong but harmless, and far better than the
 * alternative of making this list authoritative and locking them out.
 */
export async function listExpectedTeammates(
  supabase: SupabaseClient,
  projectId: string,
  members: Member[],
): Promise<ExpectedTeammate[]> {
  const { data, error } = await supabase
    .from("expected_teammates")
    .select("id, email")
    .eq("project_id", projectId)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  const joined = new Set(members.map((member) => member.name.toLowerCase()));

  return (data as { id: string; email: string }[]).map((row) => ({
    id: row.id,
    email: row.email,
    hasJoined: joined.has(row.email.toLowerCase()),
  }));
}

export async function listMembers(
  supabase: SupabaseClient,
  projectId: string,
): Promise<Member[]> {
  const { data, error } = await supabase
    .from("members")
    .select("user_id, role")
    .eq("project_id", projectId);

  if (error) {
    throw new Error(error.message);
  }

  const rows = data as { user_id: string; role: string }[];

  if (rows.length === 0) {
    return [];
  }

  const { data: profiles, error: profilesError } = await supabase
    .from("profiles")
    .select("id, email")
    .in(
      "id",
      rows.map((row) => row.user_id),
    );

  if (profilesError) {
    throw new Error(profilesError.message);
  }

  const nameById = new Map(
    (profiles as { id: string; email: string }[]).map((row) => [
      row.id,
      row.email,
    ]),
  );

  return rows.map((row) => ({
    userId: row.user_id,
    role: row.role,
    name: nameById.get(row.user_id) ?? "Someone who has left",
  }));
}
