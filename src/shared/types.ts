// ─────────────────────────────────────────────────────────────────────────
// Shared API types — the source of truth for every endpoint this backend
// actually implements. Not a monorepo yet, so the frontend can't import
// this file directly; copy it into the frontend repo and keep it in sync
// by hand until/unless we merge into one repository.
//
// Rule: this file only describes endpoints that are real. If it's not in
// here, it doesn't exist yet — see the bottom of the file for what's
// planned but not built.
//
// Last updated: added ChangeRequest ("ask to add this in") — list and
// create. Only creating and listing exist; approving and rejecting are
// not built yet, so every request you see will be "pending". No
// Activity types yet.
// ─────────────────────────────────────────────────────────────────────────

// ── Users ────────────────────────────────────────────────

export interface User {
  id: string;
  email: string;
  // No display name or role field yet — the product only collects an
  // email address (magic-link sign-in), nothing else about a person.
}

// GET /api/me
export type GetMeResponse = User;

// ── Projects ─────────────────────────────────────────────

export interface Project {
  id: string;
  name: string;
  createdAt: string; // ISO date
  // No ownerId or memberIds on this shape yet — the API doesn't return
  // membership info alongside a project yet.
}

// GET /api/projects
export type ListProjectsResponse = Project[];

// POST /api/projects
export interface CreateProjectRequest {
  name: string;
}
export type CreateProjectResponse = Project;

// GET /api/projects/:id
export type GetProjectResponse = Project;

// ── Project files ────────────────────────────────────────

export interface ProjectFile {
  name: string;
  sizeBytes: number;
  lastModified: string | null; // ISO date; null if storage never recorded one
  url: string | null; // signed download URL, expires 60s after issued
  projectId: string;
  branchId: string; // which version this file belongs to
}

// GET /api/projects/:id/files?branchId=<id>
// branchId is optional — omit it to get the final version's files.
export type ListProjectFilesResponse = ProjectFile[];

// POST /api/projects/:id/files?branchId=<id>
// Request body is multipart/form-data with a "file" field — not JSON,
// so there's no request type to import for this one. branchId is
// optional; omit it to upload into the final version.
export interface UploadProjectFileResponse {
  name: string;
  sizeBytes: number;
  projectId: string;
  branchId: string;
}

// ── Copies ───────────────────────────────────────────────
//
// A project has one protected "final" version plus zero or more copies.
// Never call these branches in the UI: it's "my copy" and "the final".
// The final version is not returned by the endpoints below — it's not a
// copy. Get its id implicitly by omitting branchId on the file routes.

export interface Copy {
  id: string;
  projectId: string;
  name: string;
  createdBy: string | null; // user id; null if that account was deleted
  createdAt: string; // ISO date
}

// GET /api/projects/:id/copies
export type ListCopiesResponse = Copy[];

// POST /api/projects/:id/copies
// No request body — a copy is always made from the final version, and
// its name is generated from the signed-in user.
export type CreateCopyResponse = Copy;

// ── Change requests ──────────────────────────────────────
//
// "Ask to add this in" — a request for a copy's files to replace the
// final's. Nothing moves until someone approves it.
//
// UI wording: never "merge request" or "pull request". Asking is "ask
// to add this in"; a pending one is "waiting for someone to say yes".

export type ChangeRequestStatus = "pending" | "approved" | "rejected";

export interface ChangeRequest {
  id: string;
  projectId: string;
  sourceBranchId: string; // the copy the changes come from
  targetBranchId: string; // always the final, for now
  authorId: string | null; // null if that account was deleted
  message: string | null;
  status: ChangeRequestStatus;
  createdAt: string;
}

// GET /api/projects/:id/change-requests
// Newest first, all statuses. Filter client-side for pending ones.
export type ListChangeRequestsResponse = ChangeRequest[];

// POST /api/projects/:id/change-requests
export interface CreateChangeRequestRequest {
  sourceBranchId: string;
  message?: string | null;
}
export type CreateChangeRequestResponse = ChangeRequest;

// ── Errors ───────────────────────────────────────────────

// Every endpoint above returns this shape on failure (400/401/404/500).
// There is no separate per-endpoint error type.
export interface ApiError {
  error: string;
}

// ── Not implemented yet ──────────────────────────────────
//
// These do not exist in the backend. Do not wire frontend UI to real
// calls for these until this comment is replaced with real types:
//
// - Approving / rejecting a change request. You can raise one, and see
//   it sitting there pending, but nothing can act on it yet — so no
//   copy's changes can actually reach the final. That's the next piece
//   being built.
// - Activity — the contribution timeline
// - Invite — not a typed request/response; joining a project is a plain
//   page navigation to GET {API_BASE_URL}/projects/:id/join, and opening
//   a file in the in-browser editor is GET
//   {API_BASE_URL}/projects/:id/edit?branch=<id>&file=<filename> — both
//   are regular links (<a href>), not fetch() calls, so no JSON shape
//   applies.
