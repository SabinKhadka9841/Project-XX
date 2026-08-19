// The project itself: its name, its deadline, and whether it's locked.

import type { SupabaseClient } from "@supabase/supabase-js";

export interface Project {
  id: string;
  name: string;
  deadline: string | null;
  createdAt: string;
  /** True once the deadline has passed — the final stops accepting changes. */
  isLocked: boolean;
}

interface ProjectRow {
  id: string;
  name: string;
  deadline: string | null;
  created_at: string;
}

function toProject(row: ProjectRow): Project {
  return {
    id: row.id,
    name: row.name,
    deadline: row.deadline,
    createdAt: row.created_at,
    isLocked: row.deadline !== null && new Date(row.deadline) < new Date(),
  };
}

export async function getProject(
  supabase: SupabaseClient,
  projectId: string,
): Promise<Project | null> {
  const { data, error } = await supabase
    .from("projects")
    .select("id, name, deadline, created_at")
    .eq("id", projectId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data ? toProject(data as ProjectRow) : null;
}

/**
 * Set or clear the deadline. Passing null clears it, which unlocks the
 * project again — deliberately possible, because a deadline being wrong
 * is far more likely than someone trying to cheat, and a group that
 * can't fix its own mistake will just stop using the tool.
 */
export async function setDeadline(
  supabase: SupabaseClient,
  projectId: string,
  deadline: string | null,
): Promise<Project> {
  const { data, error } = await supabase
    .from("projects")
    .update({ deadline })
    .eq("id", projectId)
    .select("id, name, deadline, created_at")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return toProject(data as ProjectRow);
}
