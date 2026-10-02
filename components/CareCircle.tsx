/**
 * The CARE circle, recreated from the practice handout's artwork (the Taking
 * CARE Retreat Handout, cover page) so the site and the handout members hold
 * show the same figure. Keep the layout faithful to that artwork, not to the
 * 2026-09-23 mock, which placed the pairs differently:
 *
 *   Calm and Connect upper left · Aware and Attitude upper right ·
 *   Recognize and Remember lower right · Embody and Engage lower left,
 *   around a centre of C, A, R, E, with three rings for each word:
 *   Self (s), Other (o), and Interbeing (i). Only the Connect wedge spells the
 *   ring names out; every other wedge carries the initial, as the artwork does.
 *
 * Presentational only. It is one image to assistive technology (role="img"
 * with a title and description), so the words inside are not read twice.
 */

const C = 300;
const R_OUTER = 290;
const R_BAND = 240;
const R_I = 181;
const R_O = 121;
const R_CENTER = 63;

type Wedge = { word: string; start: number; color: string };

// Clock degrees from twelve o'clock, clockwise; each wedge spans 45°.
const WEDGES: Wedge[] = [
  { word: "Aware", start: 0, color: "#CFE9EA" },
  { word: "Attitude", start: 45, color: "#DCEBCF" },
  { word: "Recognize", start: 90, color: "#FAEFC8" },
  { word: "Remember", start: 135, color: "#FADFC2" },
  { word: "Embody", start: 180, color: "#F4CDB8" },
  { word: "Engage", start: 225, color: "#F3C6D6" },
  { word: "Calm", start: 270, color: "#D9CBE0" },
  { word: "Connect", start: 315, color: "#C8CEE8" },
];

const CENTER_QUADRANTS = [
  { letter: "A", start: 0, color: "#CFE7D3" },
  { letter: "R", start: 90, color: "#FADFC0" },
  { letter: "E", start: 180, color: "#F6C7C7" },
  { letter: "C", start: 270, color: "#D8CFE6" },
];

function pt(r: number, deg: number): [number, number] {
  const rad = (deg * Math.PI) / 180;
  return [C + r * Math.sin(rad), C - r * Math.cos(rad)];
}

function f(n: number) {
  return n.toFixed(2);
}

/** An annular sector between two radii and two clock angles. */
function sector(rIn: number, rOut: number, a0: number, a1: number) {
  const [x0, y0] = pt(rOut, a0);
  const [x1, y1] = pt(rOut, a1);
  const [x2, y2] = pt(rIn, a1);
  const [x3, y3] = pt(rIn, a0);
  return `M${f(x0)} ${f(y0)} A${rOut} ${rOut} 0 0 1 ${f(x1)} ${f(y1)} L${f(x2)} ${f(y2)} A${rIn} ${rIn} 0 0 0 ${f(x3)} ${f(y3)} Z`;
}

/**
 * An arc for text to ride. Words in the top half run clockwise; words in the
 * bottom half run the other way so they read upright, as on the handout.
 */
function textArc(r: number, a0: number, a1: number, upright: boolean) {
  if (!upright) {
    const [x0, y0] = pt(r, a0);
    const [x1, y1] = pt(r, a1);
    return `M${f(x0)} ${f(y0)} A${r} ${r} 0 0 1 ${f(x1)} ${f(y1)}`;
  }
  const [x0, y0] = pt(r, a1);
  const [x1, y1] = pt(r, a0);
  return `M${f(x0)} ${f(y0)} A${r} ${r} 0 0 0 ${f(x1)} ${f(y1)}`;
}

/**
 * The ring initials (s, o, i) are drawn as outlines, not text. As <text> they
 * were read out of the figure as a stray "ios" after every word but Connect
 * (the figure is one image to assistive technology, but a plain text
 * extraction still sees every <text> node). These are the Quincy Regular
 * glyphs at 20px, baseline at y = 0, so the artwork is unchanged; `adv` is the
 * advance width, used to centre each one the way text-anchor="middle" did.
 */
