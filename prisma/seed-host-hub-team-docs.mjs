/**
 * seed-host-hub-team-docs.mjs — Seed reference HubDocuments for host-team.
 *
 * Six documents across four new categories, written for hosts and the
 * host coordinator. Generic role names — never name a specific
 * coordinator, so chapters stay portable across role changes. Aligned
 * with RIM_Role_Design.md §Virtual Host and the Web Design Philosophy
 * (clear seeing, restraint, designed for overwhelmed users).
 *
 * Documents (canonical HTML strings — the post-Tiptap-migration storage format):
 *
 *   The Practice of Hosting
 *     · Host Role
 *     · Stewardship Practices
 *
 *   Running a Session
 *     · Quick Start
 *     · Sub Coverage
 *
 *   When Things Go Wrong
 *     · Disruption Response
 *
 *   For Coordinators
 *     · Coordinator Playbook
 *
 * Idempotent at the record level (upsert by hub + label). Wired into
 * migrate.mjs behind a migration flag.
 */

const HOST_ROLE = `<p>Hosting at RIM is a specific kind of service. You open the session room, welcome the people who arrive, hold the space steady while the teacher teaches, and stay attentive without making yourself the center of anything. The role is small in scope and large in impact — most members never have a one-on-one moment with a teacher, but they have one with a host every time they arrive.</p>
<p>This document covers what the role consists of, what we ask of you, and what we hold for you in return.</p>
<h2>What you'll be doing</h2>
<p>You'll be assigned to specific recurring sessions — Monday-night drop-ins, the Wednesday morning sit, a six-week course. The schedule lives in the Host Schedule tool, which you can reach from the host hub sidebar. Each session you're assigned to is yours to open and tend.</p>
<p>For each session, the work is consistent:</p>
<ul>
<li>Open the session room a few minutes before the start time.</li>
<li>Welcome members as they arrive.</li>
<li>Watch the chat, mute background noise as needed, and be available for technical questions.</li>
<li>Stay attentive but unobtrusive while the teacher leads the practice.</li>
<li>Close the session at the end.</li>
</ul>
<p>If you can't make a session you're assigned to, the system supports requesting a sub. Another host can claim it. The "Sub Coverage" document explains how.</p>
<h2>What we ask of you</h2>
<p><strong>Reliability.</strong> When you're assigned to a session, members and teachers count on you being there. If something comes up, request a sub as early as you can — early enough that another host has a real chance to pick it up. Coverage gaps create stress for the whole team.</p>
<p><strong>Steadiness.</strong> Things will go wrong sometimes. A participant's audio won't work. The teacher will be late. Someone will say something strange in chat. The work is to stay calm, do what's available to do, and let the rest go. The "Stewardship Practices" document covers the relational side of this in more depth.</p>
<p><strong>Communication.</strong> If something feels off — a recurring technical issue, a participant who concerns you, a moment in a session that needs follow-up — tell the host coordinator. Hosts debrief together. You don't carry difficult sessions alone.</p>
<p><strong>Practice.</strong> Hosting at RIM is not generic volunteering. It's a form of practice that sits inside a community of practice. Showing up, paying attention, being willing to be steady — these are the same dispositions meditation cultivates, brought into a particular service.</p>
<h2>What we hold for you</h2>
<p><strong>Training.</strong> Before your first session, you'll have a chance to shadow an experienced host, and to co-host with one before going solo. You won't be thrown in unprepared.</p>
<p><strong>A coordinator.</strong> The team has a host coordinator who supports the team, handles questions, helps with coverage gaps, and is the first person to message if something difficult happens. You'll see who the coordinator is in the Members tab. You don't need to escalate to Jesse for ordinary issues — that's what the coordinator is for.</p>
<p><strong>Tools.</strong> The Host Schedule shows you exactly what you're assigned to. The session room itself gives you Mute and End for All controls when you need them. The Documents tab in the host hub holds the references you might want during or after a session.</p>
<p><strong>Support after a hard session.</strong> If something happens — a disruption, a participant in distress, a moment that felt heavy — you don't sit with it alone. Message the host coordinator. Hosts debrief together as a matter of course, not as a special exception.</p>
<h2>The team you're part of</h2>
<p>You're not a contractor. You're part of the host team — a sangha within a sangha. Other hosts are tending other sessions in the same week, working from the same shared schedule, drawing on the same training, and supporting each other through the harder moments. The way the team works together is itself part of what makes RIM what it is.</p>
<p>When you're new, ask questions. When you're experienced, help newer hosts find their footing. When something's not working, say so — the team gets better when feedback is part of the rhythm.</p>
<h2>Commitment</h2>
<p>We ask for a commitment of at least six months when possible, and one or more sessions per week. If your availability changes, tell the host coordinator — the schedule can flex. If you need a break or want to step back, tell the host coordinator. Stepping back is a normal part of volunteer life. We'd rather know early than have you carry a commitment that's no longer right.</p>`;

