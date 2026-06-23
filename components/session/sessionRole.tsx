"use client";

/**
 * SessionRoleContext — distributes the viewer's permission tier into
 * descendants of RIMConference without prop-drilling through GridLayout
 * children (LiveKit's layouts re-mount tile components and don't accept
 * arbitrary props).
 *
 * Consumers: RIMParticipantTile (hover-mute affordance + pin/unpin).
 */

import { createContext, useContext } from "react";

export interface SessionRoleValue {
  isSessionHost: boolean;
  isCoHost: boolean;
  /** ProgramTeacher row exists for this program — drives Teacher pill + audio profile. */
  isProgramTeacher: boolean;
  programSlug: string;
  /**
   * Session date (YYYY-MM-DD in CT) — issued by the token route to scope
   * the LiveKit room and chat to a single occurrence. Action routes
   * (mute-participant, mute-all, end-session, step-in) must include this
   * in their body so the server resolves the same room name the client
   * is connected to.
   */
  sessionDate: string | undefined;
  /**
   * LiveKit identity of the local participant; tiles use it to suppress
   * self-affordances. Null until LiveKit's localParticipant is bound — any
   * consumer must check truthiness before comparing.
   */
  localIdentity: string | null;
  /**
   * Local pin — the identity the viewer has manually pinned to their focus
   * view, or null. Purely client-side (this viewer only); not broadcast.
   * When set, the pin-orchestration effect in RIMConference forces focus
   * layout on this participant and suppresses active-speaker auto-follow.
   */
  pinnedIdentity: string | null;
  /** Toggle the local pin on a participant identity (pin if not pinned, else unpin). */
  onTogglePin: (identity: string) => void;
  /** Room-wide host "Spotlight" (Zoom parity) — the identity spotlighted for
   *  everyone, or null. Distributed via room metadata; folded into focus
   *  precedence below a personal pin and an active screen share. */
  spotlightedIdentity: string | null;
  /** Co-host: set/clear the room-wide spotlight on a participant (toggle).
   *  Server-gated via /api/livekit/spotlight. */
  onToggleSpotlight: (identity: string) => void;
}

const SessionRoleContext = createContext<SessionRoleValue | null>(null);

export function SessionRoleProvider({
  value,
  children,
}: {
  value: SessionRoleValue;
  children: React.ReactNode;
}) {
  return (
    <SessionRoleContext.Provider value={value}>
      {children}
    </SessionRoleContext.Provider>
  );
}

export function useSessionRole(): SessionRoleValue | null {
  return useContext(SessionRoleContext);
}
