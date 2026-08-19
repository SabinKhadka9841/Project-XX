"use client";

import { useEffect, useRef, useState } from "react";

declare global {
  interface Window {
    DocsAPI?: {
      DocEditor: (containerId: string, config: object) => void;
    };
  }
}

export function OnlyOfficeEditor({
  documentServerUrl,
  config,
  filename,
}: {
  documentServerUrl: string;
  config: object;
  filename: string;
}) {
  const loaded = useRef(false);
  const [status, setStatus] = useState<"loading" | "ready" | "error">(
    "loading",
  );
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (loaded.current) return;
    loaded.current = true;

    const script = document.createElement("script");
    script.src = `${documentServerUrl}/web-apps/apps/api/documents/api.js`;

    script.onerror = () => {
      setStatus("error");
      setErrorMessage(
        "Couldn't reach the document server. Is its Docker container running?",
      );
    };

    script.onload = () => {
      // Attached here rather than on the server because these are
      // functions, which can't be sent from a server component.
      window.DocsAPI?.DocEditor("onlyoffice-container", {
        ...config,
        events: {
          onDocumentReady: () => setStatus("ready"),
          onError: (event: { data?: { errorDescription?: string } }) => {
            setStatus("error");
            setErrorMessage(
              event?.data?.errorDescription ?? "The editor reported an error.",
            );
          },
        },
      });
    };

    document.body.appendChild(script);
  }, [documentServerUrl, config]);

  return (
    <div className="relative h-[85vh] w-full">
      {status !== "ready" && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-bg px-4 text-center">
          {status === "loading" ? (
            <>
              <p className="text-sm font-medium">Opening {filename}…</p>
              <p className="text-sm text-text-muted">
                Large documents can take a few seconds to appear.
              </p>
            </>
          ) : (
            <>
              <p className="text-sm font-medium">Couldn&apos;t open this file</p>
              <p className="text-sm text-text-muted">{errorMessage}</p>
            </>
          )}
        </div>
      )}
      <div id="onlyoffice-container" className="h-full w-full" />
    </div>
  );
}
