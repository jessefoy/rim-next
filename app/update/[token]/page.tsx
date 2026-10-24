import { db } from "@/lib/db";
import UpdateForm from "@/components/UpdateForm";
import { answerFor, oldAnswers, questionKey } from "@/lib/registrationAnswers";

interface PageProps {
  params: Promise<{ token: string }>;
}

export const metadata = { title: "Update Your Responses - Rooted In Mindfulness" };

// ─── Field definition ────────────────────────────────────────────────────────

export interface RegistrationField {
  /** Set by the save routes (lib/registrationFields.ts); older questions may lack it. */
  _key?: string;
  label: string;
  fieldType: "shortText" | "longText" | "yesNo" | "select";
  required?: boolean;
  options?: string[];
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function UpdateResponsesPage({ params }: PageProps) {
  const { token } = await params;

  // Look up registration by edit token
  const registration = await db.registration.findUnique({
    where: { editToken: token },
  });

  // Token not found or already used (cleared)
  if (!registration) {
    return <ErrorPage message="This link has already been used or is invalid." />;
  }

  // Token expired
  if (!registration.editTokenExpiresAt || registration.editTokenExpiresAt < new Date()) {
    return <ErrorPage message="This link has expired. Please ask your registrar to send a new one." />;
  }

  // Fetch program's field definitions from Postgres
  const pgProgram = await db.program.findUnique({
    where: { slug: registration.programSlug },
    select: { registrationFields: true },
  });
  const fields: RegistrationField[] = (pgProgram?.registrationFields as RegistrationField[] | null) ?? [];
  // Their answers by question (stored by id, or by wording before ids:
  // lib/registrationAnswers.ts), and any old answers no current question has.
  const old = oldAnswers(registration.customFields, fields);
  const initialAnswers: Record<string, string> = Object.fromEntries([
    ...fields.map((f) => [questionKey(f), answerFor(registration.customFields, f)]),
    ...old.map((o) => [o.key, o.value]),
  ]);

  return (
    <main>
      <div className="ur-wrap">
        <h1 className="ur-title">Update your responses</h1>
        <p className="ur-sub">
          You&rsquo;re updating your registration responses for{" "}
          <strong>{registration.programTitle}</strong>.
        </p>
        <UpdateForm
          token={token}
          fields={fields}
          initialAnswers={initialAnswers}
          oldAnswers={old.map((o) => ({ key: o.key, label: o.label }))}
        />
      </div>
    </main>
  );
}

// ─── Error state ──────────────────────────────────────────────────────────────

function ErrorPage({ message }: { message: string }) {
  return (
    <main>
      <div className="ur-wrap">
        <h1 className="ur-title">Link unavailable</h1>
        <p className="ur-sub">{message}</p>
        <p style={{ fontSize: "15px", color: "var(--rim-text-muted)" }}>
          Questions? Contact us at{" "}
          <a href="mailto:info@rootedinmindfulness.org" style={{ color: "var(--rim-mid)" }}>
            info@rootedinmindfulness.org
          </a>
        </p>
      </div>
    </main>
  );
}
