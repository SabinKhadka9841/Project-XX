import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SignInForm } from "@/app/login/sign-in-form";

export default async function JoinProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Signed out: show what they've been invited to *before* asking for
  // anything. Bouncing straight to a bare email box is where somebody
  // who's never heard of this tool gives up and says "just email it to
  // me" — which the plan names as the real competitor.
  if (!user) {
    const { data } = await supabase.rpc("invite_preview", {
      p_project_id: id,
    });

    const projectName = (data as { name: string }[] | null)?.[0]?.name;

    if (!projectName) {
      notFound();
    }

    return (
      <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-5 px-4 py-16">
        <div className="flex flex-col gap-2">
          <p className="text-sm text-zinc-600">
            You&apos;ve been invited to a group project
          </p>
          <h1 className="text-2xl font-semibold">{projectName}</h1>
        </div>

        <p className="text-sm text-zinc-600">
          Everyone works on their own copy, and nothing changes the final
          version until a teammate agrees to it. Put in your email and
          you&apos;re in.
        </p>

        <SignInForm next={`/projects/${id}/join`} submitLabel="Join this project" />
      </main>
    );
  }

  // Signed in: no separate "does this project exist" check, because the
  // projects SELECT policy only lets members see it and a new joiner
  // isn't one yet — checking first sent every genuine new member to a
  // false 404. The insert's own foreign key catches a bad id.
  const { error } = await supabase
    .from("members")
    .insert({ project_id: id, user_id: user.id });

  if (error) {
    if (error.code === "23505") {
      // Already a member. Fine, just continue.
    } else if (error.code === "23503") {
      notFound();
    } else {
      throw new Error(error.message);
    }
  }

  redirect(`/projects/${id}?joined=1`);
}