const RING_GLYPHS: Record<string, { adv: number; d: string }> = {
  i: {
    adv: 5.2,
    d: "M2.42-11.36Q2.02-11.36 1.72-11.67Q1.42-11.98 1.42-12.38Q1.42-12.78 1.72-13.08Q2.02-13.38 2.42-13.38Q2.82-13.38 3.12-13.08Q3.42-12.78 3.42-12.38Q3.42-11.98 3.12-11.67Q2.82-11.36 2.42-11.36M0.52-0.42Q1.24-0.50 1.52-0.72Q1.80-0.94 1.80-1.48L1.80-7.12Q1.80-7.84 1.55-8.10Q1.30-8.36 0.50-8.28L0.50-8.66L2.70-9.16Q2.78-9.18 2.90-9.18Q3.40-9.18 3.40-8.58L3.40-1.48Q3.40-0.94 3.68-0.72Q3.96-0.50 4.70-0.42L4.70 0L0.52 0",
  },
  o: {
    adv: 10.4,
    d: "M5.18 0.12Q3.94 0.12 2.90-0.45Q1.86-1.02 1.23-2.07Q0.60-3.12 0.60-4.52Q0.60-5.92 1.23-6.98Q1.86-8.04 2.92-8.62Q3.98-9.20 5.24-9.20Q6.46-9.20 7.51-8.64Q8.56-8.08 9.18-7.03Q9.80-5.98 9.80-4.58Q9.80-3.18 9.17-2.11Q8.54-1.04 7.48-0.46Q6.42 0.12 5.18 0.12M5.68-0.44Q6.76-0.44 7.42-1.31Q8.08-2.18 8.08-3.84Q8.08-5.14 7.65-6.24Q7.22-7.34 6.46-7.99Q5.70-8.64 4.72-8.64Q3.64-8.64 2.99-7.78Q2.34-6.92 2.34-5.26Q2.34-3.96 2.76-2.85Q3.18-1.74 3.94-1.09Q4.70-0.44 5.68-0.44",
  },
  s: {
    adv: 8.46,
    d: "M4.06 0.12Q3.10 0.12 2.31-0.12Q1.52-0.36 1.04-0.78Q0.68-1.50 0.68-2.10Q0.68-2.42 0.81-2.62Q0.94-2.82 1.18-2.82Q1.48-2.82 1.62-2.42Q2-1.38 2.65-0.88Q3.30-0.38 4.32-0.38Q5.26-0.38 5.75-0.78Q6.24-1.18 6.24-1.88Q6.24-2.48 5.91-2.85Q5.58-3.22 5.19-3.39Q4.80-3.56 3.76-3.92Q2.42-4.38 1.65-4.99Q0.88-5.60 0.88-6.66Q0.88-7.82 1.82-8.51Q2.76-9.20 4.32-9.20Q5.14-9.20 5.86-8.99Q6.58-8.78 7.08-8.44Q7.42-7.70 7.42-7.14Q7.42-6.82 7.29-6.62Q7.16-6.42 6.92-6.42Q6.64-6.42 6.50-6.82Q5.82-8.72 4.06-8.72Q3.26-8.72 2.82-8.35Q2.38-7.98 2.38-7.32Q2.38-6.54 2.90-6.11Q3.42-5.68 4.48-5.30Q4.64-5.24 5.67-4.90Q6.70-4.56 7.28-3.96Q7.86-3.36 7.86-2.56Q7.86-1.34 6.80-0.61Q5.74 0.12 4.06 0.12",
  },
};
// text-anchor="middle" + dominant-baseline="central" put the baseline 5.9px
// below the point (the centre of Quincy's ascent/descent box at 20px).
const RING_BASELINE_DROP = 5.9;

const isBottom = (mid: number) => mid > 90 && mid < 270;

