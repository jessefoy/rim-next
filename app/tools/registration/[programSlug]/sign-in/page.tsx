/**
 * /tools/registration/[programSlug]/sign-in — a printed sign-in list
 * (2026-10-23): the registered people's names, by last name, with a box to
 * tick at the door. Names only: no contact details, answers or dana, so it can
 * sit on a table. Printing it is kept in the program's History (PrintButton,
 * on the page's print event; 2026-10-25, it was kept on every load).
 * Gate: canUseRegistration (also in the layout).
 */

import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import { db } from "@/lib/db";
import { canUseRegistration } from "@/lib/toolAuth";
import { programWhen } from "@/lib/registrationDesk";
import PrintButton from "@/components/registration/PrintButton";

export const dynamic = "force-dynamic";
export const metadata = { title: "Sign-in list - Registration" };

export default async function SignInListPage({
  params,
  searchParams,
}: {
  params: Promise<{ programSlug: string }>;
  searchParams: Promise<{ hub?: string }>;
}) {
  const { programSlug } = await params;
  const { hub } = await searchParams;
  const session = await auth();
  if (!session) redirect("/login");
  if (!canUseRegistration(session.user.roles)) notFound();

  const program = await db.program.findUnique({
    where: { slug: programSlug },
    select: {
      id: true, slug: true, name: true, dateText: true, startDatetime: true, endDatetime: true,
      recurrenceFreq: true, recurrenceInterval: true, recurrenceDays: true,
    },
  });
  if (!program) notFound();

  const people = await db.registration.findMany({
    where: { programSlug, status: { in: ["REGISTERED", "APPROVED"] } },
    select: { id: true, firstName: true, lastName: true },
  });
  const sorted = people.sort(
    (a, b) => a.lastName.localeCompare(b.lastName) || a.firstName.localeCompare(b.firstName),
  );

  const when = programWhen(program);
  const back = `/tools/registration/${program.slug}${hub ? `?hub=${encodeURIComponent(hub)}` : ""}`;

  return (
    <div className="vol-page reg-print">
      <div className="vol-content">
        <div className="reg-print__screen">
          <a href={back} className="vol-back">&larr; {program.name}</a>
          <div className="reg-actions">
            <PrintButton programSlug={program.slug} />
          </div>
        </div>
        <h1 className="vol-header__title">{program.name}</h1>
        <p className="reg-meta">
          {[when, `${sorted.length === 1 ? "1 person" : `${sorted.length} people`} registered`].filter(Boolean).join(" · ")}
        </p>
        {sorted.length === 0 ? (
          <p className="reg-quiet">No one is registered yet.</p>
        ) : (
          <table className="reg-signin">
            <thead>
              <tr>
                <th scope="col">Name</th>
                <th scope="col" className="reg-signin__here">Here</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((p) => (
                <tr key={p.id}>
                  <td>{p.lastName}, {p.firstName}</td>
                  <td className="reg-signin__here"><span className="reg-signin__box" aria-hidden="true" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
