import { createHash } from "node:crypto";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { OnlyOfficeEditor } from "./onlyoffice-editor";

const DOCUMENT_SERVER_URL = "http://localhost:8080";

// OnlyOffice runs in Docker, so it can't reach "localhost" on your Mac —
// host.docker.internal is Docker's special address for "the machine
// running Docker." That's how it can call our save-callback endpoint.
const CALLBACK_HOST = "http://host.docker.internal:4000";

function fileTypeFor(filename: string) {
  const extension = filename.split(".").pop()?.toLowerCase();
  return extension ?? "";
}

const DOCUMENT_TYPE_BY_EXTENSION: Record<string, string> = {
  doc: "word",
  docx: "word",
  xls: "cell",
  xlsx: "cell",
  ppt: "slide",
  pptx: "slide",
};

export default async function EditFilePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ file?: string }>;
}) {
  const { id } = await params;
  const { file } = await searchParams;

  if (!file) {
    notFound();
  }

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

  const documentType = DOCUMENT_TYPE_BY_EXTENSION[fileTypeFor(file)];

  if (!documentType) {
    return (
      <main className="flex flex-1 items-center justify-center px-4 text-center">
        <p className="text-sm text-zinc-600">
          &quot;{file}&quot; can&apos;t be opened in the in-browser editor
          (only Word, Excel and PowerPoint files can). Download it from the
          project page instead.
        </p>
      </main>
    );
  }

  const filePath = `${id}/${file}`;

  const { data: signed, error } = await supabase.storage
    .from("project-files")
    .createSignedUrl(filePath, 300);

  if (error || !signed) {
    notFound();
  }

  // Changes each time the file is re-uploaded, so OnlyOffice knows
  // when it's looking at a stale cached copy vs. the current one.
  const { data: fileList } = await supabase.storage
    .from("project-files")
    .list(id, { search: file });
  const lastModified = fileList?.[0]?.updated_at ?? "";
  const documentKey = createHash("sha256")
    .update(`${filePath}:${lastModified}`)
    .digest("hex")
    .slice(0, 32);

  const callbackUrl = `${CALLBACK_HOST}/api/onlyoffice/callback?projectId=${id}&filename=${encodeURIComponent(file)}`;

  const config = {
    document: {
      fileType: fileTypeFor(file),
      key: documentKey,
      title: file,
      url: signed.signedUrl,
    },
    documentType,
    editorConfig: {
      callbackUrl,
      mode: "edit",
      user: { id: user.id, name: user.email ?? "Unknown" },
    },
  };

  return (
    <main className="flex flex-1 flex-col">
      <div className="border-b px-4 py-2 text-sm text-zinc-600">
        {project.name} / {file}
      </div>
      <OnlyOfficeEditor documentServerUrl={DOCUMENT_SERVER_URL} config={config} />
    </main>
  );
}