const STEWARDSHIP_PRACTICES = `<p>Hosting is a form of practice. The technical work of opening the session, supporting audio and video, and watching the chat is real and necessary. But the work that matters most is harder to name and harder to teach. It is the quality of presence you bring into the room — the steadiness, the welcome, the unhurried attention — that becomes part of what other people experience when they arrive.</p>
<p>A host who is technically competent but not present is missing the point. A host who is present but technically unprepared creates chaos. Both are required, and both are care.</p>
<p>This document is about the second dimension — the part that doesn't show up in checklists but shapes everything.</p>
<h2>What stewardship is</h2>
<p>Stewardship is the work of holding the container so that the people inside it can practice. It is not management. It is not customer service. It is not a performance of warmth. It is closer to what a sangha host does at a retreat — opening the door, knowing your way around, paying attention without demanding attention.</p>
<p>The aim is for a participant to be able to forget about you. If they notice the room is steady, the technology is working, the welcome is warm, and you are unhurried, that is enough. They can settle into practice without you needing to be the center of anything.</p>
<p>The Dharma frame for this is simple: clear seeing is the prerequisite for wise and compassionate response. A cluttered, anxious, over-managed online space prevents the people in it from settling into their own clear seeing. A quiet, attentive space makes room for it.</p>
<h2>Welcoming</h2>
<p>People are arriving from the rest of their day. Some are coming from work, from family, from grief, from joy, from the highway. The first thirty seconds of their session are when they cross a threshold from one mode of being to another.</p>
<p>A good welcome is short, warm, and unhurried. It does not require them to introduce themselves, account for their day, or perform belonging.</p>
<blockquote><p>Welcome. We're glad you're here. Please feel free to settle in.</p></blockquote>
<p>That is enough. You can vary the words; the quality is the same. Calm. Present. No urgency.</p>
<p>What stewardship is not is a performance. You don't need to be cheerful. You don't need to fill silence. You don't need to deliver a monologue about the program. If you are a steady presence and the room is open, that itself is welcome.</p>
<h2>Receiving someone new</h2>
<p>If someone is visibly new — a name you haven't seen, a question that sounds uncertain, the small hesitation of someone trying not to do the wrong thing — receive them gently. Don't single them out to the group. A private chat message is often kinder than calling on them.</p>
<blockquote><p>You're in the right place. We'll begin in a few minutes. There's nothing you need to do — just settle in.</p></blockquote>
<p>The instinct to reassure with information — here's how it will go, here's where the chat is, here's what to expect — is usually too much. The right amount is less than feels natural. Trust that they'll figure out what they need to as the session unfolds.</p>
<h2>When someone needs technical help</h2>
<p>Keep it brief, keep it private, and keep it unhurried.</p>
<p>If someone's audio isn't working, or their video won't turn on, or they can't find the chat — answer once, in private chat if possible, and let it go. If it can't be solved quickly, invite them to stay as they are.</p>
<blockquote><p>It looks like your audio isn't connecting. You can try clicking the audio icon at the bottom of the screen. If that doesn't work, you're welcome to stay with us — you can hear us, and we're glad you're here.</p></blockquote>
<p>Two things to avoid: turning the whole room's attention toward the issue, and trying to solve every problem completely. A small unresolved technical issue is not a failure of hosting. The session continues. The person can stay. That's the actual win.</p>
<h2>When someone is upset</h2>
<p>Sometimes a participant is visibly distressed — a comment in chat that suggests they're struggling, a tearful camera, a question that has more weight than the moment can hold. Your job here is narrow: stay calm, acknowledge briefly if appropriate, and protect the space.</p>
<p>Your job is not to be their therapist, their teacher, or their friend in this moment. Trying to be any of those things, in a session with other people present, is rarely what's actually helpful, even when it feels generous.</p>
<p>If something feels weighty — a hint of crisis, a reference to harm, a moment that needs careful pastoral attention — flag it for Jesse afterward. Not in front of the group. Message the host coordinator directly when the session ends.</p>
<blockquote><p>Thank you for sharing that. I'm going to make sure we follow up after the session.</p></blockquote>
<p>That is enough.</p>
<h2>What you don't hold</h2>
<p>You are part of a larger support structure. You are not alone in the room, even when you feel like you are. Some things are not yours to carry:</p>
<ul>
<li><strong>Counseling.</strong> If someone is in distress, your role is to flag it, not resolve it.</li>
<li><strong>Interpersonal conflict.</strong> If two participants are tense with each other, your job is to keep the container steady, not to mediate.</li>
<li><strong>Speaking on behalf of RIM.</strong> If someone asks you a policy question, a teacher question, or a question about something you don't know — say you'll find out. Don't improvise.</li>
<li><strong>Solving every technical problem.</strong> Some problems can't be solved in thirty seconds. They don't need to be.</li>
</ul>
<p>These are not coldness. They are the boundary that keeps you available for what is actually yours: holding the room.</p>
<h2>Disruption</h2>
<p>Most sessions never need this. But you should know what to do, so the rare moment doesn't catch you off guard.</p>
<p>The principle is least-intrusive-response. Do as little as the situation actually requires. Escalate only when the smaller response wasn't enough.</p>
<p>The gradient:</p>
<ol>
<li><strong>Private message.</strong> Most low-level issues — background noise, an open mic, a comment in chat edging toward inappropriate — can be handled with a private message. The participant is often unaware. A kind word fixes it.</li>
<li><strong>Mute.</strong> If background noise is disrupting practice or the participant doesn't respond, mute them. You can send a private message afterward explaining why.</li>
<li><strong>Verbal redirect.</strong> Rarely needed, but if a participant is speaking out of turn or pulling the room off course, a brief verbal redirect can land. Keep it kind and short. <em>We're going to return to the practice now. Thank you.</em></li>
<li><strong>Mute All.</strong> A single button in the page header. Mutes every non-host at once — useful when the room itself becomes noisy or when a coordinated disruption begins. Buys the room a moment to settle.</li>
<li><strong>End for all.</strong> If the room itself is unsafe — multiple disruptors, a coordinated attack on an Open Access session — close the session for everyone. This is rare and dramatic, but it exists for a reason.</li>
</ol>
<p>The teacher or facilitator may notice and respond to disruption too. If they do, follow their lead. If they don't, you act.</p>
<p>After ending a session or any difficult moment, message the host coordinator with a brief note about what happened.</p>
<h2>After a difficult session</h2>
<p>Don't carry it alone.</p>
<p>If something happened — a participant in distress, a disruption, a moment that felt heavy — message the host coordinator afterward. Brief is fine. <em>Wanted to let you know what happened in the session tonight.</em> The point isn't a formal report. The point is that you don't sit with it by yourself.</p>
<p>Hosts debrief together. That's part of how the team learns, and part of how the work stays sustainable. If you find yourself replaying a difficult moment days later, that's the signal to talk to someone — the host coordinator, Jesse, another host. The practice of hosting includes the practice of letting the day end.</p>
<h2>The practice itself</h2>
<p>The most important part of stewardship is the simplest: be present. Not perfect. Not impressive. Present.</p>
<p>The members in the room are not evaluating your performance. They're settling into their own practice, and your steadiness is one of the conditions that lets them do that. You don't have to fill the space. You don't have to be on. You can be quiet, attentive, and kind, and that is the work.</p>
<p>If you make a mistake — share a wrong link, fumble a name, miss a moment — let it be a small thing. Hosts who can move past their own missteps without contracting are the hosts who can hold a room well. Self-criticism in the middle of a session pulls you out of presence, and presence is what you're here to offer.</p>
<p>You are part of a sangha that is bigger than any one session. The host coordinator has your back. Jesse has the team's back. You are not alone in this. The work is shared.</p>`;

