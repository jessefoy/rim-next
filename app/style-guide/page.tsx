import DanaSection from "@/components/DanaSection";
import TeacherList from "@/components/TeacherList";
import MemberGate from "@/components/MemberGate";
import SeriesListItem from "@/components/SeriesListItem";
import ListRow from "@/components/ListRow";
import Link from "next/link";

export const metadata = { title: "Style Guide — Rooted In Mindfulness" };

const mockTeachers = [
  { name: "Bhikkhu Bodhi", slug: { current: "bhikkhu-bodhi" } },
  { name: "Tara Brach", slug: { current: "tara-brach" } },
];

const colors = [
  { hex: "#39607a", name: "Primary Teal",   usage: "Buttons, links, active nav" },
  { hex: "#135274", name: "Dark Blue",       usage: "Footer, button-2-copy" },
  { hex: "#ec5b21", name: "Accent Orange",   usage: "link-2, link-3, form buttons" },
  { hex: "#db1d40", name: "Donation Red",    usage: "Donate button" },
  { hex: "#1c4a36", name: "Dark Green",      usage: "button-6, accents" },
  { hex: "#080e2a", name: "Dark Text",       usage: "Headings, body copy" },
  { hex: "#fafafa", name: "Light BG",        usage: "section-10, program-details-section" },
  { hex: "#f4eeeb", name: "Beige / Cream",   usage: "breadcrumb-link, section-17" },
];

