"use client";

/**
 * LazyVideoRoomEmbed — thin wrapper that dynamically imports VideoRoomEmbed.
 * Safe to import from server components without pulling in livekit-client.
 */

import dynamic from "next/dynamic";

const VideoRoomEmbed = dynamic(() => import("@/components/VideoRoomEmbed"), {
  ssr: false,
  loading: () => <button className="join-btn" disabled>Loading…</button>,
});

interface Props {
  programSlug: string;
  programId: string;
  sessionDate?: string;
  className?: string;
}

export default function LazyVideoRoomEmbed(props: Props) {
  return <VideoRoomEmbed {...props} />;
}
