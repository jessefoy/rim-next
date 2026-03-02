import { db } from "@/lib/db";
import { sanityClient } from "@/lib/sanity";
import { registrationFieldsBySlugQuery } from "@/lib/queries";
import UpdateForm from "@/components/UpdateForm";

interface PageProps {
  params: Promise<{ token: string }>;
}

export const metadata = { title: "Update Your Responses — Rooted In Mindfulness" };

// ─── Field definition from Sanity ────────────────────────────────────────────

export interface RegistrationField {
  _key: string;
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

  // Fetch program's field definitions from Sanity
  const programData = await sanityClient.fetch<{ registrationFields?: RegistrationField[] } | null>(
    registrationFieldsBySlugQuery,
    { slug: registration.programSlug }
  );
  const fields: RegistrationField[] = programData?.registrationFields ?? [];

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
          currentCustomFields={(registration.customFields as Record<string, string>) ?? {}}
          currentComments={registration.comments ?? ""}
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
