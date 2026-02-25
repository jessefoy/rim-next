"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

const CONFIG = {
  MINUTES_BEFORE_EVENT: 10,
  BUFFER_MS: 10000,
  EVENT_DURATION_MINUTES: 120,
  UPDATE_INTERVAL_MS: 10000,
};

const SLIDES = [
  {
    heading: "Welcome, we're glad you're here!",
    text: "RIM is a community for all who wish to practice meditation and mindful living.\n~\nThanks for being part of it.",
  },
  {
    heading: "Help create a safe and supportive community space.",
    text: "By holding it with kindness, respect, and grace for others and ourselves.",
  },
  {
    heading: "Everyone's voice supports our learning and practice!",
    text: "Your shares and questions are welcome and appreciated. Please offer others the opportunity to share too.",
  },
  {
    heading: "Without a sense of caring, there can be no sense of community.",
    text: "Anthony J. D'Angelo",
  },
];

function getMilwaukeeNow() {
  return new Date(new Date().toLocaleString("en-US", { timeZone: "America/Chicago" }));
}

function parseEventTime(timeString: string): { hours: number; minutes: number } | null {
  if (!timeString.trim()) return null;
  let clean = timeString.trim();
  for (const sep of [" - ", " – ", " — ", " to ", "-", "–", "—"]) {
    if (clean.includes(sep)) {
      clean = clean.split(sep)[0].trim();
      break;
    }
  }
  const m = clean.match(/(\d{1,2}):?(\d{0,2})\s*(AM|PM|am|pm)/i);
  if (!m) return null;
  let hours = parseInt(m[1]);
  const minutes = m[2] ? parseInt(m[2]) : 0;
  const period = m[3].toUpperCase();
  if (period === "PM" && hours !== 12) hours += 12;
  if (period === "AM" && hours === 12) hours = 0;
  return { hours, minutes };
}

function createEventDate(timeInfo: { hours: number; minutes: number }): Date {
  const now = getMilwaukeeNow();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate(), timeInfo.hours, timeInfo.minutes, 0);
}

export default function WaitingRoomPage() {
  const searchParams = useSearchParams();
  const eventName = searchParams.get("name") ?? "The program";
  const eventTime = searchParams.get("time") ?? "";
  const zoomLink = searchParams.get("zoom") ?? "";

  const [slideIndex, setSlideIndex] = useState(0);
  const [showLink, setShowLink] = useState(false);
  const [header, setHeader] = useState("Waiting Room");
  const [message, setMessage] = useState("");
  const [note, setNote] = useState("NOTE: The Zoom link will appear about 5 minutes before the event begins.");

  function updateStatus() {
    if (!eventTime.trim()) {
      setShowLink(true);
      setHeader("We're Ready! Join Below");
      return;
    }
    const timeInfo = parseEventTime(eventTime);
    if (!timeInfo) {
      setShowLink(true);
      setHeader("We're Ready! Join Below");
      return;
    }
    const eventDate = createEventDate(timeInfo);
    const now = getMilwaukeeNow();
    const msUntil = eventDate.getTime() - now.getTime();
    const minutesUntil = msUntil / 60000;
    const minutesSince = -minutesUntil;

    const userTime = eventDate.toLocaleString("en-US", { hour: "numeric", minute: "2-digit", timeZoneName: "short" });
    const linkOpenTime = new Date(eventDate.getTime() - CONFIG.MINUTES_BEFORE_EVENT * 60000)
      .toLocaleString("en-US", { hour: "numeric", minute: "2-digit", timeZoneName: "short" });

    function friendly(mins: number) {
      const a = Math.abs(Math.round(mins));
      if (a < 1) return "right now";
      if (a < 60) return `${a} minute${a !== 1 ? "s" : ""}`;
      const h = Math.floor(a / 60), m = a % 60;
      return m === 0 ? `${h} hour${h !== 1 ? "s" : ""}` : `${h} hour${h !== 1 ? "s" : ""} and ${m} minute${m !== 1 ? "s" : ""}`;
    }

    const name = decodeURIComponent(eventName);

    if (minutesUntil <= CONFIG.MINUTES_BEFORE_EVENT && msUntil > CONFIG.BUFFER_MS) {
      setShowLink(true);
      setHeader("We're Ready! Join Below");
      return;
    }
    if (minutesUntil <= 0 && minutesSince <= CONFIG.EVENT_DURATION_MINUTES) {
      setShowLink(true);
      setHeader("We're Ready! Join Below");
      return;
    }

    setShowLink(false);
    setHeader("Waiting Room");

    if (minutesUntil > 0) {
      setMessage(`${name} starts in ${friendly(minutesUntil)} at ${userTime}.`);
      if (minutesUntil <= CONFIG.MINUTES_BEFORE_EVENT) {
        setNote("The Zoom link is about to appear — you're perfectly on time!");
      } else {
        const untilLink = minutesUntil - CONFIG.MINUTES_BEFORE_EVENT;
        setNote(`The Zoom link will appear at ${linkOpenTime} (in ${friendly(untilLink)}).`);
      }
    } else {
      setMessage(`${name} is over for today.`);
      setNote("This session has concluded. Check your dashboard for other available programs today.");
    }
  }

  useEffect(() => {
    updateStatus();
    const interval = setInterval(() => {
      updateStatus();
      setSlideIndex((i) => (i + 1) % SLIDES.length);
    }, CONFIG.UPDATE_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []);

  const slide = SLIDES[slideIndex];

  return (
    <div className="page-wrapper">
      <div className="dashboard-section">
        <div className="div-block-162">
          <h1 id="Waiting-Room-Header" className="waiting-room-header">
            {header}
          </h1>

          {!showLink && (
            <>
              <div className="div-block-163">
                <h1 id="Waiting-Room-Message" className="heading-52">{message}</h1>
              </div>
              <div className="waiting-room-zoom-note">
                <div className="text-block-95">
                  <strong>NOTE:</strong> {note}
                </div>
              </div>
              <div id="Waiting-Room-Slider" className="slider-container">
                <div className="waiting-room-slider">
                  <div className="mask">
                    <div className="w-slide" style={{ display: "block" }}>
                      <div className="div-block-165">
                        <h3 className="heading-53">{slide.heading}</h3>
                        <p className="paragraph-26">{slide.text}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}

          {showLink && zoomLink && (
            <div className="div-block-164">
              <a
                id="join-zoom-button"
                href={decodeURIComponent(zoomLink)}
                target="_blank"
                rel="noopener noreferrer"
                className="waiting-room-attendance-button w-button"
              >
                Join us on Zoom
              </a>
            </div>
          )}

          {showLink && !zoomLink && (
            <div className="div-block-163">
              <p>The Zoom link is not available for this session. Please contact support.</p>
            </div>
          )}

          <div style={{ marginTop: "2rem" }}>
            <Link href="/account/dashboard" className="breadcrumb-link w-inline-block">
              ← Back to Dashboard
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
