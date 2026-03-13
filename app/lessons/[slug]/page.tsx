import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import ReactMarkdown from "react-markdown";
import DanaSection from "@/components/DanaSection";
import AudioPlayer from "@/components/AudioPlayer";

function extractText(node: React.ReactNode): string {
  if (typeof node === "string") return node;
  if (typeof node === "number") return String(node);
  if (!node) return "";
  if (Array.isArray(node)) return node.map(extractText).join("\n");
  if (typeof node === "object" && "props" in (node as unknown as Record<string, unknown>)) {
    const el = node as unknown as { props: { children?: React.ReactNode } };
    return extractText(el.props.children);
  }
  return "";
}

const markdownComponents = {
  blockquote: ({ children }: { children?: React.ReactNode }) => {
    const text = extractText(children);

    if (text.startsWith("[verse]")) {
      const lines = text.replace("[verse]", "").trim().split("\n");
      const attribution = lines.find((l) => l.startsWith("—"));
      const quote = lines.filter((l) => !l.startsWith("—")).join("\n").trim();
      return (
        <div className="lp-verse-quote">
          <p>{quote}</p>
          {attribution && (
            <cite className="lp-verse-quote__cite">{attribution}</cite>
          )}
        </div>
      );
    }

    if (text.startsWith("[practice]")) {
      const content = text.replace("[practice]", "").trim();
      return (
        <div className="lp-callout">
          <p className="lp-callout__title">Practice Suggestion</p>
          <div className="lp-callout__content">
            <p>{content}</p>
          </div>
        </div>
      );
    }

    if (text.startsWith("[callout]")) {
      const content = text.replace("[callout]", "").trim();
      return (
        <div className="lp-callout-block">
          <p>{content}</p>
        </div>
      );
    }

    return <blockquote>{children}</blockquote>;
  },
};

export const revalidate = 60;

export async function generateStaticParams() {
  const lessons = await db.lesson.findMany({ select: { slug: true } });
  return lessons.map((l) => ({ slug: l.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const lesson = await db.lesson.findUnique({ where: { slug }, select: { titleDisplayed: true } });
  return { title: `${lesson?.titleDisplayed ?? "Lesson"} — Rooted In Mindfulness` };
}

export default async function LessonPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const lesson = await db.lesson.findUnique({ where: { slug } });
  if (!lesson) notFound();

  const hasAudio = !!lesson.audioUrl;
  const hasQuote = !!lesson.headerQuote;
  const resources = (lesson.resources as { name: string; url: string; resourceType: string }[]) ?? [];
  const hasResources = resources.length > 0;
  const hasTeachers = lesson.teacherNames.length > 0;

  return (
    <div className="lp-page">

      {/* ── Header: label + title ── */}
      <header className="lp-header">
        <div className="lp-header__inner">
          <p className="lp-label">Learning &amp; Practice</p>
          <h1 className="lp-title">{lesson.titleDisplayed}</h1>
        </div>
      </header>

      {/* ── Hero image ── */}
      {lesson.heroImageUrl && (
        <div className="lp-hero-image">
          <img
            src={lesson.heroImageUrl}
            alt={lesson.heroImageAlt ?? lesson.titleDisplayed}
          />
        </div>
      )}

      {/* ── Audio player (below hero image, above content) ── */}
      {hasAudio && (
        <div className="lp-audio">
          <AudioPlayer src={lesson.audioUrl!} />
        </div>
      )}

      {/* ── Content column ── */}
      <div className="lp-content">

        {/* Pull quote — editorial style, no box. Uses <figure> not <blockquote>
            to avoid Webflow's aggressive blockquote element styles.
            Shown when no audio file is set (same conditional as before). */}
        {hasQuote && !hasAudio && (
          <figure className="lp-pullquote">
            {lesson.headerQuote}
            {lesson.quoteSource && (
              <cite className="lp-pullquote__cite">— {lesson.quoteSource}</cite>
            )}
          </figure>
        )}

        {/* Video */}
        {lesson.videoUrl && (
          <div className="lp-video">
            <iframe
              src={lesson.videoUrl}
              frameBorder="0"
              allow="autoplay; fullscreen"
              allowFullScreen
            />
          </div>
        )}

        {/* Body content (Markdown) */}
        {lesson.body && (
          <div className="lp-body">
            <ReactMarkdown components={markdownComponents}>{lesson.body}</ReactMarkdown>
          </div>
        )}

        {(hasResources || hasTeachers) && <hr className="lp-divider" />}

        {/* Downloadable resources */}
        {hasResources && (
          <div className="lp-resources">
            <p className="lp-resources__label">Downloadable Resources</p>
            {resources.map((resource, i) => (
              <div key={i} className="lp-resources__item">
                <a
                  href={resource.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="lp-resource-link"
                >
                  {resource.name}
                </a>
              </div>
            ))}
          </div>
        )}

        {/* Teachers */}
        {hasTeachers && (
          <div className="lp-teachers-simple">
            <p className="lp-resources__label">Teachers</p>
            <p>{lesson.teacherNames.join(", ")}</p>
          </div>
        )}

        {/* Dana */}
        <DanaSection />

      </div>
    </div>
  );
}
