// Adds a subscriber to Flodesk and assigns them to the configured segment.
// Requires FLODESK_API_KEY environment variable.

const SEGMENT_ID = "6340e5b00170f97cbdfc4b87";

export async function POST(request: Request) {
  const { email, first_name, last_name } = await request.json();

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
