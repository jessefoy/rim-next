import Link from "next/link";

export default function DanaSection() {
  return (
    <div className="lp-dana">
      <p>
        RIM is a small and dedicated community that continues the tradition of offering
        authentic teachings and practices freely — to all who may benefit. In turn,
        contributions from people like you support these offerings, our teachers, and a
        community of people who aspire to co-create a wise, compassionate, and healthy
        world.
      </p>
      <p>
        <Link href="/donate"><strong>♥ Donate to RIM</strong></Link>
        {" "}— Your generosity is appreciated and makes a real impact.
      </p>
      <p><em>RIM is a 501(c3) non-profit organization.</em></p>
    </div>
  );
}
