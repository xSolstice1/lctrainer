import { useEffect, useState, type ReactNode } from "react";
import { STORAGE_KEY_SIDEBAR_TAB } from "../lib/constants.js";

export type SidebarTabId = "solved" | "attempted" | "studyplan";

const VALID_TAB_IDS: SidebarTabId[] = ["solved", "attempted", "studyplan"];

interface SidebarProps {
  theme: "dark" | "light";
  top: number;
  left: number;
  width: number;
  height: number;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  onHideAll: () => void;
  onEastEdgeResizeStart: (e: React.PointerEvent<HTMLElement>) => void;
  onNorthEdgeResizeStart: (e: React.PointerEvent<HTMLElement>) => void;
  onSouthEdgeResizeStart: (e: React.PointerEvent<HTMLElement>) => void;
  onCornerResizeStart: (e: React.PointerEvent<HTMLElement>, corner: "ne" | "se") => void;
  solvedTab: ReactNode;
  attemptedTab: ReactNode;
  studyPlanTab: ReactNode;
}

const TAB_LABELS: Record<SidebarTabId, string> = {
  solved: "Solved",
  attempted: "Attempted",
  studyplan: "Study Plan",
};


export function Sidebar({
  theme,
  top,
  left,
  width,
  height,
  collapsed,
  onToggleCollapsed,
  onHideAll,
  onEastEdgeResizeStart,
  onNorthEdgeResizeStart,
  onSouthEdgeResizeStart,
  onCornerResizeStart,
  solvedTab,
  attemptedTab,
  studyPlanTab,
}: SidebarProps) {
  const [activeTab, setActiveTab] = useState<SidebarTabId>("solved");

  useEffect(() => {
    chrome.storage.local.get(STORAGE_KEY_SIDEBAR_TAB).then((stored) => {
      if (VALID_TAB_IDS.includes(stored[STORAGE_KEY_SIDEBAR_TAB])) setActiveTab(stored[STORAGE_KEY_SIDEBAR_TAB]);
    });
  }, []);

  const selectTab = (tab: SidebarTabId) => {
    setActiveTab(tab);
    chrome.storage.local.set({ [STORAGE_KEY_SIDEBAR_TAB]: tab });
  };

  if (collapsed) {
    return null;
  }

  return (
    <div
      className={`sidebar lctrainer-panel theme-${theme}`}
      style={{ position: "fixed", top, left, width, height, pointerEvents: "auto" }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div className="sidebar-header">
        <div className="sidebar-tabs">
          {(Object.keys(TAB_LABELS) as SidebarTabId[]).map((tab) => (
            <button
              key={tab}
              type="button"
              className={`sidebar-tab${activeTab === tab ? " active" : ""}`}
              onClick={() => selectTab(tab)}
            >
              {TAB_LABELS[tab]}
            </button>
          ))}
        </div>
        <button type="button" className="header-btn sidebar-hide-btn" title="Hide extension" onClick={onHideAll}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="4 14 10 14 10 20" /><polyline points="20 10 14 10 14 4" /><line x1="14" y1="10" x2="21" y2="3" /><line x1="3" y1="21" x2="10" y2="14" />
          </svg>
        </button>
      </div>
      <div className="sidebar-body">
        {activeTab === "solved" ? solvedTab : activeTab === "attempted" ? attemptedTab : studyPlanTab}
      </div>
      <div className="edge-resize-handle edge-resize-handle-n" onPointerDown={onNorthEdgeResizeStart} />
      <div className="edge-resize-handle edge-resize-handle-e" onPointerDown={onEastEdgeResizeStart} />
      <div className="edge-resize-handle edge-resize-handle-s" onPointerDown={onSouthEdgeResizeStart} />
      <div className="resize-handle resize-handle-ne" onPointerDown={(e) => onCornerResizeStart(e, "ne")} />
      <div className="resize-handle resize-handle-se" onPointerDown={(e) => onCornerResizeStart(e, "se")} />
    </div>
  );
}
