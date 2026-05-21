/**
 * update-manual-host-hub-team-management.mjs — Rewrite the team-management chapter.
 *
 * The original was ~6,000 words with system-architect framing
 * ("HubMember record," "the hub-membership-is-authority rule," "what
 * syncs automatically vs. what you manage," "LiveKit," "HOST role").
 * Comprehensive but heavy for the audience.
 *
 * This rewrite is for Maria the host coordinator — written at an
 * 8th-grade reading level, no jargon, no model names. Same information,
 * plain language. Adds the destructive-action confirmation flow when
 * pausing a host with upcoming sessions (was missing). Trimmed to ~1,700
 * words; everything substantive is preserved.
 *
 * Body is stored as a plain HTML string (post-Tiptap-migration canonical
 * format). Renderers route via isHtmlString() format detection.
 *
 * Idempotent at the record level (update by slug). Wired into migrate.mjs
 * behind a one-time flag.
 */

const TEAM_MANAGEMENT_BODY = `<p>This chapter is for the host coordinator. It explains how you manage the team — adding new hosts, pausing someone who needs a break, keeping track of who's active, and what happens behind the scenes when you make a change. If you're new to the role, read this first. If you've been doing it for a while, come back when something specific is in question.</p>
<h2>What you actually decide</h2>
<p>You decide who's on the host team. You can add hosts, pause them when they need a break, and adjust their settings. You don't need to ask Jesse or anyone else for these choices. Other people may bring you names — someone who reached out, someone who's interested — but bringing them onto the team is yours.</p>
<p>One exception: permanently removing a host (as opposed to pausing them) is reserved for Jesse. This is a safety thing — pausing is recoverable, removing isn't, so the irreversible action sits with the admin. If you need to permanently remove someone, ask Jesse.</p>
<h2>Adding someone to the team</h2>
<p>In the hub, open the Members tab and click <strong>Add a host</strong>. A search box appears.</p>
<p>Type the person's name or email. The search looks across everyone with a RIM account. As you type, matches appear. Each result shows the person's name and email, along with small tags telling you which other hubs they're already in — useful so you can see "this person is also in the Course Hub" without leaving the page.</p>
<p>Click the person you want to add. You'll be asked to confirm. Once you confirm:</p>
<ul>
<li>They're on the team right away.</li>
<li>They get the ability to host sessions and claim sub requests.</li>
<li>They start receiving the team's emails, unless you mute them later.</li>
<li>The other coordinators get an email letting them know a new host joined.</li>
</ul>
<p>That's it. The whole flow is two screens.</p>
<h3>What if they're not in RIM yet?</h3>
<p>The search only shows people who already have a RIM account. If someone wants to host but doesn't have an account, they need to create one first — by signing up for any program, or by visiting the sign-in page and asking for a sign-in code. Once they have an account, they'll show up in the search.</p>
<p>This is on purpose. Being a host means you're already part of RIM. It keeps the membership boundary clean.</p>
<h2>Status: active, paused, or away</h2>
<p>Every host on the team has a status. There are three.</p>
<p><strong>Active.</strong> They're currently hosting. They appear in the team list, get the team's emails, and can host sessions. New hosts start here.</p>
<p><strong>Paused.</strong> They're taking a break. They're hidden from the default team view but their record stays put — every note, every detail. Pausing is gentle. It isn't a removal. When they come back, you unpause and they pick up where they left off.</p>
<p><strong>Away.</strong> They've left the team. Their record stays for history, but they don't host anymore and don't appear in active views. Use Away only when someone has truly left — for breaks, even long ones, use Paused.</p>
<h2>When and how to pause someone</h2>
<p>Pause is for real situations:</p>
<ul>
<li>Someone going through a hard time who asked for a break.</li>
<li>Someone who moved and needs a month to settle in.</li>
<li>Someone who had a baby.</li>
<li>Someone traveling for a while.</li>
<li>Someone who wants to rest, full stop, no other reason needed.</li>
</ul>
<p>Pause is also useful when you're not quite sure what's going on. If a host has stopped showing up and isn't responding to messages, pausing them keeps the team list honest (they're not active) without making a permanent decision. You can always unpause later.</p>
<h3>What you decide when you pause</h3>
<p>When you pause someone, three small choices come up. Each one answers a different question.</p>
<p><strong>Can they still host?</strong></p>
<ul>
<li><em>Yes.</em> They can still claim sub requests and host occasionally if they want. Useful for someone stepping back from regular hosting but happy to fill in.</li>
<li><em>No.</em> They can't host while paused. Useful for someone fully stepping back, or for a long-enough break that hosting wouldn't make sense.</li>
</ul>
<p><strong>Do they still get the team's emails?</strong></p>
<ul>
<li><em>Yes.</em> They still hear about new sub requests, conversations, and team updates. Useful for someone who wants to stay in the loop.</li>
<li><em>No.</em> They're muted while paused. Useful for someone who asked not to be contacted, or for a long break where notifications would feel like nagging.</li>
</ul>
<p><strong>Why are they paused?</strong></p>
<p>A short note for your records. Examples: <em>"Traveling through May, will check back in June." "Asked for indefinite break — follow up in three months." "New baby — wait until they reach out."</em></p>
<p>This note is for you. The host doesn't see it. You'll thank yourself in three months when you're looking at your paused list and trying to remember why someone is there.</p>
<h3>The defaults</h3>
<p>When you click Pause on someone, the choices come pre-filled:</p>
<ul>
<li><em>Can they still host?</em> Yes (kept).</li>
<li><em>Do they still get emails?</em> No (muted).</li>
</ul>
<p>These defaults assume "stepping back, but not gone." That's the most common case. Adjust as needed.</p>
<h3>If they have sessions on the schedule</h3>
<p>If the person you're pausing has sessions assigned to them in the future, the system notices. It pauses for a moment and asks: should we release those sessions back to the team?</p>
<p>Usually you say yes. The sessions go back into the pool, and the team gets a heads-up that those slots need a host. If you say no, the sessions stay assigned to the paused host — useful in rare cases where you know they'll cover something specific even while taking a break, but uncommon.</p>
<h3>Unpausing</h3>
<p>When someone is ready to come back, open their record and switch their status to Active. Their settings reset to the active defaults — hosting on, emails on — unless you set them otherwise.</p>
<p>A welcome-back message in Conversations is a nice touch.</p>
<h2>What a paused host actually experiences</h2>
<p>When someone is paused with hosting off and emails muted:</p>
<ul>
<li>They can't start a session as the host. The host controls won't show up for them, even if they reach a session page.</li>
<li>They can't claim sub requests.</li>
<li>They aren't shown in the default team list when you or another host opens the Members tab.</li>
<li>They aren't counted as "available" when the team is looking for coverage.</li>
<li>They don't get sub-request emails, new-thread emails, or new-reply emails.</li>
</ul>
<p>What they <em>can</em> still do: log in, visit the hub, read what's there. Pause is about what the system asks of them and lets them do — not about locking them out.</p>
<p>This is worth understanding. When you pause someone with hosting off, the system really stops them from hosting. It's not a label. It's the real thing.</p>
<h2>Coordinator notes</h2>
<p>Each host has a place for coordinator notes — a spot to write down anything you want to remember about them as a teammate. This is different from the pause note, which is specifically about why someone is currently paused. Coordinator notes are for context that stays useful over time:</p>
<ul>
<li><em>"Came via recommendation from Sarah at the Saturday retreat."</em></li>
<li><em>"Hosting since 2022, very experienced — happy to mentor."</em></li>
<li><em>"Prefers Tuesday evenings; mornings don't work for him."</em></li>
<li><em>"Was nervous about tech at first, very comfortable now."</em></li>
</ul>
<p>These notes are for you and the other coordinators. Regular hosts can't see them. They don't show up anywhere else. This is purely a place for team-stewardship memory.</p>
<h2>Reading the team at a glance</h2>
<p>The Members tab has filters for Active, Paused, Away, and All. Active is the default.</p>
<p>For each person, you see:</p>
<ul>
<li>Their name and photo.</li>
<li>Their status badge.</li>
<li>A short activity note: how many sessions they've been assigned in the last 30 days. <em>"3 in last 30 days"</em> or <em>"No recent sessions."</em></li>
<li>Their join date.</li>
</ul>
<p>The activity note is an approximation, not a measurement. It tells you who's been on the schedule recently. It doesn't track who actually hosted (someone may have been assigned but had a sub cover). Use it as a signal for stewardship, not as a metric.</p>
<p>Click anyone to open their detail panel. From there you can see everything, change their status, adjust their settings, and add notes.</p>
<h2>What you decide vs. what happens on its own</h2>
<p>A few things about a host's record happen automatically. Others are yours to manage. Knowing the difference helps you understand what to expect.</p>
<p><strong>Happens on its own:</strong></p>
<ul>
<li>When you add someone to the team, they get host access.</li>
<li>When their broader role changes (an admin gives or takes a role), some basic settings adjust to match.</li>
<li>The system creates and updates the host's record as needed.</li>
</ul>
<p><strong>Yours to manage:</strong></p>
<ul>
<li>Status (active, paused, away).</li>
<li>Whether a paused host can still host.</li>
<li>Whether they still get the team's emails.</li>
<li>Pause notes and coordinator notes.</li>
</ul>
<p>If an admin makes a change at the account level — say, removing or adding a role — the system won't undo your decisions. A paused host stays paused. A muted host stays muted. Your work is respected.</p>
<h2>What's not yours to decide</h2>
<p>Some things sit with other roles, on purpose.</p>
<p><strong>Program details</strong> (when sessions happen, virtual or in person, the room link). Contact the registrar. You can see information in the schedule, but you can't edit programs.</p>
<p><strong>Permanently removing someone.</strong> Ask Jesse. Hard removal is reserved for the admin to prevent accidental irreversible actions. For temporary or indefinite breaks, use Paused or Away.</p>
<p><strong>Major account changes</strong> (changing someone's email, archiving an account, managing their full registration history). These belong to the admin and the registrar. You have everything you need about your team inside the host hub.</p>
<p><strong>Anything that feels bigger than hosting</strong> (a session that needs pastoral follow-up, a structural problem, something that needs a teacher's attention). Send it to Jesse. Trust your read — when in doubt, a brief message is better than guessing.</p>
<h2>A reminder</h2>
<p>Team stewardship is relational work. The tools in the Members tab support it — they let you track who's active, who's paused, who needs a check-in. But the tools don't <em>do</em> the stewardship. A paused host with a coordinator note saying "asked for a break" deserves a check-in message from you in two or three months, regardless of what the system does.</p>
<p>Use the tools to help you care for the team. Not to replace your care.</p>`;

export async function updateManualHostHubTeamManagement(db) {
  const existing = await db.manualSection.findUnique({
    where: { slug: "host-hub-team-management" },
    select: { id: true },
  });

  const data = {
    title: "Host Hub — Team Management",
    description: "How the host coordinator adds hosts, pauses team members, and manages the team.",
    hubSlug: "host-team",
    body: TEAM_MANAGEMENT_BODY,
    relations: ["host-hub", "host-schedule"],
  };

  if (existing) {
    await db.manualSection.update({
      where: { slug: "host-hub-team-management" },
      data,
    });
    console.log("  ✔ Updated manual section: host-hub-team-management");
  } else {
    // Order 20 mirrors the original chapter position; only used if a fresh
    // database has somehow missed the original seed run.
    await db.manualSection.create({
      data: { slug: "host-hub-team-management", order: 20, ...data },
    });
    console.log("  ✔ Created manual section: host-hub-team-management");
  }
}
