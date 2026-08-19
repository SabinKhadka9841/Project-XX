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

/** Where the browser reaches this app (the editor runs in an iframe). */
const APP_ORIGIN = "http://localhost:4000";

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
        <p className="text-sm leading-relaxed text-text-muted">
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

  const backTo = branch.isFinal
    ? `/projects/${id}`
    : `/projects/${id}/copies/${branch.id}`;

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

      // Strip OnlyOffice's own branding and chrome so what's left is
      // essentially the document surface, with our interface around it.
      // These are the keys this version actually reads — checked
      // against the running container rather than taken from docs for
      // another release.
      customization: {
        // Three options are deliberately absent, and none of it is an
        // oversight — each one breaks this edition outright:
        //
        //   toolbarNoTabs, loaderLogo, loaderName
        //
        // Any of them makes api.js append `&indexPostfix=_loader`, so
        // the iframe loads `index_loader.html` — a file the Community
        // build does not ship (only index.html exists; checked inside
        // the container). The result is a 404 where the document should
        // be. The condition is visible in their own api.js.
        //
        // `logo` is out for the same reason via the same code path, so
        // the ONLYOFFICE mark stays put on this edition. Re-branding is
        // an Enterprise feature; no config flag gets around a file that
        // isn't in the image.
        //
        // Everything below is what can genuinely be stripped.

        // What was observed on this edition, rather than what the docs
        // imply: compactHeader and goback take effect. about, leftMenu,
        // rightMenu and statusBar are accepted without complaint and
        // then ignored — the panels are all still there. They're left
        // in because they're harmless and are what we'd want if this
        // ever moves to an edition that honours them, but don't expect
        // them to do anything today.
        compactHeader: true, // works: drops the tall title bar
        about: false, // ignored on Community
        leftMenu: false, // ignored on Community
        rightMenu: false, // ignored on Community
        statusBar: false, // ignored on Community
        autosave: true,

        // A back arrow inside the editor, since with the chrome gone
        // there's otherwise no obvious way out.
        goback: {
          text: "Back",
          url: `${APP_ORIGIN}${backTo}`,
        },
      },
    },
  };
  const signedConfig = { ...config, token: signOnlyOfficeConfig(config) };

  return (
    <main className="flex flex-1 flex-col">
      <div className="border-b border-border-subtle bg-surface px-4 py-2.5 text-sm text-text-muted">
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
