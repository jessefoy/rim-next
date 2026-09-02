import Link from "next/link";

export default function PracticeWithUs() {
  return (
    <aside className="pl-membership">
      <p className="pl-membership__label">
        <strong>Practice with us</strong>
      </p>
      <h2 className="pl-membership__title">
        Offered in mutual generosity and care.
      </h2>
      <p className="pl-membership__body">
        We don&rsquo;t charge for the teachings, and no one carries this center alone.
        Everything here runs on{" "}
        <Link href="/donate#dana-at-rim" className="pl-membership__inline-link">
          dana
        </Link>
        , generosity of heart: each of us giving what feels right and possible, caring
        for one another, our teachers, and the center we share. A member account is how
        you join us on Zoom and register for programs; there are no dues, only our{" "}
        <Link href="/community-care-agreements" className="pl-membership__inline-link">
          community care agreements
        </Link>
        .
      </p>
    </aside>
  );
}
