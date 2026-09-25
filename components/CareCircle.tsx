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
        Eight words in four pairs around a centre of the letters C, A, R, and E: Calm and
        Connect, Aware and Attitude, Recognize and Remember, Embody and Engage. Three rings
        run through every word: Self, Other, and Interbeing.
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
                  return (
                    <text
                      key={ring.key}
                      className="care-circle__ring"
                      x={f(x)}
                      y={f(y)}
                      textAnchor="middle"
                      dominantBaseline="central"
                      transform={`rotate(${f(rot)} ${f(x)} ${f(y)})`}
                    >
                      {ring.key}
                    </text>
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
