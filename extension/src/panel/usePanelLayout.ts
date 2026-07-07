import { useEffect, useRef, useState } from "react";
import { STORAGE_KEY_PANEL_LAYOUT } from "../lib/constants.js";

export interface PanelLayout {
  top: number;
  left: number;
  width: number;
  height: number;
  opacity: number;
  minimized: boolean;
}

export type ResizeCorner = "nw" | "ne" | "sw" | "se";

const DEFAULT_WIDTH = 340;
const DEFAULT_HEIGHT = 480;

// The sidebar is always docked to the right edge — the main panel's default
// position and drag/resize bounds leave this much room so it never spawns
// or gets dragged underneath it.
export const SIDEBAR_WIDTH = 300;

function defaultLayout(): PanelLayout {
  return {
    top: 80,
    left: Math.max(0, window.innerWidth - 16 - SIDEBAR_WIDTH - DEFAULT_WIDTH),
    width: DEFAULT_WIDTH,
    height: DEFAULT_HEIGHT,
    opacity: 1,
    minimized: false,
  };
}

const MIN_WIDTH = 260;
const MIN_HEIGHT = 220;

function clampLayout(layout: PanelLayout): PanelLayout {
  const maxLeft = Math.max(0, window.innerWidth - SIDEBAR_WIDTH - layout.width);
  return {
    top: Math.max(0, layout.top),
    left: Math.min(maxLeft, Math.max(0, layout.left)),
    width: Math.max(MIN_WIDTH, layout.width),
    height: Math.max(MIN_HEIGHT, layout.height),
    opacity: Math.min(1, Math.max(0.2, layout.opacity)),
    minimized: layout.minimized,
  };
}

/** Migrates layouts persisted before the top/right -> top/left switch. */
function migrateStoredLayout(stored: any): Partial<PanelLayout> {
  if (stored && typeof stored.right === "number" && typeof stored.left !== "number") {
    const width = stored.width ?? DEFAULT_WIDTH;
    return { ...stored, left: Math.max(0, window.innerWidth - stored.right - width) };
  }
  return stored ?? {};
}

export function usePanelLayout() {
  const [layout, setLayout] = useState<PanelLayout>(defaultLayout);
  const layoutRef = useRef(layout);
  layoutRef.current = layout;

  useEffect(() => {
    chrome.storage.local.get(STORAGE_KEY_PANEL_LAYOUT).then((stored) => {
      const saved = migrateStoredLayout(stored[STORAGE_KEY_PANEL_LAYOUT]);
      if (Object.keys(saved).length > 0) setLayout(clampLayout({ ...defaultLayout(), ...saved }));
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

  const toggleMinimized = () => {
    updateLayout({ minimized: !layoutRef.current.minimized });
  };

  const startDrag = (startEvent: React.PointerEvent<HTMLElement>) => {
    startEvent.preventDefault();
    const target = startEvent.currentTarget;
    const pointerId = startEvent.pointerId;
    target.setPointerCapture(pointerId);
    const startX = startEvent.clientX;
    const startY = startEvent.clientY;
    const start = layoutRef.current;

    const onMove = (e: PointerEvent) => {
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      setLayout(clampLayout({ ...layoutRef.current, top: start.top + dy, left: start.left + dx }));
    };
    const onUp = () => {
      target.releasePointerCapture(pointerId);
      target.removeEventListener("pointermove", onMove);
      target.removeEventListener("pointerup", onUp);
      persist(layoutRef.current);
    };
    target.addEventListener("pointermove", onMove);
    target.addEventListener("pointerup", onUp);
  };

  const startResize = (startEvent: React.PointerEvent<HTMLElement>, corner: ResizeCorner) => {
    startEvent.preventDefault();
    startEvent.stopPropagation();
    const target = startEvent.currentTarget;
    const pointerId = startEvent.pointerId;
    target.setPointerCapture(pointerId);
    const startX = startEvent.clientX;
    const startY = startEvent.clientY;
    const start = layoutRef.current;
    const growsLeft = corner === "nw" || corner === "sw";
    const growsUp = corner === "nw" || corner === "ne";

    const onMove = (e: PointerEvent) => {
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;

      const rawWidth = growsLeft ? start.width - dx : start.width + dx;
      const rawHeight = growsUp ? start.height - dy : start.height + dy;
      const width = Math.max(MIN_WIDTH, rawWidth);
      const height = Math.max(MIN_HEIGHT, rawHeight);
      // When clamped to the minimum, the anchored edge must stop tracking the
      // pointer too — otherwise the panel visibly jumps once dx/dy exceeds
      // how far it can actually shrink.
      const left = growsLeft ? start.left + (start.width - width) : start.left;
      const top = growsUp ? start.top + (start.height - height) : start.top;

      setLayout(clampLayout({ ...layoutRef.current, left, top, width, height }));
    };
    const onUp = () => {
      target.releasePointerCapture(pointerId);
      target.removeEventListener("pointermove", onMove);
      target.removeEventListener("pointerup", onUp);
      persist(layoutRef.current);
    };
    target.addEventListener("pointermove", onMove);
    target.addEventListener("pointerup", onUp);
  };

  return { layout, updateLayout, toggleMinimized, startDrag, startResize };
}
