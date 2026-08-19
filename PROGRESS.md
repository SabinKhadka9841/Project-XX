# Where the backend stands

For the frontend side of the team — a plain-language walkthrough of everything built so far, why, and what's still missing. Technical contract details (exact request/response shapes) live in `API_CONTRACT.md` and `src/shared/types.ts`, sent separately — this document is the story around those.

## The headline

**The core loop works end to end, and the contribution log with it.** A person can make their own copy of a project, change it, ask a teammate to add it into the final, and the teammate can say yes or no — with the final only ever changing on approval. Every one of those steps is then recorded in a plain "who did what" timeline. That's the actual product idea, tested with two real accounts, not simulated.

Everything below either supports that loop or is infrastructure it depends on.

---

## What exists right now

### Accounts and projects
- Sign in via magic link (email only — no passwords).
- Create a project. You automatically become its `owner`.
- Invite a teammate with a plain link (`/projects/:id/join`) — no email list, no approval step to join, just click and you're a member.

### Versions: "the final" and "copies"
Every project has one protected **final** version. Anyone can click **"Make my own copy"**, which duplicates every file into a version that's entirely separate — changing a file in a copy is physically incapable of touching the final, because the bytes live in different storage folders.

### Files
- Upload into the final, or into any copy, via a plain file picker.
- Word/Excel/PowerPoint files (docx/xlsx/pptx) can also be opened and edited **live, in-browser** — a real embedded editor (OnlyOffice), not a homegrown one. Click "Open" next to a file instead of downloading it.
- Other file types (PDFs, images, Canva exports) stay upload/download only, edited in whatever tool the person already uses.

### The propose → approve loop
- On a copy, **"Ask to add this in"** raises a request. Nothing moves yet — it's a proposal, not applied.
- On the project page, everyone can see what's waiting under **"Waiting for someone to say yes."**
- Anyone who *isn't* the person who asked can **"Add it in"** or **"Say no."**
- Approving copies every file from the copy onto the final (whole-file replace — no diffing or merging, deliberately) and only then marks the request approved. Rejecting just marks it rejected; nothing about the files changes.
- **The person who asked can't decide their own request.** This isn't just hidden in the UI — the database itself refuses the update if you try, confirmed by testing it directly.

### The contribution timeline ("Who did what")
Every project now has a plain chronological log: who made a copy, who asked for it to be added in, who said yes or no. Reachable from the project page.

This is meant to be the part no competitor has — and it exists because of the approval gate, not as a separate feature bolted on. Because nothing reaches the final without someone approving it, the record of who did what falls out for free.

**It deliberately shows no percentages, no ranking, no "top contributor."** Raw metrics start arguments between teammates and punish whoever did the reading, planning and checking rather than the typing. It's evidence for a conversation, not a verdict. If you build any UI around this, please keep that — it's a product decision, not a styling one.

It also leaves out file uploads and edits, because storage never recorded who put a file there. Showing less beats showing something we'd be guessing at.

### The backend is a real API, not just pages
Because the frontend is a separate app, this backend also exposes plain REST endpoints (`/api/projects`, `/api/projects/:id/files`, `/api/projects/:id/copies`, `/api/projects/:id/change-requests`, …) that return JSON instead of HTML. That's what `API_CONTRACT.md` documents in full. There's also a typed contract file (`src/shared/types.ts`) meant to be copied into the frontend repo and kept in sync by hand, since the two repos can't literally share one file yet.

---

## Decisions worth knowing about

**No developer words anywhere a student sees.** Internally this is Git-like (branches, merges) because that's the easiest way to build it correctly. Nobody using the app ever sees those words — it's "my copy," "ask to add this in," "the final." If you're building UI text, match that vocabulary.

**Whole-file replace, not real merging.** If two people changed the same file in different copies, only one can be approved cleanly — there's no line-by-line merge. This is a deliberate v1 simplification, not an oversight.

**OnlyOffice runs in Docker, locally, separate from the Next.js app.** It needs to be running (`docker start onlyoffice-documentserver`) for the in-browser editor to work. If it's not running, "Open" on a file will fail — that's expected, not a bug to chase.

**The database moved once already.** It started in Seoul, which made every single database call a ~200ms round trip from Australia. It's now in Sydney. If you're setting up your own `.env.local`, use the values in `.env.example` and pick a nearby region if you ever spin up your own Supabase project for testing.

---

## Real bugs found and fixed along the way

Worth knowing about since they weren't obvious and could resurface in similar shapes:

1. **Creating a project used to fail outright.** The code tried to read back the row it had just inserted, but the security rule for "can you see this project" requires being a member — and the membership row didn't exist yet at that exact moment. Fixed by generating the project's ID up front instead of asking the database for it back.
2. **Invite links never actually worked for a genuinely new person**, only appeared to. The join page checked "does this project exist" using a method only members are allowed to use — so a brand-new person always got a false "not found." Only caught by testing with a real second account instead of assuming it worked because the code looked reasonable.
3. **Overwriting an existing file was silently broken for real users.** The database had permission rules for creating and viewing files, but not for *replacing* one. It only worked before through the in-editor save button, which uses a special bypass-everything key — a normal member overwriting a file the normal way (exactly what approving a request does) was broken since file upload was first built.
4. **You couldn't see your own teammates.** The rule for reading membership only ever allowed "your own row," so nothing could list who's in a project — and the contribution timeline showed every reviewer as "Someone who has left," because looking up a teammate's name required reading a membership row it wasn't allowed to see. Fixed so teammates are visible to each other; verified a non-member still sees nothing at all.

None of these were guessed at — each was found by actually driving the app with real accounts and checking the database state before and after, not by reading the code and assuming it was correct.

---

## What's not built yet

- **Solo mode**, deadlines, auto-lock before submission, a pending-approvals countdown, and one-click export are all later-phase items, untouched so far.
- **Attributing file uploads and edits.** Storage doesn't record who put a file where, so those events are absent from the timeline rather than guessed at.
- **A "who's in this project" list.** The data is readable now, but there's no screen or endpoint for it yet.
- **Real-time co-editing** exists in the sense that OnlyOffice supports it natively, but hasn't been tested with two people in the same file at once.

---

## Try it yourself

Backend runs on **`http://localhost:4000`**. You'll need `.env.local` set up per `.env.example`, the OnlyOffice Docker container running for the editor, and a magic-link email to actually sign in (or ask for a direct sign-in link if you want to skip that for testing).
