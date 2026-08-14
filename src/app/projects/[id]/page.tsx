import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: project } = await supabase
    .from("projects")
    .select("name")
    .eq("id", id)
    .single();

  if (!project) {
    notFound();
  }

  return (
    <main className="flex flex-1 items-center justify-center">
      <h1 className="text-2xl font-semibold">{project.name}</h1>
    </main>
  );
}
