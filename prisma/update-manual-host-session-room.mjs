/**
 * update-manual-host-session-room.mjs — The Session Room chapter.
 *
 * Audience: hosts running a virtual session. Walks through the full
 * host experience: the twelve-minute pre-session window, joining,
 * what's on screen, host vs. co-host controls, Step in as Host,
 * nonverbal signals, member photos, Open Access, and what to do
 * when something misbehaves.
 *
 * v6 additions over v5 (session 124, 2026-05-25):
 *   - Three role pills: Host / Teacher / Co-host (was a single Host badge)
 *   - "Who can do what" rewritten — any active host-team member is now
 *     automatically a Co-host (Zoom-style); plain HOST role no longer
 *     requires Step-In to gain mute / share / Bell mode capabilities
 *   - Bell mode caveat — the bell-cleanup is only fully effective when
 *     the person ringing is on the teacher audio profile (i.e. listed
 *     as a ProgramTeacher for that program); for other hosts the
 *     browser's own noise filter still runs upstream of Bell mode
 *
 * v5 additions over v4 (session 122, 2026-05-20):
 *   - "Headphones are recommended" practical note under Getting into the room
 *   - Bell mode section — the small bell button in the control bar that
 *     turns off the background noise cleanup so bells, bowls, and gongs
 *     come through with their full tone preserved
 *
 * v4 additions over v3 (session 121, 2026-05-24):
 *   - Three-tier permission model (Session Host vs. Co-host vs. Participant)
 *   - Hover-mute affordance on any tile
 *   - Chrome is always visible (auto-hide on idle was removed)
 *   - Share Screen is Session-Host-only
 *   - End for All is Session-Host-only (Co-hosts see "Leave" only)
 *   - The ten-minute early-open window for the assigned host and teacher
 *
 * v3 additions over v2:
 *   - The twelve-minute pre-session section (relational dimension)
 *   - Step in as Host section
 *   - Fullscreen and clearer navigation paths
 *
 * Avoids product names. The room is always "the session room."
 * Voice: 8th-grade reading level, plain language, warm and practical.
 * Body is a plain HTML string (post-Tiptap canonical format).
 */

