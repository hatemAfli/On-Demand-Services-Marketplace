import React, { createContext, useContext } from "react";

type ProviderSidebarContextValue = {
  openSidebar: () => void;
};

const ProviderSidebarContext =
  createContext<ProviderSidebarContextValue | null>(null);

export function ProviderSidebarProvider({
  children,
  openSidebar,
}: {
  children: React.ReactNode;
  openSidebar: () => void;
}) {
  return (
    <ProviderSidebarContext.Provider value={{ openSidebar }}>
      {children}
    </ProviderSidebarContext.Provider>
  );
}

export function useProviderSidebarOpen(): () => void {
  const ctx = useContext(ProviderSidebarContext);
  return ctx?.openSidebar ?? (() => {});
}
