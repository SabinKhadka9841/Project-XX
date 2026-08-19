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
// Last updated: added approving/rejecting a change request (PATCH).
// The core loop — copy, propose, approve — is now complete end to end.
// ChangeRequest gained reviewedBy/reviewedAt. Still no Activity types.
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
  reviewedBy: string | null; // who approved/rejected; null while pending
  reviewedAt: string | null; // null while pending
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

// PATCH /api/projects/:id/change-requests/:changeRequestId
// Approving actually copies the copy's files onto the final — whole
// file replace, no merging — and only then flips the status. Rejecting
// just flips the status.
export interface DecideChangeRequestRequest {
  decision: "approve" | "reject";
}
export type DecideChangeRequestResponse = ChangeRequest;

// ── Contribution timeline ────────────────────────────────
//
// A chronological record of who did what. Present it as a plain list,
// newest first.
//
// IMPORTANT, and not negotiable: never turn this into percentages, a
// leaderboard, a "top contributor", or any kind of score. Raw metrics
// start arguments and punish whoever did the reading and thinking
// rather than the typing. It's evidence for a conversation, not a
// verdict on who worked hardest.

export type TimelineEventType =
  | "copy_made"
  | "asked_to_add_in"
  | "added_in"
  | "said_no";

export interface TimelineEvent {
  id: string;
  type: TimelineEventType;
  at: string; // ISO date
  actorId: string | null;
  actorName: string; // email, or a fallback if the account is gone
  branchId: string | null;
  branchName: string | null;
}

// GET /api/projects/:id/timeline
// Newest first. Deliberately excludes file uploads and edits: storage
// doesn't record who put a file there, so attributing them would mean
// guessing, and a sometimes-wrong attribution log is worse than a
// narrow one.
export type GetTimelineResponse = TimelineEvent[];

// ── Errors ───────────────────────────────────────────────

// Every endpoint above returns this shape on failure. Status codes:
// 400 malformed request, 401 not signed in, 404 not found, 409 a
// real, showable reason the action can't happen right now (e.g. "you
// can't approve your own copy"), 500 something broke.
export interface ApiError {
  error: string;
}

// ── Not implemented yet ──────────────────────────────────
//
// These do not exist in the backend. Do not wire frontend UI to real
// calls for these until this comment is replaced with real types:
//
// - Activity — the contribution timeline. Falls out of change requests
//   now that approvals are recorded (who authored it, who reviewed
//   it), so it's buildable next, just not built yet.
// - Invite — not a typed request/response; joining a project is a plain
//   page navigation to GET {API_BASE_URL}/projects/:id/join, and opening
//   a file in the in-browser editor is GET
//   {API_BASE_URL}/projects/:id/edit?branch=<id>&file=<filename> — both
//   are regular links (<a href>), not fetch() calls, so no JSON shape
//   applies.
