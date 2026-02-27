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

  const hasAudio = !!(lesson.includesAudio && lesson.podcastId);
  const hasQuote = !!lesson.headerQuote;

  return (
    <>
      {/* ── Hero: dark blue background, title + optional audio/quote card ── */}
      <div className="section lesson-hero">
        <div className="container-4">
          <div className="lesson-hero-content">
          <div className="text-block-53">Learning &amp; Practice</div>
          <h1 className="lesson-page-heading">{lesson.lessonTitleDisplayed}</h1>

          {(hasAudio || hasQuote) && (
            <div className="div-block-129">
              {hasAudio ? (
                <iframe
                  src={`https://player.captivate.fm/episode/${lesson.podcastId}`}
                  width="100%"
                  height="200"
                  frameBorder="0"
                  scrolling="no"
                />
              ) : (
                <>
                  <p className="block-quote-2">{lesson.headerQuote}</p>
                  {lesson.quoteSource && (
                    <div className="text-block-56">{lesson.quoteSource}</div>
                  )}
                </>
              )}
            </div>
          )}
          </div>
        </div>
      </div>

      {/* ── Content: teachers, video, body, resources, dana ── */}
      <div className="section-10">
        <div className="content-container centered">

          {lesson.videoLessonLink && (
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
          )}

          {lesson.lessonContent && (
            <div className="rich-text-container">
              <div className="rich-text-block-19 w-richtext">
                <PortableText value={lesson.lessonContent as any} />
              </div>
            </div>
          )}

          {lesson.downloadableResources && lesson.downloadableResources.length > 0 && (
            <div className="lesson-resources-block">
              <h3 className="details-header">Downloadable Resources</h3>
              {lesson.downloadableResources.map((resource, i) => (
                <div key={i} className="resource-item">
                  {resource.resourceFile?.asset?.url && (
                    <a
                      href={resource.resourceFile.asset.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="button-2 w-button"
                    >
                      {resource.name}
                    </a>
                  )}
                  {resource.description && <p>{resource.description}</p>}
                </div>
              ))}
            </div>
          )}

          {lesson.teachers && lesson.teachers.length > 0 && (
            <TeacherList teachers={lesson.teachers} variant="lesson" />
          )}

          <DanaSection />

        </div>
      </div>
    </>
  );
}
