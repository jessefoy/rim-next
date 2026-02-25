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
  teachers?: { name: string; slug: { current: string } }[];
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

  return (
    <>
      <div className="section lesson-hero background-light">
        <div className="content-container centered">
          {lesson.includesAudio && lesson.podcastId ? (
            <div className="lesson-audio-block">
              <div className="captivate-player-embed">
                <iframe
                  src={`https://player.captivate.fm/episode/${lesson.podcastId}`}
                  width="100%"
                  height="200"
                  frameBorder="0"
                  scrolling="no"
                />
              </div>
            </div>
          ) : lesson.headerQuote ? (
            <div className="program-quote-block">
              <p className="program-quote-text">{lesson.headerQuote}</p>
              {lesson.quoteSource && (
                <div className="quote-source">
                  <div className="program-quote-source-dash">-</div>
                  <div className="program-quote-source-text">{lesson.quoteSource}</div>
                </div>
              )}
            </div>
          ) : null}
        </div>
      </div>

      <div className="section background-white">
        <div className="content-container">
          <h1 className="heading-9">{lesson.lessonTitleDisplayed}</h1>

          {lesson.teachers && lesson.teachers.length > 0 && (
            <div className="lesson-teachers">
              {lesson.teachers.map((teacher) => (
                <Link
                  key={teacher.slug.current}
                  href={`/team/${teacher.slug.current}`}
                  className="teacher-container w-inline-block"
                >
                  <div className="facilitator-name underline">{teacher.name}</div>
                </Link>
              ))}
            </div>
          )}

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
            <div className="rich-text-block-19 w-richtext">
              <PortableText value={lesson.lessonContent as any} />
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
                      <img src="/images/file_upload_black_24dp-1.svg" width={20} alt="" />{" "}
                      {resource.name}
                    </a>
                  )}
                  {resource.description && <p>{resource.description}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
