import { useState, type ReactNode } from "react";

export type DrawerTabId = "problem" | "learned";

interface DrawerProps {
  open: boolean;
  onClose: () => void;
  problemTab: ReactNode;
  learnedTab: ReactNode;
}

const TAB_LABELS: Record<DrawerTabId, string> = {
  problem: "This Problem",
  learned: "Learned",
};

export function Drawer({ open, onClose, problemTab, learnedTab }: DrawerProps) {
  const [activeTab, setActiveTab] = useState<DrawerTabId>("problem");

  return (
    <div className={`drawer${open ? " open" : ""}`} onPointerDown={(e) => e.stopPropagation()}>
      <div className="drawer-header">
        <div className="drawer-tabs">
          {(Object.keys(TAB_LABELS) as DrawerTabId[]).map((tab) => (
            <button
              key={tab}
              type="button"
              className={`drawer-tab${activeTab === tab ? " active" : ""}`}
              onClick={() => setActiveTab(tab)}
            >
              {TAB_LABELS[tab]}
            </button>
          ))}
        </div>
        <button type="button" className="icon-button" title="Close" onClick={onClose}>
          ✕
        </button>
      </div>
      <div className="drawer-body">{activeTab === "problem" ? problemTab : learnedTab}</div>
    </div>
  );
}
