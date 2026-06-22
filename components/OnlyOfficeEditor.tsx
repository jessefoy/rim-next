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

// If the editor never fires onDocumentReady within this window, reveal the
// editor surface anyway so OnlyOffice's own error (e.g. "The document security
// token is not correctly formed") stops hiding behind our loading overlay. A
// cold document server can take ~15s on first open, so keep this comfortably
// above that — the banner is non-blocking and auto-clears if the doc loads late.
const READY_TIMEOUT_MS = 25000;

/**
 * Mounts the OnlyOffice editor for a document. Fetches the JWT-signed config
 * from RIM (which re-checks access), loads the document server's api.js, then
 * hands the config to DocsAPI.DocEditor. `events` are attached client-side —
 * they're functions, never part of the signed token.
 *
 * Three failure surfaces, deliberately distinct:
 *  - `error`  — RIM-side: editor-config fetch or api.js load failed. Full card.
 *  - `stalled` — document-server-side: OnlyOffice fired onError, or never became
 *    ready within READY_TIMEOUT_MS. We reveal the editor surface + a banner so
 *    the server's real message is visible (the loading overlay used to mask it).
 */
export default function OnlyOfficeEditor({ documentId }: { documentId: string }) {
  const editorRef = useRef<DocEditorInstance | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [stalled, setStalled] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let readyTimer: ReturnType<typeof setTimeout> | null = null;

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
              if (cancelled) return;
              if (readyTimer) {
                clearTimeout(readyTimer);
                readyTimer = null;
              }
              setStalled(null);
              setLoading(false);
            },
            onRequestClose: () => window.history.back(),
            onError: (e: unknown) => {
              console.error("[onlyoffice] editor error", e);
              if (cancelled) return;
              const code = (e as { data?: unknown })?.data;
              setLoading(false);
              setStalled(
                `The document server returned an error${code != null ? ` (code ${String(code)})` : ""}. ` +
                  "If the message on the page mentions a security token, the server's key is out of sync with the app.",
              );
            },
          },
        };
        editorRef.current = new window.DocsAPI.DocEditor("onlyoffice-editor", config);

        readyTimer = setTimeout(() => {
          if (cancelled) return;
          setLoading(false);
          setStalled((prev) =>
            prev ??
            "The editor didn't finish loading. If the page shows a security-token message, the document server's key needs re-syncing with the app.",
          );
        }, READY_TIMEOUT_MS);
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
      if (readyTimer) clearTimeout(readyTimer);
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
          {stalled && (
            <div className="oo-editor-stalled" role="alert">
              <p>{stalled}</p>
              <button type="button" className="oo-editor-back" onClick={() => window.history.back()}>
                ← Go back
              </button>
            </div>
          )}
          <div id="onlyoffice-editor" className="oo-editor-mount" />
        </>
      )}
    </div>
  );
}
