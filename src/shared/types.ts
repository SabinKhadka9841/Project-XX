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
// Last updated: added Users, Projects, and Project Files. No Copy/Branch/
// ChangeRequest/Activity types yet — those endpoints don't exist.
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
}

// GET /api/projects/:id/files
export type ListProjectFilesResponse = ProjectFile[];

// POST /api/projects/:id/files
// Request body is multipart/form-data with a "file" field — not JSON,
// so there's no request type to import for this one.
export interface UploadProjectFileResponse {
  name: string;
  sizeBytes: number;
  projectId: string;
}

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
// - Copy/Branch — copying a whole project (project-level, not per-file)
// - ChangeRequest — "ask to add this in" / approve / reject
// - Activity — the contribution timeline
// - Invite — not a typed request/response; joining a project is a plain
//   page navigation to GET {API_BASE_URL}/projects/:id/join, and opening
//   a file in the in-browser editor is GET
//   {API_BASE_URL}/projects/:id/edit?file=<filename> — both are regular
//   links (<a href>), not fetch() calls, so no JSON shape applies.
