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
      {/* ── Hero: dark background, category label, title, optional audio/quote ── */}
      <div className="lp-hero">
        <div className="lp-hero__inner">
          <div className="lp-hero__label">Learning &amp; Practice</div>
          <h1 className="lp-hero__title">{lesson.lessonTitleDisplayed}</h1>

          {(hasAudio || hasQuote) && (
            <div className="lp-hero__card">
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
                  <p className="lp-hero__quote">{lesson.headerQuote}</p>
                  {lesson.quoteSource && (
                    <div className="lp-hero__quote-source">{lesson.quoteSource}</div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Content: video, body, resources, teachers, dana ── */}
      <div className="lp-content">
        <div className="lp-content__inner">

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

          {lesson.lessonContent && (
            <div className="lp-body">
              <PortableText value={lesson.lessonContent as any} />
            </div>
          )}

          {lesson.downloadableResources && lesson.downloadableResources.length > 0 && (
            <div className="lp-resources">
              <h3 className="lp-resources__label">Downloadable Resources</h3>
              {lesson.downloadableResources.map((resource, i) => (
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

          {lesson.teachers && lesson.teachers.length > 0 && (
            <div className="lp-teachers">
              <TeacherList teachers={lesson.teachers} variant="lesson" />
            </div>
          )}

          <DanaSection />

        </div>
      </div>
    </>
  );
}
