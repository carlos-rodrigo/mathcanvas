import type { CanvasCommand, CanvasElement } from "@/lib/commands/canvasTypes";

// ── Renderer-level types ─────────────────────────────────────────────

/** Virtual canvas coordinate space (desktop-first). */
export const CANVAS_WIDTH = 800;
export const CANVAS_HEIGHT = 500;

/** Props shared by every SVG primitive component. */
export interface PrimitiveProps<T extends CanvasElement = CanvasElement> {
  /** The validated canvas element descriptor. */
  el: T;
}

/** Props for the Highlight primitive which needs access to siblings. */
export interface HighlightPrimitiveProps {
  el: import("@/lib/commands/canvasTypes").Highlight;
  allElements: CanvasElement[];
}

/** Result of applying a sequence of `CanvasCommand`s to a list of elements. */
export type ElementMap = CanvasElement[];

/**
 * Apply an ordered list of canvas commands to the current element array
 * and return a new array (immutable).
 */
export function applyCanvasCommands(
  current: CanvasElement[],
  commands: CanvasCommand[],
): CanvasElement[] {
  let next = [...current];
  for (const cmd of commands) {
    if (cmd.action === "clear") {
      next = cmd.targetId ? next.filter((el) => el.id !== cmd.targetId) : [];
    } else {
      const idx = next.findIndex((el) => el.id === cmd.element.id);
      if (idx >= 0) {
        next[idx] = cmd.element;
      } else {
        next.push(cmd.element);
      }
    }
  }
  return next;
}
