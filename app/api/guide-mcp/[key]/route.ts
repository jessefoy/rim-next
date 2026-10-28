import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { readAccess, SITE_ORIGIN } from "@/lib/guideAuth";
import { keyMatches } from "@/lib/guideConnector";
import {
  listGuideTopics,
  publicPageWords,
  readDesignDoc,
  readGuideTopic,
  screenCode,
  screenWords,
  searchGuide,
  DESIGN_DOCS,
} from "@/lib/guideContent";
import {
  emailTemplates,
  findMembers,
  listPrograms,
  memberRecord,
  myTeams,
  programPeople,
  programSettings,
  teamConversations,
  teamMembers,
  teamSchedule,
  viewerCan,
  type GuideViewer,
} from "@/lib/guideData";

/**
 * The RIM Guide connector (2026-10-27): a read-only remote MCP server that the
 * volunteers' shared Claude project uses for everything it knows. Each person
 * signs in with their own RIM account (lib/guideAuth.ts) and the guide reads
 * what they can read on the site: the guide's topics, the design docs, every
 * signed-in screen's words and code (lib/guideContent.ts), and RIM's data
 * through the site's own gates (lib/guideData.ts). Nothing here writes.
 *
 * Added once by a workspace owner (Organization settings > Connectors > Add >
 * Custom > Web) at https://<site>/api/guide-mcp/<GUIDE_CONNECTOR_KEY>; each
 * volunteer presses Connect and signs in once. Without a current sign-in it
 * answers 401 with where to sign in (RFC 9728), which is how Claude starts it.
 *
 * Streamable HTTP, stateless: each POST carries JSON-RPC and gets JSON back;
 * there is no event stream (GET is 405) and no session.
 */

const PROTOCOL_VERSIONS = ["2025-11-25", "2025-06-18", "2025-03-26", "2024-11-05"];

const READ_ONLY = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false };
const obj = (properties: Record<string, unknown>, required: string[] = []) => ({ type: "object", properties, required });
const s = (description: string) => ({ type: "string", description });

type Tool = { name: string; title: string; description: string; inputSchema: object; annotations: object };

/** Tools everyone signed in may use. */
const OPEN_TOOLS: Tool[] = [
  {
    name: "guide_topics",
    title: "List the guide's topics",
    description: "Lists the RIM Guide's topics (how the site works and why, the site map, Programs and Registration, teams and the Scheduler, the tutorials, how RIM writes), each with the name to read it by.",
    inputSchema: obj({}),
    annotations: READ_ONLY,
  },
  {
    name: "search_guide",
    title: "Search the guide and design docs",
    description: "Finds the sections of the guide's topics and the design docs that best match a few words, such as \"waiting list email\" or \"why can't members cancel\". Use it first for most questions.",
    inputSchema: obj({ query: s("A few words about what to find."), within: { type: "string", enum: ["both", "guide", "docs"], description: "Search the guide's topics, the design docs, or both (the default)." } }, ["query"]),
    annotations: READ_ONLY,
  },
  {
    name: "read_guide",
    title: "Read a guide topic",
    description: "Reads one topic of the guide in full, or only the section whose heading contains the given words. Use the topic names from guide_topics.",
    inputSchema: obj({ topic: s("The topic's name, such as \"programs-and-registration\" or \"site-map\"."), section: s("Optional: words from a section heading, to read only that section.") }, ["topic"]),
    annotations: READ_ONLY,
  },
  {
    name: "read_design_doc",
    title: "Read a design doc",
    description: `Reads one of RIM's design docs, which say why each part of the site is built the way it is. Without a section it gives the doc's opening and its headings; with words from a heading it gives that section. The docs: ${DESIGN_DOCS.join(", ")}.`,
    inputSchema: obj({ doc: s("The doc's name, such as \"RIM_ProgramEditor\" or \"web design philosophy\"."), section: s("Optional: words from a section heading.") }, ["doc"]),
    annotations: READ_ONLY,
  },
  {
    name: "screen_words",
    title: "Read a screen's words",
    description: "The exact words on a signed-in screen (labels, hints under fields, buttons, headings, confirm questions, the messages after saving or on an error), each with the file and line where it lives in the code. Without a screen it lists the screens. Use it to quote what a volunteer reads, and put the file and line in a feedback note.",
    inputSchema: obj({ screen: s("The screen's name from the list, such as \"program-editor\" or \"registration-program\"."), part: s("Optional: part of one file's name, such as \"About\" or \"Dana\", to read only that part.") }),
    annotations: READ_ONLY,
  },
  {
    name: "screen_code",
    title: "Read the code behind a screen",
    description: "Up to 160 numbered lines of one screen's code, around a line or between two. Use it to see when something shows or what a button does, then explain it in plain words; don't show code unless asked.",
    inputSchema: obj({ file: s("The file's full name as screen_words gives it."), line: { type: "number", description: "A line to read around." }, from: { type: "number", description: "First line to read." }, to: { type: "number", description: "Last line to read." } }, ["file"]),
    annotations: READ_ONLY,
  },
  {
    name: "page_words",
    title: "Read a public page's words",
    description: "Reads the words on one public page of RIM's site right now, such as /new-to-rim or /programs/qigong-at-rim. Use it to quote a public page's current words exactly.",
    inputSchema: obj({ path: s("The page's address after the site name, such as /about.") }, ["path"]),
    annotations: { ...READ_ONLY, openWorldHint: true },
  },
  {
    name: "my_teams",
    title: "List my teams",
    description: "The teams the signed-in person can open, with the name to ask about each by.",
    inputSchema: obj({}),
    annotations: READ_ONLY,
  },
  {
    name: "team_members",
    title: "A team's members",
    description: "A team's members as its Members page shows the signed-in person (a lead also sees emails and notes).",
    inputSchema: obj({ team: s("The team's name from my_teams, such as \"host-team\".") }, ["team"]),
    annotations: READ_ONLY,
  },
  {
    name: "team_conversations",
    title: "A team's conversations",
    description: "A team's conversations, latest first, or one conversation with its replies when given words from its title.",
    inputSchema: obj({ team: s("The team's name from my_teams."), title: s("Optional: words from a conversation's title, to read it.") }, ["team"]),
    annotations: READ_ONLY,
  },
  {
    name: "team_schedule",
    title: "A team's schedule",
    description: "Who is covering a team's sessions in the coming weeks, which are still open, and the open requests for a sub, as the Scheduler shows them.",
    inputSchema: obj({ team: s("The team's name from my_teams."), weeks: { type: "number", description: "How many weeks ahead, 1 to 12 (4 if not given)." } }, ["team"]),
    annotations: READ_ONLY,
  },
];

