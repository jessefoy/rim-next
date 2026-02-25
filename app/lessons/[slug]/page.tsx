import { sanityClient } from "@/lib/sanity";
import { lessonBySlugQuery, allLessonSlugsQuery } from "@/lib/queries";
import { PortableText } from "@portabletext/react";
import Link from "next/link";
import { notFound } from "next/navigation";

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
      {/* ── Lesson hero: label + title + white overlay box (quote or audio) ── */}
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

      {/* ── Lesson content ── */}
      <div className="section-10">

        {lesson.teachers && lesson.teachers.length > 0 && (
          <div className="content-container centered">
            <div className="lesson-teachers">
              {lesson.teachers.map((teacher) => (
                <Link
                  key={teacher.slug.current}
                  href={`/team/${teacher.slug.current}`}
                  className="teacher-container w-inline-block"
                >
                  {teacher.bioPicture?.asset?.url && (
                    <img
                      src={teacher.bioPicture.asset.url}
                      alt={teacher.name}
                      className="image-11"
                      loading="lazy"
                    />
                  )}
                  <div className="facilitator-name letter-space">By </div>
                  <div className="facilitator-name underline">{teacher.name}</div>
                </Link>
              ))}
            </div>
          </div>
        )}

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

        {lesson.lessonContent && (
          <div className="content-container centered">
            <div className="rich-text-container">
              <PortableText value={lesson.lessonContent as any} />
            </div>
          </div>
        )}

        {lesson.downloadableResources && lesson.downloadableResources.length > 0 && (
          <div className="content-container centered">
            <div className="lesson-resource-block-continer">
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
                      <img src="/images/file_upload_black_24dp-1.svg" width={20} alt="" />{" "}
                      {resource.name}
                    </a>
                  )}
                  {resource.description && <p>{resource.description}</p>}
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </>
  );
}
