# Build Prompts — work through these in order

**How to use this file**

Paste one prompt at a time into Claude Code. After each one:

1. Check the thing actually works before moving on.
2. Commit: `git add -A && git commit -m "what you just did"`
3. Only then move to the next prompt.

Do not skip ahead. Do not paste two at once. When something breaks, paste the **entire** error message back into Claude Code — including the file name and line number, not a summary.

Turn on plan mode with `Shift+Tab` for the first few. It shows you what it intends to do before it writes anything.

---

## PHASE 0 — Foundation

### Prompt 1 — Scaffold

```
Read CLAUDE.md for full project context.

Set up step one only: a Next.js 15 app in this folder with
TypeScript, Tailwind, App Router and the src/ directory, using npm.
Replace the default homepage with a plain heading that says
"Project Vault".

Nothing else — no Supabase, no auth, no database.

Explain what each file and folder does as you create it, and when
you're done tell me the exact command to see it in my browser.
```

**Check:** `localhost:3000` shows your heading.

---

### Prompt 2 — Supabase account and connection

```
I want to connect this app to Supabase. I have not created an
account yet.

First: give me step-by-step instructions for the Supabase website —
creating the project, and exactly where to find the project URL and
anon key. Be specific about what to click.

Then: install the Supabase client library and set up the connection
files. Show me exactly what .env.local should contain with
placeholder values, and make sure .env.local is listed in
.gitignore.

Do not build any features yet.
```

**Check:** the app still loads without errors after adding the keys.

---

### Prompt 3 — First tables

```
Using the data model in CLAUDE.md, write the SQL for just two
tables: projects and members.

Keep it minimal — no snapshots, blobs or branches yet. Include the
org_id column on projects as specified.

Give me the SQL as a block I can paste into the Supabase SQL
editor, and explain what each column is for in plain language.
Also explain what Row Level Security is and whether I need it yet.
```

**Check:** tables appear in the Supabase table editor.

---

### Prompt 4 — Login

```
Add magic link authentication using Supabase Auth.

I want:
- A /login page with a single email field that emails a sign-in link
- Clicking the link lands the user on /projects
- Visiting /projects while logged out redirects to /login
- A sign out button somewhere visible

Keep the UI completely plain. Explain how the redirect protection
works and where that code lives.
```

**Check:** you can email yourself a link, click it, and land on /projects.

---

### Prompt 5 — Projects list

```
Build the /projects page.

It should list every project the logged-in user is a member of, and
have a "New project" button that asks for a name, creates the
project, and adds the creator as a member with role 'owner'.

Clicking a project goes to /projects/[id], which for now just shows
the project name.
```

**Check:** you can create two projects and click into each.

---

### Prompt 6 — File upload

```
On the /projects/[id] page, add file upload using Supabase Storage.

Uploaded files should appear in a list below showing filename, size
and upload date, each with a working download link. Files must be
scoped to their project — project A must not show project B's files.

No versioning, no copies, no hashing yet. Plain upload and list.
```

**Check:** upload a .docx to one project, confirm it does not appear in the other.

**Phase 0 is now complete. Commit and take a break.**

---

## PHASE 1 — The core loop

This is the actual product. Everything above was plumbing.

### Prompt 7 — Copies

```
Add the ability to make a copy of a project.

On /projects/[id], add a button labelled "Make my copy". It creates
a copy of the project containing all its current files, owned by
the person who clicked it, and takes them to /copies/[id].

The copy is fully editable by its owner. Changes there must not
affect the original project in any way.

Remember the vocabulary rules in CLAUDE.md — the UI says "my copy",
never "branch".

For now, duplicating the files is fine even though it wastes
storage. We'll add content hashing later.
```

---

### Prompt 8 — Changing files in a copy

```
On the copy page, let the owner replace any file by uploading a new
version of it, and add new files.

Show clearly which files have been changed compared to the original
project — something like a "changed" label next to them.

The original project must remain untouched.
```

---

### Prompt 9 — Requesting changes go in

```
Add a button on the copy page: "Ask to add this in".

It creates a request recording who made it, which copy it came
from, which project it targets, which files changed, and a short
message the user types explaining what they did.

The request status starts as 'pending'. Show the user a
confirmation that their request was sent.
```

---

### Prompt 10 — Approving

```
On /projects/[id], show any pending requests to project members.

Each request shows who made it, their message, when, and which
files would change.

Members can Approve or Decline. Approving replaces those files in
the project with the versions from the copy and marks the request
'approved'. Declining marks it 'declined' and changes nothing.

The person who made the request should not be able to approve their
own request.
```

**Check:** two accounts. Account B copies, changes a file, requests. Account A sees it and approves. The file in the project updates.

**This is the demo. If it works, you have a product to show people.**

---

### Prompt 11 — Invite by link

```
Add link-based invites.

Project members can generate an invite link. Anyone opening it sees
the project name and files immediately, before signing up. They are
prompted to sign in only when they try to make a copy or approve
something.

This is the single most important thing for adoption — every extra
step before someone sees value loses a group member. Make the path
from clicking a link to seeing the project as short as possible.
```

---

### Prompt 12 — Contribution timeline

```
Add a "Who did what" tab on the project page.

Show a chronological list of every approved request: who, what they
changed, when, and their message.

Do NOT show percentages, scores, or rankings of any kind. Raw
metrics start arguments and punish people who did research rather
than typing. A timeline informs a conversation; a score starts a
fight.
```

---

## Stop here

That is a working product. Do not add features beyond this point until real students have used it for a real assignment.

The next thing is not code — it's finding one instructor willing to let a class try it for one project.
