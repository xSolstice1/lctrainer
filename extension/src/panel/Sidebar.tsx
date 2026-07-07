import { useState, type ReactNode } from "react";

export type SidebarTabId = "solved" | "attempted";

interface SidebarProps {
  theme: "dark" | "light";
  top: number;
  left: number;
  width: number;
  height: number;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  onEastEdgeResizeStart: (e: React.PointerEvent<HTMLElement>) => void;
  onNorthEdgeResizeStart: (e: React.PointerEvent<HTMLElement>) => void;
  onSouthEdgeResizeStart: (e: React.PointerEvent<HTMLElement>) => void;
  onCornerResizeStart: (e: React.PointerEvent<HTMLElement>, corner: "ne" | "se") => void;
  solvedTab: ReactNode;
  attemptedTab: ReactNode;
}

const TAB_LABELS: Record<SidebarTabId, string> = {
  solved: "Solved",
  attempted: "Attempted",
};

export function Sidebar({
  theme,
  top,
  left,
  width,
  height,
  collapsed,
  onToggleCollapsed,
  onEastEdgeResizeStart,
  onNorthEdgeResizeStart,
  onSouthEdgeResizeStart,
  onCornerResizeStart,
  solvedTab,
  attemptedTab,
}: SidebarProps) {
  const [activeTab, setActiveTab] = useState<SidebarTabId>("solved");

  return (
    <div
      className={`sidebar lctrainer-panel theme-${theme}${collapsed ? " collapsed" : ""}`}
      style={{ position: "fixed", top, left, width, height: collapsed ? undefined : height, pointerEvents: "auto" }}
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
        <button
          type="button"
          className="icon-button"
          title={collapsed ? "Expand" : "Collapse"}
          onClick={onToggleCollapsed}
        >
          {collapsed ? "◂" : "▸"}
        </button>
      </div>
      {!collapsed && (
        <>
          <div className="sidebar-body">{activeTab === "solved" ? solvedTab : attemptedTab}</div>
          <div className="edge-resize-handle edge-resize-handle-n" onPointerDown={onNorthEdgeResizeStart} />
          <div className="edge-resize-handle edge-resize-handle-e" onPointerDown={onEastEdgeResizeStart} />
          <div className="edge-resize-handle edge-resize-handle-s" onPointerDown={onSouthEdgeResizeStart} />
          <div className="resize-handle resize-handle-ne" onPointerDown={(e) => onCornerResizeStart(e, "ne")} />
          <div className="resize-handle resize-handle-se" onPointerDown={(e) => onCornerResizeStart(e, "se")} />
        </>
      )}
    </div>
  );
}
