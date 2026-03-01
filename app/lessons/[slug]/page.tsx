import { sanityClient } from "@/lib/sanity";
import { lessonBySlugQuery, allLessonSlugsQuery } from "@/lib/queries";
import { PortableText } from "@portabletext/react";
import { notFound } from "next/navigation";
import DanaSection from "@/components/DanaSection";
import TeacherList from "@/components/TeacherList";
import AudioPlayer from "@/components/AudioPlayer";

export const revalidate = 60;

type Lesson = {
  _id: string;
  lessonTitleDisplayed: string;
  includesAudio?: boolean;
  audioFile?: { asset?: { url: string } };
  videoLessonLink?: string;
  headerQuote?: string;
  quoteSource?: string;
  lessonContent?: unknown[];
  heroImage?: { asset?: { url: string }; alt?: string };
  teachers?: { name: string; slug: { current: string }; bioPicture?: { asset?: { url: string } } }[];
  downloadableResources?: {
    name: string;
    description?: string;
    resourceFile?: { asset?: { url: string } };
  }[];
};

export async function generateStaticParams() {
  const slugs = await sanityClient.fetch<{ slug: string }[]>(allLessonSlugsQuery);
  return slugs.filter((s) => s.slug).map((s) => ({ slug: s.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const lesson = await sanityClient.fetch<Lesson | null>(lessonBySlugQuery, { slug });
  return { title: `${lesson?.lessonTitleDisplayed ?? "Lesson"} — Rooted In Mindfulness` };
}

export default async function LessonPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const lesson = await sanityClient.fetch<Lesson | null>(lessonBySlugQuery, { slug });
  if (!lesson) notFound();

  const hasAudio = !!(lesson.includesAudio && lesson.audioFile?.asset?.url);
  const hasQuote = !!lesson.headerQuote;
  const hasResources = !!(lesson.downloadableResources && lesson.downloadableResources.length > 0);
  const hasTeachers = !!(lesson.teachers && lesson.teachers.length > 0);

  return (
    <div className="lp-page">

      {/* ── Header: label + title ── */}
      <header className="lp-header">
        <div className="lp-header__inner">
          <p className="lp-label">Learning &amp; Practice</p>
          <h1 className="lp-title">{lesson.lessonTitleDisplayed}</h1>
        </div>
      </header>

      {/* ── Hero image — only renders when an image is set in Sanity ── */}
      {lesson.heroImage?.asset?.url && (
        <div className="lp-hero-image">
          <img
            src={lesson.heroImage.asset.url}
            alt={lesson.heroImage.alt ?? lesson.lessonTitleDisplayed}
          />
        </div>
      )}

      {/* ── Audio player (below hero image, above content) ── */}
      {hasAudio && (
        <div className="lp-audio">
          <AudioPlayer src={lesson.audioFile!.asset!.url} />
        </div>
      )}

      {/* ── Content column ── */}
      <div className="lp-content">

        {/* Pull quote — editorial style, no box */}
        {hasQuote && (
          <blockquote className="lp-pullquote">
            {lesson.headerQuote}
            {lesson.quoteSource && (
              <cite className="lp-pullquote__cite">— {lesson.quoteSource}</cite>
            )}
          </blockquote>
        )}

        {/* Video */}
        {lesson.videoLessonLink && (
          <div className="lp-video">
            <iframe
              src={lesson.videoLessonLink}
              frameBorder="0"
              allow="autoplay; fullscreen"
              allowFullScreen
            />
          </div>
        )}

        {/* Body content */}
        {lesson.lessonContent && (
          <div className="lp-body">
            <PortableText
              value={lesson.lessonContent as any}
              components={{
                types: {
                  practiceCallout: ({ value }: any) => (
                    <div className="lp-callout">
                      <p className="lp-callout__title">{value.title || "Practice Suggestion"}</p>
                      {value.content && (
                        <div className="lp-callout__content">
                          <PortableText value={value.content} />
                        </div>
                      )}
                    </div>
                  ),
                  bodyQuote: ({ value }: any) => (
                    <blockquote className="lp-body-quote">
                      <p className="lp-body-quote__text">{value.quote}</p>
                      {value.attribution && (
                        <cite className="lp-body-quote__cite">— {value.attribution}</cite>
                      )}
                    </blockquote>
                  ),
                },
              }}
            />
          </div>
        )}

        {(hasResources || hasTeachers) && <hr className="lp-divider" />}

        {/* Downloadable resources */}
        {hasResources && (
          <div className="lp-resources">
            <p className="lp-resources__label">Downloadable Resources</p>
            {lesson.downloadableResources!.map((resource, i) => (
              <div key={i} className="lp-resources__item">
                {resource.resourceFile?.asset?.url && (
                  <a
                    href={resource.resourceFile.asset.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="lp-resource-link"
                  >
                    {resource.name}
                  </a>
                )}
                {resource.description && (
                  <p className="lp-resources__desc">{resource.description}</p>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Teachers */}
        {hasTeachers && (
          <TeacherList teachers={lesson.teachers!} variant="lesson" />
        )}

        {/* Dana */}
        <DanaSection />

      </div>
    </div>
  );
}
