import { useState, type ReactNode } from "react";

export type SidebarTabId = "solved" | "attempted";

interface SidebarProps {
  theme: "dark" | "light";
  top: number;
  left: number;
  width: number;
  height: number;
  onResizeStart: (e: React.PointerEvent<HTMLElement>) => void;
  solvedTab: ReactNode;
  attemptedTab: ReactNode;
}

const TAB_LABELS: Record<SidebarTabId, string> = {
  solved: "Solved",
  attempted: "Attempted",
};

export function Sidebar({ theme, top, left, width, height, onResizeStart, solvedTab, attemptedTab }: SidebarProps) {
  const [activeTab, setActiveTab] = useState<SidebarTabId>("solved");

  return (
    <div
      className={`sidebar lctrainer-panel theme-${theme}`}
      style={{ position: "fixed", top, left, width, height, pointerEvents: "auto" }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div className="sidebar-resize-handle" onPointerDown={onResizeStart} />
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
