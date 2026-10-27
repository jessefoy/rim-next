import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { listGuideTopics, publicPageWords, readGuideTopic, searchGuide } from "@/lib/guideContent";

/**
 * The RIM Guide connector (2026-10-27): a read-only remote MCP server that a
 * shared Claude project in RIM's workspace uses for everything it knows. It
 * serves the topic files in volunteer-guide/ and the public pages' words, read
 * live (lib/guideContent.ts), so the guide is current with every deploy and
 * nothing is uploaded by hand.
 *
 * Added once by a workspace owner (Organization settings > Connectors > Add >
 * Custom > Web) at https://<site>/api/guide-mcp/<GUIDE_CONNECTOR_KEY>; each
 * volunteer presses Connect once. The key keeps the address to RIM's
 * workspace; nothing served is private, and nothing here writes anything.
 *
 * Streamable HTTP, stateless: each POST carries JSON-RPC and gets JSON back;
 * there is no event stream (GET is 405) and no session.
 */

const PROTOCOL_VERSIONS = ["2025-11-25", "2025-06-18", "2025-03-26", "2024-11-05"];

const BASE_URL = (process.env.NEXTAUTH_URL ?? "https://rim-next.vercel.app").trim().replace(/\/$/, "");

const READ_ONLY = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false };

const TOOLS = [
  {
    name: "guide_topics",
    title: "List the guide's topics",
    description: "Lists the RIM Guide's topics (how the site works and why, the site map, Programs and Registration, teams and the Scheduler, the tutorials, how RIM writes), each with the name to read it by.",
    inputSchema: { type: "object", properties: {} },
    annotations: READ_ONLY,
  },
  {
    name: "search_guide",
    title: "Search the guide",
    description: "Finds the guide's sections that best match a few words, such as \"waiting list email\" or \"why can't members cancel\". Use it first for most questions.",
    inputSchema: {
      type: "object",
      properties: { query: { type: "string", description: "A few words about what to find." } },
      required: ["query"],
    },
    annotations: READ_ONLY,
  },
  {
    name: "read_guide",
    title: "Read a guide topic",
    description: "Reads one topic of the guide in full, or only the section whose heading contains the given words. Use the topic names from guide_topics.",
    inputSchema: {
      type: "object",
      properties: {
        topic: { type: "string", description: "The topic's name, such as \"programs-and-registration\" or \"site-map\"." },
        section: { type: "string", description: "Optional: words from a section heading, to read only that section." },
      },
      required: ["topic"],
    },
    annotations: READ_ONLY,
  },
  {
    name: "page_words",
    title: "Read a public page's words",
    description: "Reads the words on one public page of RIM's site right now, such as /new-to-rim or /programs/qigong-at-rim. Use it to quote a page's current words exactly. Pages behind sign-in can't be read.",
    inputSchema: {
      type: "object",
      properties: { path: { type: "string", description: "The page's address after the site name, such as /about." } },
      required: ["path"],
    },
    annotations: { ...READ_ONLY, openWorldHint: true },
  },
];

type RpcMessage = { jsonrpc?: string; id?: string | number | null; method?: string; params?: Record<string, unknown> };

function keyMatches(given: string): boolean {
  const expected = process.env.GUIDE_CONNECTOR_KEY?.trim();
  if (!expected || expected.length < 24) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

const text = (t: string, isError = false) => ({ content: [{ type: "text", text: t }], ...(isError ? { isError: true } : {}) });
const str = (v: unknown) => (typeof v === "string" ? v : "");

async function callTool(name: string, args: Record<string, unknown>) {
  switch (name) {
    case "guide_topics": {
      const topics = await listGuideTopics();
      return text(topics.map((t) => `- ${t.slug}: ${t.title}`).join("\n"));
    }
    case "search_guide":
      return text(await searchGuide(str(args.query)));
    case "read_guide": {
      const found = await readGuideTopic(str(args.topic), str(args.section) || undefined);
      if (found) return text(found);
      const topics = (await listGuideTopics()).map((t) => t.slug).join(", ");
      return text(args.section ? `No section in "${str(args.topic)}" has "${str(args.section)}" in its heading. Read the whole topic, or search.` : `There's no topic "${str(args.topic)}". The topics are: ${topics}.`, true);
    }
    case "page_words":
      return text(await publicPageWords(BASE_URL, str(args.path)));
    default:
      return null;
  }
}

async function answer(msg: RpcMessage): Promise<object | null> {
  if (!msg || typeof msg !== "object") {
    return { jsonrpc: "2.0", id: null, error: { code: -32600, message: "Invalid Request" } };
  }
  // A notification (no id) gets no reply.
  if (msg.id === undefined || msg.id === null) return null;
  const reply = (result: object) => ({ jsonrpc: "2.0", id: msg.id, result });
  const fail = (code: number, message: string) => ({ jsonrpc: "2.0", id: msg.id, error: { code, message } });

  switch (msg.method) {
    case "initialize": {
      const asked = str(msg.params?.protocolVersion);
      return reply({
        protocolVersion: PROTOCOL_VERSIONS.includes(asked) ? asked : PROTOCOL_VERSIONS[0],
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: "rim-guide", title: "RIM Guide", version: "1.0.0" },
        instructions: "How Rooted in Mindfulness's website and apps work and why, for RIM's volunteers. Search or read the guide before answering; read a public page's words to quote them exactly. Read-only.",
      });
    }
    case "ping":
      return reply({});
    case "tools/list":
      return reply({ tools: TOOLS });
    case "tools/call": {
      const name = str(msg.params?.name);
      const args = (msg.params?.arguments ?? {}) as Record<string, unknown>;
      try {
        const result = await callTool(name, args);
        return result ? reply(result) : fail(-32602, `Unknown tool: ${name}`);
      } catch (err) {
        console.error(`[guide-mcp] ${name} failed`, err);
        return reply(text("That didn't work just now. Try again in a moment.", true));
      }
    }
    default:
      return fail(-32601, `Method not found: ${str(msg.method)}`);
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  if (!keyMatches(key)) return new NextResponse("Not found", { status: 404 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } }, { status: 400 });
  }

  const batch = Array.isArray(body);
  const messages: unknown[] = batch ? (body as unknown[]) : [body];
  if (!messages.length) {
    return NextResponse.json({ jsonrpc: "2.0", id: null, error: { code: -32600, message: "Invalid Request" } }, { status: 400 });
  }
  const replies = (await Promise.all(messages.map((m) => answer(m as RpcMessage)))).filter(Boolean);
  // Only notifications: accepted, nothing to say.
  if (!replies.length) return new NextResponse(null, { status: 202 });
  return NextResponse.json(batch ? replies : replies[0], { headers: { "Cache-Control": "no-store" } });
}

export async function GET() {
  return new NextResponse("Method not allowed", { status: 405, headers: { Allow: "POST" } });
}

export async function DELETE() {
  return new NextResponse("Method not allowed", { status: 405, headers: { Allow: "POST" } });
}
