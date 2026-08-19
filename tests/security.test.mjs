// Tests for the rules that keep one group's coursework private from
// another's.
//
// These run against the real database as real signed-in users, not as
// the service role — so they exercise the row-level security policies
// exactly as the app does. Testing them any other way would prove
// nothing, because the service role bypasses every policy.
//
// Everything the app's privacy rests on lives in those policies, and
// until now they were only ever checked by hand. Five genuine bugs
// turned up that way during the build; this is what stops the next one
// shipping silently.
//
// Run with: npm test

import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

// Read .env.local directly: this is a plain node script, not Next.js,
// so nothing has loaded it for us.
const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split("\n")
    .filter((line) => line.trim() && !line.trim().startsWith("#"))
    .map((line) => {
      const at = line.indexOf("=");
      return [line.slice(0, at).trim(), line.slice(at + 1).trim()];
    }),
);

const URL_ = env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE = env.SUPABASE_SERVICE_ROLE_KEY;

const admin = createClient(URL_, SERVICE, {
  auth: { autoRefreshToken: false, persistSession: false },
});

/** A client acting as a real signed-in user, subject to every policy. */
async function signInAs(email) {
  // Create the account first: for an address that doesn't exist yet,
  // generateLink issues a *signup* token, which verifyOtp then rejects
  // when told to expect a magiclink.
  await admin.auth.admin.createUser({ email, email_confirm: true });

  const { data, error } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
  });
  if (error) throw error;

  const verifier = createClient(URL_, ANON, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: session, error: verifyError } = await verifier.auth.verifyOtp({
    token_hash: data.properties.hashed_token,
    type: "magiclink",
  });
  if (verifyError) throw verifyError;

  return {
    userId: session.user.id,
    client: createClient(URL_, ANON, {
      auth: { autoRefreshToken: false, persistSession: false },
      global: {
        headers: { Authorization: `Bearer ${session.session.access_token}` },
      },
    }),
  };
}

const stamp = Date.now();
const OWNER_EMAIL = `test-owner-${stamp}@example.com`;
const TEAMMATE_EMAIL = `test-teammate-${stamp}@example.com`;
const OUTSIDER_EMAIL = `test-outsider-${stamp}@example.com`;

let owner, teammate, outsider;
let projectId, finalId;

before(async () => {
  [owner, teammate, outsider] = await Promise.all([
    signInAs(OWNER_EMAIL),
    signInAs(TEAMMATE_EMAIL),
    signInAs(OUTSIDER_EMAIL),
  ]);

  projectId = crypto.randomUUID();

  // Built through the owner's own client, so the setup itself proves
  // the create path works under policy rather than around it.
  const { error: projectError } = await owner.client
    .from("projects")
    .insert({ id: projectId, name: `Policy test ${stamp}` });
  assert.equal(projectError, null, "owner should be able to create a project");

  await owner.client
    .from("members")
    .insert({ project_id: projectId, user_id: owner.userId, role: "owner" });

  const { data: final } = await owner.client
    .from("branches")
    .insert({ project_id: projectId, name: "The final", is_final: true })
    .select("id")
    .single();
  finalId = final.id;

  await teammate.client
    .from("members")
    .insert({ project_id: projectId, user_id: teammate.userId });
});

after(async () => {
  await admin.from("projects").delete().eq("id", projectId);

  // Sweeps every account this suite has ever made, not just this run's.
  // A failing run would otherwise leave its users behind, and they'd
  // pile up invisibly in a real project's account list.
  const { data } = await admin.auth.admin.listUsers({ perPage: 200 });
  const strays = (data?.users ?? []).filter((user) =>
    /^test-(owner|teammate|outsider)-\d+@example\.com$/.test(user.email ?? ""),
  );

  for (const user of strays) {
    await admin.auth.admin.deleteUser(user.id);
  }
});

describe("someone outside the project", () => {
  it("cannot see the project", async () => {
    const { data } = await outsider.client
      .from("projects")
      .select("id")
      .eq("id", projectId);
    assert.deepEqual(data, [], "an outsider must not see the project at all");
  });

  it("cannot see who is in it", async () => {
    const { data } = await outsider.client
      .from("members")
      .select("user_id")
      .eq("project_id", projectId);
    assert.deepEqual(data, []);
  });

  it("cannot see teammates' email addresses", async () => {
    const { data } = await outsider.client
      .from("profiles")
      .select("email")
      .in("id", [owner.userId, teammate.userId]);
    assert.deepEqual(data, [], "emails must not leak to non-members");
  });

  it("cannot see the project's versions", async () => {
    const { data } = await outsider.client
      .from("branches")
      .select("id")
      .eq("project_id", projectId);
    assert.deepEqual(data, []);
  });

  it("cannot read its files", async () => {
    const { data } = await outsider.client.storage
      .from("project-files")
      .list(`${projectId}/${finalId}`);
    assert.deepEqual(data ?? [], []);
  });

  it("cannot upload into it", async () => {
    const { error } = await outsider.client.storage
      .from("project-files")
      .upload(
        `${projectId}/${finalId}/intruder.txt`,
        new Blob(["should be refused"]),
      );
    assert.notEqual(error, null, "an outsider must not be able to write files");
  });
});

