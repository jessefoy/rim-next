import Link from "next/link";

const GUIDANCE: Record<string, string> = {
  "nature-meditation-km-group": "A seasonal gathering from late spring through fall at Menomonee Park: about 75 minutes, with a slow walk, guided meditation, and reflection. Expect about 45 minutes of walking on uneven terrain. Practicing outdoors connects CARE with attention to our bodies, other people, and the natural world.",
  "qigong-at-rim": "Slow movement, breathing, and body awareness offer another way to explore CARE. No previous qigong experience is needed. Contact RIM before joining to discuss movement or access needs.",
  "good-morning-silent-meditation": "Brief opening guidance is followed by an unguided sit. Noble silence means sharing the practice without conversation. If you would like instructions as you meditate, begin with Meditation and Dharma Talk.",
  "good-evening-silent-meditation": "Brief opening guidance is followed by an unguided sit. Noble silence means sharing the practice without conversation. If you would like instructions as you meditate, begin with Meditation and Dharma Talk.",
  "the-art-of-meditation": "This gathering explores meditation practice and how it develops. Through CARE, we can notice how settling, awareness, and a kind attitude support one another while we sit and in daily life.",
  "meditation-and-dharma-talk": "Recommended for your first visit. Guided meditation and a teaching offer a way to begin practicing CARE together. No previous meditation experience is needed.",
  "awakening-the-heart": "The Monday gathering explores heart practices through meditation and conversation. These practices support CARE by helping us meet ourselves and other people with kindness, compassion, joy, and steadiness.",
  "our-hearts-were-made-for-this": "The Sunday gathering includes 20–30 minutes of guided heart practice and a brief teaching. Equanimity means meeting change with steadiness and care. These heart practices help bring CARE into our relationships and daily responses.",
};

export default function ProgramOrientation({ slug, recurringRegistration }: { slug: string; recurringRegistration: boolean }) {
  const text = GUIDANCE[slug];
  if (!text && !recurringRegistration) return null;
  const silent = slug === "good-morning-silent-meditation" || slug === "good-evening-silent-meditation";
  return (
    <div className="pp-prose pg-orientation">
      {text && <p>{text}</p>}
      {recurringRegistration && <p>Registration is for this program. You do not need to submit a new registration for each scheduled session.</p>}
      {silent ? <p><Link href="/programs/meditation-and-dharma-talk">Explore guided meditation</Link></p> : text && <p><Link href="/new-to-rim#first-gathering">Planning your first visit</Link>{" · "}<Link href="/care">About CARE</Link></p>}
    </div>
  );
}
