import { sanityClient } from "@/lib/sanity";
import { courseBySlugQuery, allCourseSlugsQuery } from "@/lib/queries";
import { PortableText } from "@portabletext/react";
import Link from "next/link";
import { notFound } from "next/navigation";

export const revalidate = 60;

type Lesson = {
  lessonTitleDisplayed: string;
  slug: { current: string };
  isSectionTitle?: boolean;
  includesAudio?: boolean;
};

type Course = {
  _id: string;
  name: string;
  subheading?: string;
  mainContentDescription?: unknown[];
  lessons?: Lesson[];
};

export async function generateStaticParams() {
  const slugs = await sanityClient.fetch<{ slug: string }[]>(allCourseSlugsQuery);
  return slugs.filter((s) => s.slug).map((s) => ({ slug: s.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const course = await sanityClient.fetch<Course | null>(courseBySlugQuery, { slug });
  return { title: `${course?.name ?? "Course"} — Rooted In Mindfulness` };
}

export default async function CoursePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const course = await sanityClient.fetch<Course | null>(courseBySlugQuery, { slug });
  if (!course) notFound();

  return (
    <>
      {/* ── Course header: label + title + description ── */}
      <div className="course-header">
        <div className="content-container w-container">
          <div className="f-container-regular">
            <div className="f-header-wrapper-left">
              {course.subheading && (
                <div className="f-margin-bottom-08">
                  <h5 className="course-type">{course.subheading}</h5>
                </div>
              )}
              <div className="f-margin-bottom-24">
                <h1 className="course-title">{course.name}</h1>
              </div>
              {course.mainContentDescription && (
                <div className="text-block-65 w-richtext">
                  <PortableText value={course.mainContentDescription as any} />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Lessons section ── */}
      <div className="section background-white lessons-collection-page">
        <div className="content-container">
          {course.lessons && course.lessons.length > 0 && (
            <div className="series-list-section">
              <div className="program-details-content no-bottom-margin">
                <h2 className="text-center bottom-margin-30">Lessons</h2>
                <div className="series-list-wrapper">
                  {course.lessons.map((lesson, i) =>
                    lesson.isSectionTitle ? (
                      // Section title row — transparent bg, no button
                      <div key={i} className="w-layout-grid series-list-grid section-title-bg">
                        <div className="dashboard-list-name-and-date-container">
                          <div className="dashboard-title-container">
                            <div className="lesson-section-break">
                              {lesson.lessonTitleDisplayed}
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : (
                      // Regular lesson row — white card + Go button
                      <div key={i} className="w-layout-grid series-list-grid">
                        <div className="dashboard-list-name-and-date-container">
                          <div className="dashboard-title-container">
                            <div className="event-name">
                              {lesson.lessonTitleDisplayed}
                              {lesson.includesAudio && <span className="audio-badge"> 🎧</span>}
                            </div>
                          </div>
                        </div>
                        <div className="program-links">
                          <Link
                            href={`/lessons/${lesson.slug.current}`}
                            className="button-2-copy w-button"
                          >
                            Go ➞
                          </Link>
                        </div>
                      </div>
                    )
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
