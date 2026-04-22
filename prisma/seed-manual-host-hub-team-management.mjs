/**
 * seed-manual-host-hub-team-management.mjs — Host Hub team management chapter.
 *
 * Called from migrate.mjs. Upserts a ManualSection with BlockNote JSON body.
 * Idempotent: checked via migration flag in migrate.mjs.
 */

let _id = 0;
const uid = () => `man-hhtm-${++_id}`;

const t = (text) => ({ type: "text", text, styles: {} });
const b = (text) => ({ type: "text", text, styles: { bold: true } });
const i = (text) => ({ type: "text", text, styles: { italic: true } });

const p = (...parts) => ({
  id: uid(), type: "paragraph", props: {},
  content: parts.flat().map(part => typeof part === "string" ? t(part) : part),
  children: [],
});

const sp = () => ({ id: uid(), type: "paragraph", props: {}, content: [], children: [] });

const h = (level, text) => ({
  id: uid(), type: "heading", props: { level },
  content: [t(text)], children: [],
});

const li = (...parts) => ({
  id: uid(), type: "bulletListItem", props: {},
  content: parts.flat().map(part => typeof part === "string" ? t(part) : part),
  children: [],
});

const ni = (...parts) => ({
  id: uid(), type: "numberedListItem", props: {},
  content: parts.flat().map(part => typeof part === "string" ? t(part) : part),
  children: [],
});

