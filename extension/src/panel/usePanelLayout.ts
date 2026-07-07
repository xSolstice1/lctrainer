import { useEffect, useRef, useState } from "react";
import { STORAGE_KEY_PANEL_LAYOUT } from "../lib/constants.js";

export interface PanelLayout {
  top: number;
  left: number;
  width: number;
  height: number;
  opacity: number;
  minimized: boolean;
  /** Width of the sidebar docked to the panel's right edge — its top/height track the panel's, but its own width resizes independently. */
  sidebarWidth: number;
  sidebarCollapsed: boolean;
}

export type ResizeCorner = "nw" | "ne" | "sw" | "se";

const DEFAULT_WIDTH = 340;
const DEFAULT_HEIGHT = 480;
export const DEFAULT_SIDEBAR_WIDTH = 300;
const MIN_SIDEBAR_WIDTH = 220;
const MAX_SIDEBAR_WIDTH = 480;

function defaultLayout(): PanelLayout {
  return {
    top: 80,
    left: Math.max(0, window.innerWidth - 16 - DEFAULT_SIDEBAR_WIDTH - DEFAULT_WIDTH),
    width: DEFAULT_WIDTH,
    height: DEFAULT_HEIGHT,
    opacity: 1,
    minimized: false,
    sidebarWidth: DEFAULT_SIDEBAR_WIDTH,
    sidebarCollapsed: false,
  };
}

const MIN_WIDTH = 260;
const MIN_HEIGHT = 220;

