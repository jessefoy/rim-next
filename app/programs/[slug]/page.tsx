import { db } from "@/lib/db";
import { auth } from "@/auth";
import Link from "next/link";
import { notFound } from "next/navigation";
import { resolveLocation } from "@/lib/locations";
import { buildDateLabel } from "@/lib/dateLabel";
import { renderContentBodyAsync } from "@/lib/renderRichContentServer";
import { isOpenlyDroppable } from "@/lib/programKind";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const program = await db.program.findUnique({ where: { slug }, select: { name: true } });
  return {
    title: program ? `${program.name} — Rooted In Mindfulness` : "Program Not Found",
  };
}

export default async function ProgramDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<{ dana?: string; session_id?: string }>;
}) {
  const { slug } = await params;
  const resolvedSearch = searchParams ? await searchParams : {};
  const [program, session] = await Promise.all([
    db.program.findUnique({
      where: { slug },
      include: {
        category: true,
        programTeachers: {
          orderBy: { order: "asc" },
          include: { user: { select: { firstName: true, lastName: true, preferredName: true, teacherProfile: { select: { slug: true } } } } },
        },
      },
    }),
    auth(),
  ]);

  if (!program || program.archivedAt) notFound();

  const useBuiltInForm = !!program.registrationEnabled;
  // When registration is OFF, the offering's KIND (session 137) decides what
  // "no registration" means: a drop-in / open community group is openly
  // droppable ("just come"), while a class / event / retreat is a commitment
  // whose registration simply isn't open yet — never "just show up."
  const droppable = isOpenlyDroppable(program.category?.kind ?? null, useBuiltInForm);
  const registrationClosed = !!(
    program.registrationClosed ||
    (program.registrationDeadline && new Date(program.registrationDeadline) < new Date())
  );

  // DB queries — only when built-in form is active
  const [activeCount, userProfile, existingRegistration] = await Promise.all([
    useBuiltInForm && program.registrationCapacity
      ? db.registration.count({
          // PENDING_PAYMENT holds a seat during checkout — count it so the shown
          // spots-remaining matches the seats actually held.
          where: { programId: program.id, status: { in: ["REGISTERED", "APPROVED", "PENDING_PAYMENT"] } },
        })
      : Promise.resolve(0),
    useBuiltInForm && session?.user?.id
      ? db.user.findUnique({
          where: { id: session.user.id },
          select: { firstName: true, lastName: true, phone: true, email: true },
        })
      : Promise.resolve(null),
    useBuiltInForm && session?.user?.id
      ? db.registration.findFirst({
          where: {
            programId: program.id,
            userId: session.user.id,
            // Exclude a held (PENDING_PAYMENT) row: a registrant mid-checkout can
            // resume via the form's reuse path rather than be told they're "already registered."
            status: { notIn: ["CANCELLED", "PENDING_PAYMENT"] },
          },
        })
      : Promise.resolve(null),
  ]);

  const spotsRemaining =
    useBuiltInForm && program.registrationCapacity
      ? Math.max(0, program.registrationCapacity - activeCount)
      : null;
  const showLowSpots = spotsRemaining !== null && spotsRemaining > 0 && spotsRemaining <= 5;

  // Resolve location from venue + programFormat
  const location = resolveLocation(program.venue, program.locationText, program.locationLink);
  const startIso = program.startDatetime?.toISOString() ?? null;
  const endIso = program.endDatetime?.toISOString() ?? null;

  // Whether registering requires payment up front (fixed / base+dana with an
  // amount). Drives the honest copy on the dana-cancelled banner: a cancelled
  // required payment means the place isn't reserved; a cancelled voluntary dana
  // leaves the registration intact.
  const requiresPaymentToRegister =
    (program.danaMode === "fixed" && (program.danaFixedAmount ?? 0) > 0) ||
    (program.danaMode === "base_plus_dana" && (program.danaBaseAmount ?? 0) > 0);

  // ── Time label (always a separate row) ──
  // Priority: manual timeText override → computed from startDatetime/endDatetime
  // Format: "9:30 AM-10:30 AM CT" — always show minutes, always show CT
  const timeLabel = program.timeText || (() => {
    if (!program.startDatetime) return null;
    const TZ = "America/Chicago";
    const fmt = (d: Date) =>
      new Intl.DateTimeFormat("en-US", {
        timeZone: TZ,
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      }).format(d);
    const start = fmt(program.startDatetime);
    if (!program.endDatetime) return `${start} CT`;
    const end = fmt(program.endDatetime);
    return `${start}-${end} CT`;
  })();

  // ── Schedule label (day/recurrence pattern, no time) ──
  const scheduleLabel = (() => {
    // Manual override → use as-is
    if (program.dateText) return program.dateText;
    // Auto-generate from recurrence fields
    const full = buildDateLabel({
      startDatetime: startIso,
      endDatetime: endIso,
      recurrenceFreq: program.recurrenceFreq,
      recurrenceInterval: program.recurrenceInterval,
      recurrenceDays: program.recurrenceDays,
    });
    if (!full) return null;
    // When showing time separately, strip the " · time" portion from auto-generated label
    if (timeLabel && full.includes(" · ")) return full.split(" · ")[0];
    return full;
  })();

  // ── Location label ──
  const locationLabel =
    program.programFormat === "virtual"
      ? `Online (${location.text || "Zoom"}) only`
      : program.programFormat === "hybrid"
        ? `${location.text || "Hybrid"} + Online`
        : location.text;
  const showLocation = !!(locationLabel);

  const hasDetails = !!(scheduleLabel || timeLabel || showLocation || program.danaText);
  // Use programTeachers (linked accounts) first, fall back to plain text
  const teacherNames = program.programTeachers.length > 0
    ? program.programTeachers.map((pt) => ({
        name: `${pt.user.preferredName || pt.user.firstName || ""} ${pt.user.lastName || ""}`.trim(),
        slug: pt.user.teacherProfile?.slug ?? null,
      }))
    : program.teacherFacilitators.map((name) => ({ name, slug: null }));
  const hasFacilitators = teacherNames.length > 0;
  const hasDescription = !!program.description;
  const descriptionHtml = hasDescription ? await renderContentBodyAsync(program.description) : "";
  const hasProgramNotes = !!program.programNotes;
  const programNotesHtml = hasProgramNotes ? await renderContentBodyAsync(program.programNotes) : "";

  return (
    <div className="pg-page">

      {/* ── Hero header ── */}
      <header
        className="pg-hero"
        style={{ backgroundImage: `url(${program.programImage || "/images/Bodhi-Leaves.jpg"})` }}
      >
        <div className="pg-hero__inner">
          {program.category && (
            <Link href="/community-programs" className="pg-hero__eyebrow">
              {program.category.name}
            </Link>
          )}
          <h1 className="pg-hero__title">{program.name}</h1>
          {program.tagline && (
            <p className="pg-hero__tagline">{program.tagline}</p>
          )}
        </div>
      </header>

      {/* ── Content column ── */}
      <div className="lp-content">

        {/* Dana result banners — shown after Stripe redirects back */}
        {resolvedSearch?.dana === "success" && (
          <div className="pg-dana-result pg-dana-result--success">
            ✓ Thank you — your dana offering has been received.
          </div>
        )}
        {resolvedSearch?.dana === "cancelled" && (
          <div className="pg-dana-result pg-dana-result--cancelled">
            {requiresPaymentToRegister
              ? "Your payment wasn’t completed, so your place isn’t reserved yet. You can register again whenever you’re ready."
              : "Your registration is confirmed. You can return anytime to complete your dana offering."}
          </div>
        )}

        {/* ── Pull quote card — floats up into hero ── */}
        {program.pullQuote && (
          <figure className="pg-quote">
            <blockquote className="pg-quote__text">{program.pullQuote}</blockquote>
            {program.pullQuoteSource && (
              <figcaption className="pg-quote__source">~ {program.pullQuoteSource}</figcaption>
            )}
          </figure>
        )}

        {/* ── Program description ── */}
        {hasDescription && (
          <div className="prog-description rim-content rim-content--program" dangerouslySetInnerHTML={{ __html: descriptionHtml }} />
        )}

        {/* ── Program notes (tan card) ──
            Heading is authored inside the rich text — don't add one here. */}
        {hasProgramNotes && (
          <section className="pg-notes">
            <div className="rim-content rim-content--program" dangerouslySetInnerHTML={{ __html: programNotesHtml }} />
          </section>
        )}

        {/* ── Details section ── */}
        {hasDetails && (
          <section className="pg-details-section">
            <h3 className="pg-section-heading">Details:</h3>
            {scheduleLabel && (
              <div className="pg-detail-row">
                <span className="pg-detail-row__icon" aria-hidden="true">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                </span>
                <span className="pg-detail-row__text">{scheduleLabel}</span>
              </div>
            )}
            {timeLabel && (
              <div className="pg-detail-row">
                <span className="pg-detail-row__icon" aria-hidden="true">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                </span>
                <span className="pg-detail-row__text">{timeLabel}</span>
              </div>
            )}
            {showLocation && (
              <div className="pg-detail-row">
                <span className="pg-detail-row__icon" aria-hidden="true">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                </span>
                <span className="pg-detail-row__text">
                  {locationLabel}
                  {location.link && (
                    <a href={location.link} target="_blank" rel="noopener noreferrer" className="pg-detail-row__link"> ↗</a>
                  )}
                </span>
              </div>
            )}
            {program.danaText && (
              <div className="pg-detail-row">
                <span className="pg-detail-row__icon" aria-hidden="true">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
                </span>
                <span className="pg-detail-row__text">{program.danaText}</span>
              </div>
            )}

            {/* ── CTA row — context-aware action ── */}
            <div className="pg-detail-row pg-detail-row--cta">
              <span className="pg-detail-row__text">
                {useBuiltInForm ? (
                  /* Registration programs — the person's OWN standing comes first,
                     so a registrant always sees their status even after registration
                     closes; then the program-level state (closed → full → open). */
                  existingRegistration?.status === "WAITLISTED" ? (
                    <span className="pg-detail-cta__text">
                      You&rsquo;re on the waitlist. <Link href={`/account/programs/${slug}`} className="pg-detail-cta__inline-link">View your details →</Link>
                    </span>
                  ) : existingRegistration ? (
                    <span className="pg-detail-cta__text">
                      ✓ You&rsquo;re registered for this program. <Link href={`/account/programs/${slug}`} className="pg-detail-cta__inline-link">View your details →</Link>
                    </span>
                  ) : registrationClosed ? (
                    <span className="pg-detail-cta__status">Registration is closed.</span>
                  ) : spotsRemaining === 0 ? (
                    <Link href={`/programs/${slug}/register`} className="pg-detail-cta__link">
                      Join the waitlist →
                    </Link>
                  ) : (
                    <Link href={`/programs/${slug}/register`} className="pg-detail-cta__link">
                      Register →
                    </Link>
                  )
                ) : droppable ? (
                  /* Openly droppable (drop-in / open community group) — how to join,
                     format-aware. */
                  program.programFormat === "virtual" ? (
                    session?.user ? (
                      <Link href="/account/dashboard" className="pg-detail-cta__link">
                        Join on Zoom from My Home →
                      </Link>
                    ) : (
                      <span className="pg-detail-cta__text">
                        Members access Zoom via their <Link href="/account/dashboard" className="pg-detail-cta__inline-link">member home</Link>
                      </span>
                    )
                  ) : program.programFormat === "hybrid" ? (
                    /* Hybrid — arrive in person OR join online */
                    session?.user ? (
                      <span className="pg-detail-cta__text">
                        Simply arrive in person · <Link href="/account/dashboard" className="pg-detail-cta__inline-link">Zoom link on My Home</Link>
                      </span>
                    ) : (
                      <span className="pg-detail-cta__text">
                        Simply arrive in person · Members join online via their <Link href="/account/dashboard" className="pg-detail-cta__inline-link">member home</Link>
                      </span>
                    )
                  ) : (
                    /* In-person only — no online option, so no Zoom reference */
                    <span className="pg-detail-cta__text">Simply arrive in person.</span>
                  )
                ) : (
                  /* A commitment (class / event / retreat / …) whose registration
                     isn't switched on yet — not a drop-in, so never "just arrive." */
                  <span className="pg-detail-cta__status">Registration isn&rsquo;t open yet.</span>
                )}
              </span>
            </div>
          </section>
        )}

        {/* ── Facilitators section ── */}
        {hasFacilitators && (
          <section className="pg-facilitators-section">
            <h3 className="pg-section-heading">Facilitators:</h3>
            <div className="pg-facilitators">
              {teacherNames.map((t, i) => (
                t.slug ? (
                  <Link key={i} href={`/teachers/${t.slug}`} className="pg-facilitator pg-facilitator--link">{t.name}</Link>
                ) : (
                  <span key={i} className="pg-facilitator">{t.name}</span>
                )
              ))}
            </div>
          </section>
        )}


      </div>
    </div>
  );
}