describe("someone in the project", () => {
  it("can see it", async () => {
    const { data } = await teammate.client
      .from("projects")
      .select("id")
      .eq("id", projectId);
    assert.equal(data.length, 1);
  });

  it("can see who else is in it", async () => {
    const { data } = await teammate.client
      .from("members")
      .select("user_id")
      .eq("project_id", projectId);
    assert.equal(data.length, 2, "teammates must be visible to each other");
  });

  it("can see teammates' names", async () => {
    const { data } = await teammate.client
      .from("profiles")
      .select("email")
      .eq("id", owner.userId);
    assert.equal(data.length, 1, "needed for the contribution timeline");
  });
});

describe("the approval gate", () => {
  let requestId;

  before(async () => {
    const { data: copy } = await owner.client
      .from("branches")
      .insert({ project_id: projectId, name: "owner's copy", is_final: false })
      .select("id")
      .single();

    const { data: request } = await owner.client
      .from("change_requests")
      .insert({
        project_id: projectId,
        source_branch_id: copy.id,
        target_branch_id: finalId,
        author_id: owner.userId,
      })
      .select("id")
      .single();
    requestId = request.id;
  });

  it("stops you approving your own work when someone else could", async () => {
    const { data } = await owner.client
      .from("change_requests")
      .update({
        status: "approved",
        reviewed_by: owner.userId,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", requestId)
      .select("id");

    assert.deepEqual(
      data,
      [],
      "the author must not be able to approve their own request",
    );
  });

  it("still says pending afterwards", async () => {
    const { data } = await owner.client
      .from("change_requests")
      .select("status")
      .eq("id", requestId)
      .single();
    assert.equal(data.status, "pending");
  });

  it("lets a teammate approve it", async () => {
    const { data } = await teammate.client
      .from("change_requests")
      .update({
        status: "approved",
        reviewed_by: teammate.userId,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", requestId)
      .select("id");

    assert.equal(data.length, 1, "a teammate must be able to approve");
  });

  it("refuses to record someone else as the reviewer", async () => {
    const { data: copy } = await owner.client
      .from("branches")
      .insert({ project_id: projectId, name: "another copy", is_final: false })
      .select("id")
      .single();

    const { data: request } = await owner.client
      .from("change_requests")
      .insert({
        project_id: projectId,
        source_branch_id: copy.id,
        target_branch_id: finalId,
        author_id: owner.userId,
      })
      .select("id")
      .single();

    // The teammate approving, but claiming the owner reviewed it.
    await teammate.client
      .from("change_requests")
      .update({
        status: "approved",
        reviewed_by: owner.userId,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", request.id)
      .select("id");

    // Asserting the end state rather than the call's return shape: a
    // refusal surfaces as an empty result when the row simply isn't
    // updatable, but as a thrown error when the WITH CHECK clause
    // rejects the new values. Both mean refused; only the stored row
    // proves it.
    const { data: after } = await admin
      .from("change_requests")
      .select("status, reviewed_by")
      .eq("id", request.id)
      .single();

    assert.equal(
      after.status,
      "pending",
      "you must not be able to attribute your approval to somebody else",
    );
    assert.equal(after.reviewed_by, null);
  });
});

describe("a passed deadline", () => {
  before(async () => {
    await admin
      .from("projects")
      .update({ deadline: new Date(Date.now() - 3600_000).toISOString() })
      .eq("id", projectId);
  });

  after(async () => {
    await admin
      .from("projects")
      .update({ deadline: null })
      .eq("id", projectId);
  });

  it("closes the final to new files", async () => {
    const { error } = await owner.client.storage
      .from("project-files")
      .upload(`${projectId}/${finalId}/late.txt`, new Blob(["too late"]));
    assert.notEqual(error, null, "the final must be closed once it's due");
  });

  it("leaves copies editable, so work in progress isn't destroyed", async () => {
    const { data: copy } = await owner.client
      .from("branches")
      .insert({ project_id: projectId, name: "late copy", is_final: false })
      .select("id")
      .single();

    const { error } = await owner.client.storage
      .from("project-files")
      .upload(`${projectId}/${copy.id}/wip.txt`, new Blob(["still working"]));
    assert.equal(error, null, "copies must stay editable after the deadline");
  });
});

describe("the invite link", () => {
  it("shows the project name to someone signed out", async () => {
    const anon = createClient(URL_, ANON, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data } = await anon.rpc("invite_preview", {
      p_project_id: projectId,
    });
    assert.equal(data?.[0]?.name, `Policy test ${stamp}`);
  });

  it("exposes nothing else about the project", async () => {
    const anon = createClient(URL_, ANON, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data } = await anon.rpc("invite_preview", {
      p_project_id: projectId,
    });
    assert.deepEqual(
      Object.keys(data[0]),
      ["name"],
      "the preview must leak only the name, never the deadline or anything else",
    );

    const { data: direct } = await anon.from("projects").select("*");
    assert.deepEqual(direct, [], "the table itself must stay unreadable");
  });
});
