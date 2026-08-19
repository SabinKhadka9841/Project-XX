import { createHash, createHmac } from "node:crypto";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { branchFolder, getBranch } from "@/modules/projects/branches";
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

function base64url(input: Buffer) {
  return input
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

// OnlyOffice requires the config we hand its editor to be signed, so it
// can trust it wasn't tampered with. This is a plain HS256 JWT, signed
// with the secret OnlyOffice's own Document Server generated.
function signOnlyOfficeConfig(config: object) {
  const secret = process.env.ONLYOFFICE_JWT_SECRET!;
  const header = base64url(Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })));
  const payload = base64url(Buffer.from(JSON.stringify(config)));
  const signature = base64url(
    createHmac("sha256", secret).update(`${header}.${payload}`).digest(),
  );
  return `${header}.${payload}.${signature}`;
}

export default async function EditFilePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ file?: string; branch?: string }>;
}) {
  const { id } = await params;
  const { file, branch: branchId } = await searchParams;

  if (!file || !branchId) {
    notFound();
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Independent lookups, so run them together — each one is a slow
  // round trip to a Supabase region that isn't nearby.
  const [{ data: project }, branch] = await Promise.all([
    supabase.from("projects").select("name").eq("id", id).single(),
    getBranch(supabase, branchId),
  ]);

  // Guard against a version id from another project being pasted in.
  if (!project || !branch || branch.projectId !== id) {
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

  const folder = branchFolder(id, branch.id);
  const filePath = `${folder}/${file}`;

  // The download link and the file's timestamp don't depend on each
  // other either, so fetch them at the same time.
  const [{ data: signed, error }, { data: fileList }] = await Promise.all([
    supabase.storage.from("project-files").createSignedUrl(filePath, 300),
    // The timestamp changes each time the file is re-uploaded, so
    // OnlyOffice can tell a stale cached copy from the current one.
    supabase.storage.from("project-files").list(folder, { search: file }),
  ]);

  if (error || !signed) {
    notFound();
  }

  const lastModified = fileList?.[0]?.updated_at ?? "";
  const documentKey = createHash("sha256")
    .update(`${filePath}:${lastModified}`)
    .digest("hex")
    .slice(0, 32);

  const callbackUrl = `${CALLBACK_HOST}/api/onlyoffice/callback?projectId=${id}&branchId=${branch.id}&filename=${encodeURIComponent(file)}`;

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
  const signedConfig = { ...config, token: signOnlyOfficeConfig(config) };

  return (
    <main className="flex flex-1 flex-col">
      <div className="border-b px-4 py-2 text-sm text-zinc-600">
        {project.name} / {branch.name} / {file}
      </div>
      <OnlyOfficeEditor
        documentServerUrl={DOCUMENT_SERVER_URL}
        config={signedConfig}
        filename={file}
      />
    </main>
  );
}
