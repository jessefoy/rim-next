'use client';

import { useRef, useState } from 'react';

// ── SVG icons ─────────────────────────────────────────────────────────────────

function PlayIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
      <polygon points="6,3 19,11 6,19" fill="currentColor" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
      <rect x="4" y="3" width="5" height="16" rx="1.5" fill="currentColor" />
      <rect x="13" y="3" width="5" height="16" rx="1.5" fill="currentColor" />
    </svg>
  );
}

// Simple left arrow — direction is unambiguous
function ArrowLeft() {
  return (
    <svg width="14" height="12" viewBox="0 0 14 12" fill="none" aria-hidden="true">
      <path
        d="M13 6H1M1 6L6 1M1 6L6 11"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// Simple right arrow
function ArrowRight() {
  return (
    <svg width="14" height="12" viewBox="0 0 14 12" fill="none" aria-hidden="true">
      <path
        d="M1 6H13M13 6L8 1M13 6L8 11"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatTime(seconds: number): string {
  if (!isFinite(seconds) || isNaN(seconds)) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function AudioPlayer({ src }: { src: string }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) {
      audio.pause();
    } else {
      audio.play();
    }
    setIsPlaying(!isPlaying);
  };

  const skip = (seconds: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    // Use audio.currentTime directly — do not clamp against the duration state
    // variable, which may still be 0 if metadata is loading. The browser
    // automatically clamps currentTime to [0, duration].
    audio.currentTime = Math.max(0, audio.currentTime + seconds);
  };

  const handleScrub = (e: React.ChangeEvent<HTMLInputElement>) => {
    const t = Number(e.target.value);
    if (audioRef.current) audioRef.current.currentTime = t;
    setCurrentTime(t);
  };

  const remaining = Math.max(0, duration - currentTime);
  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="ap-player">
      {/* Hidden audio element */}
      <audio
        ref={audioRef}
        src={src}
        onTimeUpdate={() => setCurrentTime(audioRef.current?.currentTime ?? 0)}
        onLoadedMetadata={() => setDuration(audioRef.current?.duration ?? 0)}
        onEnded={() => setIsPlaying(false)}
        preload="metadata"
      />

      {/* ── Progress row ── */}
      <div className="ap-progress-row">
        <span className="ap-time">{formatTime(currentTime)}</span>
        <input
          className="ap-scrubber"
          type="range"
          min={0}
          max={duration || 0}
          step={0.1}
          value={currentTime}
          onChange={handleScrub}
          aria-label="Seek"
          style={{ '--ap-progress': `${progress}%` } as React.CSSProperties}
        />
        <span className="ap-time ap-time--remaining">-{formatTime(remaining)}</span>
      </div>

      {/* ── Controls row ── */}
      <div className="ap-controls">

        {/* ← 30s */}
        <button
          className="ap-btn ap-btn--skip"
          onClick={() => skip(-30)}
          aria-label="Rewind 30 seconds"
        >
          <ArrowLeft />
          <span className="ap-skip-label">30s</span>
        </button>

        {/* Play / Pause */}
        <button
          className="ap-btn ap-btn--play"
          onClick={togglePlay}
          aria-label={isPlaying ? 'Pause' : 'Play'}
        >
          {isPlaying ? <PauseIcon /> : <PlayIcon />}
        </button>

        {/* 30s → */}
        <button
          className="ap-btn ap-btn--skip"
          onClick={() => skip(30)}
          aria-label="Forward 30 seconds"
        >
          <span className="ap-skip-label">30s</span>
          <ArrowRight />
        </button>

      </div>
    </div>
  );
}
