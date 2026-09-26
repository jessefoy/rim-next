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
        You can attend an in-person drop-in without an account. For Zoom and program registration,
        create a member account; there are no dues or attendance requirements. Each program’s page
        explains its participation and giving arrangements.
      </p>
      <p className="pl-membership__body">
        RIM is supported through <Link href="/donate#dana-at-rim" className="pl-membership__inline-link">generosity</Link>:
        {" "}financial gifts, time, care, and presence. Our
        <Link href="/community-care-agreements" className="pl-membership__inline-link"> community care agreements</Link>
        {" "}guide how we practice together.
      </p>
      {/* The aside says a member account is how you join on Zoom and register,
          so it has to offer one. The version this replaced ended in this exact
          pill; dropping it left /community-programs and /this-week with no
          route to membership outside the nav's hover dropdown. */}
      <div className="pp-actions">
        <Link href="/join" className="pp-btn">
          Create a member account
        </Link>
      </div>
    </aside>
  );
}
