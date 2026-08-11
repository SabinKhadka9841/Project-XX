# Two-Developer Split

## The uncomfortable first rule: Phase 0 cannot be split

Prompts 1–6 build the foundation — scaffold, Supabase connection, auth, projects, upload. Every one depends on the one before it. Two people cannot build these in parallel; you'd just create the same files twice and spend a day untangling it.

**So: one person does Phase 0 alone.** Whoever is more comfortable with setup. It's roughly one focused session.

The other person is not idle during this. They should be doing the Phase 0 interviews — ten students, five instructors. That work is genuinely as important as the code and it's the one thing that actually parallelises on day one.

When Phase 0 is committed and pushed, you split.

---

## The contract: agree the schema before writing any Phase 1 code

This is the step that makes parallel work possible. Sit down together — one session, both present — and write the SQL for all the Phase 1 tables at once:

```
Branch          — id, project_id, name, owner_id, head_snapshot_id, created_at
Snapshot        — id, project_id, parent_id, author_id, message, created_at
FileEntry       — snapshot_id, path, blob_hash
ChangeRequest   — id, source_branch, target_branch, author_id,
                  message, status, created_at
```

Run it in Supabase. Commit the SQL file to the repo. **Neither of you changes the schema alone after this** — if it needs to change, both agree first, because a schema change breaks the other person's work silently.

Once the tables exist, both people are writing against a known shape and you can work independently for days without touching each other.

---

## The split

The natural seam is **the copy side** versus **the project side**. They talk to each other only through the `ChangeRequest` table.

### Developer A — "The copy side"

Everything a person does when they want to change something.

| Prompt | What it builds |
|---|---|
| 7 | Making a copy of a project |
| 8 | Changing and adding files inside a copy |
| 9 | Creating a change request |

**Owns these files:**
```
/src/app/copies/**
/src/modules/snapshots/**
/src/modules/branches/**
```

**Writes to:** `ChangeRequest` (creating rows with status 'pending')

### Developer B — "The project side"

Everything a person does when they're reviewing, joining, or looking back.

| Prompt | What it builds |
|---|---|
| 10 | Reviewing and approving requests |
| 11 | Invite by link |
| 12 | Contribution timeline |

**Owns these files:**
```
/src/app/projects/**
/src/app/invite/**
/src/modules/attribution/**
/src/modules/notifications/**
```

**Reads from:** `ChangeRequest` (and updates status to 'approved' / 'declined')

---

## Dependency warning

Prompt 10 (approving) needs prompt 9 (requests) to exist before it can be tested end to end.

Dev B should build the approval UI against **fake seeded data** — insert two or three dummy rows into `ChangeRequest` by hand in Supabase and build against those. That way B isn't blocked waiting for A. When A's real requests start appearing, B's screen already works.

This trick is worth remembering generally: seed fake data rather than waiting on your teammate.

---

## Git rules for two beginners

You are about to personally experience the exact problem your product solves. Take these seriously — merge conflicts between two people learning git can burn an entire evening.

**One repo on GitHub. Both clone it.**

**Never work on `main`.** Each person works on their own branch:

```bash
git checkout -b dev-a-copies      # Dev A
git checkout -b dev-b-approvals   # Dev B
```

**Pull before you start, every single time:**

```bash
git checkout main
git pull
git checkout your-branch
git merge main
```

**Push small and often.** Merge into `main` when a prompt is finished and working — not at the end of the week. Small merges rarely conflict; week-long ones always do.

**Never edit a file the other person owns.** If you need a change in their area, message them and ask. This one rule prevents most conflicts before they happen.

**Shared files that will cause conflicts if you both touch them:**

- `CLAUDE.md` — only change it together
- `package.json` — tell the other person when you install a library
- Anything in `/src/app/layout.tsx` or shared components — agree first

---

## Sync points

Three moments where you both need to be present:

1. **Schema session** — before Phase 1 starts. Non-negotiable.
2. **Mid-Phase 1 check** — after prompts 8 and 11 are done. Merge both branches into `main` and confirm the app still runs. Do not let this slip; the longer you wait the worse the merge.
3. **The integration test** — after prompts 9 and 10. Two accounts, two browsers: B's account copies a project, changes a file, requests it goes in; A's account approves it; the file updates. This is the moment the product exists.

---

## Using Claude Code with two people

Both of you keep the **same `CLAUDE.md`** in the repo — it's shared through git, so you both get identical context automatically. That's the whole point of it.

Add one line to your own session at the start of each day so Claude Code knows your lane:

> I am Developer A. I own the copy side — /src/app/copies and /src/modules/snapshots and /src/modules/branches. Do not modify files under /src/app/projects or /src/modules/attribution; those belong to Developer B. If a change seems to need those files, tell me instead of editing them.

Swap the paths for Developer B. Without this, Claude Code will happily "helpfully" refactor a file your teammate is editing, and you'll find out at merge time.

---

## If you're stuck on who does what

Whoever is more confident should take **Developer A**. The copy side involves file handling and storage, which is fiddlier.

Developer B's work is more UI and query logic, which is a gentler start — and prompt 11 (invite links) is the highest-leverage feature in the entire product, so it's not the lesser half.
