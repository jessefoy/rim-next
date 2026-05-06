/**
 * update-manual-host-session-room.mjs — The Session Room chapter (new).
 *
 * Audience: hosts running a session. Walks through the host's experience
 * inside RIM's video room — joining, what's on screen, the host
 * controls, nonverbal signals, member photos, Open Access notes, and
 * what to do when something looks weird.
 *
 * Avoids product names — no LiveKit, no RIMConference, no Zoom. The room
 * is "the session room."
 *
 * Voice: 8th-grade reading level, plain language, supportive in tone,
 * no model names or system jargon. Same spirit as the other chapters.
 *
 * Body is a plain HTML string (post-Tiptap canonical format).
 * Idempotent at the record level. Wired into migrate.mjs with a v1 flag.
 */

const SESSION_ROOM_BODY = `<p>The session room is where RIM's online sessions happen. Hosts open it, members join, the teacher leads, and practice unfolds. As a host, you're the first one in and the last one out — opening the room steady so everyone else can settle.</p>
<p>This chapter walks through what the room looks like, what your host controls do, and the few things that might trip you up.</p>
<h2>Joining as a host</h2>
<p>Sign in to RIM. Open your dashboard or the Host Schedule, find the session you're hosting, and click into it. You'll arrive in the room as the host — the system recognizes you because of how you signed in.</p>
<p>Your browser will ask permission to use your camera and microphone. Click <strong>Allow</strong>. If you don't see the prompt, look for a small icon in the address bar that lets you grant permission.</p>
<p>Most laptops and phones work fine. If you're using something unusual, test ahead of time during a quiet moment so you're not figuring it out at start time.</p>
<h2>What you see when you arrive</h2>
<p>The first time you join, here's what's there:</p>
<ul>
<li><strong>Tiles</strong> — one for each person in the room, with their name. As participants join, more tiles appear. You see your own tile too.</li>
<li><strong>Your camera and microphone controls</strong> at the bottom — turn them on or off. You arrive with both on by default.</li>
<li><strong>A chat panel</strong> — usually a button on the side or bottom that opens a conversation panel. Use it for typing notes to the room or to specific people.</li>
<li><strong>Host controls</strong> — a participants panel where you can mute people, remove them, or end the session for everyone. Members don't see these.</li>
</ul>
<p>If your browser asks for permission to play audio, click yes. Some browsers (especially Safari) require this once per session.</p>
<h2>During the session</h2>
<p>For most of the session, you don't do much. You're holding the room — present, attentive, available — while the teacher teaches.</p>
<p>Keep an eye on:</p>
<ul>
<li><strong>Background noise.</strong> If someone's microphone is picking up loud sounds during practice, mute them. They can unmute themselves when they want to speak.</li>
<li><strong>The chat.</strong> People may write questions or quietly say they're having technical trouble.</li>
<li><strong>Raised hands.</strong> If someone raises a hand, the system shows a banner so you don't miss it. Either acknowledge them, point it out to the teacher, or use your judgment.</li>
</ul>
<p>That's the work. You don't have to fill the silence. The room being steady is the help.</p>
<h2>The host controls — what they do</h2>
<p>You have controls that ordinary participants don't. The participants panel shows everyone in the room with a small menu next to each name.</p>
<p><strong>Mute a participant.</strong> Use this when a microphone is leaking noise. The participant can unmute themselves.</p>
<p><strong>Disable a participant's camera.</strong> Rarely needed. Use when video is itself disruptive — a strange screen, an unexpected scene, a participant who isn't aware their camera is on.</p>
<p><strong>Pin a participant.</strong> Pinning makes one person fill more of the screen — a "focus" view. Useful when the teacher is leading and you want their tile bigger, or when one participant is responding to something and the room should see them clearly.</p>
<p><strong>Mute all.</strong> Mutes every non-host at once. Useful when the room itself becomes noisy, or as a fast first move during a coordinated disruption.</p>
<p><strong>Remove a participant.</strong> Ejects someone from the session. They can't rejoin. Use this only when someone is hostile, harassing, or genuinely disruptive — the room matters more than any single participant.</p>
<p><strong>End for all.</strong> Closes the session for everyone. Reserve for emergencies — multiple disruptors, a coordinated attack, a situation the room can't recover from.</p>
<p>The Disruption Response document in the Host Hub Documents tab covers <em>when</em> to use each one. This chapter is about what they are.</p>
<h2>Nonverbal signals</h2>
<p>Members can use nonverbal signals to indicate something without speaking — a raised hand, a heart for thanks, a folded-hands gratitude, a check for "yes," an x for "no." When someone uses one, a small symbol appears on their tile.</p>
<p>The raised hand also shows as a banner across the top so you don't miss it. You don't have to respond immediately, but you should know it's there.</p>
<h2>Member photos</h2>
<p>When members upload a photo to their profile, it appears in the room when their camera is off — a small image instead of a blank tile. It encourages a sense of being seen even when video isn't on.</p>
<h2>Open Access sessions</h2>
<p>A few RIM programs are Open Access — guests can join via a shared link without signing in. They appear as named guests in the room.</p>
<p>These sessions carry slightly more risk because the participants aren't authenticated members. Be a little more attentive to the participants list as people arrive. If a name looks odd or someone won't engage when you reach out, you can remove them preemptively.</p>
<p>If a coordinated disruption ever happens on an Open Access session, end the session. The link can be reset; the practice space matters more than continuing one occurrence.</p>
<h2>When something looks weird</h2>
<p>Sometimes the room misbehaves. A participant's audio is silent. A camera won't connect. You disconnect briefly and have to rejoin.</p>
<p>The first move is almost always <strong>refresh the page</strong>. Most issues clear up. If they don't:</p>
<ul>
<li>Try a different browser (Chrome and Edge are most reliable; Safari is fine on Mac too).</li>
<li>Restart your camera or microphone by clicking the icons off and back on.</li>
<li>Rejoin the session if you've fully disconnected.</li>
</ul>
<p>If the issue keeps coming back across sessions, message the host coordinator afterward — recurring problems are signals worth flagging.</p>
<h2>Ending the session</h2>
<p>When the teacher finishes, stay available for a brief moment in case someone has a question or needs help leaving. Then end the session.</p>
<p>You can leave the session yourself, or click <strong>End for all</strong> to close the room for everyone. Either way, the session is done.</p>
<p>If something notable happened — a disruption, a participant in distress, a recurring technical issue — message the host coordinator afterward. Brief is fine. The team learns when these get reported.</p>`;

export async function updateManualHostSessionRoom(db) {
  const existing = await db.manualSection.findUnique({
    where: { slug: "host-session-room" },
    select: { id: true },
  });

  const data = {
    title: "The Session Room",
    description: "What hosts see when they open the room — controls, nonverbal signals, raised hands, and what to do when something misbehaves.",
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
    // Order 9 places it after host-rotations (order 8) in the host-team
    // chapter cluster.
    await db.manualSection.create({
      data: { slug: "host-session-room", order: 9, ...data },
    });
    console.log("  ✔ Created manual section: host-session-room");
  }
}
