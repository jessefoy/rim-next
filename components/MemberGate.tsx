import Link from "next/link";
import { PortableText } from "@portabletext/react";

/**
 * MemberGate — logged-out message block
 * Shows a "Join or sign in" wall when a visitor is not signed in.
 * Used on program detail pages and any other page with gated content.
 */
export default function MemberGate({
  signedOutInstructions,
  heading = "Join Us",
}: {
  signedOutInstructions?: unknown[];
  heading?: string;
}) {
  return (
    <div className="logged-out---message">
      <h3 className="details-header">{heading}</h3>
      {signedOutInstructions && signedOutInstructions.length > 0 && (
        <div className="signed-out-instuctions w-richtext">
          <PortableText value={signedOutInstructions as any} />
        </div>
      )}
      <div className="become-member-buttons">
        <Link href="/login" className="button-2 w-button">
          Join or sign in →
        </Link>
      </div>
    </div>
  );
}
