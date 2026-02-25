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
      <div className="course-header">
        <div className="program-title-block">
          <h1 className="course-title">{course.name}</h1>
          {course.subheading && <p className="course-subheading">{course.subheading}</p>}
        </div>
      </div>

      <div className="section background-white lessons-collection-page">
        <div className="content-container">
          {course.mainContentDescription && (
            <div className="rich-text-block-19 w-richtext">
              <PortableText value={course.mainContentDescription as any} />
            </div>
          )}

          {course.lessons && course.lessons.length > 0 && (
            <div className="lesson-resource-block-continer">
              <h3 className="details-header">Lessons</h3>
              {course.lessons.map((lesson, i) =>
                lesson.isSectionTitle ? (
                  <div key={i} className="lesson-section-break">
                    {lesson.lessonTitleDisplayed}
                  </div>
                ) : (
                  <div key={i} className="lesson-resource-item">
                    <div className="lesson-resource-name">
                      {lesson.lessonTitleDisplayed}
                      {lesson.includesAudio && <span className="audio-badge"> 🎧</span>}
                    </div>
                    <Link
                      href={`/lessons/${lesson.slug.current}`}
                      className="button-2 w-button no-top-margin"
                    >
                      Go →
                    </Link>
                  </div>
                )
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
