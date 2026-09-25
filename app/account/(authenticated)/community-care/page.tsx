import AccountLayout from "@/components/AccountLayout";
import { COMMUNITY_AGREEMENTS, COMMUNITY_AGREEMENTS_LEAD_IN, COMMUNITY_SHARED_VISION_TITLE } from "@/lib/communityAgreements";
export const metadata = { title: "Community Care — Rooted In Mindfulness" };
export default function CommunityCarePage() {
  return <AccountLayout><article className="ac-member-page rim-care">
    <header className="ac-page-head"><h1 className="ac-page-title">Community Care</h1></header>
    <div className="rim-content"><p><strong>{COMMUNITY_SHARED_VISION_TITLE}.</strong> {COMMUNITY_AGREEMENTS_LEAD_IN}</p>
      <ol className="rim-care__agreements">{COMMUNITY_AGREEMENTS.map(agreement => <li key={agreement.title}>
        <h2>{agreement.title}</h2><p>{agreement.summary}</p>
      </li>)}</ol>
    </div>
  </article></AccountLayout>;
}
