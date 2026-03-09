/**
 * /account/host — Meet Host Area
 *
 * Shows all virtual programs that have a Google Meet link assigned,
 * with the room account the host team needs to sign into for each session.
 *
 * Accessible to HOST, REGISTRAR, and ADMIN roles.
 * CSS prefix: hs-
 */

import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { sanityClient } from "@/lib/sanity";
import { hostProgramsQuery } from "@/lib/queries";
import AccountLayout from "@/components/AccountLayout";
import { buildDateLabel } from "@/lib/dateLabel";

export const metadata = { title: "Host Area — Rooted In Mindfulness" };
export const dynamic = "force-dynamic";

interface HostProgram {
  _id: string;
  name: string;
  slug: string;
  dateText?: string | null;
  startDatetime?: string | null;
  endDatetime?: string | null;
  recurrenceFreq?: string | null;
  recurrenceInterval?: number | null;
  recurrenceDays?: string[] | null;
  zoomLink: string;
  meetHostAccount?: string | null;
  dayOfWeek?: { name: string }[];
}

export default async function HostAreaPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const hasAccess = session.user.roles?.some((r) =>
    ["HOST", "REGISTRAR", "ADMIN"].includes(r)
  );
  if (!hasAccess) redirect("/account/dashboard");

  const programs = await sanityClient.fetch<HostProgram[]>(hostProgramsQuery);

  return (
    <AccountLayout>
      <div className="hs-page">
        <div className="hs-header">
          <p className="lp-label">Host Area</p>
          <h1 className="hs-header__title">Virtual Programs</h1>
          <p className="hs-header__intro">
            Every virtual program at RIM uses a dedicated Google account as its meeting room. When it&rsquo;s your turn to host, sign into the account listed below for your session — that&rsquo;s what gives you host controls when you join.
          </p>
        </div>

        <div className="hs-how-to">
          <h2 className="hs-how-to__title">How to host</h2>
          <ol className="hs-steps">
            <li>Sign into the <strong>host account</strong> listed for your program. You can add it as a secondary account in your browser — you don&rsquo;t need to log out of your own account.</li>
            <li>Click the <strong>Join link</strong> for your program. Join a few minutes before the session starts.</li>
            <li>You&rsquo;ll see a small <strong>blue shield</strong> in the bottom-right corner. That means you have host controls — mute all, remove a participant, end the meeting for everyone.</li>
            <li>When the session ends, click the red button and choose <strong>End meeting for all</strong>. Then switch back to your personal account.</li>
          </ol>
          <p className="hs-how-to__note">
            If you don&rsquo;t see the blue shield, any other volunteer in the meeting with a <code>@rootedinmindfulness.org</code> account can grant you host controls from the People panel.
          </p>
        </div>

        {programs.length === 0 ? (
          <p className="hs-empty">No virtual programs are set up yet. Once a Google Meet link is created for a program, it will appear here.</p>
        ) : (
          <div className="hs-programs">
            {programs.map((program) => {
              const dayTime = program.dateText || buildDateLabel(program) || "—";
              const hostAccount = program.meetHostAccount;

              return (
                <div key={program._id} className="hs-program">
                  <div className="hs-program__name">{program.name}</div>
                  <div className="hs-program__day">{dayTime}</div>

                  {hostAccount ? (
                    <div className="hs-program__account">
                      <span className="hs-program__account-label">Sign in as</span>
                      <span className="hs-program__account-value">{hostAccount}</span>
                    </div>
                  ) : (
                    <div className="hs-program__account hs-program__account--missing">
                      Host account not recorded — check with a registrar.
                    </div>
                  )}

                  <a
                    href={program.zoomLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hs-program__join"
                  >
                    Join on Google Meet →
                  </a>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AccountLayout>
  );
}
