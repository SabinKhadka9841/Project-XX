import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { InviteLink } from "./invite-link";
import { uploadFile } from "./actions";

const EDITABLE_EXTENSIONS = ["doc", "docx", "xls", "xlsx", "ppt", "pptx"];

function isEditable(filename: string) {
  const extension = filename.split(".").pop()?.toLowerCase();
  return extension ? EDITABLE_EXTENSIONS.includes(extension) : false;
}

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

  const { data: storageFiles } = await supabase.storage
    .from("project-files")
    .list(id);

  const files = await Promise.all(
    (storageFiles ?? []).map(async (file) => {
      const { data: signed } = await supabase.storage
        .from("project-files")
        .createSignedUrl(`${id}/${file.name}`, 60);
      return { name: file.name, url: signed?.signedUrl };
    }),
  );

  return (
    <main className="flex flex-1 flex-col items-center gap-6 px-4 py-16">
      <h1 className="text-2xl font-semibold">{project.name}</h1>
      <InviteLink projectId={id} />

      <div className="flex w-full max-w-md flex-col gap-4">
        <form action={uploadFile.bind(null, id)} className="flex gap-2">
          <input type="file" name="file" required className="flex-1 text-sm" />
          <button
            type="submit"
            className="rounded border px-3 py-2 text-sm hover:bg-zinc-50"
          >
            Upload
          </button>
        </form>

        {files.length === 0 ? (
          <p className="text-sm text-zinc-600">No files yet.</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {files.map((file) => (
              <li key={file.name} className="flex items-center gap-3">
                <a
                  href={file.url}
                  className="text-sm underline"
                  target="_blank"
                  rel="noreferrer"
                >
                  {file.name}
                </a>
                {isEditable(file.name) && (
                  <Link
                    href={`/projects/${id}/edit?file=${encodeURIComponent(file.name)}`}
                    className="text-sm text-zinc-600 underline"
                  >
                    Open
                  </Link>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