const QUICK_START = `<p>This document walks through running a session from the moment you sit down at your computer to the moment you close it down afterward. If you're hosting for the first time, read it once before your session. After that, return to it when something specific is in question.</p>
<h2>Before you sit down</h2>
<p>Check the Host Schedule a day or two ahead. You'll see what you're assigned to and at what time. If you can't make it, request a sub as early as possible — see "Sub Coverage."</p>
<h2>A few minutes before the start</h2>
<p>Sign in to RIM and navigate to the session you're hosting. The link to the session room is on the program page or your dashboard. You'll arrive in the room as the host — the system recognizes you because of how you signed in.</p>
<p>A few things to settle as you arrive:</p>
<ul>
<li>Make sure your microphone and camera are working.</li>
<li>Take a breath. The first few minutes set the tone.</li>
<li>Open the chat panel — you'll be watching it during the session.</li>
<li>If a co-host is assigned, exchange a quick word about who's watching what.</li>
</ul>
<h2>As members arrive</h2>
<p>Welcome people as they come in. The "Stewardship Practices" document covers the spirit of this; the procedure is simple:</p>
<ul>
<li>A brief verbal welcome to the room as a whole works for most sessions.</li>
<li>For someone who looks new or hesitant, a private chat message is often kinder.</li>
<li>Keep it short. Members are settling in, not waiting for you to perform.</li>
</ul>
<p>If a member arrives with audio, video, or chat trouble, help them once, in private chat if you can. If it doesn't get fixed in thirty seconds, invite them to stay as they are.</p>
<h2>During the session</h2>
<p>Once the teacher begins, your role narrows. You're watching:</p>
<ul>
<li><strong>Chat</strong> — for questions, technical issues, or anything that needs a response.</li>
<li><strong>Audio</strong> — for background noise that's pulling people out of practice. Mute the participant; you can explain in private chat afterward.</li>
<li><strong>The room as a whole</strong> — for anyone who looks distressed, a hand raised, a moment that needs gentle attention.</li>
</ul>
<p>You don't need to do anything most of the time. The work is mostly being available rather than active.</p>
<p>If something disruptive happens, see "Disruption Response." The short version: act calmly, escalate the response only as much as the situation requires, and the room is more important than any single participant's continued presence.</p>
<h2>At the end</h2>
<p>The teacher will usually close the session. Your job is to be available for a moment afterward in case someone has a follow-up question or needs help leaving the room. Then end the session and close the room.</p>
<h2>After the session</h2>
<p>If something notable happened — a participant in distress, a sub coverage that didn't work, a recurring technical issue, a stranger who slipped past Open Access — let the host coordinator know. A short message is fine.</p>
<p>If nothing notable happened, that's the sign of a session that went well. You don't need to file a report. You can let the day end.</p>`;

