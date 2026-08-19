// The bits of WOPI we need to let Collabora open and save our files.
//
// WOPI is a protocol Microsoft defined and Collabora speaks: the editor
// asks *us* for a file's details and bytes, and posts the bytes back
// when saving. That's the opposite shape to OnlyOffice, which we handed
// a signed config and a callback URL. Hence the rewrite.
//
// Two things carry all the security here:
//
//   fileId       opaque, identifies which project/version/file
//   access_token signed by us, says who's editing and what they may do
//
// Collabora echoes both back on every request, and never sees anything
// it wasn't given. The token is what stops someone editing a file by
// guessing an id, so it is signed and time-limited rather than being a
// bare string.

import { createHmac, timingSafeEqual } from "node:crypto";

export interface WopiClaims {
  projectId: string;
  branchId: string;
  filename: string;
  userId: string;
  userName: string;
  canWrite: boolean;
  /** Seconds since epoch. */
  exp: number;
}

/** Long enough for a real editing session, short enough to matter. */
const TOKEN_LIFETIME_SECONDS = 8 * 60 * 60;

function secret() {
  const value = process.env.WOPI_TOKEN_SECRET;

  if (!value) {
    // Failing loudly beats signing with a blank key and silently
    // accepting anybody's forged token.
    throw new Error(
      "WOPI_TOKEN_SECRET is not set — the editor can't sign access tokens.",
    );
  }

  return value;
}

function base64url(input: Buffer | string) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function sign(payload: string) {
  return base64url(createHmac("sha256", secret()).update(payload).digest());
}

export function createAccessToken(
  claims: Omit<WopiClaims, "exp">,
  now = Date.now(),
): { token: string; expiresAtMs: number } {
  const exp = Math.floor(now / 1000) + TOKEN_LIFETIME_SECONDS;
  const payload = base64url(JSON.stringify({ ...claims, exp }));

  return {
    token: `${payload}.${sign(payload)}`,
    expiresAtMs: exp * 1000,
  };
}

/**
 * Returns the claims only if the signature and expiry both hold.
 * Anything else returns null — callers treat that as "no access".
 */
export function readAccessToken(
  token: string | null,
  now = Date.now(),
): WopiClaims | null {
  if (!token) return null;

  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;

  const expected = sign(payload);

  // Constant-time compare so the signature can't be discovered a byte
  // at a time by timing the response.
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  let claims: WopiClaims;
  try {
    claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  } catch {
    return null;
  }

  if (typeof claims.exp !== "number" || claims.exp * 1000 < now) return null;

  return claims;
}

/**
 * Which file a WOPI request is about.
 *
 * Encoded rather than raw so a filename containing a slash can't be
 * read as a different path, and so the shape can change later without
 * breaking saved URLs mid-session.
 */
export function encodeFileId(
  projectId: string,
  branchId: string,
  filename: string,
) {
  return base64url(JSON.stringify([projectId, branchId, filename]));
}

export function decodeFileId(
  fileId: string,
): { projectId: string; branchId: string; filename: string } | null {
  try {
    const parsed = JSON.parse(
      Buffer.from(fileId, "base64url").toString("utf8"),
    );

    if (!Array.isArray(parsed) || parsed.length !== 3) return null;
    const [projectId, branchId, filename] = parsed;
    if (
      typeof projectId !== "string" ||
      typeof branchId !== "string" ||
      typeof filename !== "string"
    ) {
      return null;
    }

    return { projectId, branchId, filename };
  } catch {
    return null;
  }
}

/**
 * The editor URL Collabora advertises for a given file type.
 *
 * Read from its discovery endpoint rather than hard-coded, because the
 * path contains a build hash that changes every time the image is
 * updated — exactly the sort of thing that silently breaks months
 * later.
 */
export async function getEditorUrl(filename: string): Promise<string | null> {
  const extension = filename.split(".").pop()?.toLowerCase();
  if (!extension) return null;

  const response = await fetch(
    `${process.env.COLLABORA_URL ?? "http://localhost:9980"}/hosting/discovery`,
    { cache: "no-store" },
  );

  if (!response.ok) return null;

  const xml = await response.text();

  // Find the <action> for this extension and take its urlsrc.
  const pattern = new RegExp(
    `<action[^>]*\\bext="${extension}"[^>]*\\burlsrc="([^"]+)"`,
    "i",
  );
  const match = xml.match(pattern);

  return match ? match[1] : null;
}
