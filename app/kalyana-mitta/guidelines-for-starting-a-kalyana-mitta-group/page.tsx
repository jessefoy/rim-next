import Link from "next/link";

export const metadata = {
  title: "Starting a Community Group — Rooted In Mindfulness",
  description: "Plan a community group at RIM: its purpose, shared responsibilities, meeting choices, and how to propose it to the coordinator.",
};

export default function KMGuidelinesPage() {
  return (
    <div className="pp-page pp-page--spine pp-page--column">
      <section className="pp-hero pp-hero--flat">
        <div className="rim-container pp-hero__inner">
          <p className="pp-hero__eyebrow">Community groups</p>
          <h1 className="pp-hero__title">Starting a community group</h1>
          <p className="pp-hero__body">A guide to proposing a group and caring for it together.</p>
        </div>
      </section>
      <section className="pp-section pp-section--last">
        <div className="rim-container"><div className="pp-prose">
          <p>RIM community groups bring people together around meditation, study, recovery, service, or another shared interest in mindful living. They are also called Kalyana Mitta groups, meaning spiritual friendship.</p>
          <nav aria-label="In this guide"><ul>
            <li><a href="#propose">Propose a group</a></li>
            <li><a href="#responsibilities">Shared responsibilities</a></li>
            <li><a href="#planning">Planning choices</a></li>
            <li><a href="#format">A suggested meeting</a></li>
            <li><a href="#support">Support and staying in touch</a></li>
          </ul></nav>

          <h2 id="propose">Propose a group</h2>
          <ol>
            <li>Describe the purpose and who the group would serve. Decide what experience, if any, participants need.</li>
            <li>Consider who will facilitate with you. RIM encourages facilitating in pairs so responsibility and support are shared.</li>
            <li>Send your idea to the coordinator before making further plans. The coordinator will discuss how it fits RIM’s <Link href="/about#vision">vision and mission</Link>.</li>
            <li>Work with the coordinator on the meeting arrangements and listing. Submitting a proposal does not by itself establish a RIM group.</li>
          </ol>
          <p>Use the <Link href="/kalyana-mitta/kalyana-mitta-group-application">proposal form</Link>, or ask questions at <a href="mailto:KalyanaMitta@rootedinmindfulness.org">KalyanaMitta@rootedinmindfulness.org</a>.</p>

          <h2 id="responsibilities">Shared responsibilities</h2>
          <ul>
            <li><strong>Purpose:</strong> Write a short statement of the group’s focus that reflects RIM’s vision and mission.</li>
            <li><strong>Care and conduct:</strong> Support everyone’s safety. Intentionally harmful or divisive speech and actions are not welcome.</li>
            <li><strong>Confidentiality:</strong> Agree together on confidentiality. Treat what people share as personal. Some groups also need to keep attendance private; establish that explicitly.</li>
            <li><strong>Listening and speech:</strong> Make room for everyone to be heard. Facilitators need to step in when someone dominates or the conversation loses its focus.</li>
            <li><strong>Boundaries:</strong> Be clear about the place of personal sharing and how it relates to the group’s purpose.</li>
            <li><strong>Feedback:</strong> Invite members to say what is and is not working. Address waning participation or commitment together.</li>
            <li><strong>Contact:</strong> Check in with the coordinator at least every three months, and let them know if the group ends.</li>
          </ul>

          <h2 id="planning">Planning choices</h2>
          <p>These are starting points to discuss with your co-facilitator and the coordinator, not one format every group must follow.</p>
          <ul>
            <li><strong>Size:</strong> Groups usually have 5–12 members, small enough for people to know one another.</li>
            <li><strong>Experience:</strong> Decide whether the group welcomes beginners or needs particular practice experience, and say so in its description.</li>
            <li><strong>Frequency and length:</strong> Groups may meet weekly, every two weeks, or monthly. Meetings generally last 1–3 hours.</li>
            <li><strong>Commitment:</strong> Consider a three- or six-month period of regular attendance, with room for travel, work, and unforeseen circumstances. Revisit the arrangement together afterward.</li>
            <li><strong>Daily life:</strong> Choose reflections or practices people can explore between meetings and bring back to the group.</li>
          </ul>

          <h2 id="format">A suggested meeting</h2>
          <ol>
            <li>Begin with silent meditation to settle together.</li>
            <li>Offer a check-in, with an agreed amount of time for each person.</li>
            <li>Give time to the group’s main practice, reading, discussion, or activity.</li>
            <li>Allow five or ten minutes for feedback about the meeting. Encourage truthful, useful speech without blame.</li>
            <li>Close with a short mindfulness or loving-kindness meditation.</li>
          </ol>

          <h2 id="support">Support and staying in touch</h2>
          <p>Co-facilitators are encouraged to talk after meetings about what went well and what needs attention. The coordinator and RIM teachers can offer guidance as the group develops. Establish contact with a teacher and check in from time to time.</p>
          <p>The coordinator can help with the website listing and weekly email, and may pass along feedback from members, leadership, or the guiding teacher. Contact <a href="mailto:KalyanaMitta@rootedinmindfulness.org">KalyanaMitta@rootedinmindfulness.org</a>.</p>
        </div>
        <div className="pp-actions"><Link href="/kalyana-mitta/kalyana-mitta-group-application" className="pp-btn">Propose a group</Link><Link href="/kalyana-mitta/community-groups-events" className="pp-link">See current groups</Link></div>
        </div>
      </section>
    </div>
  );
}