const SUB_COVERAGE = `<p>If you're scheduled to host a session and can't make it, the team has you covered — but only if you tell us early enough for another host to pick up the assignment. This document explains how that works.</p>
<h2>When to request a sub</h2>
<p>As soon as you know you can't make a session. Twenty-four hours is the minimum target; a few days is much better. The earlier the request, the more likely another host can rearrange around it.</p>
<p>If something genuinely last-minute happens — illness, an emergency — request the sub anyway and message the host coordinator directly so they know. The team will figure it out.</p>
<h2>How to request</h2>
<p>In the Host Schedule, find the session you're assigned to and use the "Request a sub" action. You'll be asked for an optional reason — a sentence or two is enough. Anything you write goes to the rest of the team in the sub-request notification.</p>
<p>The request goes out to all available hosts. You don't choose who covers; whoever's available claims it.</p>
<h2>How a sub gets claimed</h2>
<p>Other hosts see your sub request in the Host Schedule and via email notification. The first available host who can take it claims the slot. You'll be notified when someone claims, and so will the rest of the team.</p>
<p>If no one claims your sub request, the host coordinator sees it and helps find coverage. You don't need to chase. You don't need to re-post in conversations. The system surfaces unclaimed sub requests directly to the coordinator.</p>
<h2>When you're claiming a sub</h2>
<p>If you see a sub request you can cover, claim it. Once claimed, the assignment is yours — you'll be the host of record for that session. Everyone on the team sees the claim land.</p>
<p>The same expectations apply to a claimed sub as to your own scheduled session. Show up, open the room, hold the space.</p>
<h2>Etiquette</h2>
<p>A few things that help the system work:</p>
<ul>
<li><strong>Don't request a sub for something that hasn't been scheduled yet.</strong> If you know you can't host a future session, tell the host coordinator during the rotation review rather than letting an assignment get made and then sub-requested.</li>
<li><strong>Don't ghost.</strong> If you can't make it and didn't request a sub in time, message the host coordinator directly. The session won't have a host otherwise.</li>
<li><strong>Cover when you can.</strong> A team where every sub request gets claimed quickly is a team where every host trusts the system. Picking up an occasional sub when you have the bandwidth is part of how the trust gets built.</li>
</ul>
<h2>When the system feels stuck</h2>
<p>If you've requested a sub and no one has claimed it, message the host coordinator. If you're trying to claim a sub and the action isn't working, message the host coordinator. The schedule is a working tool — when something is off, the coordinator wants to know.</p>`;

