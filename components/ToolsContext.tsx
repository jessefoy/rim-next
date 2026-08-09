"use client";

/**
 * ToolsContext — provides tool-specific config to the ToolsNav.
 * Each tool's layout sets this via ToolsProvider.
 * The tools shell layout reads it via useToolsContext.
 *
 * hubSlug is read from the ?hub= search param automatically.
 */

import { createContext, useContext, useMemo, Suspense } from "react";
import { useSearchParams } from "next/navigation";

export interface SubNavItem {
  label: string;
  href: string;
}

interface ToolsConfig {
  toolName: string;
  backHref: string;
  backLabel: string;
  subNav?: SubNavItem[];
  hubSlug?: string;
}

/** Server-side config passed by each tool layout (no hubSlug — that comes from URL). */
export interface ToolsProviderProps {
  toolName: string;
  backHref: string;
  backLabel: string;
  subNav?: SubNavItem[];
}

const ToolsContext = createContext<ToolsConfig>({
  toolName: "",
  backHref: "/account/dashboard",
  backLabel: "My RIM",
});

function ToolsProviderInner({
  children,
  value,
}: {
  children: React.ReactNode;
  value: ToolsProviderProps;
}) {
  const searchParams = useSearchParams();
  const hubSlug = searchParams.get("hub") ?? undefined;

  const config = useMemo<ToolsConfig>(
    () => ({ ...value, hubSlug }),
    [value, hubSlug]
  );

  return <ToolsContext.Provider value={config}>{children}</ToolsContext.Provider>;
}

export function ToolsProvider({
  children,
  value,
}: {
  children: React.ReactNode;
  value: ToolsProviderProps;
}) {
  return (
    <Suspense fallback={
      <ToolsContext.Provider value={{ ...value }}>
        {children}
      </ToolsContext.Provider>
    }>
      <ToolsProviderInner value={value}>{children}</ToolsProviderInner>
    </Suspense>
  );
}

export function useToolsContext() {
  return useContext(ToolsContext);
}