function clampLayout(layout: PanelLayout): PanelLayout {
  return {
    top: Math.max(0, layout.top),
    left: Math.max(0, layout.left),
    width: Math.max(MIN_WIDTH, layout.width),
    height: Math.max(MIN_HEIGHT, layout.height),
    opacity: Math.min(1, Math.max(0.2, layout.opacity)),
    minimized: layout.minimized,
    sidebarWidth: Math.min(MAX_SIDEBAR_WIDTH, Math.max(MIN_SIDEBAR_WIDTH, layout.sidebarWidth)),
    sidebarCollapsed: layout.sidebarCollapsed,
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

/**
 * Wires up a pointer-driven drag: captures the pointer on the element the
 * gesture started on, reports (dx, dy) deltas from the start point on every
 * move, and cleans up + fires onDone once the pointer is released.
 */
function withPointerDrag(
  startEvent: React.PointerEvent<HTMLElement>,
  onMove: (dx: number, dy: number) => void,
  onDone: () => void,
  stopPropagation = false
) {
  startEvent.preventDefault();
  if (stopPropagation) startEvent.stopPropagation();
  const target = startEvent.currentTarget;
  const pointerId = startEvent.pointerId;
  target.setPointerCapture(pointerId);
  const startX = startEvent.clientX;
  const startY = startEvent.clientY;

  const handleMove = (e: PointerEvent) => onMove(e.clientX - startX, e.clientY - startY);
  const handleUp = () => {
    target.releasePointerCapture(pointerId);
    target.removeEventListener("pointermove", handleMove);
    target.removeEventListener("pointerup", handleUp);
    onDone();
  };
  target.addEventListener("pointermove", handleMove);
  target.addEventListener("pointerup", handleUp);
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

  const toggleSidebarCollapsed = () => {
    updateLayout({ sidebarCollapsed: !layoutRef.current.sidebarCollapsed });
  };

  const startDrag = (startEvent: React.PointerEvent<HTMLElement>) => {
    const start = layoutRef.current;
    withPointerDrag(
      startEvent,
      (dx, dy) => setLayout(clampLayout({ ...layoutRef.current, top: start.top + dy, left: start.left + dx })),
      () => persist(layoutRef.current)
    );
  };

  // Panel's own two corners of the whole panel+sidebar rectangle — the other
  // two corners (top-right, bottom-right) belong to the sidebar and are
  // handled by startSidebarCorner below.
  const startResize = (startEvent: React.PointerEvent<HTMLElement>, corner: ResizeCorner) => {
    const start = layoutRef.current;
    const growsLeft = corner === "nw" || corner === "sw";
    const growsUp = corner === "nw" || corner === "ne";

    withPointerDrag(
      startEvent,
      (dx, dy) => {
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
      },
      () => persist(layoutRef.current),
      true
    );
  };

  // Panel's outer-left edge — resizes panel width/left only.
  const startWestEdgeResize = (startEvent: React.PointerEvent<HTMLElement>) => {
    const start = layoutRef.current;
    withPointerDrag(
      startEvent,
      (dx) => {
        const width = Math.max(MIN_WIDTH, start.width - dx);
        const left = start.left + (start.width - width);
        setLayout(clampLayout({ ...layoutRef.current, left, width }));
      },
      () => persist(layoutRef.current),
      true
    );
  };

  // Sidebar's outer-right edge — resizes sidebarWidth only, natural direction.
  const startEastEdgeResize = (startEvent: React.PointerEvent<HTMLElement>) => {
    const start = layoutRef.current;
    withPointerDrag(
      startEvent,
      (dx) => setLayout(clampLayout({ ...layoutRef.current, sidebarWidth: start.sidebarWidth + dx })),
      () => persist(layoutRef.current),
      true
    );
  };

  // Shared top edge (spans both panel and sidebar, since they share top/height).
  const startNorthEdgeResize = (startEvent: React.PointerEvent<HTMLElement>) => {
    const start = layoutRef.current;
    withPointerDrag(
      startEvent,
      (_dx, dy) => {
        const height = Math.max(MIN_HEIGHT, start.height - dy);
        const top = start.top + (start.height - height);
        setLayout(clampLayout({ ...layoutRef.current, top, height }));
      },
      () => persist(layoutRef.current),
      true
    );
  };

  // Shared bottom edge.
  const startSouthEdgeResize = (startEvent: React.PointerEvent<HTMLElement>) => {
    const start = layoutRef.current;
    withPointerDrag(
      startEvent,
      (_dx, dy) => setLayout(clampLayout({ ...layoutRef.current, height: Math.max(MIN_HEIGHT, start.height + dy) })),
      () => persist(layoutRef.current),
      true
    );
  };

  // The seam between panel and sidebar — an internal divider, not an outer
  // edge: dragging it redistributes width between the two (panel grows,
  // sidebar shrinks by the same clamped amount, or vice versa) rather than
  // changing the combined rectangle's total width.
  const startSeamResize = (startEvent: React.PointerEvent<HTMLElement>) => {
    const start = layoutRef.current;
    withPointerDrag(
      startEvent,
      (dx) => {
        const width = Math.max(MIN_WIDTH, start.width + dx);
        const appliedDx = width - start.width;
        setLayout(clampLayout({ ...layoutRef.current, width, sidebarWidth: start.sidebarWidth - appliedDx }));
      },
      () => persist(layoutRef.current),
      true
    );
  };

  // Sidebar's own two corners of the whole rectangle (top-right, bottom-right):
  // dx grows sidebarWidth (same direction as the east edge), dy behaves like
  // the north/south edge depending on which corner.
  const startSidebarCorner = (startEvent: React.PointerEvent<HTMLElement>, corner: "ne" | "se") => {
    const start = layoutRef.current;
    const growsUp = corner === "ne";
    withPointerDrag(
      startEvent,
      (dx, dy) => {
        const rawHeight = growsUp ? start.height - dy : start.height + dy;
        const height = Math.max(MIN_HEIGHT, rawHeight);
        const top = growsUp ? start.top + (start.height - height) : start.top;
        setLayout(clampLayout({ ...layoutRef.current, top, height, sidebarWidth: start.sidebarWidth + dx }));
      },
      () => persist(layoutRef.current),
      true
    );
  };

  return {
    layout,
    updateLayout,
    toggleMinimized,
    toggleSidebarCollapsed,
    startDrag,
    startResize,
    startWestEdgeResize,
    startEastEdgeResize,
    startNorthEdgeResize,
    startSouthEdgeResize,
    startSeamResize,
    startSidebarCorner,
  };
}
