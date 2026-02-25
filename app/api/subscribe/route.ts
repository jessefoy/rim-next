// Adds a subscriber to Flodesk and assigns them to the configured segment.
// Requires FLODESK_API_KEY environment variable.

const SEGMENT_ID = "6340e5b00170f97cbdfc4b87";

export async function POST(request: Request) {
  const { email, first_name, last_name } = await request.json();

  if (!email || !email.includes("@")) {
    return Response.json({ error: "A valid email address is required." }, { status: 400 });
  }

  const apiKey = process.env.FLODESK_API_KEY;
  if (!apiKey) {
    return Response.json({ error: "Server configuration error." }, { status: 500 });
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
      const err = await subRes.json().catch(() => ({}));
      return Response.json({ error: (err as any).message || "Could not add subscriber." }, { status: subRes.status });
    }

    const subscriber = await subRes.json().catch(() => ({}));
    const subscriberId = subscriber.id || encodeURIComponent(email.trim().toLowerCase());

    // Step 2: Add to segment
    const segRes = await fetch(
      `https://api.flodesk.com/v1/subscribers/${subscriberId}/segments`,
      {
        method: "POST",
        headers: {
          Authorization: auth,
          "Content-Type": "application/json",
          "User-Agent": "RIM-Website/1.0",
        },
        body: JSON.stringify({ segment_ids: [SEGMENT_ID] }),
      }
    );

    if (!segRes.ok) {
      console.warn("Segment assignment failed:", subscriberId, await segRes.text());
    }

    return Response.json({ success: true });
  } catch (err) {
    console.error("Subscribe error:", err);
    return Response.json({ error: "Server error. Please try again." }, { status: 500 });
  }
}