const SESSION_ROOM_BODY = `<p>The session room is where RIM's online sessions happen. As a host, you're the first one in and the last one out — opening the space and holding it steady so practice can unfold. This chapter covers everything from arriving early through closing the room when it's done.</p>

<h2>The twelve minutes before</h2>
<p>Plan to join the room twelve minutes before the session starts. This isn't waiting around. It's the most important part of hosting.</p>
<p>As participants filter in, they find someone already there. A familiar presence, or a warm stranger. Greet people as they arrive. If you see a name you don't recognize, welcome them — they may be joining RIM for the first time. Let conversation happen naturally. Ask how someone's doing. You don't need an agenda. The room being settled and welcoming <em>is</em> the agenda.</p>
<p>This is the relational dimension of the role. It's not less important than the technical side — it's equally important. Presence fosters presence. The room you hold at the start is the room the teacher inherits.</p>
<p>Technically there's nothing to configure. The room is simply open. Your job is to be there, in it, attending.</p>

<h2>Your room opens early</h2>
<p>The assigned host and the teacher can enter the session room <strong>ten minutes before everyone else</strong>. On your dashboard, your row turns teal and reads <strong>"Open early as host"</strong> with an <strong>Enter as host</strong> button — twenty-two minutes before the session start, instead of the normal twelve. This gives you a quiet window to check your camera and audio, settle yourself, and be in the room before the first participant arrives.</p>
<p>Once the regular join window opens at twelve minutes before start, your row collapses into the standard "Live Now" view that everyone sees — same row, same button. You're already in by then.</p>
<p>This early access is a quiet affordance. There's no notification and no separate flow — just a button on your dashboard at the right moment. If you forget and join at the regular time, nothing breaks; you simply use the twelve-minute window like everyone else.</p>

<h2>Getting into the room</h2>
<p>Sign in to your RIM account. From the Host Schedule, find the session card you're hosting and click <strong>Join session</strong>. You can also join from the dashboard's <strong>Enter as host</strong> button (early window) or <strong>Join now</strong> button (regular live window).</p>
<p>Your browser will ask permission to use your camera and microphone. Click <strong>Allow</strong>. If you don't see the prompt, look for a small camera or lock icon in your browser's address bar — clicking it lets you grant permission.</p>
<p>You arrive as host automatically because the system recognizes you from how you signed in. No special code or link is needed.</p>
<p>If you haven't tested your setup recently, join the room during a quiet moment before a live session — check that your camera and audio work, then leave. Better to find a problem then than at start time.</p>
<p><strong>Headphones are recommended.</strong> Without headphones, your speakers can broadcast other people's voices back into your microphone — which is why a participant occasionally hears their own voice come back through someone else's connection. It's not a hard requirement, but if you can use headphones, do. Encourage participants who report echo or audio strangeness to try headphones as the first step.</p>

<h2>What you see when you arrive</h2>
<p>The session room is a full-page video space with a dark header strip across the top and a control bar across the bottom. Both stay visible the whole time — they don't fade out.</p>
<p>Reading across the top header:</p>
<ul>
<li>The <strong>program name</strong>, centered.</li>
<li><strong>Speaker / Gallery view</strong> — switches between a single large speaker tile and the full grid.</li>
<li><strong>Fullscreen</strong> — expands the session room to fill your whole screen. Press Escape or click the button again to exit.</li>
<li><strong>?</strong> — opens this chapter in a new tab.</li>
</ul>
<p>The bottom control bar holds every action button. Reading left to right:</p>
<ul>
<li><strong>Mute</strong> and <strong>Start Video</strong> — toggle your own mic and camera. The small chevrons next to each open a device picker (pick a different mic, camera, or speaker).</li>
<li><strong>Participants</strong> — opens a side panel listing everyone in the room.</li>
<li><strong>Chat</strong> — opens a chat sidebar. Send messages to the whole room or to a specific person.</li>
<li><strong>Share Screen</strong> — appears only if you're the assigned host or the teacher. Regular participants can't share their screen.</li>
<li><strong>Reactions</strong> — opens the nonverbal signal popup (raise hand, heart, gratitude, yes, no).</li>
<li><strong>Settings</strong> — opens audio, video, and presence-photo settings.</li>
<li><strong>End</strong> (red, far right) — opens a small menu with two items if you're the assigned host (<strong>End Meeting for All</strong> and <strong>Leave Meeting</strong>) or just one if you're not (<strong>Leave Meeting</strong>).</li>
</ul>
<p>In the main area:</p>
<ul>
<li><strong>Tiles</strong> — one per person in the room, with their name. Yours is there too.</li>
<li><strong>Role pills</strong> — small colored labels next to a person's name on their tile (and in the Participants panel) so everyone can see who's holding what role. There are three: <strong>Host</strong> (teal — the assigned host of this specific session), <strong>Teacher</strong> (warm gold — anyone listed as a teacher of this program), and <strong>Co-host</strong> (muted gray — anyone on the host team who is helping run the room but isn't the assigned host or a teacher). A person who is both the assigned host and a teacher of the program shows both Host and Teacher pills side by side. Regular participants don't show any pill.</li>
<li><strong>Active speaker outline</strong> — a yellow border appears around the tile of whoever is currently speaking.</li>
</ul>
<p>If your browser asks for permission to play audio — a full-screen prompt that blocks the view — click yes. Some browsers, especially Safari, require this once each session. It's normal.</p>

<h2>Who can do what</h2>
<p>The session room has three permission levels, not just "host" and "everyone else." Knowing which level you're at tells you which buttons you'll see.</p>
<p><strong>The assigned host</strong> (you, on the day you're scheduled) and any RIM admin can do everything: mute people, share the screen, end the session for everyone. The "Host" pill marks this person.</p>
<p><strong>Co-hosts</strong> are everyone else who's on the host team. If you're an active member of the Host Hub, you're a Co-host automatically — you can mute people, share the screen, toggle Bell mode, and manage the participant list. The teacher of the program is also a Co-host. <strong>Co-hosts cannot end the session for everyone.</strong> That stays with the assigned host. This is intentional: only one person is the steward of the room at any moment, and the End button respects that. The "Teacher" pill marks the program's teacher; the "Co-host" pill marks every other active host-team member who joins. (If you're both the assigned host and a teacher, you'll show both Host and Teacher pills side by side; the Co-host pill is replaced by whichever of the higher pills applies.)</p>
<p><strong>Everyone else</strong> — regular participants — can mute themselves, turn their own camera on or off, react, and chat. They don't see Share Screen, Mute All, or End for All at all. There's no temptation to click something they shouldn't.</p>
<p>If multiple host-team members join together to test, only one of them is the assigned host at any moment — the others see "Leave Meeting" where the assigned host sees "End Meeting for All," and they show the Co-host pill while the assigned host shows the Host pill. This is by design.</p>

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
<p>There are two ways to mute a participant, plus a Mute All for the whole room.</p>
<p><strong>Mute one person — from their tile.</strong> Hover over any participant's tile with your mouse. A small red <strong>Mute</strong> button appears in the top-right corner. Click it and their audio is silenced. They can unmute themselves whenever they want to speak. If they're already muted, the same spot shows a "Muted" pill instead. This is the fastest way during a session — you don't have to open a panel.</p>
<p><strong>Mute one person — from the participants panel.</strong> Open the Participants panel from the bottom control bar. Each row has a Mute button next to it. Same effect as hovering the tile. Use whichever feels more natural.</p>
<p><strong>Mute All.</strong> In the participants panel footer. Mutes every non-host at once. Use it when background noise is coming from multiple places and individual muting isn't practical, or when you need everyone quiet immediately. It's a blunt instrument — use it purposefully.</p>
<p><strong>End for All.</strong> The red End button in the bottom-right of the control bar. If you're the assigned host, click it to open a small menu; choose "End Meeting for All" to close the room for everyone. Reserve this for genuine emergencies — a coordinated disruption, a situation the room can't recover from. A normal end to a session does not need this button. Choosing "Leave Meeting" instead exits you while the room stays open for whoever is still there.</p>
<p><strong>Pin (focus).</strong> Click any participant's tile to pin them — they fill more of the visible screen. Useful when the teacher is leading and their tile should be more prominent, or when a participant is responding and the room should see them clearly. Click the tile again to unpin.</p>
<p>The Disruption Response document in the Host Hub's Documents tab covers when to use each of these under specific circumstances. This section is about what they are.</p>

<h2>Bell mode — for bells, bowls, and gongs</h2>
<p>The session room cleans up your audio in the background so background sounds — a fan, traffic, someone typing — don't reach other people. This is on by default for everyone, every session.</p>
<p>That cleanup is good for voice but works against bells. If you ring a bell, strike a singing bowl, or sound a gong, the cleanup treats the bell tone as noise and suppresses part of its character. <strong>Bell mode</strong> is the small bell-shaped button in the bottom control bar, sitting between Settings and the red End button. Tapping it turns the cleanup off for your microphone so the full tone of the bell passes through clearly.</p>
<p>A simple rhythm:</p>
<ol>
<li>Tap <strong>Bell mode</strong>. The button gets a warm amber tint and the label changes to "Clean voice."</li>
<li>Pause for a second or two. The change reaches every listener almost instantly, but the pause itself is good practice — it lets the room settle before the bell.</li>
<li>Ring the bell. Let it decay fully.</li>
<li>Tap the button again. The amber tint goes away and the label returns to "Bell mode."</li>
</ol>
<p>The button is only visible to the assigned host and Co-hosts. Regular participants don't see it — their audio is always cleaned. The state resets every time you join a session, so you always start in clean-voice mode (cleanup on); Bell mode is a deliberate moment, not a setting you can leave on by accident.</p>
<p>If you're on a browser where the cleanup feature isn't supported, the Bell mode button won't appear at all. Your voice is going through unprocessed, the same way it would have before the cleanup was added — which is fine, just not Krisp-cleaned. This is rare; the cleanup is supported on every modern browser on Mac, Windows, iPad, and iPhone.</p>
<p><strong>One caveat for hosts who aren't program teachers.</strong> Bell mode turns off the room's added audio cleanup. But your <em>browser</em> also has its own background-noise filter, which runs first — before Bell mode even sees the audio. The browser filter is turned off automatically only for people listed as the <em>teacher</em> of the program (the Teacher pill). For everyone else, the browser filter is on by default and may still soften bells even when Bell mode is engaged. If you ring bells regularly during a program, ask Jesse to add you as a teacher of that program — the Teacher pill comes with bell-friendly capture, and Bell mode then works exactly as described. For one-off sessions where the regular host is ringing the bell, the same fix applies on the day.</p>

<h2>Step in as Host</h2>
<p>Any host-team member who joins a session they are <em>not</em> the assigned host for will see a <strong>Step in as Host</strong> button in the header. Regular participants don't see this button.</p>
<p>Clicking it makes you the assigned host for the session, granting the full control set — including End for All. The system records that you stepped in, so the assigned-host role transfers to you cleanly. Use it when:</p>
<ul>
<li>The assigned host hasn't shown up and someone needs to hold the room.</li>
<li>The host coordinator wants to step in and take over coverage mid-session.</li>
</ul>
<p>The transition is invisible to participants — no notification appears. You simply gain the controls and can use them from that point forward. If a previous host had also stepped in earlier, stepping in again transfers the role to you; the room only has one assigned host at a time.</p>
<p>If you're already the assigned host, you won't see this button. You have host controls from the moment you join.</p>

<h2>Nonverbal signals</h2>
<p>Participants can communicate without speaking — a raised hand, a heart for thanks, a folded-hands gesture of gratitude, a check for yes, an x for no. When someone uses one, a small symbol appears on their tile. The raised hand also triggers a banner at the top of the screen so it doesn't get lost in a full room.</p>
<p>You don't need to respond to every signal. Being present and aware — letting people see that you see them — is often enough.</p>

<h2>Member photos</h2>
<p>Members who have uploaded a profile photo will show that photo in their tile when their camera is off, instead of initials in a colored circle. It keeps the room feeling like a gathering of people rather than a grid of names.</p>

<h2>Open Access sessions</h2>
<p>Some programs allow guests to join via a shared link without signing in. They appear in the room under whatever name they entered on the join screen — not necessarily their real name.</p>
<p>These sessions have a slightly wider door. Be a little more attentive to who's arriving. If someone's presence feels off or they aren't engaging when you reach out, you can use the participants panel to mute them or end the session. If a coordinated disruption happens on an Open Access session, end the session. A link can be reset; the practice space matters more than finishing any one occurrence.</p>

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
<li>Click <strong>End</strong> (red button, far right of the control bar) → <strong>Leave Meeting</strong> to exit yourself. Participants stay connected and will leave on their own.</li>
<li>Or click <strong>End</strong> → <strong>End Meeting for All</strong> to close the room for everyone at once. This is the cleaner option when the session is clearly finished and only you are still there.</li>
</ul>
<p>After leaving, if anything notable happened — a disruption, a participant who seemed distressed, a technical problem that kept recurring — send a brief note to the host coordinator. A few sentences is enough. The team learns from what gets reported.</p>`;

export async function updateManualHostSessionRoom(db) {
  const existing = await db.manualSection.findUnique({
    where: { slug: "host-session-room" },
    select: { id: true },
  });

  const data = {
    title: "The Session Room",
    description: "What hosts see when they open the room — the twelve-minute welcome window, the ten-minute early-open for hosts and teachers, the three permission tiers, tile hover-mute, Bell mode for bells and bowls, Step in as Host, nonverbal signals, and what to do when something misbehaves.",
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
