# Backend API contract

For whoever's wiring the frontend's `lib/api.ts` up to the real backend.

## Base URL

Local dev: `http://localhost:4000` — this is already `lib/api.ts`'s
default, so no `.env.local` change should even be needed on the
frontend side.

## Auth

Cookie-based, not a token you attach yourself. Every request must be made
with `credentials: 'include'` (the frontend's `lib/api.ts` already does
this). Signing in happens on the *backend's* domain — send the user to
`{API_BASE_URL}/login`, they enter their email, click the magic link in
their inbox, and land back on the backend signed in with a session
cookie. There's no `/api/login` endpoint to call directly.

If a request isn't signed in, every endpoint below returns:

```
401 { "error": "Not signed in" }
```

## Endpoints implemented so far

### `GET /api/me`

```
200 { "id": string, "email": string }
```

Note: no `name` or `role` field yet — we don't collect a display name
anywhere in the product yet, just an email via magic link.

### `GET /api/projects`

List projects the signed-in user is a member of.

```
200 [{ "id": string, "name": string, "createdAt": string }]
```

### `POST /api/projects`

Create a project. The creator is automatically added as its `owner`.

Request body: `{ "name": string }`

```
201 { "id": string, "name": string, "createdAt": string }
400 { "error": "Project name is required" }
```

### `GET /api/projects/:id`

```
200 { "id": string, "name": string, "createdAt": string }
404 { "error": "Not found" }
```

(404 also covers "exists but you're not a member" — we don't leak
whether a project exists to non-members.)

## Versions: "the final" and "copies"

Files no longer sit loose in a project. Every project has one protected
**final** version, plus zero or more **copies** that people can change
freely without affecting the final. Every file therefore belongs to a
version, and carries its `branchId`.

Never call these branches in the UI — it's "the final" and "my copy".

### `GET /api/projects/:id/copies`

Lists the copies only. The final version isn't a copy, so it isn't in
this list.

```
200 [{
  "id": string,
  "projectId": string,
  "name": string,          // e.g. "sam@uni.edu's copy"
  "createdBy": string | null,   // user id; null if the account was deleted
  "createdAt": string
}]
```

### `POST /api/projects/:id/copies`

Makes a copy of the final version, duplicating all its files. No
request body — it's always copied from the final, and named after the
signed-in user.

```
201 { same shape as above }
404 { "error": "Not found" }
```

### `GET /api/projects/:id/files?branchId=<id>`

`branchId` is **optional** — leave it off to get the final version's
files, or pass a copy's id to get that copy's files.

```
200 [{
  "name": string,
  "sizeBytes": number,
  "lastModified": string | null,  // null if storage recorded no timestamp
  "url": string | null,           // signed download URL, expires after 60s
  "projectId": string,
  "branchId": string              // which version this file belongs to
}]
404 { "error": "Not found" }      // branchId isn't part of this project
```

### `POST /api/projects/:id/files?branchId=<id>`

Request body: `multipart/form-data` with a `file` field. `branchId` is
optional — omit it to upload into the final. Uploading a file whose
name already exists in that version replaces it (no per-file history
yet).

```
201 { "name": string, "sizeBytes": number, "projectId": string, "branchId": string }
400 { "error": "Choose a file first." }
404 { "error": "Not found" }
```

## Joining a project (not a JSON endpoint)

Invite links are plain page navigations, not something to `fetch()`:
`{API_BASE_URL}/projects/:id/join`. Link to it directly (`<a href>`),
same as any other outbound link — the backend handles sign-in and
adding the person as a member, then lands them back on the project.

## Opening a file in the in-browser editor (not a JSON endpoint)

Also a plain page navigation, not a `fetch()` call:
`{API_BASE_URL}/projects/:id/edit?branch=<branchId>&file=<filename>`.
Both query parameters are required. Only works for Word/Excel/
PowerPoint files (doc/docx/xls/xlsx/ppt/pptx) — other file types
should just link to their download URL from the files endpoint
instead. Opens the file live, in-browser, via OnlyOffice; changes save
back to that version automatically.

Note this needs OnlyOffice's Document Server running in Docker
locally. See `.env.example` for the one-line command.

## Not built yet

**Change requests** ("ask to add this in" / approve / reject) and
**activity** do not exist yet. Copies can be made and edited, but
there is currently no way to get changes from a copy back into the
final — that's the next thing being built.

Don't wire the frontend's propose/approve UI to real calls until this
doc says those endpoints exist.
