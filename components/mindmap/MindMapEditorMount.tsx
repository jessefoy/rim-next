"use client";

/**
 * Client mount for the React Flow editor — dynamic-imported with ssr:false so
 * the canvas only initializes in the browser (the heavy-client-component
 * pattern used across the app). The server page does the access gate + data
 * load and passes serialized props through.
 */

import dynamic from "next/dynamic";
import type { SerializedNode } from "./MindMapEditor";

const MindMapEditor = dynamic(() => import("./MindMapEditor"), {
  ssr: false,
  loading: () => <div className="mm-loading">Loading the canvas…</div>,
});

interface Props {
  mapId: string;
  initialTitle: string;
  initialDescription: string | null;
  canEdit: boolean;
  currentUserId: string;
  initialNodes: SerializedNode[];
}

export default function MindMapEditorMount(props: Props) {
  return <MindMapEditor {...props} />;
}
