/**
 * update-manual-host-session-room.mjs — The Session Room chapter.
 *
 * Audience: hosts running a virtual session. Walks through the full
 * host experience: the twelve-minute pre-session window, joining,
 * what's on screen, host controls (Mute All / End for All / per-
 * participant / Pin), Step in as Host, nonverbal signals, member
 * photos, Open Access, and what to do when something misbehaves.
 *
 * v3 additions over v2:
 *   - The twelve-minute pre-session section (the relational dimension
 *     of the role, from RIM_Role_Design.md — the most important thing
 *     a host does, previously unmentioned)
 *   - Step in as Host section (a distinct host-team affordance, absent
 *     in v2 despite being wired in the UI)
 *   - Fullscreen button noted in what-you-see
 *   - Host role vs. teacher role made more explicit in during-the-session
 *   - Navigation path to the session room clarified
 *
 * Avoids product names (no LiveKit, no RIMConference, no Zoom).
 * The room is always "the session room."
 *
 * Voice: 8th-grade reading level, plain language, warm and practical.
 * Same spirit as the other host manual chapters.
 *
 * Body is a plain HTML string (post-Tiptap canonical format).
 * Wired into migrate.mjs with a v3 flag.
 */

const SESSION_ROOM_BODY = `<p>The session room is where RIM's online sessions happen. As a host, you're the first one in and the last one out — opening the space and holding it steady so practice can unfold. This chapter covers everything from arriving early through closing the room when it's done.</p>

<h2>The twelve minutes before</h2>
<p>Plan to join the room twelve minutes before the session starts. This isn't waiting around. It's the most important part of hosting.</p>
<p>As participants filter in, they find someone already there. A familiar presence, or a warm stranger. Greet people as they arrive. If you see a name you don't recognize, welcome them — they may be joining RIM for the first time. Let conversation happen naturally. Ask how someone's doing. You don't need an agenda. The room being settled and welcoming <em>is</em> the agenda.</p>
<p>This is the relational dimension of the role. It's not less important than the technical side — it's equally important. Presence fosters presence. The room you hold at the start is the room the teacher inherits.</p>
<p>Technically there's nothing to configure. The room is simply open. Your job is to be there, in it, attending.</p>

<h2>Getting into the room</h2>
<p>Sign in to your RIM account. From the Host Schedule, find the session card you're hosting and click <strong>Join session</strong>. You can also join from the dashboard's Join button if your program shows one there.</p>
<p>Your browser will ask permission to use your camera and microphone. Click <strong>Allow</strong>. If you don't see the prompt, look for a small camera or lock icon in your browser's address bar — clicking it lets you grant permission.</p>
<p>You arrive as host automatically because the system recognizes you from how you signed in. No special code or link is needed.</p>
<p>If you haven't tested your setup recently, join the room during a quiet moment before a live session — check that your camera and audio work, then leave. Better to find a problem then than at start time.</p>

<h2>What you see when you arrive</h2>
<p>The session room is a full-page video space with a dark header strip across the top. Reading across the header:</p>
<ul>
<li><strong>← Leave</strong> — exits you from the room. Other participants stay connected.</li>
<li>The <strong>program name</strong>, centered.</li>
<li><strong>Mute All</strong> and <strong>End for All</strong> — your host controls. Members don't see these.</li>
<li><strong>Fullscreen</strong> — expands the session room to fill your whole screen. Optional, but it helps some hosts stay focused. Press Escape or click the button again to exit.</li>
</ul>
<p>In the main area:</p>
<ul>
<li><strong>Tiles</strong> — one per person in the room, with their name. Yours is there too. More tiles appear as participants join.</li>
<li><strong>Camera and microphone controls</strong> at the bottom — toggle them on or off any time.</li>
<li><strong>A chat panel</strong> — opens from the side. Use it for written notes to the whole room or to individual participants.</li>
<li><strong>A participants panel</strong> — lists everyone in the room and lets you mute individual participants.</li>
</ul>
<p>If your browser asks for permission to play audio — a full-screen prompt that blocks the view — click yes. Some browsers, especially Safari, require this once each session. It's normal.</p>

<h2>During the session</h2>
<p>The teacher leads the content. You hold the room. For most of the session, that means doing very little — staying present, attentive, and available.</p>
<p>Keep a background awareness of three things:</p>
<ul>
<li><strong>Background noise.</strong> If someone's microphone is picking up distracting sound during practice, mute them. They can unmute themselves when they want to speak.</li>
<li><strong>The chat.</strong> Participants may write questions, respond to the teacher, or quietly mention a technical problem. Glance at it periodically. You don't need to respond to everything immediately — but note what's there.</li>
<li><strong>Raised hands.</strong> A banner appears at the top of your screen when someone raises a hand. Notice it. Address it yourself or let the teacher know when the timing feels right.</li>
</ul>
<p>The default is presence, not activity. You don't need to fill the silence, add to what the teacher is saying, or keep the chat going. A steady, attentive host is the help. When you're uncertain whether to do something, wait. The right moment often becomes obvious.</p>

<h2>Host controls</h2>
<p>You have four controls that regular participants don't.</p>
<p><strong>Mute (individual).</strong> In the participants panel, click Mute next to any participant's name. Their audio is silenced. They can unmute themselves whenever they want to speak — you're not locking them out.</p>
<p><strong>Mute All.</strong> The button in the header. Mutes every non-host at once. Use it when background noise is coming from multiple places and individual muting isn't practical, or when you need everyone quiet immediately. It's a blunt instrument — use it purposefully.</p>
<p><strong>End for All.</strong> Also in the header. Closes the session room for everyone. Reserve this for genuine emergencies — a coordinated disruption, a situation the room can't recover from. A normal end to a session does not use this button. When you use it, the session is over for everyone.</p>
<p><strong>Pin (focus).</strong> Click any participant's tile to pin them — they fill more of the visible screen. Useful when the teacher is leading and their tile should be more prominent, or when a participant is responding and the room should see them clearly. Click the tile again to unpin.</p>
<p>The Disruption Response document in the Host Hub's Documents tab covers when to use each of these under specific circumstances. This section is about what they are.</p>

<h2>Step in as Host</h2>
<p>Any host-team member who joins a session they are <em>not</em> the assigned host for will see a <strong>Step in as Host</strong> button in the header. Regular participants don't see this button.</p>
<p>Clicking it grants you the full host control set — Mute All, End for All, and individual mutes — without any pre-assignment. Use it when:</p>
<ul>
<li>The assigned host hasn't shown up and someone needs to hold the room.</li>
<li>The host coordinator wants to step in and provide coverage mid-session.</li>
<li>A second host is joining and wants to share host responsibility with the primary host.</li>
</ul>
<p>The transition is invisible to participants — no notification appears. You simply gain the controls and can use them from that point forward.</p>
<p>If you're the assigned host, you won't see this button. You already have host controls from the moment you join.</p>

<h2>Nonverbal signals</h2>
<p>Participants can communicate without speaking — a raised hand, a heart for thanks, a folded-hands gesture of gratitude, a check for yes, an x for no. When someone uses one, a small symbol appears on their tile. The raised hand also triggers a banner at the top of the screen so it doesn't get lost in a full room.</p>
<p>You don't need to respond to every signal. Being present and aware — letting people see that you see them — is often enough.</p>

<h2>Member photos</h2>
<p>Members who have uploaded a profile photo will show that photo in their tile when their camera is off, instead of a blank rectangle. It keeps the room feeling like a gathering of people rather than a grid of names.</p>

<h2>Open Access sessions</h2>
<p>Some programs allow guests to join via a shared link without signing in. They appear in the room under whatever name they entered on the join screen — not necessarily their real name.</p>
<p>These sessions have a slightly wider door. Be a little more attentive to who's arriving. If someone's presence feels off or they aren't engaging when you reach out, you can use the participants panel to remove them. If a coordinated disruption happens on an Open Access session, end the session. A link can be reset; the practice space matters more than finishing any one occurrence.</p>

<h2>When something looks weird</h2>
<p>Technical problems happen. Handling them calmly is part of the job.</p>
<p>The first move for almost anything is <strong>refresh the page</strong>. You'll reconnect to the room and most issues clear. If that doesn't work:</p>
<ul>
<li>Try a different browser. Chrome and Edge are the most reliable. Safari works well on Mac and iPhone.</li>
<li>Click the camera or microphone icon off and back on to reset the device.</li>
<li>Leave the session and rejoin if you've fully disconnected.</li>
</ul>
<p>If a participant is having trouble, walk them through the same steps: refresh first, then try a different browser or device if that doesn't work.</p>
<p>This video system is newer than what some volunteers have used before. If something unfamiliar happens, it doesn't mean something is broken — it might just be new. Message the host coordinator afterward with what you saw. That's how the team gets better at handling the edges together.</p>

<h2>Ending the session</h2>
<p>After the teacher closes the teaching, there's usually a brief settling moment — goodbyes, a closing word, a few quiet seconds. Stay available through that. It's part of holding the room to the end.</p>
<p>When it's time to close:</p>
<ul>
<li>Click <strong>← Leave</strong> to exit yourself. Participants stay connected and will leave on their own.</li>
<li>Or click <strong>End for All</strong> to close the room for everyone at once. This is the cleaner option when the session is clearly finished.</li>
</ul>
<p>After leaving, if anything notable happened — a disruption, a participant who seemed distressed, a technical problem that kept recurring — send a brief note to the host coordinator. A few sentences is enough. The team learns from what gets reported.</p>`;

export async function updateManualHostSessionRoom(db) {
  const existing = await db.manualSection.findUnique({
    where: { slug: "host-session-room" },
    select: { id: true },
  });

  const data = {
    title: "The Session Room",
    description: "What hosts see when they open the room — the twelve-minute welcome window, controls, nonverbal signals, Step in as Host, and what to do when something misbehaves.",
    hubSlug: "host-team",
    body: SESSION_ROOM_BODY,
    relations: ["host-hub", "host-schedule"],
  };

  if (existing) {
    await db.manualSection.update({
      where: { slug: "host-session-room" },
      data,
    });
    console.log("  ✔ Updated manual section: host-session-room");
  } else {
    await db.manualSection.create({
      data: { slug: "host-session-room", order: 9, ...data },
    });
    console.log("  ✔ Created manual section: host-session-room");
  }
}
