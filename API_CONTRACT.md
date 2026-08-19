# Backend API contract

For whoever's wiring the frontend's `lib/api.ts` up to the real backend.

## Base URL

Local dev: `http://localhost:3000`. Set this as `NEXT_PUBLIC_API_BASE_URL`
in the frontend's `.env.local`.

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

### `GET /api/projects/:id/files`

```
200 [{
  "name": string,
  "sizeBytes": number,
  "lastModified": string,
  "url": string | null,   // signed download URL, expires after 60s
  "projectId": string
}]
```

### `POST /api/projects/:id/files`

Request body: `multipart/form-data` with a `file` field. Uploading a
file with a name that already exists in the project replaces it (no
version history yet).

```
201 { "name": string, "sizeBytes": number, "projectId": string }
400 { "error": "Choose a file first." }
```

## Joining a project (not a JSON endpoint)

Invite links are plain page navigations, not something to `fetch()`:
`{API_BASE_URL}/projects/:id/join`. Link to it directly (`<a href>`),
same as any other outbound link — the backend handles sign-in and
adding the person as a member, then lands them back on the project.

## Not built yet

No endpoints for branches, change requests ("ask to add this in" /
approve), or activity — those don't exist in the backend yet. They'll
be added once the copy → propose → approve loop is actually built.
Don't wire the frontend's branch/merge-request UI to real calls until
this doc says they exist.
