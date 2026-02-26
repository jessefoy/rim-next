import { sanityClient } from "@/lib/sanity";
import { lessonBySlugQuery, allLessonSlugsQuery } from "@/lib/queries";
import { PortableText } from "@portabletext/react";
import { notFound } from "next/navigation";
import DanaSection from "@/components/DanaSection";
import TeacherList from "@/components/TeacherList";

export const revalidate = 60;

type Lesson = {
  _id: string;
  lessonTitleDisplayed: string;
  includesAudio?: boolean;
  podcastId?: string;
  videoLessonLink?: string;
  headerQuote?: string;
  quoteSource?: string;
  lessonContent?: unknown[];
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

  const hasHeroContent =
    (lesson.includesAudio && lesson.podcastId) || !!lesson.headerQuote;

  return (
    <>
      {/* ── Hero: label + title + quote or audio overlay box ── */}
      <div className="section lesson-hero">
        <div className="container-4"></div>
        <div>
          <div className="text-block-53">Learning &amp; Practice</div>
        </div>
        <h1 className="lesson-page-heading">{lesson.lessonTitleDisplayed}</h1>

        {hasHeroContent && (
          <div className="div-block-129">
            {lesson.includesAudio && lesson.podcastId ? (
              <iframe
                src={`https://player.captivate.fm/episode/${lesson.podcastId}`}
                width="100%"
                height="200"
                frameBorder="0"
                scrolling="no"
              />
            ) : lesson.headerQuote ? (
              <div className="quote-header-container">
                <p className="block-quote-2">{lesson.headerQuote}</p>
                {lesson.quoteSource && (
                  <div className="text-block-56">— {lesson.quoteSource}</div>
                )}
              </div>
            ) : null}
          </div>
        )}

        <div className="container-4"></div>
      </div>

      {/* ── Content ── */}
      <div className="section-10">

        {/* Video */}
        {lesson.videoLessonLink && (
          <div className="content-container centered">
            <div className="lesson-video-block">
              <div className="w-video w-embed">
                <iframe
                  src={lesson.videoLessonLink}
                  frameBorder="0"
                  allow="autoplay; fullscreen"
                  allowFullScreen
                  style={{ width: "100%", height: "100%" }}
                />
              </div>
            </div>
          </div>
        )}

        {/* Lesson text + teachers (teachers live inside this container, after the text) */}
        {(lesson.lessonContent || (lesson.teachers && lesson.teachers.length > 0)) && (
          <div className="content-container centered">
            {lesson.lessonContent && (
              <div className="rich-text-container">
                <PortableText value={lesson.lessonContent as any} />
              </div>
            )}
            <TeacherList teachers={lesson.teachers ?? []} variant="lesson" />
          </div>
        )}

        {/* Downloadable resources */}
        {lesson.downloadableResources && lesson.downloadableResources.length > 0 && (
          <div className="content-container centered">
            <h3 className="details-header">Downloadable Resources</h3>
            <div className="lesson-resource-block-continer">
              {lesson.downloadableResources.map((resource, i) => (
                <div key={i} className="lesson-resource-item">
                  <div className="event-name">{resource.name}</div>
                  {resource.resourceFile?.asset?.url && (
                    <a
                      href={resource.resourceFile.asset.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="program-list-button w-button"
                    >
                      Download
                    </a>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Dana / generosity — always shown */}
        <DanaSection />

        <div className="div-block-129"></div>

      </div>
    </>
  );
}
