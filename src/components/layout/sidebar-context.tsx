"use client";

import * as React from "react";

interface SidebarValue {
  collapsed: boolean;
  toggle: () => void;
  setCollapsed: (v: boolean) => void;
}

const SidebarCtx = React.createContext<SidebarValue | null>(null);

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = React.useState(false);

  React.useEffect(() => {
    const v = localStorage.getItem("sidebar-collapsed");
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (v) setCollapsed(v === "1");
  }, []);

  React.useEffect(() => {
    localStorage.setItem("sidebar-collapsed", collapsed ? "1" : "0");
  }, [collapsed]);

  const toggle = React.useCallback(() => setCollapsed((c) => !c), []);

  return <SidebarCtx.Provider value={{ collapsed, toggle, setCollapsed }}>{children}</SidebarCtx.Provider>;
}

export function useSidebar() {
  return React.useContext(SidebarCtx) ?? { collapsed: false, toggle: () => {}, setCollapsed: () => {} };
}
