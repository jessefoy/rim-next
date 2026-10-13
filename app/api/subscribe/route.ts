// Adds a subscriber to Flodesk and assigns them to the configured segment.
// Requires FLODESK_API_KEY environment variable.

import { looksAutomated } from "@/lib/botCheck";
import { checkRateLimit, getRequestIp } from "@/lib/rateLimit";

const SEGMENT_ID = "6340e5b00170f97cbdfc4b87";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const { email, first_name, last_name } = body as { email?: string; first_name?: string; last_name?: string };

  // Bots filled this list for a year (2026-10-13). A bot is told it worked
  // and nothing is sent to Flodesk, so it learns nothing (lib/botCheck.ts).
  if (looksAutomated(body as Record<string, unknown>)) {
    console.warn("[subscribe] automated sign-up ignored");
    return Response.json({ success: true });
  }
  // Five sign-ups an hour from one connection is more than any household.
  const ipCheck = await checkRateLimit(`subscribe-ip:${getRequestIp(request)}`, 5, 60 * 60);
  if (!ipCheck.allowed) {
    return Response.json({ error: "Please try again in a little while." }, { status: 429 });
  }

  // These strings are rendered to the visitor in the footer form, so they are
  // written in the house voice, not as system messages.
  const FALLBACK = "Something went wrong. Try again, or email us and we'll add you ourselves.";

  if (!email || !email.includes("@")) {
    return Response.json({ error: "That email address doesn't look right." }, { status: 400 });
  }

  const apiKey = process.env.FLODESK_API_KEY;
  if (!apiKey) {
    return Response.json({ error: FALLBACK }, { status: 500 });
  }

  const auth = "Basic " + Buffer.from(apiKey + ":").toString("base64");

  try {
    // Step 1: Create or update subscriber
    const subRes = await fetch("https://api.flodesk.com/v1/subscribers", {
      method: "POST",
      headers: {
        Authorization: auth,
        "Content-Type": "application/json",
        "User-Agent": "RIM-Website/1.0",
      },
      body: JSON.stringify({
        email: email.trim().toLowerCase(),
        first_name: (first_name || "").trim(),
        last_name: (last_name || "").trim(),
      }),
    });

    if (!subRes.ok) {
      // Flodesk's own message is logged for us, never shown to the visitor —
      // it is written for an API consumer, not for a person signing up.
      const err = await subRes.json().catch(() => ({}));
      console.warn("Subscribe failed:", subRes.status, (err as { message?: string }).message);
      return Response.json({ error: FALLBACK }, { status: subRes.status });
    }

    const subscriber = await subRes.json().catch(() => ({}));
    const subscriberId = encodeURIComponent(subscriber.id || email.trim().toLowerCase());

    // Step 2: Add to the newsletter segment. This endpoint only ADDS segments
    // (the create call's segment_ids isn't documented as additive for
    // existing subscribers, so it isn't used). The visitor is on the list
    // either way; a missing segment is ours to fix, so retry once and log it
    // as an error where it will be seen.
    const addToSegment = () =>
      fetch(`https://api.flodesk.com/v1/subscribers/${subscriberId}/segments`, {
        method: "POST",
        headers: {
          Authorization: auth,
          "Content-Type": "application/json",
          "User-Agent": "RIM-Website/1.0",
        },
        body: JSON.stringify({ segment_ids: [SEGMENT_ID] }),
      });
    let segRes = await addToSegment();
    if (!segRes.ok) segRes = await addToSegment();
    if (!segRes.ok) {
      console.error(
        "[subscribe] Subscriber added but NOT put in the newsletter segment:",
        subscriberId,
        segRes.status,
        await segRes.text().catch(() => ""),
      );
    }

    return Response.json({ success: true });
  } catch (err) {
    console.error("Subscribe error:", err);
    return Response.json({ error: FALLBACK }, { status: 500 });
  }
}
