@AGENTS.md

# CLAUDE.md

## Working style — read this first

The developer on this project is a beginner. They have not built a Next.js app before.

- Explain what each file does as you create it, in plain language.
- Do one step at a time. Do not build ahead of what was asked, even if the next step seems obvious.
- Stop and ask rather than guessing when something is ambiguous.
- When the developer must do something outside the editor (create an account, copy an API key, run SQL in a dashboard), give exact click-by-click instructions.
- Prefer boring, obvious code over clever code. This codebase will be read by someone learning.
- After each working step, remind them to commit.
- Keep the UI extremely plain until explicitly told otherwise. Function before appearance.

---

## What we are building

A collaboration tool for student group projects.

Every project has a protected final version. Anyone can make a **copy**, change files freely, and propose those changes back. Changes only reach the final version once a teammate **approves** them. Because every change passes through that approval gate, the system automatically records who contributed what — which is the part no competitor has.

**One-line pitch:** Figma branches a design file for professionals. We branch an entire assignment for students, in whatever tools they already use, and we keep the receipts for who did what.

**The problem:** group assignments fail for social reasons. Files scatter across WhatsApp and Drive, nobody knows which version is current, one person hoards the master copy out of fear it'll get broken, and at the end marks are shared equally regardless of who did the work.

---

## Locked decisions — do not suggest otherwise

**Monolith, not microservices.** Microservices solve an organisational problem that doesn't exist below ~50 engineers. The only future exception is document processing, which becomes a background worker with a job queue — same repo, separate process.

**We do not build our own editor.** Students keep using Word, Google Docs, Canva, Excel. We are a versioning and approval layer on top of the tools they already use. Building an editor is a year of work per format and contradicts the strategy.

**No sophisticated merging in v1.** Whole-file propose-and-replace only. If two people copy the same project at once, one set of changes is discarded — show a plain warning, don't engineer around it yet.

**Never convert file formats.** Original bytes are always the source of truth. Round-tripping docx → our format → docx destroys footnotes, tracked changes, page breaks and embedded charts. Coursework has strict formatting requirements.

**Not building:** chat, calendars, task boards, notes, study tools. Each competes with a category leader students already use.

**No developer vocabulary in the UI.** Never show the user these words:

| Never say | Say instead |
|---|---|
| Branch | My copy |
| Merge / merge request | Ask to add this in |
| Main / master | The final |
| Merge conflict | You both changed page 4 — pick one |
| Commit | Save |
| Repository | Project |

---

## Tech stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16, App Router, TypeScript, `src/` directory |
| Styling | Tailwind |
| Database | Supabase (Postgres) |
| Auth | Supabase Auth, magic links |
| File storage | Supabase Storage for now; Cloudflare R2 later (zero egress fees — S3 would be too expensive for a download-heavy product) |
| Hosting | Vercel |
| Package manager | npm |

---

## Data model

Build these incrementally as the prompts call for them — not all at once.

```
User            — handled by Supabase Auth
Project         — id, name, deadline, org_id, created_at
Member          — project_id, user_id, role
Blob            — hash (PK), size, mime_type
Snapshot        — id, project_id, parent_id, author_id, message, created_at
FileEntry       — snapshot_id, path, blob_hash
Branch          — id, project_id, name, head_snapshot_id
ChangeRequest   — id, source_branch, target_branch, author_id, status, created_at
```

**Two rules that matter:**

1. **`org_id` goes on every table holding user data, from the first migration.** Universities will demand tenancy isolation and regional data residency. Retrofitting this is painful; doing it now is free.

2. **`ChangeRequest` + `Snapshot.author_id` *is* the contribution log.** Attribution is not a separate feature — it falls out of this model, which is exactly why it's the defensible part of the product.

---

## The key architectural idea: content-addressed storage

When a file is uploaded, hash it (SHA-256) and store the bytes under that hash. A project snapshot is then a small JSON manifest:

```json
{
  "report.docx": "a3f8b2...",
  "slides.pptx": "9c1e44...",
  "data.xlsx":   "7b02de..."
}
```

Copying a project = copying that manifest. Instant, and it costs nothing. Change only the report, and the new snapshot reuses the other two hashes. Ten snapshots of a 200MB project cost ~210MB, not 2GB.

This is how Git works internally, and it turns "branch the whole submission" from an expensive feature into a cheap one.

**Note:** early prompts deliberately skip hashing and store files plainly. That is intentional — it's wasteful but simpler to learn on, and swapping it in later changes nothing the user sees. Do not add hashing before it is asked for.

---

## Code organisation

Modular monolith — organise by domain, not by technical layer:

```
/src
  /app          ← Next.js routes
  /modules
    /projects
    /snapshots      ← blob storage, manifests, hashing
    /diffing        ← most likely to be extracted to a worker later
    /attribution
    /notifications
```

**Rule:** modules talk through defined functions, never by reaching into each other's database tables. If `attribution` needs snapshot data it calls `snapshots.getHistory()`. This costs nothing today and means any module can become a separate service later by swapping a function call for an HTTP call.

---

## Build order

**Phase 0 — foundation.** Next.js scaffold → Supabase connection → projects table → magic link auth → projects list → file upload.

**Phase 1 — the core loop.** Copy a project → upload a changed file into the copy → request it goes in → approve → final version updates. Plus link-based invites.

**Phase 2 — the parts nobody else has.** Contribution timeline (chronological log, **never percentages** — raw metrics start fights and punish whoever did research rather than typing). Then solo mode: a project with one member is a personal draft history.

**Phase 3 — pilot-ready.** Deadline field, auto-lock before submission, countdown of pending approvals, one-click export. Then a full week on onboarding friction alone.

**Freeze rule:** no new feature ideas enter the build until the core loop works end to end.

---

## What success looks like

The metric that matters in the first pilot is **the percentage of groups where every single member signed up** — not sessions, not retention, not files uploaded.

One member saying "just email it to me" collapses the whole group back to WhatsApp. That is the real competitor, and friction is the thing most likely to kill this product. Engineering is not.

Every design decision should be weighed against: *does this make it easier or harder for the least motivated member of the group to join?*
