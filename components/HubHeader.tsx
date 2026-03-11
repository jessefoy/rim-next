/**
 * HubHeader — top-of-page header for any hub.
 * Shows hub type eyebrow, hub name, and member/coordinator meta line.
 */

interface HubMemberRow {
  isCoordinator: boolean;
  user: { firstName: string | null; lastName: string | null; preferredName: string | null };
}

interface Props {
  hubType: "OPERATIONAL" | "GOVERNANCE" | "COMMUNITY_GROUP";
  hubName: string;
  memberCount: number;
  members: HubMemberRow[];
}

const TYPE_LABEL: Record<string, string> = {
  OPERATIONAL:    "Operational Hub",
  GOVERNANCE:     "Governance Hub",
  COMMUNITY_GROUP: "Community Group",
};

function displayName(m: HubMemberRow["user"]) {
  return m.preferredName || [m.firstName, m.lastName].filter(Boolean).join(" ") || "—";
}

export default function HubHeader({ hubType, hubName, memberCount, members }: Props) {
  const coordinators = members.filter((m) => m.isCoordinator);

  return (
    <div className="hub-hdr">
      <div className="hub-hdr__eyebrow">{TYPE_LABEL[hubType] ?? hubType}</div>
      <div className="hub-hdr__title">{hubName}</div>
      <div className="hub-hdr__meta">
        {memberCount} member{memberCount !== 1 ? "s" : ""}
        {coordinators.length > 0 && (
          <>
            {" · "}Coordinator{coordinators.length > 1 ? "s" : ""}:{" "}
            {coordinators.map((c) => displayName(c.user)).join(", ")}
          </>
        )}
      </div>
    </div>
  );
}