export default function CareCircle() {
  const bandMid = (R_OUTER + R_BAND) / 2;
  const rings = [
    { key: "i", name: "Interbeing", rIn: R_I, rOut: R_BAND, opacity: 0.55 },
    { key: "o", name: "Other", rIn: R_O, rOut: R_I, opacity: 0.38 },
    { key: "s", name: "Self", rIn: R_CENTER, rOut: R_O, opacity: 0.22 },
  ];

  return (
    <svg
      className="care-circle"
      viewBox="0 0 600 600"
      role="img"
      aria-labelledby="care-circle-title care-circle-desc"
    >
      <title id="care-circle-title">The CARE circle</title>
      <desc id="care-circle-desc">
        Eight words around a center of the letters C, A, R, and E: Calm, Connect, Aware,
        Attitude, Recognize, Remember, Embody, and Engage. Three rings run through every word:
        Self, Other, and Interbeing.
      </desc>

      <circle cx={C} cy={C} r={R_OUTER} fill="#fff" />

      {WEDGES.map((w) => {
        const a0 = w.start;
        const a1 = w.start + 45;
        const mid = w.start + 22.5;
        const bottom = isBottom(mid);
        const arcId = `care-arc-${w.word.toLowerCase()}`;
        // Glyphs rise away from the baseline: outward on the top half, inward
        // on the bottom half, so the baseline sits either side of the band's
        // middle to centre the word in it.
        const baseline = bottom ? bandMid + 8.5 : bandMid - 8.5;
        return (
          <g key={w.word}>
            <path d={sector(R_BAND, R_OUTER, a0, a1)} fill={w.color} />
            {rings.map((ring) => (
              <path
                key={ring.key}
                d={sector(ring.rIn, ring.rOut, a0, a1)}
                fill={w.color}
                fillOpacity={ring.opacity}
              />
            ))}
            <path id={arcId} d={textArc(baseline, a0, a1, bottom)} fill="none" />
            <text className="care-circle__word">
              <textPath href={`#${arcId}`} startOffset="50%" textAnchor="middle">
                {w.word}
              </textPath>
            </text>
            {w.word === "Connect"
              ? rings.map((ring) => {
                  const rid = `care-ring-${ring.key}`;
                  const mr = (ring.rIn + ring.rOut) / 2 - 6;
                  return (
                    <g key={ring.key}>
                      <path id={rid} d={textArc(mr, a0, a1, false)} fill="none" />
                      <text className="care-circle__ring">
                        <textPath href={`#${rid}`} startOffset="50%" textAnchor="middle">
                          {ring.name}
                        </textPath>
                      </text>
                    </g>
                  );
                })
              : rings.map((ring) => {
                  const [x, y] = pt((ring.rIn + ring.rOut) / 2, mid);
                  const rot = bottom ? mid + 180 : mid;
                  const glyph = RING_GLYPHS[ring.key];
                  return (
                    <path
                      key={ring.key}
                      aria-hidden="true"
                      fill="#1f1f1f"
                      d={glyph.d}
                      transform={`translate(${f(x)} ${f(y)}) rotate(${f(rot)}) translate(${f(-glyph.adv / 2)} ${RING_BASELINE_DROP})`}
                    />
                  );
                })}
          </g>
        );
      })}

      {/* Ring boundaries and the diagonals between partner words. */}
      <g fill="none" stroke="#1f1f1f">
        {[R_BAND, R_I, R_O].map((r) => (
          <circle key={r} cx={C} cy={C} r={r} strokeWidth={2.5} />
        ))}
        {[45, 135, 225, 315].map((a) => {
          const [x0, y0] = pt(R_CENTER, a);
          const [x1, y1] = pt(R_OUTER, a);
          return (
            <line key={a} x1={f(x0)} y1={f(y0)} x2={f(x1)} y2={f(y1)} strokeWidth={2.5} />
          );
        })}
        {[0, 90, 180, 270].map((a) => {
          const [x0, y0] = pt(R_CENTER, a);
          const [x1, y1] = pt(R_OUTER, a);
          return (
            <line key={a} x1={f(x0)} y1={f(y0)} x2={f(x1)} y2={f(y1)} strokeWidth={5} />
          );
        })}
      </g>

      {/* The centre: C, A, R, E in their own quadrants. */}
      {CENTER_QUADRANTS.map((q) => {
        const [x, y] = pt(R_CENTER * 0.52, q.start + 45);
        return (
          <g key={q.letter}>
            <path d={sector(0.01, R_CENTER, q.start, q.start + 90)} fill={q.color} />
            <text
              className="care-circle__letter"
              x={f(x)}
              y={f(y)}
              textAnchor="middle"
              dominantBaseline="central"
            >
              {q.letter}
            </text>
          </g>
        );
      })}
      <g fill="none" stroke="#1f1f1f">
        <line x1={C} y1={C - R_CENTER} x2={C} y2={C + R_CENTER} strokeWidth={2} />
        <line x1={C - R_CENTER} y1={C} x2={C + R_CENTER} y2={C} strokeWidth={2} />
        <circle cx={C} cy={C} r={R_CENTER} strokeWidth={4.5} />
        <circle cx={C} cy={C} r={R_OUTER} strokeWidth={7} />
      </g>
    </svg>
  );
}
