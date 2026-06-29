"use client";

/**
 * Mind-map proof-of-concept (Slice 0 — throwaway).
 *
 * A self-contained React Flow canvas with hardcoded sample nodes — NO database,
 * NO placement, NO real conversations. Its only purpose is to let Jesse feel the
 * interaction and judge whether a spatial mind-map fits the Sangha + the RIM
 * aesthetic before any schema is committed. See RIM target architecture in the
 * approved plan. Delete this file + the mm- CSS block + the dep to fully revert.
 */

import { useCallback, useMemo, useState } from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  Handle,
  Position,
  useNodesState,
  useEdgesState,
  reconnectEdge,
  type Node,
  type Edge,
  type Connection,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

// ---- Sample content: a realistic Sangha brainstorm, not lorem ipsum ----------

type NodeKind = "root" | "branch" | "leaf";

type FakeReply = { author: string; when: string; body: string };

type MMNodeData = {
  label: string;
  kind: NodeKind;
  thread?: FakeReply[]; // a couple of nodes carry a stubbed conversation
};

const SAMPLE_NODES: Node<MMNodeData>[] = [
  { id: "root", position: { x: 40, y: 300 }, data: { label: "Spring Retreat 2026", kind: "root" }, type: "mm" },

  { id: "venue", position: { x: 340, y: 60 }, data: { label: "Venue & logistics", kind: "branch" }, type: "mm" },
  { id: "teachers", position: { x: 340, y: 180 }, data: { label: "Teachers & dharma", kind: "branch" }, type: "mm" },
  { id: "registration", position: { x: 340, y: 300 }, data: { label: "Registration & dana", kind: "branch" }, type: "mm" },
  { id: "volunteers", position: { x: 340, y: 420 }, data: { label: "Volunteers & hosting", kind: "branch" }, type: "mm" },
  { id: "comms", position: { x: 340, y: 540 }, data: { label: "Communications", kind: "branch" }, type: "mm" },

  {
    id: "venue-checklist",
    position: { x: 660, y: 10 },
    data: {
      label: "Site visit checklist",
      kind: "leaf",
      thread: [
        { author: "LoriLee", when: "2 days ago", body: "I can drive up Thursday to walk the meditation hall and the kitchen. Who wants to come?" },
        { author: "Nancy", when: "1 day ago", body: "I'll join — let's also check the quiet-room for anyone needing a rest space." },
      ],
    },
    type: "mm",
  },
  {
    id: "venue-access",
    position: { x: 660, y: 110 },
    data: {
      label: "Accessibility",
      kind: "leaf",
      thread: [
        { author: "Jesse", when: "3 days ago", body: "We need to confirm step-free access to the hall and at least one accessible bathroom before we open registration." },
      ],
    },
    type: "mm",
  },

  { id: "vol-rota", position: { x: 660, y: 380 }, data: { label: "Host rota", kind: "leaf" }, type: "mm" },
  { id: "vol-greeter", position: { x: 660, y: 480 }, data: { label: "Greeter onboarding", kind: "leaf" }, type: "mm" },
];

const SAMPLE_EDGES: Edge[] = [
  { id: "e-root-venue", source: "root", target: "venue" },
  { id: "e-root-teachers", source: "root", target: "teachers" },
  { id: "e-root-registration", source: "root", target: "registration" },
  { id: "e-root-volunteers", source: "root", target: "volunteers" },
  { id: "e-root-comms", source: "root", target: "comms" },
  { id: "e-venue-checklist", source: "venue", target: "venue-checklist" },
  { id: "e-venue-access", source: "venue", target: "venue-access" },
  { id: "e-vol-rota", source: "volunteers", target: "vol-rota" },
  { id: "e-vol-greeter", source: "volunteers", target: "vol-greeter" },
].map((e) => ({ ...e, type: "smoothstep" }));

// ---- Custom node (left target handle, right source handle = a tidy L→R tree) --

function MindMapNode({ data, selected }: NodeProps<Node<MMNodeData>>) {
  return (
    <div className={`mm-node mm-node--${data.kind}${selected ? " is-selected" : ""}`}>
      <Handle type="target" position={Position.Left} className="mm-handle" />
      <span className="mm-node__label">{data.label}</span>
      {data.thread && data.thread.length > 0 && (
        <span className="mm-node__convo" title="Has a conversation" aria-label="Has a conversation">
          {data.thread.length}
        </span>
      )}
      <Handle type="source" position={Position.Right} className="mm-handle" />
    </div>
  );
}

const nodeTypes = { mm: MindMapNode };

// ---- Canvas -------------------------------------------------------------------

function Canvas() {
  const [nodes, , onNodesChange] = useNodesState<Node<MMNodeData>>(SAMPLE_NODES);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(SAMPLE_EDGES);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Reparent gesture (v0): drag a branch's connection endpoint to a new parent.
  const onReconnect = useCallback(
    (oldEdge: Edge, newConnection: Connection) =>
      setEdges((els) => reconnectEdge(oldEdge, newConnection, els)),
    [setEdges],
  );

  const onNodeClick = useCallback((_: unknown, node: Node) => setSelectedId(node.id), []);

  const selected = useMemo(
    () => nodes.find((n) => n.id === selectedId) ?? null,
    [nodes, selectedId],
  );

  return (
    <div className="mm-stage">
      <div className="mm-canvas">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onReconnect={onReconnect}
          onNodeClick={onNodeClick}
          onPaneClick={() => setSelectedId(null)}
          nodeTypes={nodeTypes}
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
        <aside className="mm-panel" aria-label={`Conversation: ${selected.data.label}`}>
          <header className="mm-panel__head">
            <span className="mm-panel__eyebrow">Topic</span>
            <h2 className="mm-panel__title">{selected.data.label}</h2>
            <button className="mm-panel__close" onClick={() => setSelectedId(null)} aria-label="Close">
              ×
            </button>
          </header>

          <div className="mm-panel__body">
            {selected.data.thread && selected.data.thread.length > 0 ? (
              <ul className="mm-thread">
                {selected.data.thread.map((r, i) => (
                  <li key={i} className="mm-thread__item">
                    <div className="mm-thread__meta">
                      <span className="mm-thread__author">{r.author}</span>
                      <span className="mm-thread__when">{r.when}</span>
                    </div>
                    <p className="mm-thread__text">{r.body}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mm-thread__empty">No conversation yet. This is where the topic’s discussion would live.</p>
            )}

            <div className="mm-compose" aria-hidden="true">
              <div className="mm-compose__box">Add to the conversation…</div>
              <button className="mm-compose__send" disabled>
                Reply
              </button>
            </div>
            <p className="mm-panel__note">
              Preview only — conversations aren’t wired up yet. In the real build, each topic opens a full RIM
              conversation (replies, follows, reactions, notifications).
            </p>
          </div>
        </aside>
      )}
    </div>
  );
}

export default function MindMapCanvasPoc() {
  return (
    <ReactFlowProvider>
      <Canvas />
    </ReactFlowProvider>
  );
}
