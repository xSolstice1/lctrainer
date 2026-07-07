import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { SIDEBAR_WIDTH, usePanelLayout } from "./usePanelLayout.js";

beforeEach(() => {
  vi.stubGlobal("chrome", {
    storage: { local: { get: vi.fn().mockResolvedValue({}), set: vi.fn().mockResolvedValue(undefined) } },
  });
  Element.prototype.setPointerCapture = vi.fn();
  Element.prototype.releasePointerCapture = vi.fn();
});

function pointerEvent(overrides: Partial<React.PointerEvent<HTMLElement>>): React.PointerEvent<HTMLElement> {
  const target = document.createElement("div");
  return {
    preventDefault: () => {},
    stopPropagation: () => {},
    currentTarget: target,
    pointerId: 1,
    clientX: 0,
    clientY: 0,
    ...overrides,
  } as React.PointerEvent<HTMLElement>;
}

describe("usePanelLayout resize", () => {
  it("grows from the se corner by following the pointer", () => {
    const { result } = renderHook(() => usePanelLayout());
    const startWidth = result.current.layout.width;
    const startHeight = result.current.layout.height;

    act(() => {
      const startEvent = pointerEvent({ clientX: 100, clientY: 100 });
      result.current.startResize(startEvent, "se");
      const target = startEvent.currentTarget;
      target.dispatchEvent(Object.assign(new Event("pointermove"), { clientX: 140, clientY: 160 }));
    });

    expect(result.current.layout.width).toBe(startWidth + 40);
    expect(result.current.layout.height).toBe(startHeight + 60);
  });

  it("keeps the right/bottom edge anchored when growing from the nw corner", () => {
    const { result } = renderHook(() => usePanelLayout());
    const start = result.current.layout;

    act(() => {
      const startEvent = pointerEvent({ clientX: 100, clientY: 100 });
      result.current.startResize(startEvent, "nw");
      const target = startEvent.currentTarget;
      // Drag the nw corner inward (down-right) by 20px each axis: shrinks the panel.
      target.dispatchEvent(Object.assign(new Event("pointermove"), { clientX: 120, clientY: 120 }));
    });

    const next = result.current.layout;
    expect(next.width).toBe(start.width - 20);
    expect(next.height).toBe(start.height - 20);
    expect(next.left).toBe(start.left + 20);
    expect(next.top).toBe(start.top + 20);
  });

  it("clamps width/height to the minimum and stops the anchored edge from tracking further", () => {
    const { result } = renderHook(() => usePanelLayout());
    const start = result.current.layout;

    act(() => {
      const startEvent = pointerEvent({ clientX: 100, clientY: 100 });
      result.current.startResize(startEvent, "nw");
      const target = startEvent.currentTarget;
      // Drag far past the point where the panel would shrink below its minimum size.
      target.dispatchEvent(Object.assign(new Event("pointermove"), { clientX: 100 + start.width, clientY: 100 + start.height }));
    });

    const next = result.current.layout;
    expect(next.width).toBe(260); // MIN_WIDTH
    expect(next.height).toBe(220); // MIN_HEIGHT
    expect(next.left).toBe(start.left + (start.width - 260));
    expect(next.top).toBe(start.top + (start.height - 220));
  });

  it("clamps opacity into [0.2, 1] via updateLayout", () => {
    const { result } = renderHook(() => usePanelLayout());

    act(() => result.current.updateLayout({ opacity: 5 }));
    expect(result.current.layout.opacity).toBe(1);

    act(() => result.current.updateLayout({ opacity: -1 }));
    expect(result.current.layout.opacity).toBe(0.2);
  });

  it("clamps left so the panel never overlaps the docked sidebar", () => {
    const { result } = renderHook(() => usePanelLayout());

    act(() => result.current.updateLayout({ left: window.innerWidth }));

    expect(result.current.layout.left).toBe(window.innerWidth - SIDEBAR_WIDTH - result.current.layout.width);
  });

  it("toggles minimized state", () => {
    const { result } = renderHook(() => usePanelLayout());
    expect(result.current.layout.minimized).toBe(false);
    act(() => result.current.toggleMinimized());
    expect(result.current.layout.minimized).toBe(true);
  });
});