export async function seedManualHostHubTeamManagement(db) {
  const existing = await db.manualSection.findUnique({
    where: { slug: "host-hub-team-management" },
  });

  const body = [
    p("Written for the Virtual Host Coordinator, though the Volunteer Coordinator and Jesse may find parts of it useful as reference."),
    sp(),

    h(2, "What this chapter covers"),
    p("This chapter explains how team management works in the Host Hub — how to add a new host, how to pause someone who needs a break, how to tell at a glance who's active on your team, and what happens behind the scenes when you make a change. If you're new to the Virtual Host Coordinator role, read this first."),
    sp(),

    h(2, "Your authority"),
    p("The Virtual Host Coordinator is the person who decides who's on the Host team. You can add hosts directly, pause them when they need a break, and remove them when they move on. You don't need to go through Jesse or anyone else for any of these actions. The Volunteer Coordinator may recommend people to you or let you know someone has reached out — but bringing them onto the team is your decision, and you make it from inside the hub."),
    sp(),
    p("One exception: permanently removing a host (as opposed to pausing them) is reserved for ADMIN. This is to prevent accidental irreversible actions. If you need to permanently remove someone, ask Jesse to do it."),
    sp(),

    h(2, "Adding a new host"),
    ni("Open the Host Hub and go to the ", b("Members"), " tab."),
    ni("Click ", b("Add a host"), "."),
    ni("Type the person's name or email. The search looks across RIM members — anyone who already has an account. You'll see matching results as you type."),
    ni("Each result shows the person's name and email, plus small tags indicating any other hubs they're already members of (so you can see \"this person is also in the Course Hub\" at a glance)."),
    ni("Click the person you want to add. You'll be asked to confirm."),
    ni("On confirm, they're added to the Host Hub immediately. This gives them:"),
    li("Access to the Host Hub"),
    li("The ", b("HOST"), " role (which lets them host LiveKit sessions and claim sub requests)"),
    li("Notifications about Host team activity (unless you mute communications — see below)"),
    ni("The other coordinators of the hub (and you, implicitly) get notified that a new host joined."),
    sp(),

    h(3, "What if the person isn't in RIM yet?"),
    p("The member picker only shows people who already have a RIM account. If someone has decided to become a host but doesn't have an account yet, they need to create one first — by registering for any program on the site, or by visiting the sign-in page and requesting a magic link. Once they have an account, they'll show up in the picker."),
    sp(),
    p("This is intentional. It keeps the membership boundary clean — a \"host\" is always someone who has chosen to be part of RIM, not an external invitation."),
    sp(),

    h(2, "The three statuses"),
    p("Every member of the Host Hub has a status:"),
    sp(),
    p(b("Active"), " — They're currently part of the team. They appear in the team roster, receive hub communications, and can host sessions. This is the default when you add someone."),
    sp(),
    p(b("Paused"), " — They're taking a break. They're hidden from the default team roster but their record is preserved, along with everything about them. Pausing is graceful — it's not a removal. When they come back, you unpause and they pick up where they were."),
    sp(),
    p(b("Inactive"), " — They've fully left the team. Their record is retained for history, but they can't host and they don't appear in active views. Use this only when someone truly leaves RIM or permanently steps away from hosting. For temporary breaks, use Paused."),
    sp(),

    h(2, "When and how to pause someone"),
    p("Pause is for real situations:"),
    li("Someone is going through a hard time and asked for a break"),
    li("Someone moved and is taking a month to settle in"),
    li("Someone had a baby"),
    li("Someone is traveling and won't be available for a while"),
    li("Someone feels like they need a rest — period, no other reason needed"),
    sp(),
    p("Pause is also useful when you're not sure what's happening with someone. If a host stops showing up and isn't responding to messages, pausing them keeps the team roster honest (they're not active) without making a permanent decision. You can always unpause later."),
    sp(),

    h(3, "Pause has three settings you control"),
    p("When you pause someone, you see three choices. Each answers a different question."),
    sp(),
    p(b("Can they still host? (Hosting capability)")),
    li(b("Yes, retained"), " — They can still claim sub requests and host a session if they want to. Useful for someone who's stepping back from regular hosting but is happy to fill in occasionally."),
    li(b("No, revoked"), " — They can't host at all while paused. No LiveKit host controls, no sub claiming. Useful for someone who is fully stepping back."),
    sp(),
    p(b("Do they still get hub communications? (Communications)")),
    li(b("Full"), " — They still receive hub notifications, sub-request alerts, conversation replies. Useful for someone who wants to stay in the loop even while not actively hosting."),
    li(b("Muted"), " — They don't receive hub notifications. Useful for someone who explicitly asked not to be contacted while on break, or for anyone whose pause is long enough that notifications would feel like nagging."),
    sp(),
    p(b("Why are they paused? (Pause note)")),
    p("A short note, visible only to you and other coordinators. Examples: ", i("\"Traveling through May, will check back in June.\""), " ", i("\"Asked for indefinite break. Follow up in 3 months.\""), " ", i("\"New baby — don't contact, will reach out when ready.\"")),
    sp(),
    p("This is for your own memory. You'll thank yourself in three months when you're looking at the paused list and wondering why someone is there."),
    sp(),

    h(3, "Defaults"),
    p("When you click \"Pause\" on a member, the defaults are:"),
    li(b("Hosting capability:"), " Retained"),
    li(b("Communications:"), " Muted"),
    sp(),
    p("These defaults assume \"stepping back but not gone.\" The most common pause case. Adjust as needed for the specific person."),
    sp(),

    h(3, "Unpausing someone"),
    p("When someone is ready to come back, open their record and change their status back to ", b("Active"), ". Their hosting capability and communications are reset to the active defaults (hosting retained, communications full) unless you explicitly set them otherwise."),
    sp(),

    h(2, "What a paused host experiences"),
    p(b("A paused host with hosting revoked:")),
    li("Cannot join a LiveKit session with host controls, even if they somehow reach the session page"),
    li("Cannot claim sub requests"),
    li("Is not shown in the team roster when other hosts view the Members tab"),
    li("Is not counted in \"active hosts\" when the coordinator is scanning her team"),
    sp(),
    p(b("A paused host with communications muted:")),
    li("Does not receive email notifications about new sub requests, new hub members, new conversation threads, or replies"),
    li("Can still log in and visit the hub if they want — the mute is only about push/email, not access"),
    sp(),
    p("A paused host can still see the hub if they log in. Pause is about what the system sends them and what they're allowed to do, not about locking them out."),
    sp(),

    h(2, "Coordinator notes"),
    p("Every member has a space for coordinator notes — a place to write anything you want to remember about them as a teammate. This is different from the pause note, which is specifically about why they're currently paused."),
    sp(),
    p("Use coordinator notes for context you'll want months from now:"),
    li(i("\"Came via recommendation from [name] at the drop-in retreat\"")),
    li(i("\"Has been hosting since 2022, very experienced\"")),
    li(i("\"Prefers Tuesday evenings, has a hard time with Monday mornings\"")),
    li(i("\"Nervous about tech at first, now very comfortable — offered to mentor new hosts\"")),
    sp(),
    p("Coordinator notes are visible to you and other coordinators of the Host Hub. Regular hosts don't see them. They're not visible on the person's profile elsewhere in the system. This is purely a team-stewardship field."),
    sp(),

    h(2, "Reading the team at a glance"),
    p("The Members tab has tabs or filters for Active, Paused, Inactive, and All. Active is the default view."),
    sp(),
    p("For each member, you see:"),
    li("Name, photo, preferred name"),
    li("Status badge"),
    li(b("Activity indicator"), " — a simple summary of how many assignments they've had in the last 30 days. \"3 assignments in last 30 days\" or \"No recent assignments.\""),
    li("Join date"),
    sp(),
    p("The activity indicator is an approximation, not a measurement. It tells you who's been on the schedule recently. It doesn't tell you exactly how many sessions they actually hosted (someone might have been assigned but had a sub cover). Treat it as a signal for team stewardship, not as a metric."),
    sp(),
    p("Clicking any member opens their detail panel, where you can see everything, edit their status and settings, and read or write notes."),
    sp(),

    h(2, "The hub-membership-is-authority rule"),
    p("This is a principle worth understanding, because it affects how pausing actually works under the hood."),
    sp(),
    p("When someone is a member of the Host Hub, their hub membership determines whether they can host — regardless of whether they have the HOST role on their account. If you pause someone with hosting revoked, the system blocks them from hosting everywhere: LiveKit sessions won't give them host controls, they can't claim sub requests, they don't appear as available hosts."),
    sp(),
    p("This is what \"paused\" really means technically: the hub says you're not currently hosting, so you're not hosting, period."),
    sp(),
    p("You don't need to do anything special to make this work. Pausing handles it. The point of explaining this is so you understand: pause isn't cosmetic. It's the real thing. A paused host with hosting revoked cannot accidentally end up hosting somewhere."),
    sp(),

    h(2, "What syncs automatically vs. what you manage"),
    p("Some things about Host Hub members sync automatically when their role changes. Others are yours to manage. Knowing which is which helps you understand what to expect."),
    sp(),
    p(b("Automatic (managed by the system):")),
    li("HOST role on the User record is added when you add someone to the Host Hub"),
    li("Position and coordinator flags adjust if roles change at the user level"),
    li("HubMember record is created when someone is added"),
    sp(),
    p(b("Yours to manage:")),
    li("Status (Active / Paused / Inactive)"),
    li("Hosting capability"),
    li("Communications preference"),
    li("Pause notes"),
    li("Coordinator notes"),
    sp(),
    p("If an ADMIN adds or removes a role at the user level, the system won't undo your coordinator-level decisions. A paused host stays paused, with their hosting capability and communications as you set them. Your work is respected."),
    sp(),

    h(2, "When something needs the registrar or ADMIN"),
    p("Some things aren't yours to manage, and that's intentional."),
    sp(),
    p(b("Program configuration"), " (when sessions happen, recurrence, virtual vs. in-person, LiveKit room setup) — contact the registrar. You can see diagnostic information in the Schedule tool but can't edit programs."),
    sp(),
    p(b("Permanent removal of a host"), " — ask Jesse. Hard delete is rare and is reserved for ADMIN to prevent accidental irreversible actions. For temporary or indefinite breaks, use Paused or Inactive instead."),
    sp(),
    p(b("LiveKit infrastructure"), " — infrastructure is managed by ADMIN. You shouldn't need to touch this, but if something unusual is happening with LiveKit across multiple sessions, flag it to Jesse."),
    sp(),
    p(b("Member account changes"), " (email changes, archiving a member entirely, managing their registration history) — the full Member Registry is for ADMIN and the registrar. You have everything you need about your team within the Host Hub."),
    sp(),

    h(2, "A note on tone"),
    p("Team stewardship is relational work. The tools in the Members tab support it — they give you the ability to track who's on your team, who's paused, who needs a check-in. But the tools don't do the stewardship itself. A paused member with a coordinator note saying \"asked for a break\" deserves a check-in message from you in two or three months, regardless of what the system does."),
    sp(),
    p("Use the tools to support your care for the team. Not to replace it."),
  ];

  const data = {
    title: "Host Hub — Team Management",
    description: "How the Virtual Host Coordinator adds hosts, pauses team members, and manages the Host Hub roster.",
    hubSlug: "host-team",
    body,
    relations: [],
  };

  if (existing) {
    await db.manualSection.update({
      where: { slug: "host-hub-team-management" },
      data,
    });
    console.log("  ✔ Updated manual section: host-hub-team-management");
  } else {
    await db.manualSection.create({
      data: {
        slug: "host-hub-team-management",
        ...data,
        order: 20,
      },
    });
    console.log("  ✔ Created manual section: host-hub-team-management");
  }
}
