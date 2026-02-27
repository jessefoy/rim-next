import { sanityClient } from "@/lib/sanity";
import { classRecordingBySlugQuery, allClassRecordingSlugsQuery } from "@/lib/queries";
import { PortableText } from "@portabletext/react";
import Link from "next/link";
import { notFound } from "next/navigation";
import TeacherList from "@/components/TeacherList";
import DanaSection from "@/components/DanaSection";

export const revalidate = 60;

type ClassRecording = {
  _id: string;
  name: string;
  dateRecorded?: string;
  audioEmbedCode?: string;
  videoLink?: string;
  description?: unknown[];
  teachers?: { name: string; slug: { current: string }; bioPicture?: { asset?: { url?: string } } }[];
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

  const hasAudio    = !!recording.audioEmbedCode;
  const hasVideo    = !!recording.videoLink;
  const hasBody     = !!(recording.description && recording.description.length > 0);
  const hasTeachers = !!(recording.teachers && recording.teachers.length > 0);
  const hasTopics   = !!(recording.topics && recording.topics.length > 0);

  const formattedDate = recording.dateRecorded
    ? new Date(recording.dateRecorded).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : null;

  return (
    <div className="cr-page">

      {/* ── Breadcrumb ── */}
      <div className="cr-breadcrumb">
        <Link href="/account/dashboard-my-library" className="cr-back">← My Library</Link>
      </div>

      {/* ── Header: label + title + date ── */}
      <header className="cr-header">
        <div className="cr-header__inner">
          <p className="lp-label">Class Recording</p>
          <h1 className="cr-title">{recording.name}</h1>
          {formattedDate && <p className="cr-date">{formattedDate}</p>}
        </div>
      </header>

      {/* ── Audio embed (full-width within reading column) ── */}
      {hasAudio && (
        <div
          className="cr-audio"
          dangerouslySetInnerHTML={{ __html: recording.audioEmbedCode! }}
        />
      )}

      {/* ── Content column ── */}
      <div className="lp-content">

        {/* Teacher byline */}
        {hasTeachers && (
          <TeacherList teachers={recording.teachers!} variant="lesson" />
        )}

        {/* Video */}
        {hasVideo && (
          <div className="lp-video">
            <iframe
              src={recording.videoLink}
              frameBorder="0"
              allow="autoplay; fullscreen"
              allowFullScreen
            />
          </div>
        )}

        {/* Body / description */}
        {hasBody && (
          <div className="lp-body">
            <PortableText value={recording.description as any} />
          </div>
        )}

        {/* Topics */}
        {hasTopics && (
          <>
            <hr className="lp-divider" />
            <div className="cr-topics">
              {recording.topics!.map((topic) => (
                <span key={topic.slug.current} className="cr-topic-tag">
                  {topic.name}
                </span>
              ))}
            </div>
          </>
        )}

        {/* Dana */}
        <DanaSection />

      </div>
    </div>
  );
}