const PROGRAM_TOOLS: Tool[] = [
  {
    name: "list_programs",
    title: "List the programs",
    description: "Every program as the Programs list shows it: when, in person or online, its category and format, and where registration stands (with how many registered, for those who can open Registration).",
    inputSchema: obj({ include_archived: { type: "boolean", description: "Include archived programs." } }),
    annotations: READ_ONLY,
  },
  {
    name: "program_settings",
    title: "A program's settings",
    description: "Every setting of one program exactly as the program editor holds it now, each under the editor's own name for it: the words, dates, registration, questions, messages, dana and where it appears.",
    inputSchema: obj({ program: s("The program's name or web address, such as \"qigong-at-rim\".") }, ["program"]),
    annotations: READ_ONLY,
  },
];

const REGISTRATION_TOOLS: Tool[] = [
  {
    name: "program_people",
    title: "A program's people",
    description: "One program's people as the Registration app shows them: each person's place, dana and contact, and the latest history. Given a person's name, their answers, notes and history in full.",
    inputSchema: obj({ program: s("The program's name or web address."), person: s("Optional: part of a person's name or email.") }, ["program"]),
    annotations: READ_ONLY,
  },
];

const EMAIL_TOOLS: Tool[] = [
  {
    name: "email_templates",
    title: "The emails RIM sends",
    description: "The email templates from /admin/emails: the list by group, or one email's subject, body, when it goes and what fills in. The words are the templates, never a person's email.",
    inputSchema: obj({ email: s("Optional: the email's name in brackets from the list, such as \"registration-confirmation\".") }),
    annotations: READ_ONLY,
  },
];

const REGISTRY_TOOLS: Tool[] = [
  {
    name: "find_members",
    title: "Find members",
    description: "Members whose name or email has the given words, with their roles and teams, as the Member Registry finds them.",
    inputSchema: obj({ query: s("Part of a name or email.") }, ["query"]),
    annotations: READ_ONLY,
  },
  {
    name: "member_record",
    title: "A member's record",
    description: "One member's record as the Member Registry shows it to the signed-in person: contact, teams, roles, registrations and the other sections they may see.",
    inputSchema: obj({ email: s("The member's email, from find_members.") }, ["email"]),
    annotations: READ_ONLY,
  },
];

async function toolsFor(v: GuideViewer): Promise<Tool[]> {
  return [
    ...OPEN_TOOLS,
    ...((await viewerCan.programs(v)) ? PROGRAM_TOOLS : []),
    ...(viewerCan.registration(v) ? REGISTRATION_TOOLS : []),
    ...(viewerCan.emails(v) ? EMAIL_TOOLS : []),
    ...(viewerCan.registry(v) ? REGISTRY_TOOLS : []),
  ];
}

type RpcMessage = { jsonrpc?: string; id?: string | number | null; method?: string; params?: Record<string, unknown> };

const text = (t: string, isError = false) => ({ content: [{ type: "text", text: t }], ...(isError ? { isError: true } : {}) });
const str = (v: unknown) => (typeof v === "string" ? v : "");
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : undefined);

