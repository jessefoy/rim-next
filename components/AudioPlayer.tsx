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

// Skip-back arrow with "30" label
function SkipBackIcon() {
  return (
    <svg width="36" height="36" viewBox="0 0 36 36" fill="none" aria-hidden="true">
      {/* Curved arrow going counter-clockwise */}
      <path
        d="M18 8 A10 10 0 1 0 27.5 23"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        fill="none"
      />
      {/* Arrowhead pointing back */}
      <polyline
        points="13,4 18,8 14,13"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      {/* "30" text in center */}
      <text x="18" y="22" textAnchor="middle" fontSize="8" fill="currentColor" fontFamily="sans-serif" fontWeight="600">
        30
      </text>
    </svg>
  );
}

// Skip-forward arrow with "30" label
function SkipForwardIcon() {
  return (
    <svg width="36" height="36" viewBox="0 0 36 36" fill="none" aria-hidden="true">
      {/* Curved arrow going clockwise */}
      <path
        d="M18 8 A10 10 0 1 1 8.5 23"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        fill="none"
      />
      {/* Arrowhead pointing forward */}
      <polyline
        points="23,4 18,8 22,13"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      {/* "30" text in center */}
      <text x="18" y="22" textAnchor="middle" fontSize="8" fill="currentColor" fontFamily="sans-serif" fontWeight="600">
        30
      </text>
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
    audio.currentTime = Math.min(Math.max(0, audio.currentTime + seconds), duration);
  };

  const handleScrub = (e: React.ChangeEvent<HTMLInputElement>) => {
    const t = Number(e.target.value);
    if (audioRef.current) audioRef.current.currentTime = t;
    setCurrentTime(t);
  };

  const remaining = Math.max(0, duration - currentTime);
  // scrubber progress % for the filled-track CSS trick
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
        <button
          className="ap-btn ap-btn--skip"
          onClick={() => skip(-30)}
          aria-label="Rewind 30 seconds"
        >
          <SkipBackIcon />
        </button>

        <button
          className="ap-btn ap-btn--play"
          onClick={togglePlay}
          aria-label={isPlaying ? 'Pause' : 'Play'}
        >
          {isPlaying ? <PauseIcon /> : <PlayIcon />}
        </button>

        <button
          className="ap-btn ap-btn--skip"
          onClick={() => skip(30)}
          aria-label="Forward 30 seconds"
        >
          <SkipForwardIcon />
        </button>
      </div>
    </div>
  );
}