export default function StyleGuidePage() {
  return (
    <div className="sg-page">
      <div className="content-container">

        {/* ── Page header ── */}
        <div className="sg-header">
          <h1 className="sg-title">Style &amp; Component Guide</h1>
          <p className="sg-subtitle">
            Live reference for RIM&apos;s reusable components, typography, buttons, and color palette.
            Components render exactly as they appear on the site.
            Path: <code style={{ fontFamily: "monospace", fontSize: "13px", color: "#39607a" }}>/style-guide</code>
          </p>
        </div>

        {/* ══════════════════════════════════════════════════
            CUSTOM COMPONENTS
        ══════════════════════════════════════════════════ */}
        <section className="sg-section">
          <h2 className="sg-section-title">Custom Components</h2>

          {/* ── ListRow ── */}
          <div className="sg-component">
            <div className="sg-component-header">
              <code className="sg-component-name">&lt;ListRow /&gt;</code>
              <span className="sg-component-path">components/ListRow.tsx</span>
            </div>
            <p className="sg-component-desc">
              Universal list-row card used everywhere: community programs, dashboard Zoom links,
              My Library, and course lessons (via SeriesListItem). All four lists now share
              this one component. Props: <code>title</code>, <code>subtitle</code>,{" "}
              <code>note</code> (italic), <code>announcement</code>, <code>badge</code>,{" "}
              <code>href</code>, <code>buttonLabel</code> (default "Go →"),{" "}
              <code>external</code>, <code>disabled</code>.
            </p>
            <div className="sg-component-preview sg-component-preview--grey">
              {/* Programs variant */}
              <ListRow
                title="The Art of Meditation:"
                subtitle="Tuesdays | 9:30–10:30 am (CT) | In-person and Zoom"
                href="/programs/the-art-of-meditation"
                buttonLabel="Learn More"
              />
              {/* Dashboard / Zoom variant */}
              <ListRow
                title="Good Morning Silent Meditation:"
                subtitle="Monday – Friday | 6:30–7:00 am (CT) | Zoom Only"
                note="Held in Noble Silence before and during session."
                href="https://zoom.us/j/example"
                buttonLabel="Join Zoom"
                external
              />
              {/* Library variant — disabled */}
              <ListRow
                title="Glossary of Dharma Terms"
                buttonLabel="Coming Soon"
                disabled
              />
              {/* Course lesson variant */}
              <ListRow
                title="Introduction to the Handful of Leaves Model"
                badge=" 🎧"
                href="/lessons/introduction-to-the-handful-of-leaves-model"
                buttonLabel="Go →"
              />
            </div>
          </div>

          {/* ── DanaSection ── */}
          <div className="sg-component">
            <div className="sg-component-header">
              <code className="sg-component-name">&lt;DanaSection /&gt;</code>
              <span className="sg-component-path">components/DanaSection.tsx</span>
            </div>
            <p className="sg-component-desc">
              RIM generosity / dana block. No props. Always rendered at the bottom of lesson pages
              inside <code>.section-10</code>, before the trailing <code>.div-block-129</code>.
            </p>
            <div className="sg-component-preview sg-component-preview--grey">
              <DanaSection />
            </div>
          </div>

          {/* ── TeacherList — lesson ── */}
          <div className="sg-component">
            <div className="sg-component-header">
              <code className="sg-component-name">&lt;TeacherList /&gt;</code>
              <span className="sg-component-tag">variant=&quot;lesson&quot;</span>
              <span className="sg-component-path">components/TeacherList.tsx</span>
            </div>
            <p className="sg-component-desc">
              Teacher attribution rows with <code>image-11</code> photo class and "By " prefix text.
              Used on lesson pages inside <code>.content-container.centered</code> after the lesson body text.
              Photo shown when <code>bioPicture.asset.url</code> is present (mock below has no photo).
            </p>
            <div className="sg-component-preview">
              <TeacherList teachers={mockTeachers} variant="lesson" />
            </div>
          </div>

          {/* ── TeacherList — program ── */}
          <div className="sg-component">
            <div className="sg-component-header">
              <code className="sg-component-name">&lt;TeacherList /&gt;</code>
              <span className="sg-component-tag">variant=&quot;program&quot;</span>
              <span className="sg-component-path">components/TeacherList.tsx</span>
            </div>
            <p className="sg-component-desc">
              Facilitator rows with 35×35 <code>facilitator</code> photo class. No "By" prefix.
              Used on program detail pages under the "Facilitators:" heading inside
              <code>.registration-details-section</code>.
            </p>
            <div className="sg-component-preview">
              <TeacherList teachers={mockTeachers} variant="program" />
            </div>
          </div>

          {/* ── MemberGate ── */}
          <div className="sg-component">
            <div className="sg-component-header">
              <code className="sg-component-name">&lt;MemberGate /&gt;</code>
              <span className="sg-component-path">components/MemberGate.tsx</span>
            </div>
            <p className="sg-component-desc">
              Auth wall shown to logged-out visitors inside <code>.program-registration-section</code>.
              Props: <code>heading</code> (default: "Join Us"), optional <code>signedOutInstructions</code> (PortableText array).
            </p>
            <div className="sg-component-preview sg-component-preview--grey">
              <MemberGate heading="Join Us" />
            </div>
          </div>

          {/* ── SeriesListItem ── */}
          <div className="sg-component">
            <div className="sg-component-header">
              <code className="sg-component-name">&lt;SeriesListItem /&gt;</code>
              <span className="sg-component-path">components/SeriesListItem.tsx</span>
            </div>
            <p className="sg-component-desc">
              Lesson list rows inside <code>.series-list-wrapper</code> on course pages.
              Props: <code>title</code>, <code>href</code>, <code>isSectionTitle</code> (transparent header, no button),
              <code>includesAudio</code> (appends 🎧 badge). Wrap in <code>.series-list-section &gt; .series-list-wrapper</code>.
            </p>
            <div className="sg-component-preview sg-component-preview--grey">
              <div className="series-list-section">
                <div className="series-list-wrapper">
                  <SeriesListItem title="Part One: Foundations" isSectionTitle />
                  <SeriesListItem
                    title="Introduction to the Handful of Leaves Model"
                    href="/lessons/introduction-to-the-handful-of-leaves-model"
                    includesAudio
                  />
                  <SeriesListItem title="The Four Noble Truths" href="/lessons/four-noble-truths" />
                  <SeriesListItem title="Part Two: Practice" isSectionTitle />
                  <SeriesListItem
                    title="Mindfulness of Breathing"
                    href="/lessons/mindfulness-of-breathing"
                    includesAudio
                  />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ══════════════════════════════════════════════════
            TYPOGRAPHY
        ══════════════════════════════════════════════════ */}
        <section className="sg-section">
          <h2 className="sg-section-title">Typography</h2>

          <p className="sg-section-label">White headings — used on dark hero backgrounds:</p>
          <div
            className="sg-section-preview"
            style={{ background: "#080e2a", padding: "32px 32px 24px" }}
          >
            <div className="sg-type-row-dark">
              <span className="sg-type-label sg-type-label--light">.heading-9</span>
              <h1 className="heading-9" style={{ margin: 0, maxWidth: "none" }}>
                The Eightfold Path
              </h1>
            </div>
            <div className="sg-type-row-dark">
              <span className="sg-type-label sg-type-label--light">.lesson-page-heading</span>
              <h1 className="lesson-page-heading" style={{ margin: 0 }}>
                Introduction to Mindfulness
              </h1>
            </div>
          </div>

          <p className="sg-section-label" style={{ marginTop: "28px" }}>
            Standard headings — used on white / light backgrounds:
          </p>
          <div className="sg-section-preview" style={{ padding: "8px 32px 8px" }}>
            <div className="sg-type-row">
              <span className="sg-type-label">.course-title</span>
              <h1 className="course-title" style={{ margin: 0 }}>Essential Dharma Study</h1>
            </div>
            <div className="sg-type-row">
              <span className="sg-type-label">.heading-11</span>
              <h2 className="heading-11" style={{ margin: 0 }}>Section Heading</h2>
            </div>
            <div className="sg-type-row">
              <span className="sg-type-label">.heading-39</span>
              <h2 className="heading-39" style={{ margin: 0 }}>Program tagline or subheading</h2>
            </div>
            <div className="sg-type-row">
              <span className="sg-type-label">.details-header</span>
              <h3 className="details-header" style={{ margin: 0 }}>Details:</h3>
            </div>
            <div className="sg-type-row">
              <span className="sg-type-label">.course-type</span>
              <h5 className="course-type" style={{ margin: 0 }}>ONLINE STUDY AND PRACTICE</h5>
            </div>
            <div className="sg-type-row">
              <span className="sg-type-label">.event-name</span>
              <div className="event-name">The Satipaṭṭhāna Sutta</div>
            </div>
            <div className="sg-type-row">
              <span className="sg-type-label">.program-detail-item</span>
              <div className="program-detail-item">Tuesdays, 7:00–8:30pm CT · Brookfield, WI</div>
            </div>
            <div className="sg-type-row">
              <span className="sg-type-label">.text-block-53 (lesson label)</span>
              <div className="text-block-53">Learning &amp; Practice</div>
            </div>
            <div className="sg-type-row">
              <span className="sg-type-label">.text-block-58 (breadcrumb text)</span>
              <div className="text-block-58">Community Programs</div>
            </div>
          </div>
        </section>

        {/* ══════════════════════════════════════════════════
            BUTTONS
        ══════════════════════════════════════════════════ */}
        <section className="sg-section">
          <h2 className="sg-section-title">Buttons</h2>
          <div className="sg-button-grid">
            <div className="sg-button-item">
              <span className="sg-button-label">.button-2</span>
              <a href="#" className="button-2 w-button">Become a Member</a>
            </div>
            <div className="sg-button-item">
              <span className="sg-button-label">.button-2._20px-from-top.donate-red</span>
              <a href="#" className="button-2 _20px-from-top donate-red w-button">Donate Today</a>
            </div>
            <div className="sg-button-item">
              <span className="sg-button-label">.button-2-copy (course lessons)</span>
              <a href="#" className="button-2-copy w-button">Go ➞</a>
            </div>
            <div className="sg-button-item">
              <span className="sg-button-label">.button-2-white</span>
              <a href="#" className="button-2-white w-button">Learn More</a>
            </div>
            <div className="sg-button-item">
              <span className="sg-button-label">.button-4</span>
              <a href="#" className="button-4 w-button">View Program</a>
            </div>
            <div className="sg-button-item">
              <span className="sg-button-label">.button-menu (nav)</span>
              <a href="#" className="button-menu w-button">DONATE</a>
            </div>
          </div>
        </section>

        {/* ══════════════════════════════════════════════════
            BREADCRUMBS & LINKS
        ══════════════════════════════════════════════════ */}
        <section className="sg-section">
          <h2 className="sg-section-title">Breadcrumbs &amp; Links</h2>
          <div className="sg-button-grid">
            <div className="sg-button-item">
              <span className="sg-button-label">.breadcrumb-link + .text-block-58</span>
              <Link href="#" className="breadcrumb-link w-inline-block">
                <div className="text-block-58">← Community Programs</div>
              </Link>
            </div>
            <div className="sg-button-item">
              <span className="sg-button-label">.already-member-link</span>
              <Link href="#" className="already-member-link">or Login</Link>
            </div>
            <div className="sg-button-item">
              <span className="sg-button-label">.link-2 (orange underline)</span>
              <a href="#" className="link-2">Volunteer →</a>
            </div>
          </div>
        </section>

        {/* ══════════════════════════════════════════════════
            COLOR PALETTE
        ══════════════════════════════════════════════════ */}
        <section className="sg-section">
          <h2 className="sg-section-title">Color Palette</h2>
          <div className="sg-color-grid">
            {colors.map((c) => (
              <div key={c.hex} className="sg-color-swatch">
                <div className="sg-color-block" style={{ background: c.hex }} />
                <span className="sg-color-hex">{c.hex}</span>
                <span className="sg-color-name">{c.name}</span>
                <span className="sg-color-usage">{c.usage}</span>
              </div>
            ))}
          </div>
        </section>

      </div>
    </div>
  );
}
