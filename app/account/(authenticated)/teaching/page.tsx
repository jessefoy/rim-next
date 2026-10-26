import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import AccountLayout from "@/components/AccountLayout";
import { endedTaughtBy, isGuidingTeacher, programsTaughtBy, programsWithTeachers } from "@/lib/teaching";
import { programWhen } from "@/lib/registrationDesk";

export const metadata = { title: "Teaching - Rooted In Mindfulness" };
export const dynamic = "force-dynamic";

type Row = Awaited<ReturnType<typeof programsTaughtBy>>[number];

function ProgramList({ programs }: { programs: Row[] }) {
  return (
    <ul className="rim-destination-list">
      {programs.map((p) => (
        <li key={p.id}>
          <Link href={`/account/teaching/${p.slug}`}>
            <span>
              {p.name}
              {programWhen(p) && <small>{programWhen(p)}</small>}
            </span>
            <span aria-hidden="true">→</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

// Teaching (2026-10-24, Phase 3 slice 3): the programs a person teaches, each
// opening its teacher's page. The guiding teacher also sees every other
// current program with a teacher. In the menu only for those two
// (components/AccountLayout, lib/teaching.ts).
export default async function TeachingPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const userId = session.user.id;
  const guiding = isGuidingTeacher(session.user.roles);

  const [mine, ended] = await Promise.all([programsTaughtBy(userId), endedTaughtBy(userId)]);
  const others = guiding
    ? (await programsWithTeachers()).filter((p) => !mine.some((m) => m.id === p.id))
    : [];

  return (
    <AccountLayout>
      <div className="ac-member-page rim-directory">
        <header className="ac-page-head">
          <div>
            <h1 className="ac-page-title">Teaching</h1>
            {(mine.length > 0 || others.length > 0) && (
              <p className="ac-page-sub">Choose a program to see who&rsquo;s coming and what they told you.</p>
            )}
          </div>
        </header>

        {mine.length > 0 && (
          <section aria-labelledby="teaching-mine">
            {guiding && <h2 id="teaching-mine" className="rim-teams__label">Programs you teach</h2>}
            <ProgramList programs={mine} />
          </section>
        )}
        {others.length > 0 && (
          <section aria-labelledby="teaching-others">
            <h2 id="teaching-others" className="rim-teams__label">Programs you oversee</h2>
            <ProgramList programs={others} />
          </section>
        )}
        {ended.length > 0 && (
          <section aria-labelledby="teaching-ended">
            <h2 id="teaching-ended" className="rim-teams__label">Ended</h2>
            <p className="ac-page-sub">Each stays here for 30 days after it ends.</p>
            <ProgramList programs={ended} />
          </section>
        )}
        {mine.length === 0 && others.length === 0 && ended.length === 0 && (
          <section className="rim-empty" aria-labelledby="teaching-empty">
            <h2 id="teaching-empty">You aren&rsquo;t teaching a current program.</h2>
            <p>When you&rsquo;re named as a teacher of a program, it appears here.</p>
            <div className="pp-actions">
              <Link href="/account/dashboard" className="pp-btn pp-btn--ghost">Back to My Home</Link>
            </div>
          </section>
        )}
      </div>
    </AccountLayout>
  );
}
