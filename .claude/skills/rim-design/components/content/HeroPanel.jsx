import React from "react";

/**
 * The site hero — quiet nature footage or photography under a scrim, with the
 * copy set directly on the image.
 *
 * Session 169 replaced the previous treatment, a 95%-opaque white "paper
 * panel" holding the message. RIM's heroes already carry a featured floating
 * object on some pages (the program-detail quote card), and a second white
 * rectangle stacked on the same image read as clutter — the same reasoning
 * that retired the floating nav pill. See RIM_Public_Pages.md.
 *
 * Two variants:
 *   default   — photographic hero, directional blue→navy scrim (program,
 *               catalog, donate, volunteer, kalyana mitta)
 *   "video"   — the homepage: looping bodhi-leaf footage under a flat scrim
 */
export function HeroPanel({
  heading,
  children,
  eyebrow,
  cta,
  ctaHref = "#",
  secondary,
  secondaryHref = "#",
  backgroundImage,
  backgroundVideo,
  variant = "photo",
  minHeight = 620,
  style,
  ...rest
}) {
  const isVideo = variant === "video" || Boolean(backgroundVideo);

  // Flat scrim under footage; directional blue→navy over a still photograph.
  const scrim = isVideo
    ? "rgba(12,18,22,0.38)"
    : `linear-gradient(90deg,
        color-mix(in srgb, var(--rim-dark) 96%, transparent) 0%,
        color-mix(in srgb, var(--rim-blue) 83%, transparent) 54%,
        color-mix(in srgb, var(--rim-blue) 48%, transparent) 100%)`;

  return (
    <section
      style={{
        position: "relative",
        minHeight,
        display: "flex",
        alignItems: "center",
        overflow: "hidden",
        backgroundColor: isVideo ? "var(--rim-dark)" : "var(--rim-blue)",
        backgroundImage: !isVideo && backgroundImage ? `url(${backgroundImage})` : undefined,
        backgroundSize: "cover",
        backgroundPosition: "center",
        ...style,
      }}
      {...rest}
    >
      {isVideo && backgroundVideo ? (
        <div style={{ position: "absolute", inset: 0, zIndex: 0 }} aria-hidden="true">
          <video
            autoPlay
            loop
            muted
            playsInline
            poster={backgroundImage}
            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
          >
            <source src={backgroundVideo} />
          </video>
        </div>
      ) : null}

      <div style={{ position: "absolute", inset: 0, background: scrim, zIndex: 1 }} />

      <div
        style={{
          position: "relative",
          zIndex: 2,
          width: "100%",
          maxWidth: "var(--container-max)",
          margin: "0 auto",
          padding: "68px var(--container-pad) 72px",
        }}
      >
        {eyebrow ? (
          <p
            style={{
              margin: "0 0 16px",
              color: "color-mix(in srgb, var(--rim-surface) 70%, transparent)",
              fontFamily: "var(--font-sans)",
              fontSize: "var(--text-xxs)",
              fontWeight: 700,
              letterSpacing: "0.15em",
              lineHeight: 1.4,
              textTransform: "uppercase",
            }}
          >
            {eyebrow}
          </p>
        ) : null}

        <h1
          style={{
            maxWidth: 780,
            margin: "0 0 22px",
            color: "var(--rim-surface)",
            fontFamily: "var(--font-serif)",
            fontSize: "clamp(2.5rem, 4.4vw + 1rem, 3.75rem)",
            fontWeight: 500,
            letterSpacing: "-0.02em",
            lineHeight: 1.14,
            textWrap: "balance",
          }}
        >
          {heading}
        </h1>

        {children ? (
          <p
            style={{
              maxWidth: 600,
              margin: "0 0 34px",
              color: "color-mix(in srgb, var(--rim-surface) 88%, transparent)",
              fontFamily: "var(--font-sans)",
              fontSize: "var(--text-body)",
              lineHeight: "var(--lh-body)",
            }}
          >
            {children}
          </p>
        ) : null}

        {cta || secondary ? (
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "14px 24px" }}>
            {cta ? (
              <a
                href={ctaHref}
                style={{
                  minHeight: 48,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: 9999,
                  padding: "0 26px",
                  background: "var(--rim-surface)",
                  color: "var(--rim-blue)",
                  fontFamily: "var(--font-sans)",
                  fontSize: "var(--text-small)",
                  fontWeight: 600,
                  textDecoration: "none",
                }}
              >
                {cta}
              </a>
            ) : null}
            {secondary ? (
              <a
                href={secondaryHref}
                style={{
                  minHeight: 44,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 12,
                  color: "var(--rim-surface)",
                  fontFamily: "var(--font-sans)",
                  fontSize: "var(--text-small)",
                  fontWeight: 600,
                  textDecoration: "none",
                }}
              >
                {secondary} <span aria-hidden="true">→</span>
              </a>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}
