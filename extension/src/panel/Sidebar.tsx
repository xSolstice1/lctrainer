import { useState, type ReactNode } from "react";

export type SidebarTabId = "solved" | "attempted";

interface SidebarProps {
  theme: "dark" | "light";
  solvedTab: ReactNode;
  attemptedTab: ReactNode;
}

const TAB_LABELS: Record<SidebarTabId, string> = {
  solved: "Solved",
  attempted: "Attempted",
};

export function Sidebar({ theme, solvedTab, attemptedTab }: SidebarProps) {
  const [activeTab, setActiveTab] = useState<SidebarTabId>("solved");

  return (
    <div
      className={`sidebar lctrainer-panel theme-${theme}`}
      style={{ pointerEvents: "auto" }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div className="sidebar-header">
        <div className="sidebar-tabs">
          {(Object.keys(TAB_LABELS) as SidebarTabId[]).map((tab) => (
            <button
              key={tab}
              type="button"
              className={`sidebar-tab${activeTab === tab ? " active" : ""}`}
              onClick={() => setActiveTab(tab)}
            >
              {TAB_LABELS[tab]}
            </button>
          ))}
        </div>
      </div>
      <div className="sidebar-body">{activeTab === "solved" ? solvedTab : attemptedTab}</div>
    </div>
  );
}
