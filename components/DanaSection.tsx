import Link from "next/link";

/**
 * DanaSection — p.small-text-box
 * RIM generosity/dana block. Identical on all pages that show it.
 * Matches the live Webflow design exactly.
 */
export default function DanaSection() {
  return (
    <p className="small-text-box">
      RIM is a small and dedicated community that continues the tradition of offering
      authentic teachings and practices freely — to all who may benefit. In turn,
      contributions from people like you support these offerings, our teachers, and a
      community of people who aspire to co-create a wise, compassionate, and healthy
      world.<br /><br />
      <Link href="/donate"><strong>♥ Donate to RIM</strong></Link>
      <strong> </strong>— Your generosity is appreciated and makes a real impact.
      <br /><br />
      <span className="text-span-12"><em>RIM is a 501(c3) non-profit organization.</em></span>
    </p>
  );
}
