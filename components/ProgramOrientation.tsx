import Link from "next/link";

/** Participation guidance; each offering's own description connects practice with CARE. */
export default function ProgramOrientation({ slug, recurringRegistration }: { slug: string; recurringRegistration: boolean }) {
  const silent = slug === "good-morning-silent-meditation" || slug === "good-evening-silent-meditation";
  const firstVisit = slug === "meditation-and-dharma-talk";
  const nature = slug === "nature-meditation-km-group";
  const recovery = slug === "recovery-dharma";
  if (!silent && !firstVisit && !recovery && !recurringRegistration) return null;
  return (
    <div className="pp-prose pg-orientation">
      {firstVisit && <p>Recommended for your first visit. No previous meditation experience is needed. <Link href="/new-to-rim#first-gathering">See what to expect when you arrive</Link>.</p>}
      {silent && <p>For guidance throughout your first meditation, try <Link href="/programs/meditation-and-dharma-talk">Meditation and Dharma Talk</Link>.</p>}
      {recurringRegistration && nature && <p>Register once for this program’s listed season. You do not need to register again for each scheduled walk. Check the program page and your email for meeting details and weather updates.</p>}
      {recurringRegistration && !nature && <p>Registration is for this program. You do not need to submit a new registration for each scheduled session. Check the program page for meeting details and notices. For an online session, sign in and open My Home for the link.</p>}
      {recovery && <p>Joining online uses a RIM member account with your first and last name and email. Zoom uses the name you enter there or the name on your Zoom account. For questions about sharing, confidentiality, or names in this group, <a href="mailto:support@rootedinmindfulness.org?subject=Recovery%20Dharma%20participation">contact RIM before joining</a>.</p>}
    </div>
  );
}