const DISRUPTION_RESPONSE = `<p>Most sessions never need this document. But you should know what to do, so the rare moment doesn't catch you off guard. The "Stewardship Practices" document covers the relational frame; this document covers what the controls actually do.</p>
<h2>The principle</h2>
<p>Least-intrusive-response. Do as little as the situation actually requires. Escalate only when the smaller response wasn't enough. The teacher or facilitator may notice and respond too — if they do, follow their lead. If they don't, you act.</p>
<h2>The controls</h2>
<p>Inside the session room, the host has a small set of controls that ordinary participants don't:</p>
<p><strong>Mute a participant.</strong> In the participants panel, click Mute next to someone's name. Their microphone is silenced; they can unmute themselves.</p>
<p><strong>Mute All.</strong> A button in the page header. Mutes every non-host at once. Useful when the room itself becomes noisy or when a coordinated disruption begins. Participants can unmute themselves afterward.</p>
<p><strong>End for All.</strong> Also in the page header. Closes the session for everyone. Reserve for genuine emergencies — multiple disruptors, a coordinated attack, something the room can't recover from.</p>
<h2>The gradient</h2>
<p>Most low-level issues don't need the full toolkit. The order of response is roughly:</p>
<ol>
<li><strong>Private chat message.</strong> Most issues — an open mic, a comment in chat that's edging toward inappropriate — can be handled with a private message. The participant is often unaware. A kind word fixes it.</li>
<li><strong>Mute.</strong> If the noise is disrupting practice or the participant doesn't respond to the chat, mute them.</li>
<li><strong>Verbal redirect.</strong> Rarely needed. If a participant is speaking out of turn or pulling the room off course, a brief verbal redirect can land. <em>We're going to return to the practice now. Thank you.</em></li>
<li><strong>Mute All.</strong> When the room itself becomes disruptive — multiple participants making noise, a coordinated arrival of strangers — Mute All quiets everyone at once and buys the room a moment to settle.</li>
<li><strong>End for all.</strong> The room is unsafe and can't be recovered. Close it.</li>
</ol>
<h2>Open Access sessions</h2>
<p>A handful of programs are Open Access — guests can join via a shared link without signing in. These sessions carry slightly more risk because participants aren't authenticated members. For Open Access sessions, be a little more vigilant about the participants list as members arrive. If a name looks suspicious or the participant won't engage when you reach out, you can remove preemptively.</p>
<p>If a coordinated disruption happens on an Open Access session, end the session. The link can be reset; the practice space matters more than the continuity of one occurrence.</p>
<h2>After</h2>
<p>Any time you end a session, or any time something difficult happens in the room, tell the host coordinator afterward. A short message is fine — what happened, what you did, anything you'd want the team to know. The point isn't a report; the point is that the team learns and you don't carry it alone.</p>
<p>If the moment was genuinely difficult — harassment that landed on you personally, a frightening situation, a participant who clearly came to disrupt — the host coordinator will follow up. You're not expected to keep going as if it didn't happen.</p>`;

