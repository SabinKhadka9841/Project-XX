"use client";

import { useEffect, useRef } from "react";

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
}: {
  documentServerUrl: string;
  config: object;
}) {
  const loaded = useRef(false);

  useEffect(() => {
    if (loaded.current) return;
    loaded.current = true;

    const script = document.createElement("script");
    script.src = `${documentServerUrl}/web-apps/apps/api/documents/api.js`;
    script.onload = () => {
      window.DocsAPI?.DocEditor("onlyoffice-container", config);
    };
    document.body.appendChild(script);
  }, [documentServerUrl, config]);

  return <div id="onlyoffice-container" className="h-[85vh] w-full" />;
}
