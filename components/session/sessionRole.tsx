"use client";

/**
 * SessionRoleContext — distributes the viewer's permission tier into
 * descendants of RIMConference without prop-drilling through GridLayout
 * children (LiveKit's layouts re-mount tile components and don't accept
 * arbitrary props).
 *
 * Consumers: RIMParticipantTile (hover-mute affordance).
 */

import { createContext, useContext } from "react";

export interface SessionRoleValue {
  isSessionHost: boolean;
  isCoHost: boolean;
  programSlug: string;
  /**
   * LiveKit identity of the local participant; tiles use it to suppress
   * self-affordances. Null until LiveKit's localParticipant is bound — any
   * consumer must check truthiness before comparing.
   */
  localIdentity: string | null;
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
