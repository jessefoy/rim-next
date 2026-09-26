import { cookies } from "next/headers";
import { authReturnPath, authReturnFromCallback } from "@/lib/authReturn";
export const metadata = { title: "Sign In Error — Rooted In Mindfulness" };

export default async function AuthErrorPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; returnTo?: string }>;
}) {
  const { error, returnTo: requestedReturn } = await searchParams;
  const jar = await cookies();
  const callback = jar.get("__Secure-authjs.callback-url")?.value ?? jar.get("authjs.callback-url")?.value;
  const returnTo = requestedReturn === undefined ? authReturnFromCallback(callback) : authReturnPath(requestedReturn);
  const query = `returnTo=${encodeURIComponent(returnTo)}`;
  let message = "An error occurred during sign in. Please try again.";
  if (error === "Verification") {
    message = "That code is invalid or has expired. Please request a new one.";
  } else if (error === "RateLimit") {
    message =
      "You've made several sign-in attempts in a short time. Please wait a few minutes, then try again.";
  }

  return (
    /* Session 176: off the Webflow-era classes and onto pp-. The warning emoji
       is gone: RIM's copy standard says errors sound like a person, and a
       3rem glyph over a calm message was the loudest thing on the page. */
    <div className="pp-page">
      <section className="pp-hero pp-hero--flat pp-hero--short">
        <div className="rim-container pp-hero__inner">
          <p className="pp-hero__eyebrow">Members</p>
          <h1 className="pp-hero__title">We could not sign you in</h1>
          <p className="pp-hero__body">{message}</p>
        </div>
      </section>

      <section className="pp-section pp-section--last">
        <div className="rim-container">
          <div className="pp-actions">
            <a href={`/login?${query}`} className="pp-btn">
              Try again
            </a>
            <a href={`/join?${query}`} className="pp-link">
              Become a member <span aria-hidden="true">&rarr;</span>
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