const COORDINATOR_PLAYBOOK = `<p>This document is for the host coordinator. The host team's day-to-day is mostly self-organizing through the Host Schedule and the sub system, but a few things land specifically with you. This document covers them.</p>
<h2>Your work, in shape</h2>
<p>Three rough buckets:</p>
<p><strong>Tending the team.</strong> Keeping hosts oriented, supported, and able to do the work. Catching when someone's struggling. Welcoming new hosts when they join. Holding the relational thread that the team itself is built on.</p>
<p><strong>Tending the schedule.</strong> Setting up rotations, making sure assignments are filled, intervening when sub requests don't get claimed, adjusting when someone's availability changes.</p>
<p><strong>Tending the boundary.</strong> Knowing when something needs to escalate to Jesse. Knowing when a host needs to be paused. Knowing when a difficult moment from a session needs follow-up beyond what a host can do.</p>
<p>The tools below support all three.</p>
<h2>The Host Schedule</h2>
<p>The Host Schedule is at <strong>/tools/schedule</strong>. You'll see the calendar of upcoming sessions, the host or hosts assigned to each, and any open sub requests.</p>
<p>Most of what you do here is light: glance at the next two weeks, check that everything is covered, see if any sub requests are sitting unclaimed. If a sub request has been open for more than a day without a claim, reach out to specific hosts who you know might be available.</p>
<h2>Rotations</h2>
<p>The Rotations tab is for setting up the standing assignments — the recurring "Sarah takes the Monday 6:30am for the next three months" pattern. Open the tab, pick a program, set the slots, and apply.</p>
<p>When you apply rotations, the system creates the host assignments forward through the end of the rotation horizon. You don't need to assign each session individually. If a particular week needs to differ from the standing pattern, edit that week's assignment directly in the schedule.</p>
<p>Re-run rotations when:</p>
<ul>
<li>A host's availability changes for the foreseeable future.</li>
<li>A new host is ready to take a regular slot.</li>
<li>A program's recurring schedule changes.</li>
<li>A host steps back from a regular assignment.</li>
</ul>
<p>The rotation horizon defaults to end-of-year. If you need it shorter or longer, set it explicitly when you apply.</p>
<h2>Pausing a host</h2>
<p>Sometimes a host needs to step back without leaving the team. They're traveling. They're in a hard period of life. They've been pushing too hard and need a season off. The system supports this without removing them from the team or sending them through onboarding again.</p>
<p>In the host hub members tab, find the host and pause them. While paused, they:</p>
<ul>
<li>Stay in the team and continue to see the schedule.</li>
<li>Don't appear as eligible for new assignments.</li>
<li>Don't receive the team's working notifications.</li>
<li>Can be unpaused when they're ready to return.</li>
</ul>
<p>If the paused host has upcoming assignments at the time you pause, the system will warn you and ask whether to release those assignments back to the team. Usually you do. Confirm to release.</p>
<p>The pause-related coordinator-only fields:</p>
<ul>
<li><strong>Pause note</strong> — short reason for your records. Not visible to the host.</li>
<li><strong>Coordinator note</strong> — broader notes about the host's situation, also coordinator-only.</li>
</ul>
<p>These notes are for you, not for the host. They help you remember context across months.</p>
<h2>Onboarding a new host</h2>
<p>When a new host arrives — usually because Jesse or you have invited them — the path is:</p>
<ol>
<li>Confirm their HOST role is set in the admin. (Jesse handles this.)</li>
<li>They land in the host hub on first visit and see the welcome interstitial.</li>
<li>They read the Onboarding documents and the Host Role / Stewardship docs.</li>
<li>You schedule a shadowing session — they observe an experienced host run a session.</li>
<li>Optionally, a co-host session — they support an experienced host before hosting solo.</li>
<li>Their first solo assignment lands on the schedule.</li>
</ol>
<p>The shadowing and co-hosting steps don't have a formal flow in the system yet. Coordinate by message and add a note on the host's record (the coordinator note).</p>
<h2>When to escalate to Jesse</h2>
<p>Most situations stay with you. Bring Jesse in when:</p>
<ul>
<li>A participant in a session was in apparent crisis or shared something that needs pastoral follow-up.</li>
<li>A host has a sustained pattern of difficulty (not a single hard session — a pattern).</li>
<li>An incident in a session needs broader RIM response (harassment that names a person, a public-facing situation, anything legal-feeling).</li>
<li>A structural problem in how hosting works needs design attention.</li>
</ul>
<p>You're not gatekeeping; you're filtering. Jesse trusts your read. When in doubt, send a brief message and let him decide whether to pick it up.</p>
<h2>Monthly rhythm</h2>
<p>A loose monthly check-in helps the team stay oriented:</p>
<ul>
<li>Glance at the schedule for the next month — gaps, sub-request pile-ups, hosts on too many sessions.</li>
<li>Check in with new hosts who are within their first three months.</li>
<li>Note any hosts who haven't been heard from in a while.</li>
<li>Update rotations if the pattern has drifted.</li>
<li>Send the team a short note of appreciation. It doesn't have to be elaborate.</li>
</ul>
<p>This isn't required. It's just the cadence that tends to keep things from accumulating.</p>
<h2>The work itself</h2>
<p>The coordinator role is mostly quiet. When it's working well, you're not doing much — the schedule fills, the sub requests get claimed, the hosts hold the rooms, and the practice lands. When it's not working well, you're the one who notices first and reaches in. The skill is mostly attention and a low threshold for asking how someone's doing.</p>
<p>You're not alone in this either. Jesse's at hand. The hosts are with you. The work is shared all the way down.</p>`;

