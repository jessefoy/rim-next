"use client";

/**
 * MindMapEditor — the real, persistent mind-map canvas (Slice 1).
 *
 * Topics are React Flow nodes; branches are derived from each node's parentId
 * (no edge table — "reconnect a line" = change parentId). Floating edges keep
 * connections tidy as nodes move. Edits autosave (debounced) via
 * PATCH /api/mindmaps/[id] as a node snapshot; the client owns stable node ids
 * so Slice 3 can anchor a conversation to a node. Conversations themselves are
 * a later slice — the side panel shows where they'll live.
 *
 * Saving is edit-driven (not selection-driven): every real mutation calls
 * scheduleSave(); saves are serialized (no out-of-order overwrite) and flushed
 * on unmount with keepalive so a quick edit-then-leave isn't lost.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  Handle,
  Position,
  useNodesState,
  useReactFlow,
  type Node,
  type Edge,
  type Connection,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import FloatingEdge from "./FloatingEdge";

type MMNodeData = {
  label: string;
  note: string | null;
  parentId: string | null;
};
type MMNode = Node<MMNodeData>;

export interface SerializedNode {
  id: string;
  label: string;
  note: string | null;
  x: number;
  y: number;
  parentId: string | null;
}

interface Props {
  mapId: string;
  initialTitle: string;
  initialDescription: string | null;
  canEdit: boolean;
  initialNodes: SerializedNode[];
}

// ── Custom topic node (Left target + Right source handles; floating render) ──
function TopicNode({ data, selected }: NodeProps<MMNode>) {
  return (
    <div className={`mm-node mm-node--branch${selected ? " is-selected" : ""}`}>
      <Handle type="target" position={Position.Left} className="mm-handle" />
      <span className="mm-node__label">{data.label || "Untitled topic"}</span>
      {data.note && <span className="mm-node__dot" title="Has a note" aria-hidden="true" />}
      <Handle type="source" position={Position.Right} className="mm-handle" />
    </div>
  );
}

const nodeTypes = { mm: TopicNode };
const edgeTypes = { floating: FloatingEdge };
const defaultEdgeOptions = { type: "floating" } as const;

function toFlowNodes(seed: SerializedNode[]): MMNode[] {
  return seed.map((n) => ({
    id: n.id,
    type: "mm",
    position: { x: n.x, y: n.y },
    data: { label: n.label, note: n.note, parentId: n.parentId },
  }));
}

function Editor({ mapId, initialTitle, canEdit, initialNodes }: Props) {
  const [nodes, setNodes, onNodesChange] = useNodesState<MMNode>(toFlowNodes(initialNodes));
  const [title, setTitle] = useState(initialTitle);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");
  const { screenToFlowPosition, fitView } = useReactFlow();

  const nodesRef = useRef(nodes);
  nodesRef.current = nodes;
  const titleRef = useRef(title);
  titleRef.current = title;

  // Edges are a pure derivation of parentId (filtered to parents that exist).
  const edges: Edge[] = useMemo(() => {
    const ids = new Set(nodes.map((n) => n.id));
    return nodes
      .filter((n) => n.data.parentId && ids.has(n.data.parentId))
      .map((n) => ({ id: `e-${n.data.parentId}-${n.id}`, source: n.data.parentId as string, target: n.id, type: "floating" }));
  }, [nodes]);

  const selected = useMemo(() => nodes.find((n) => n.id === selectedId) ?? null, [nodes, selectedId]);

  // ── Autosave: edit-driven, serialized, flush-on-unmount ──
  const dirtyRef = useRef(false);
  const savingRef = useRef(false);
  const pendingRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const buildPayload = useCallback(
    () => ({
      title: titleRef.current,
      nodes: nodesRef.current.map((n) => ({
        id: n.id,
        label: n.data.label,
        note: n.data.note,
        x: n.position.x,
        y: n.position.y,
        parentId: n.data.parentId,
      })),
    }),
    [],
  );

  const runSave = useCallback(async () => {
    if (savingRef.current) { pendingRef.current = true; return; } // serialize — no out-of-order writes
    savingRef.current = true;
    setSaveState("saving");
    try {
      const res = await fetch(`/api/mindmaps/${mapId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildPayload()),
      });
      if (!res.ok) throw new Error();
      dirtyRef.current = false;
      setSaveState("saved");
    } catch {
      setSaveState("idle");
    } finally {
      savingRef.current = false;
      if (pendingRef.current) { pendingRef.current = false; void runSave(); }
    }
  }, [mapId, buildPayload]);

  const scheduleSave = useCallback(() => {
    if (!canEdit) return;
    dirtyRef.current = true;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => void runSave(), 800);
  }, [canEdit, runSave]);

  // Flush a pending edit on unmount — client-side back-nav keeps the JS context
  // alive (the fetch completes); keepalive covers a hard tab close too.
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (dirtyRef.current && canEdit) {
        fetch(`/api/mindmaps/${mapId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(buildPayload()),
          keepalive: true,
        }).catch(() => {});
      }
    };
  }, [mapId, canEdit, buildPayload]);

  // Only meaningful structural changes save — selection/measure changes don't.
  const onNodesChangeHandler = useCallback(
    (changes: Parameters<typeof onNodesChange>[0]) => {
      onNodesChange(changes);
      if (changes.some((c) => c.type === "position" || c.type === "remove" || c.type === "add" || c.type === "replace")) {
        scheduleSave();
      }
    },
    [onNodesChange, scheduleSave],
  );

  // ── Parent / reparent helpers (with cycle guard) ──
  const isDescendant = useCallback((ancestorId: string, maybeDescId: string) => {
    const list = nodesRef.current;
    const seen = new Set<string>();
    let cur = list.find((n) => n.id === maybeDescId);
    while (cur?.data.parentId) {
      if (seen.has(cur.id)) break;
      seen.add(cur.id);
      if (cur.data.parentId === ancestorId) return true;
      cur = list.find((n) => n.id === cur!.data.parentId);
    }
    return false;
  }, []);

  const setParent = useCallback(
    (childId: string, parentId: string | null) => {
      if (childId === parentId) return;
      if (parentId && isDescendant(childId, parentId)) return; // no cycles
      setNodes((ns) => ns.map((n) => (n.id === childId ? { ...n, data: { ...n.data, parentId } } : n)));
      scheduleSave();
    },
    [isDescendant, setNodes, scheduleSave],
  );

  const onConnect = useCallback(
    (c: Connection) => { if (c.source && c.target) setParent(c.target, c.source); },
    [setParent],
  );

  const onReconnect = useCallback(
    (oldEdge: Edge, c: Connection) => {
      if (!c.source || !c.target) return;
      if (c.target === oldEdge.target) {
        setParent(oldEdge.target, c.source); // same child, new parent
      } else {
        setParent(oldEdge.target, null); // detach old child
        setParent(c.target, c.source);
      }
    },
    [setParent],
  );

  // ── Node CRUD ──
  const addTopic = useCallback(() => {
    const id = crypto.randomUUID();
    const parent = selectedId ? nodesRef.current.find((n) => n.id === selectedId) : null;
    const anchor = parent ?? nodesRef.current[0];
    const pos = anchor ? { x: anchor.position.x + 240, y: anchor.position.y + (Math.random() * 120 - 60) } : { x: 0, y: 0 };
    setNodes((ns) => [...ns, { id, type: "mm", position: pos, data: { label: "New topic", note: null, parentId: parent ? parent.id : null } }]);
    setSelectedId(id);
    scheduleSave();
  }, [selectedId, setNodes, scheduleSave]);

  const onPaneDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      if (!canEdit) return;
      const pos = screenToFlowPosition({ x: e.clientX, y: e.clientY });
      const id = crypto.randomUUID();
      setNodes((ns) => [...ns, { id, type: "mm", position: pos, data: { label: "New topic", note: null, parentId: null } }]);
      setSelectedId(id);
      scheduleSave();
    },
    [canEdit, screenToFlowPosition, setNodes, scheduleSave],
  );

  const deleteSelected = useCallback(() => {
    if (!selectedId) return;
    if (!window.confirm("Delete this topic? Anything hanging off it becomes free-floating.")) return;
    const delId = selectedId;
    setNodes((ns) =>
      ns.filter((n) => n.id !== delId).map((n) => (n.data.parentId === delId ? { ...n, data: { ...n.data, parentId: null } } : n)),
    );
    setSelectedId(null);
    scheduleSave();
  }, [selectedId, setNodes, scheduleSave]);

  const updateSelected = useCallback(
    (patch: Partial<MMNodeData>) => {
      if (!selectedId) return;
      setNodes((ns) => ns.map((n) => (n.id === selectedId ? { ...n, data: { ...n.data, ...patch } } : n)));
      scheduleSave();
    },
    [selectedId, setNodes, scheduleSave],
  );

  const onTitleChange = useCallback(
    (value: string) => { setTitle(value); scheduleSave(); },
    [scheduleSave],
  );

  // ── "Tidy up" — simple left→right tree layout, then fit ──
  const tidy = useCallback(() => {
    const list = nodesRef.current;
    const ids = new Set(list.map((n) => n.id));
    const childrenOf = new Map<string | null, string[]>();
    for (const n of list) {
      const p = n.data.parentId && ids.has(n.data.parentId) ? n.data.parentId : null;
      if (!childrenOf.has(p)) childrenOf.set(p, []);
      childrenOf.get(p)!.push(n.id);
    }
    const H = 260;
    const V = 96;
    const pos = new Map<string, { x: number; y: number }>();
    const placed = new Set<string>();
    let row = 0;
    const place = (id: string, depth: number): number => {
      if (placed.has(id)) return pos.get(id)?.y ?? 0; // cycle guard
      placed.add(id);
      const kids = childrenOf.get(id) ?? [];
      if (kids.length === 0) {
        const y = row * V;
        row++;
        pos.set(id, { x: depth * H, y });
        return y;
      }
      const ys = kids.map((k) => place(k, depth + 1));
      const y = (ys[0] + ys[ys.length - 1]) / 2;
      pos.set(id, { x: depth * H, y });
      return y;
    };
    for (const r of childrenOf.get(null) ?? []) place(r, 0);
    setNodes((ns) => ns.map((n) => (pos.has(n.id) ? { ...n, position: pos.get(n.id)! } : n)));
    scheduleSave();
    setTimeout(() => fitView({ padding: 0.2, duration: 400 }), 60);
  }, [fitView, setNodes, scheduleSave]);

  return (
    <div className="mm-page">
      <header className="mm-toolbar">
        <Link href="/account/mindmaps" className="mm-toolbar__back">← Mind Maps</Link>
        <input
          className="mm-toolbar__title"
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
          disabled={!canEdit}
          aria-label="Map title"
          placeholder="Untitled mind map"
        />
        <span className="mm-toolbar__save" aria-live="polite">
          {saveState === "saving" ? "Saving…" : saveState === "saved" ? "Saved" : ""}
        </span>
        {canEdit && (
          <div className="mm-toolbar__actions">
            <button className="mm-btn" onClick={addTopic}>+ Add topic</button>
            <button className="mm-btn mm-btn--ghost" onClick={tidy}>Tidy up</button>
          </div>
        )}
      </header>

      <div className="mm-stage">
        <div className="mm-canvas">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChangeHandler}
            onConnect={onConnect}
            onReconnect={onReconnect}
            onNodeClick={(_, n) => setSelectedId(n.id)}
            onPaneClick={() => setSelectedId(null)}
            onDoubleClick={onPaneDoubleClick}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            defaultEdgeOptions={defaultEdgeOptions}
            nodesDraggable={canEdit}
            nodesConnectable={canEdit}
            deleteKeyCode={null}
            fitView
            fitViewOptions={{ padding: 0.2 }}
            proOptions={{ hideAttribution: true }}
            minZoom={0.3}
            maxZoom={1.75}
          >
            <Background gap={28} size={1} color="var(--rim-bg-accent)" />
            <Controls showInteractive={false} />
          </ReactFlow>
        </div>

        {selected && (
          <aside className="mm-panel" aria-label={`Topic: ${selected.data.label}`}>
            <header className="mm-panel__head">
              <span className="mm-panel__eyebrow">Topic</span>
              <input
                className="mm-panel__titleinput"
                value={selected.data.label}
                onChange={(e) => updateSelected({ label: e.target.value })}
                disabled={!canEdit}
                aria-label="Topic title"
                placeholder="Untitled topic"
              />
              <button className="mm-panel__close" onClick={() => setSelectedId(null)} aria-label="Close">×</button>
            </header>

            <div className="mm-panel__body">
              <label className="mm-field">
                <span className="mm-field__label">Note <span className="mm-field__hint">(optional)</span></span>
                <textarea
                  className="mm-field__textarea"
                  value={selected.data.note ?? ""}
                  onChange={(e) => updateSelected({ note: e.target.value || null })}
                  disabled={!canEdit}
                  rows={4}
                  placeholder="A sentence or two of context for this topic…"
                />
              </label>

              <div className="mm-panel__convo">
                <span className="mm-panel__convo-title">Conversation</span>
                <p className="mm-panel__note">
                  Conversations on a topic arrive in a later step — each topic will open a full discussion
                  here (replies, follows, reactions).
                </p>
              </div>

              {canEdit && (
                <button className="mm-btn mm-btn--danger" onClick={deleteSelected}>Delete topic</button>
              )}
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}

export default function MindMapEditor(props: Props) {
  return (
    <ReactFlowProvider>
      <Editor {...props} />
    </ReactFlowProvider>
  );
}
