"use client";

/**
 * ToolsContext — provides tool-specific config to the ToolsNav.
 * Each tool's layout sets this via ToolsProvider.
 * The tools shell layout reads it via useToolsContext.
 */

import { createContext, useContext } from "react";

export interface SubNavItem {
  label: string;
  href: string;
}

interface ToolsConfig {
  toolName: string;
  backHref: string;
  backLabel: string;
  subNav?: SubNavItem[];
}

const ToolsContext = createContext<ToolsConfig>({
  toolName: "",
  backHref: "/account/dashboard",
  backLabel: "Dashboard",
});

export function ToolsProvider({
  children,
  value,
}: {
  children: React.ReactNode;
  value: ToolsConfig;
}) {
  return <ToolsContext.Provider value={value}>{children}</ToolsContext.Provider>;
}

export function useToolsContext() {
  return useContext(ToolsContext);
}
