import { sanityClient } from "@/lib/sanity";
import { classRecordingBySlugQuery, allClassRecordingSlugsQuery } from "@/lib/queries";
import { PortableText } from "@portabletext/react";
import Link from "next/link";
import { notFound } from "next/navigation";

export const revalidate = 60;

type ClassRecording = {
  _id: string;
  name: string;
  dateRecorded?: string;
  audioEmbedCode?: string;
  videoLink?: string;
  description?: unknown[];
  teachers?: { name: string; slug: { current: string } }[];
  topics?: { name: string; slug: { current: string } }[];
};

export async function generateStaticParams() {
  const slugs = await sanityClient.fetch<{ slug: string }[]>(allClassRecordingSlugsQuery);
  return slugs.filter((s) => s.slug).map((s) => ({ slug: s.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const recording = await sanityClient.fetch<ClassRecording | null>(classRecordingBySlugQuery, { slug });
  return { title: `${recording?.name ?? "Class Recording"} — Class Recordings — Rooted In Mindfulness` };
}

export default async function ClassRecordingPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const recording = await sanityClient.fetch<ClassRecording | null>(classRecordingBySlugQuery, { slug });
  if (!recording) notFound();

  return (
    <div className="section background-white">
      <div className="content-container">
        <Link href="/work-in-progress/class-recordings" className="breadcrumb-link w-inline-block">
          <div className="text-block-58">← Class Recordings</div>
        </Link>

        <h1 className="heading-9">{recording.name}</h1>

        {recording.dateRecorded && (
          <p className="recording-date">
            {new Date(recording.dateRecorded).toLocaleDateString("en-US", {
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </p>
        )}

        {recording.teachers && recording.teachers.length > 0 && (
          <div className="lesson-teachers">
            {recording.teachers.map((teacher) => (
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

        {recording.audioEmbedCode && (
          <div
            className="lesson-audio-block"
            dangerouslySetInnerHTML={{ __html: recording.audioEmbedCode }}
          />
        )}

        {recording.videoLink && (
          <div className="lesson-video-block">
            <div className="w-video w-embed">
              <iframe
                src={recording.videoLink}
                frameBorder="0"
                allow="autoplay; fullscreen"
                allowFullScreen
                style={{ width: "100%", height: "100%" }}
              />
            </div>
          </div>
        )}

        {recording.description && (
          <div className="rich-text-block-19 w-richtext">
            <PortableText value={recording.description as any} />
          </div>
        )}

        {recording.topics && recording.topics.length > 0 && (
          <div className="recording-topics">
            {recording.topics.map((topic) => (
              <span key={topic.slug.current} className="topic-tag">
                {topic.name}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
