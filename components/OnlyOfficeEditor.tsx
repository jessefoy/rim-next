"use client";

import { useEffect, useRef, useState } from "react";

type DocEditorInstance = { destroyEditor: () => void };

declare global {
  interface Window {
    DocsAPI?: {
      DocEditor: new (id: string, config: unknown) => DocEditorInstance;
    };
  }
}

interface EditorConfigResponse {
  config: Record<string, unknown>;
  apiJsUrl: string;
  documentServerUrl: string;
}

/**
 * Mounts the OnlyOffice editor for a document. Fetches the JWT-signed config
 * from RIM (which re-checks access), loads the document server's api.js, then
 * hands the config to DocsAPI.DocEditor. `events` are attached client-side —
 * they're functions, never part of the signed token.
 */
export default function OnlyOfficeEditor({ documentId }: { documentId: string }) {
  const editorRef = useRef<DocEditorInstance | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    function loadScript(src: string): Promise<void> {
      return new Promise((resolve, reject) => {
        if (window.DocsAPI) return resolve();
        const existing = document.querySelector<HTMLScriptElement>("script[data-onlyoffice]");
        if (existing) {
          existing.addEventListener("load", () => resolve());
          existing.addEventListener("error", () => reject(new Error("Could not load the editor script")));
          return;
        }
        const el = document.createElement("script");
        el.src = src;
        el.async = true;
        el.dataset.onlyoffice = "true";
        el.onload = () => resolve();
        el.onerror = () => reject(new Error("Could not load the editor script"));
        document.body.appendChild(el);
      });
    }

    async function init() {
      try {
        const res = await fetch(`/api/documents/${documentId}/editor-config`);
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(body.error || `Editor unavailable (${res.status})`);
        }
        const data = (await res.json()) as EditorConfigResponse;
        if (cancelled) return;

        await loadScript(data.apiJsUrl);
        if (cancelled || !window.DocsAPI) return;

        const config = {
          ...data.config,
          width: "100%",
          height: "100%",
          events: {
            onDocumentReady: () => {
              if (!cancelled) setLoading(false);
            },
            onRequestClose: () => window.history.back(),
            onError: (e: unknown) => console.error("[onlyoffice] editor error", e),
          },
        };
        editorRef.current = new window.DocsAPI.DocEditor("onlyoffice-editor", config);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to open the document");
          setLoading(false);
        }
      }
    }

    init();

    return () => {
      cancelled = true;
      try {
        editorRef.current?.destroyEditor();
      } catch {
        /* editor may not have initialized */
      }
      editorRef.current = null;
    };
  }, [documentId]);

  return (
    <div className="oo-editor-shell">
      {error ? (
        <div className="oo-editor-error">
          <p>Couldn&apos;t open this document.</p>
          <p className="oo-editor-error-detail">{error}</p>
          <button type="button" className="oo-editor-back" onClick={() => window.history.back()}>
            ← Go back
          </button>
        </div>
      ) : (
        <>
          {loading && <div className="oo-editor-loading">Opening editor…</div>}
          <div id="onlyoffice-editor" className="oo-editor-mount" />
        </>
      )}
    </div>
  );
}
