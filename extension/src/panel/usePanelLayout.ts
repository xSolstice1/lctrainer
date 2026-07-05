import { useEffect, useRef, useState } from "react";
import { STORAGE_KEY_PANEL_LAYOUT } from "../lib/constants.js";

export interface PanelLayout {
  top: number;
  right: number;
  width: number;
  height: number;
  opacity: number;
}

const DEFAULT_LAYOUT: PanelLayout = {
  top: 80,
  right: 16,
  width: 340,
  height: 480,
  opacity: 1,
};

const MIN_WIDTH = 260;
const MIN_HEIGHT = 220;

function clampLayout(layout: PanelLayout): PanelLayout {
  return {
    top: Math.max(0, layout.top),
    right: Math.max(0, layout.right),
    width: Math.max(MIN_WIDTH, layout.width),
    height: Math.max(MIN_HEIGHT, layout.height),
    opacity: Math.min(1, Math.max(0.2, layout.opacity)),
  };
}

export function usePanelLayout() {
  const [layout, setLayout] = useState<PanelLayout>(DEFAULT_LAYOUT);
  const layoutRef = useRef(layout);
  layoutRef.current = layout;

  useEffect(() => {
    chrome.storage.local.get(STORAGE_KEY_PANEL_LAYOUT).then((stored) => {
      const saved = stored[STORAGE_KEY_PANEL_LAYOUT];
      if (saved) setLayout(clampLayout({ ...DEFAULT_LAYOUT, ...saved }));
    });
  }, []);

  const persist = (next: PanelLayout) => {
    chrome.storage.local.set({ [STORAGE_KEY_PANEL_LAYOUT]: next });
  };

  const updateLayout = (partial: Partial<PanelLayout>) => {
    const next = clampLayout({ ...layoutRef.current, ...partial });
    setLayout(next);
    persist(next);
  };

  const startDrag = (startEvent: React.PointerEvent) => {
    startEvent.preventDefault();
    const startX = startEvent.clientX;
    const startY = startEvent.clientY;
    const start = layoutRef.current;

    const onMove = (e: PointerEvent) => {
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      setLayout(clampLayout({ ...layoutRef.current, top: start.top + dy, right: start.right - dx }));
    };
    const onUp = () => {
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", onUp);
      persist(layoutRef.current);
    };
    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerup", onUp);
  };

  const startResize = (startEvent: React.PointerEvent) => {
    startEvent.preventDefault();
    startEvent.stopPropagation();
    const startX = startEvent.clientX;
    const startY = startEvent.clientY;
    const start = layoutRef.current;

    const onMove = (e: PointerEvent) => {
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      setLayout(clampLayout({ ...layoutRef.current, width: start.width + dx, height: start.height + dy }));
    };
    const onUp = () => {
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", onUp);
      persist(layoutRef.current);
    };
    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerup", onUp);
  };

  return { layout, updateLayout, startDrag, startResize };
}
