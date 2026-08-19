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

Create a project. The creator is automatically added as its `owner`,
and the project's protected **final** version is created along with
it — a project without one can hold no files and can't be copied.

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

## Change requests: "ask to add this in"

A change request says "please put my copy's files into the final".
**Nothing moves when one is created** — files only change on approval.

Call it "ask to add this in" in the UI, never merge/pull request. A
pending one reads as "waiting for someone to say yes". Approve reads
as "add it in"; reject reads as "say no".

**The person who authored a request can't decide it — unless they're
alone on the project.** Approve/reject buttons should only render for
someone who isn't the `authorId`, *or* when the project has exactly
one member. The API enforces this (409) and so does the database
(RLS), so it isn't just a UI nicety — but hiding the buttons up front
still matters so people aren't clicking something guaranteed to fail.

The solo exception isn't a loophole, it's necessary: with nobody to
ask, a solo project could otherwise never change its final at all. The
timeline still records plainly that the same person did both halves.

### `GET /api/projects/:id/change-requests`

Newest first, every status. Filter for `"pending"` client-side.

```
200 [{
  "id": string,
  "projectId": string,
  "sourceBranchId": string,   // the copy the changes come from
  "targetBranchId": string,   // always the final, for now
  "authorId": string | null,  // null if that account was deleted
  "message": string | null,
  "status": "pending" | "approved" | "rejected",
  "reviewedBy": string | null,  // who approved/rejected; null while pending
  "reviewedAt": string | null,  // null while pending
  "createdAt": string
}]
```

### `PATCH /api/projects/:id/change-requests/:changeRequestId`

Approve or reject a pending request.

Request body: `{ "decision": "approve" | "reject" }`

```
200 { same shape as above, status/reviewedBy/reviewedAt updated }
400 { "error": "..." }              // decision missing or invalid
409 { "error": "<a readable reason>" }
```

Approving actually copies every file from the copy onto the final —
**whole-file replace, no merging**, matching the "no sophisticated
merging in v1" rule. A file the final has that the copy doesn't (not
possible right now, since a copy starts as a full duplicate) would be
left alone, not deleted.

**Because there's no merging, approving can erase a teammate's work.**
If somebody else's changes landed in the final after this copy was
made, adding the copy in reverts them. The pages in this repo warn
about that before you ask and before you approve, naming the affected
files. The API deliberately does **not** warn — it does what it's told
— so a frontend building its own approve button should surface the
same warning rather than letting people find out afterwards. There's
no endpoint for the check yet; ask if you want one.

The 409 cases, each with a message meant to be shown directly:
- the request was already decided
- the signed-in person is the request's own author

### `POST /api/projects/:id/change-requests`

Request body: `{ "sourceBranchId": string, "message"?: string | null }`

```
201 { same shape as above }
400 { "error": "sourceBranchId is required" }
409 { "error": "<a readable reason>" }
```

The **409** is the interesting one — it means the person did something
they can fix, and the `error` string is written to be shown to them
directly. Three cases:

- already asked for this copy, and it's still waiting
- the id given is the final version (you can't add the final into
  itself — ask from a copy)
- the id belongs to a different project

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

## Deadlines and locking

A project can have a deadline. Once it passes, the project is
**locked**: the final stops accepting file changes, and change
requests can no longer be approved. Copies stay fully editable —
freezing those would just destroy work in progress.

`GET /api/projects/:id` and the projects list don't currently return
the deadline; the pages read it server-side. Say the word if the
frontend needs it exposed and it's a small addition.

Locked projects reject writes with **409** and a readable message
("This project is closed — its due date has passed…"), from both the
file upload and the approve endpoints.

Worth knowing: any member can set, change, or clear the deadline. The
lock is a guardrail against accidents — someone opening the wrong file
the night before marking — not a security control against a determined
person.

## Exporting

### `GET /projects/:id/export` and `GET /projects/:id/export?branch=<id>`

Not a JSON endpoint — a plain browser navigation that downloads a zip
of every file in that version. Omit `branch` for the final. Link to it
with a normal `<a href>`; don't `fetch()` it.

```
200  application/zip, Content-Disposition attachment
409  { "error": "There are no files to export yet." }
404  { "error": "Not found" }
```

## People in a project

### `GET /api/projects/:id/members`

Who's in the project. Only visible to people already in it.

```
200 [{
  "userId": string,
  "role": string,   // "owner" for whoever created it, else "member"
  "name": string    // email, or a fallback if the account is gone
}]
```

Worth surfacing prominently: the measure that decides whether a pilot
worked is whether *every* member of a group signed up, and this is the
only way to see who actually did.

## Contribution timeline

### `GET /api/projects/:id/timeline`

A chronological record of who did what, newest first.

```
200 [{
  "id": string,
  "type": "copy_made" | "asked_to_add_in" | "added_in" | "said_no",
  "at": string,                 // ISO date
  "actorId": string | null,
  "actorName": string,          // email, or a fallback if the account is gone
  "branchId": string | null,
  "branchName": string | null
}]
```

**Present this as a plain list. Never as percentages, a leaderboard,
a "top contributor", or any score.** This isn't a style preference —
raw metrics start arguments between teammates and punish whoever did
the reading, planning and checking rather than the typing. It's
evidence for a conversation, not a verdict on who worked hardest. The
page in this repo says as much in its own footer; worth keeping that
sentiment wherever it appears.

File uploads and edits are deliberately **not** in the timeline:
storage never recorded who put a file there, so including them would
mean guessing at attribution. Narrow and correct beats broad and
sometimes-wrong.

## Core loop status

Copy → propose → approve is **done end to end** as of this update:
copying a project, asking for a copy to be added in, and a teammate
approving or rejecting it all work, verified in the browser with two
real accounts.

## Not built yet

- **Attributing file uploads and edits.** Storage doesn't record who
  put a file where. Fixing it means tracking uploads ourselves, which
  hasn't been done, so those events are absent from the timeline
  rather than guessed at.
- **Actually sending invite emails.** Invites are copy-paste links.
  Emailing them would need a mail provider (Resend, SendGrid or
  similar) with the cost and deliverability decisions that implies —
  worth a deliberate choice rather than quietly adding one.
- **Server-side endpoints for the "expecting" list.** It works on the
  project page but has no `/api/...` route yet, since the frontend
  hasn't asked for one. Straightforward to add.
