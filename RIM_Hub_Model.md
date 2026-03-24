# The RIM Hub and Tools Model

## The Two Layers

Everything in the volunteer platform lives in one of two layers:

**Hubs are team homes.** A hub is where a team exists — where they communicate, coordinate, manage tasks, share documents, and know who's on their team. Every hub has the same core structure regardless of what team it serves.

**Tools are work applications.** A tool is where specific work gets done — processing registrations, managing a session schedule, handling support emails. Tools are focused, full-screen, and designed for the workflow they serve.

The relationship is intentional: the hub is where you belong, the tool is where you work.

## Creating a Hub

An admin creates a hub at `/admin/hubs`. They provide:

- A name and slug (the URL identifier)
- A type: Operational, Governance, or Community Group
- A description
- A coordinator (assigned from existing members)

When a hub is created it immediately has five core sections available to everyone on the team: Home, Conversations, Tasks, Documents, and Members. No additional configuration is required for these — they work out of the box.

## The Hub Sidebar

Every hub has a left sidebar that serves as its navigation environment. The sidebar has four parts:

**Identity** — hub type, hub name, member count, coordinator name. Always visible so you always know where you are.

**Core sections** — Home, Conversations, Tasks, Documents, Members. These are the same in every hub. Improving any one of them improves every hub simultaneously because they're all powered by the same shared template.

**Tools** — a curated list of applications this team uses. Each tool link navigates away from the hub to the tool's full-screen experience. An external arrow indicator (+) signals that it's leaving the hub.

**Hub settings** — visible only to coordinators and admins. Links to the hub's admin edit page.

## Connecting Tools to a Hub

An admin connects a tool to a hub by adding an app link in the hub's settings at `/admin/hubs/[slug]/edit`. An app link has a label ("Program Manager"), a path (`/tools/programs`), and an enabled toggle. Links can be reordered.

Once added, the tool link appears in the hub sidebar under Tools and as a card on the hub's Home screen. The Home screen card surfaces live context — "3 new registrations" or "2 sessions need hosts" — so the team sees what needs attention before they even open the tool.

Any tool can be linked from any hub. A single tool can be linked from multiple hubs.

## Navigating to a Tool

When a hub member clicks a tool link from the sidebar, two things happen:

First, the `?hub=registrar` query parameter is appended to the URL. This tells the tool which hub launched it.

Second, the tool opens in its own full-screen environment with a ToolsNav bar at the top — not the hub's sidebar. The ToolsNav shows the tool name on the left and a back link on the right ("< Registrar Hub") so the member can return to their hub without using the browser back button.

The tool works the same regardless of how you reached it. If a member navigates directly to `/tools/programs` without coming from a hub, the back link shows "< Dashboard" instead.

## Access Control

Access to each tool is controlled by role, not by hub membership:

| Tool | Required Role |
|------|--------------|
| Program Manager | REGISTRAR or ADMIN |
| Support Inbox | SUPPORT or ADMIN |
| Host Schedule | HOST, HOST_MANAGER, or ADMIN |

This means: being a member of a hub that links to a tool does not grant access to that tool. Access is granted separately through role assignment. A hub member without the right role will see the tool link in their sidebar but will be blocked when they try to open it.

This is intentional. Hub membership is about belonging to a team. Tool access is about being authorized to do specific work. These are different things.

## Shared Tools and Hub Context

When the same tool is linked from multiple hubs, the tool receives the hub slug from the URL parameter (`?hub=slug`). Any tool page can read `useToolsContext().hubSlug` to know which hub launched it.

This is the foundation for scoped data — a tool that serves multiple teams can filter what it shows based on which hub the user came from. A community group discussion tool linked from two different groups shows each group only their own content, even though it's the same tool running the same code.

When a member navigates to a tool directly (no hub context), the tool shows everything their role permits — the full unfiltered view. This is appropriate for admins and coordinators who need the complete picture.

## The Mental Model in One Sentence

A hub is your team's home — you belong there, you communicate there, you track your work there. A tool is a focused application your team uses — you launch it from your hub, do the work, and return.

The hub gives you context. The tool gives you capability. Together they form a complete workspace without either one trying to be both things at once.