const DOCS = [
  {
    label: "Host Role",
    description: "What hosting at RIM is, what we ask of you, and what we hold for you.",
    category: "The Practice of Hosting",
    body: HOST_ROLE,
  },
  {
    label: "Stewardship Practices",
    description: "The relational dimension of hosting — welcoming, redirecting, escalation, boundaries.",
    category: "The Practice of Hosting",
    body: STEWARDSHIP_PRACTICES,
  },
  {
    label: "Quick Start",
    description: "Running a session from the moment you sit down to the moment you close it.",
    category: "Running a Session",
    body: QUICK_START,
  },
  {
    label: "Sub Coverage",
    description: "How sub requests work — when to ask, when to claim, etiquette.",
    category: "Running a Session",
    body: SUB_COVERAGE,
  },
  {
    label: "Disruption Response",
    description: "What the host controls do, the gradient of response, and what to do after.",
    category: "When Things Go Wrong",
    body: DISRUPTION_RESPONSE,
  },
  {
    label: "Coordinator Playbook",
    description: "The coordinator's bookshelf — Rotations, pausing, onboarding, escalation, monthly rhythm.",
    category: "For Coordinators",
    body: COORDINATOR_PLAYBOOK,
  },
];

const NEW_CATEGORIES = [
  "The Practice of Hosting",
  "Running a Session",
  "When Things Go Wrong",
  "For Coordinators",
];

export async function seedHostHubTeamDocs(db) {
  const hub = await db.hub.findUnique({
    where: { slug: "host-team" },
    select: { id: true, documentCategories: true },
  });
  if (!hub) {
    console.log("  ⚠ host-team hub not found — skipping team docs seed");
    return;
  }

  // Find an author. Prefer the hub's first coordinator; fall back to first ADMIN.
  let authorId = null;
  const coordinator = await db.hubMember.findFirst({
    where: { hubId: hub.id, isCoordinator: true, status: "ACTIVE" },
    select: { userId: true },
    orderBy: { joinedAt: "asc" },
  });
  if (coordinator) {
    authorId = coordinator.userId;
  } else {
    const admin = await db.user.findFirst({
      where: { roles: { has: "ADMIN" } },
      select: { id: true },
      orderBy: { createdAt: "asc" },
    });
    if (admin) authorId = admin.id;
  }
  if (!authorId) {
    console.log("  ⚠ No coordinator or ADMIN user found — skipping team docs seed");
    return;
  }

  // Add any missing categories to the hub. Order is preserved.
  const existing = hub.documentCategories ?? [];
  const toAdd = NEW_CATEGORIES.filter(c => !existing.includes(c));
  if (toAdd.length > 0) {
    await db.hub.update({
      where: { id: hub.id },
      data: { documentCategories: { set: [...existing, ...toAdd] } },
    });
  }

  let created = 0;
  let updated = 0;
  for (const d of DOCS) {
    const found = await db.hubDocument.findFirst({
      where: { hubId: hub.id, label: d.label },
      select: { id: true },
    });
    if (found) {
      await db.hubDocument.update({
        where: { id: found.id },
        data: {
          description: d.description,
          category: d.category,
          body: d.body,
          isNative: true,
          fileType: "DOC",
          url: null,
        },
      });
      updated++;
    } else {
      await db.hubDocument.create({
        data: {
          hubId: hub.id,
          addedById: authorId,
          label: d.label,
          description: d.description,
          category: d.category,
          body: d.body,
          isNative: true,
          fileType: "DOC",
          url: null,
        },
      });
      created++;
    }
  }

  console.log(`  ✔ Host hub team docs (${created} created, ${updated} updated)`);
}
