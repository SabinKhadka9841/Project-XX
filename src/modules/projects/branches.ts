// Everything about "versions" of a project — the protected final one, and
// the copies people make from it.
//
// In the UI these are never called branches: the final one is "the final"
// and the others are "my copy". The table is called `branches` because
// that's what it is underneath, but that word must not reach the user.

import type { SupabaseClient } from "@supabase/supabase-js";

const BUCKET = "project-files";

export interface Branch {
  id: string;
  projectId: string;
  name: string;
  isFinal: boolean;
  createdBy: string | null;
  createdAt: string;
}

interface BranchRow {
  id: string;
  project_id: string;
  name: string;
  is_final: boolean;
  created_by: string | null;
  created_at: string;
}

function toBranch(row: BranchRow): Branch {
  return {
    id: row.id,
    projectId: row.project_id,
    name: row.name,
    isFinal: row.is_final,
    createdBy: row.created_by,
    createdAt: row.created_at,
  };
}

const COLUMNS = "id, project_id, name, is_final, created_by, created_at";

/** Where a version's files live in storage. */
export function branchFolder(projectId: string, branchId: string) {
  return `${projectId}/${branchId}`;
}

export async function listBranches(
  supabase: SupabaseClient,
  projectId: string,
): Promise<Branch[]> {
  const { data, error } = await supabase
    .from("branches")
    .select(COLUMNS)
    .eq("project_id", projectId)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return (data as BranchRow[]).map(toBranch);
}

export async function getFinalBranch(
  supabase: SupabaseClient,
  projectId: string,
): Promise<Branch | null> {
  const { data, error } = await supabase
    .from("branches")
    .select(COLUMNS)
    .eq("project_id", projectId)
    .eq("is_final", true)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data ? toBranch(data as BranchRow) : null;
}

export async function getBranch(
  supabase: SupabaseClient,
  branchId: string,
): Promise<Branch | null> {
  const { data, error } = await supabase
    .from("branches")
    .select(COLUMNS)
    .eq("id", branchId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data ? toBranch(data as BranchRow) : null;
}

export async function createFinalBranch(
  supabase: SupabaseClient,
  projectId: string,
  userId: string,
): Promise<Branch> {
  const { data, error } = await supabase
    .from("branches")
    .insert({
      project_id: projectId,
      name: "The final",
      is_final: true,
      created_by: userId,
    })
    .select(COLUMNS)
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return toBranch(data as BranchRow);
}

export interface BranchFile {
  name: string;
  sizeBytes: number;
  lastModified: string | null;
}

export async function listBranchFiles(
  supabase: SupabaseClient,
  projectId: string,
  branchId: string,
): Promise<BranchFile[]> {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .list(branchFolder(projectId, branchId));

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map((file) => ({
    name: file.name,
    sizeBytes: file.metadata?.size ?? 0,
    lastModified: file.updated_at ?? file.created_at ?? null,
  }));
}

export interface BranchFileWithUrl extends BranchFile {
  url: string | null;
}

/**
 * Same as listBranchFiles, but also gets a download link for each file.
 *
 * Uses createSignedUrls (plural) so a version with ten files costs one
 * network round trip instead of ten. That matters a lot here: Supabase
 * is in a different region from most users, so every round trip is
 * ~200ms of pure waiting.
 */
export async function listBranchFilesWithUrls(
  supabase: SupabaseClient,
  projectId: string,
  branchId: string,
  expiresInSeconds = 60,
): Promise<BranchFileWithUrl[]> {
  const files = await listBranchFiles(supabase, projectId, branchId);

  if (files.length === 0) {
    return [];
  }

  const folder = branchFolder(projectId, branchId);
  const { data: signed } = await supabase.storage
    .from(BUCKET)
    .createSignedUrls(
      files.map((file) => `${folder}/${file.name}`),
      expiresInSeconds,
    );

  const urlByPath = new Map(
    (signed ?? []).map((entry) => [entry.path, entry.signedUrl]),
  );

  return files.map((file) => ({
    ...file,
    url: urlByPath.get(`${folder}/${file.name}`) ?? null,
  }));
}

/**
 * Make a copy of a version. Every file in the source is duplicated into
 * the new one, so changing a file in the copy can't affect the original.
 *
 * This physically duplicates the bytes, which is wasteful — a 200MB
 * project copied ten times really does cost 2GB today. The planned fix
 * is content-addressed storage (store bytes once under a hash, and let a
 * copy just reference the same hashes), but that's deliberately deferred:
 * it changes nothing the user sees, so it can land later without redoing
 * any of this.
 */
export async function copyBranch(
  supabase: SupabaseClient,
  projectId: string,
  sourceBranchId: string,
  name: string,
  userId: string,
): Promise<Branch> {
  const { data, error } = await supabase
    .from("branches")
    .insert({
      project_id: projectId,
      name,
      is_final: false,
      created_by: userId,
    })
    .select(COLUMNS)
    .single();

  if (error) {
    throw new Error(error.message);
  }

  const branch = toBranch(data as BranchRow);

  const files = await listBranchFiles(supabase, projectId, sourceBranchId);
  const sourceFolder = branchFolder(projectId, sourceBranchId);
  const targetFolder = branchFolder(projectId, branch.id);

  for (const file of files) {
    const { error: copyError } = await supabase.storage
      .from(BUCKET)
      .copy(`${sourceFolder}/${file.name}`, `${targetFolder}/${file.name}`);

    if (copyError) {
      throw new Error(copyError.message);
    }
  }

  return branch;
}
