/**
 * seed-manual-host-schedule.mjs — Host Schedule chapter for the average host volunteer.
 *
 * Audience: any host on the team. Plain language. Anchored in concrete actions.
 * Designed against RIM's design philosophy: clear seeing, calm interfaces,
 * generosity toward overwhelmed users.
 *
 * Called from migrate.mjs. Upserts a ManualSection with BlockNote JSON body.
 * Idempotent: checked via migration flag in migrate.mjs.
 */

let _id = 0;
const uid = () => `man-hsch-${++_id}`;

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

export async function seedManualHostSchedule(db) {
  const existing = await db.manualSection.findUnique({
    where: { slug: "host-schedule" },
  });

  const body = [
    p("Welcome. The Host Schedule is where you see what's coming up — your own commitments, what the team needs help with, and what your teammates are hosting. Everything happens through this one page."),
    sp(),
    p("This guide is written so you can read it once and have a clear picture, or come back later and skim for a specific answer. Take your time."),
    sp(),

    h(2, "Getting there"),
    p("Sign in to your RIM account. From your dashboard, open the ", b("Host Hub"), " and click ", b("Schedule"), " in the left sidebar. The full address is ", b("/tools/schedule"), " — useful if you want to bookmark it on your phone."),
    sp(),

    h(2, "What you see when you arrive"),
    p("The page opens to the current month. Reading from the top:"),
    sp(),
    li(b("The month name"), " (e.g. \"April 2026\") with arrows on either side. Use the arrows to step backward or forward a month. A small ", b("This month"), " button appears whenever you've navigated away from today, so you can always jump back."),
    li(b("Filter pills"), " — small rounded buttons that help you focus on what you care about. More on these below."),
    li(b("Cards"), " — each card is one upcoming session. Date and time, the program name and format, who's hosting (or whether nobody has signed up yet), and a button if there's something for you to do."),
    li(b("\"Earlier this month\""), " — a quiet, collapsed section at the bottom. It holds the sessions that already happened. You can open it for reference, but you can't take action on past sessions."),
    sp(),

    h(2, "The four buttons you might see"),
    p("There are really only four actions you'll ever take from this page. Each one is a clearly-labeled button on a session card."),
    sp(),

    h(3, "\"Yes, I can host this\""),
    p("This appears on sessions that haven't been claimed by anyone yet. The card shows ", b("Needs a host"), " in orange."),
    sp(),
    p("Click the button. A confirmation window opens, telling you exactly what you're committing to — the program, the date, the time. If you're sure, click ", b("Yes, I'll host this"), ". If you change your mind, click ", b("Not yet"), " — nothing happens."),
    sp(),
    p("Once confirmed, the team gets notified, the session moves to your column, and you'll see it under the ", b("Mine"), " filter."),
    sp(),

    h(3, "\"Yes, I can cover\""),
    p("This appears on sessions where another host has asked the team to cover for them — they have something come up and they need help. The card shows ", b("[Their name] needs help"), " or ", b("Needs a sub"), "."),
    sp(),
    p("It's the same flow as taking a session — click, confirm, done. Once you confirm, the original host gets an email letting them know you've stepped in. They can relax."),
    sp(),

    h(3, "\"Ask the team to cover\""),
    p("This appears on your own sessions. You'll see it as a small text link at the bottom of any card you're hosting."),
    sp(),
    p("Click it when you can't make a session. A window opens. You can add a short note for the team if you want — something like \"family event came up\" or \"feeling under the weather, no need to call back.\" Notes are optional. Once you click ", b("Send to the team"), ", every other host on the team gets an email with a link that takes them straight to a confirmation for your session. One of them will likely step in."),
    sp(),
    p(b("One important thing:"), " until someone covers, you're still officially the host. If nobody picks it up, you're expected to host. Please plan accordingly — if it's urgent, also reach out to the coordinator directly so they know."),
    sp(),

    h(3, "\"Cancel my request\""),
    p("If you've asked for cover and your situation changes — your sister cancels her visit, your back feels better, your meeting moves — you can take it back. On a card where you've asked for cover, you'll see ", b("Cancel my request"), " as a small link. Click it, confirm, and you're back to hosting that session normally. The team will know your request is closed."),
    sp(),
    p("This is here on purpose. Changing your mind is fine."),
    sp(),

    h(2, "Filter pills — focusing the page"),
    p("Across the top of the page, just below the month, are these pills:"),
    sp(),
    li(b("All"), " — every upcoming session this month, no filter applied. This is the default."),
    li(b("Needs help"), " — only sessions where help is needed. Open sessions, sessions where someone has asked for cover. The shortest path to \"what can I do?\""),
    li(b("Mine"), " — only sessions you're hosting. Useful for a quick check of your own commitments."),
    li(b("My requests"), " — only sessions where you've asked the team to cover. This pill only appears if you have an open request — otherwise it stays hidden."),
    sp(),
    p("Pick one at a time. The number on each pill tells you how many sessions match."),
    sp(),

    h(2, "Looking at a teammate's schedule"),
    p("The ", b("Mine"), " pill has a small downward arrow next to it. Click the arrow (not the pill itself) and a list of every host on the team appears. Pick anyone from the list, and the page switches to show ", i("their"), " schedule — what they're hosting, what they need help with."),
    sp(),
    p("This is for awareness — you might want to see whether a teammate is overloaded or quiet, or check who's hosting the program you're attending. You can't ", i("act on their behalf"), " (you can't ask the team to cover for someone else), but if they have an open cover request you'll see it and can step in just like you would from the regular view."),
    sp(),
    p("To switch back to your own view, click the arrow again and pick ", b("Mine"), " from the top of the list."),
    sp(),

    h(2, "Emails — the one-tap path"),
    p("When a teammate asks the team to cover, you get an email. The email has a button — ", b("Cover this session →"), " — that takes you directly to the schedule page with the cover-confirmation already open for the right session. One tap from your email to confirming you'll cover. You don't need to find the session manually or remember what day it was on."),
    sp(),
    p("Same idea applies if anyone sends you a link to claim a specific session — clicking it opens the confirmation directly. You always get a chance to confirm before anything is committed; the link doesn't sign you up by itself."),
    sp(),

    h(2, "\"Earlier this month\""),
    p("As the month progresses, sessions that have happened don't clutter the top of the page. They get tucked into a small collapsed section at the bottom called ", b("Earlier this month"), "."),
    sp(),
    p("Click the arrow to expand it. The cards inside are muted and have no buttons — you can't take action on something that's already passed. It's just there if you want to remember what happened, or check who hosted what."),
    sp(),
    p("This section only appears when you're viewing the current month. If you navigate to a past or future month, all sessions just appear in the regular flow."),
    sp(),

    h(2, "If something feels off"),
    p("None of the actions on this page are irreversible. Every confirmation can be cancelled before it happens. After the fact, you can ask the team to cover, cancel a request, or reach out to the coordinator to fix things directly. Mistakes are fine."),
    sp(),
    p("If anything is confusing — a button you can't find, a label that doesn't make sense, a workflow that feels harder than it should be — tell the host coordinator. The page is meant to make hosting easy. If it doesn't, that's worth fixing."),
    sp(),

    h(2, "A small reminder"),
    p("Hosting is volunteer work. Your time is a real gift to the community. The page is designed so that saying yes is easy, asking for help is easy, and changing your mind doesn't feel like failure. None of those things should ever feel hard."),
    sp(),
    p("Welcome to the team."),
  ];

  const data = {
    title: "Host Schedule",
    description: "How to use the Host Schedule — claim sessions, ask the team to cover, step in for teammates.",
    hubSlug: "host-team",
    body,
    relations: ["host-hub", "host-hub-team-management", "programs"],
    order: 7,
  };

  if (existing) {
    await db.manualSection.update({
      where: { slug: "host-schedule" },
      data,
    });
    console.log("  ✔ Updated manual section: host-schedule");
  } else {
    await db.manualSection.create({
      data: { slug: "host-schedule", ...data },
    });
    console.log("  ✔ Created manual section: host-schedule");
  }
}
