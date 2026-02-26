import { sanityClient } from "@/lib/sanity";
import { courseBySlugQuery, allCourseSlugsQuery } from "@/lib/queries";
import { PortableText } from "@portabletext/react";
import { notFound } from "next/navigation";
import SeriesListItem from "@/components/SeriesListItem";

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

      {/* ── Lessons section ── */}
      <div className="section background-white lessons-collection-page">
        <div className="content-container">
          {course.lessons && course.lessons.length > 0 && (
            <div className="series-list-section">
              <div className="program-details-content no-bottom-margin">
                <h2 className="text-center bottom-margin-30">Lessons</h2>
                <div className="series-list-wrapper">
                  {course.lessons.map((lesson, i) => (
                    <SeriesListItem
                      key={i}
                      title={lesson.lessonTitleDisplayed}
                      href={lesson.isSectionTitle ? undefined : `/lessons/${lesson.slug.current}`}
                      isSectionTitle={lesson.isSectionTitle}
                      includesAudio={lesson.includesAudio}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
