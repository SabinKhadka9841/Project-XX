"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Collabora is loaded by POSTing a form into an iframe — it takes the
 * access token in the body rather than the URL, which keeps the token
 * out of browser history, server logs and the Referer header.
 */
export function CollaboraEditor({
  editorUrl,
  wopiSrc,
  accessToken,
  accessTokenTtl,
  filename,
}: {
  editorUrl: string;
  wopiSrc: string;
  accessToken: string;
  accessTokenTtl: number;
  filename: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const submitted = useRef(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (submitted.current) return;
    submitted.current = true;
    formRef.current?.submit();
  }, []);

  useEffect(() => {
    // Collabora announces itself once the document is open. Until then
    // the iframe is blank, which reads as broken on a big document.
    function onMessage(event: MessageEvent) {
      if (typeof event.data !== "string") return;
      try {
        const message = JSON.parse(event.data);
        if (
          message.MessageId === "App_LoadingStatus" &&
          message.Values?.Status === "Document_Loaded"
        ) {
          setReady(true);
        }
      } catch {
        // Not a message meant for us.
      }
    }

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  const src = `${editorUrl}WOPISrc=${encodeURIComponent(wopiSrc)}`;

  return (
    <div className="relative flex-1">
      {!ready && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-bg px-4 text-center">
          <p className="text-sm font-medium">Opening {filename}…</p>
          <p className="text-sm text-text-muted">
            Large documents can take a few seconds to appear.
          </p>
        </div>
      )}

      <form
        ref={formRef}
        action={src}
        method="post"
        target="collabora-frame"
        className="hidden"
      >
        <input type="hidden" name="access_token" value={accessToken} />
        <input
          type="hidden"
          name="access_token_ttl"
          value={String(accessTokenTtl)}
        />
      </form>

      <iframe
        name="collabora-frame"
        title={filename}
        className="h-full w-full border-0"
        allow="clipboard-read; clipboard-write; fullscreen"
      />
    </div>
  );
}
