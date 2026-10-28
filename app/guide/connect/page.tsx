import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { clientRedirectOk, issueCode, SITE_ORIGIN } from "@/lib/guideAuth";

/**
 * /guide/connect: where a volunteer lets the RIM Guide in Claude read RIM as
 * them (2026-10-27). Claude opens it to sign someone in (the OAuth
 * authorization endpoint, lib/guideAuth.ts). Signed out, it goes through
 * sign-in and comes back here (/login?next=). Allow returns a one-time code
 * to Claude; Cancel returns "denied". Nothing is changed in RIM by either.
 * Wording provisional until Jesse's read-aloud.
 */

export const metadata = { title: "Connect the RIM Guide - Rooted In Mindfulness", referrer: "no-referrer" as const };
export const dynamic = "force-dynamic";

type Ask = {
  responseType: string;
  clientId: string;
  redirectUri: string;
  codeChallenge: string;
  method: string;
  state: string;
};

function readAsk(get: (k: string) => string | undefined | null): Ask {
  return {
    responseType: get("response_type") ?? "",
    clientId: get("client_id") ?? "",
    redirectUri: get("redirect_uri") ?? "",
    codeChallenge: get("code_challenge") ?? "",
    method: get("code_challenge_method") ?? "",
    state: get("state") ?? "",
  };
}

function askIsValid(a: Ask): boolean {
  return (
    a.responseType === "code" &&
    a.method === "S256" &&
    /^[A-Za-z0-9_-]{43,128}$/.test(a.codeChallenge) &&
    a.state.length <= 2000 &&
    clientRedirectOk(a.clientId, a.redirectUri)
  );
}

/** Claude's return address with the answer added, keeping what it carries. */
function answerUrl(redirectUri: string, params: Record<string, string>): string {
  const url = new URL(redirectUri);
  for (const [k, v] of Object.entries(params)) if (v) url.searchParams.set(k, v);
  return url.toString();
}

function Shell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="pp-page pp-page--spine pp-page--column">
      <section className="pp-hero pp-hero--quiet">
        <div className="rim-container pp-hero__inner">
          <p className="pp-hero__eyebrow">RIM Guide</p>
          <h1 className="pp-hero__title">{title}</h1>
        </div>
      </section>
      <section className="pp-section pp-section--last">
        <div className="rim-container">
          <div className="pp-form">{children}</div>
        </div>
      </section>
    </div>
  );
}

export default async function GuideConnectPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = await searchParams;
  const one = (k: string) => (typeof raw[k] === "string" ? (raw[k] as string) : undefined);
  const ask = readAsk(one);

  if (!askIsValid(ask)) {
    return (
      <Shell title="This link isn't working">
        <p className="pp-form__help">
          Start again from Claude: open the RIM Guide connector there and press Connect.
        </p>
      </Shell>
    );
  }

  const session = await auth();
  if (!session?.user?.id) {
    const here = new URLSearchParams();
    for (const [k, v] of Object.entries(raw)) if (typeof v === "string") here.set(k, v);
    redirect(`/login?next=${encodeURIComponent(`/guide/connect?${here.toString()}`)}`);
  }
  if (session.user.archivedAt || !session.user.agreedToTerms) {
    return (
      <Shell title="This account can't connect the guide">
        <p className="pp-form__help">If that seems wrong, please ask Jesse.</p>
      </Shell>
    );
  }

  const from = new URL(ask.redirectUri).hostname;
  const fromWords = from === "localhost" || from === "127.0.0.1" ? "Claude Code on this computer" : from;
  const cancelHref = answerUrl(ask.redirectUri, { error: "access_denied", state: ask.state, iss: SITE_ORIGIN });

  async function allow(formData: FormData) {
    "use server";
    const a = readAsk((k) => formData.get(k) as string | null);
    const s = await auth();
    if (!askIsValid(a) || !s?.user?.id || s.user.archivedAt || !s.user.agreedToTerms) redirect("/guide/connect");
    const code = await issueCode({ userId: s.user.id, clientId: a.clientId, redirectUri: a.redirectUri, codeChallenge: a.codeChallenge });
    redirect(answerUrl(a.redirectUri, { code, state: a.state, iss: SITE_ORIGIN }));
  }

  const firstName = session.user.name ?? "";

  return (
    <Shell title="Connect the RIM Guide">
      <p className="pp-form__help lg-lead">
        Claude is asking to read RIM as you{firstName ? `, ${firstName}` : ""}. The RIM Guide will see what you see when
        you&apos;re signed in here. It can&apos;t change anything or send anything.
      </p>
      <p className="pp-form__help">
        Connecting from <strong className="lg-email">{fromWords}</strong>.
      </p>
      <form action={allow}>
        <input type="hidden" name="response_type" value={ask.responseType} />
        <input type="hidden" name="client_id" value={ask.clientId} />
        <input type="hidden" name="redirect_uri" value={ask.redirectUri} />
        <input type="hidden" name="code_challenge" value={ask.codeChallenge} />
        <input type="hidden" name="code_challenge_method" value={ask.method} />
        <input type="hidden" name="state" value={ask.state} />
        <button type="submit" className="pp-btn pp-form__submit">
          Allow
        </button>
      </form>
      <p className="lg-alt">
        <a href={cancelHref}>Cancel</a>
      </p>
    </Shell>
  );
}