async function callTool(name: string, args: Record<string, unknown>, v: GuideViewer) {
  switch (name) {
    case "guide_topics": {
      const topics = await listGuideTopics();
      return text(topics.map((t) => `- ${t.slug}: ${t.title}`).join("\n"));
    }
    case "search_guide": {
      const within = str(args.within);
      return text(await searchGuide(str(args.query), 6, within === "guide" || within === "docs" ? within : "both"));
    }
    case "read_guide": {
      const found = await readGuideTopic(str(args.topic), str(args.section) || undefined);
      if (found) return text(found);
      const topics = (await listGuideTopics()).map((t) => t.slug).join(", ");
      return text(args.section ? `No section in "${str(args.topic)}" has "${str(args.section)}" in its heading. Read the whole topic, or search.` : `There's no topic "${str(args.topic)}". The topics are: ${topics}.`, true);
    }
    case "read_design_doc":
      return text(await readDesignDoc(str(args.doc), str(args.section) || undefined));
    case "screen_words":
      return text(await screenWords(str(args.screen) || undefined, str(args.part) || undefined));
    case "screen_code":
      return text(await screenCode(str(args.file), num(args.line), num(args.from), num(args.to)));
    case "page_words":
      return text(await publicPageWords(SITE_ORIGIN, str(args.path)));
    case "my_teams":
      return text(await myTeams(v));
    case "team_members":
      return text(await teamMembers(v, str(args.team)));
    case "team_conversations":
      return text(await teamConversations(v, str(args.team), str(args.title) || undefined));
    case "team_schedule":
      return text(await teamSchedule(v, str(args.team), num(args.weeks) ?? 4));
    case "list_programs":
      return text(await listPrograms(v, args.include_archived === true));
    case "program_settings":
      return text(await programSettings(v, str(args.program)));
    case "program_people":
      return text(await programPeople(v, str(args.program), str(args.person) || undefined));
    case "email_templates":
      return text(await emailTemplates(v, str(args.email) || undefined));
    case "find_members":
      return text(await findMembers(v, str(args.query)));
    case "member_record":
      return text(await memberRecord(v, str(args.email)));
    default:
      return null;
  }
}

async function answer(msg: RpcMessage, v: GuideViewer): Promise<object | null> {
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
        serverInfo: { name: "rim-guide", title: "RIM Guide", version: "2.0.0" },
        instructions: `How Rooted in Mindfulness's website and apps work and why, for RIM's volunteers, read as ${v.firstName || "the signed-in volunteer"} with what their account can see. Search the guide and design docs before answering; quote a screen's exact words with screen_words; read RIM's data with the program, registration, team and member tools. Read-only.`,
      });
    }
    case "ping":
      return reply({});
    case "tools/list":
      return reply({ tools: await toolsFor(v) });
    case "tools/call": {
      const name = str(msg.params?.name);
      const args = (msg.params?.arguments ?? {}) as Record<string, unknown>;
      if (!(await toolsFor(v)).some((t) => t.name === name)) return fail(-32602, `Unknown tool: ${name}`);
      try {
        const result = await callTool(name, args, v);
        // Who used which tool, for the record; never what they asked or read.
        console.info(`[guide-mcp] ${v.userId} ${name}`);
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

/** Who is asking, from their sign-in, with roles read now; null asks them to sign in. */
async function viewerFrom(request: NextRequest): Promise<GuideViewer | null> {
  const auth = request.headers.get("authorization") ?? "";
  const m = auth.match(/^Bearer\s+(\S+)$/i);
  if (!m) return null;
  const access = await readAccess(m[1]);
  if (!access) return null;
  const user = await db.user.findUnique({
    where: { id: access.userId },
    select: { id: true, firstName: true, preferredName: true, roles: true, sectionGrants: true, archivedAt: true },
  });
  if (!user || user.archivedAt) return null;
  return { userId: user.id, firstName: user.preferredName || user.firstName || "", roles: user.roles, sectionGrants: user.sectionGrants };
}

function signInPlease(key: string, hadToken: boolean) {
  const meta = `${SITE_ORIGIN}/api/guide-mcp/${key}/oauth-protected-resource`;
  return new NextResponse(JSON.stringify({ error: "Sign in to RIM to use the guide." }), {
    status: 401,
    headers: {
      "Content-Type": "application/json",
      "WWW-Authenticate": `Bearer resource_metadata="${meta}", scope="guide"${hadToken ? ', error="invalid_token"' : ""}`,
      "Cache-Control": "no-store",
    },
  });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  if (!keyMatches(key)) return new NextResponse("Not found", { status: 404 });

  const viewer = await viewerFrom(request);
  if (!viewer) return signInPlease(key, !!request.headers.get("authorization"));

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
  const replies = (await Promise.all(messages.map((m) => answer(m as RpcMessage, viewer)))).filter(Boolean);
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
