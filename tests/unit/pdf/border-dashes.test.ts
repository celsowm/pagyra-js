import { describe, it, expect } from "vitest";
import { computeBorderSideStrokes, computeDashForStyle } from "../../../src/pdf/utils/border-dashes.js";
import type { BorderStyles, Edges, Rect, Radius, RGBA } from "../../../src/pdf/types.js";

describe("border-dashes geometry", () => {
  const rect: Rect = { x: 0, y: 0, width: 200, height: 50 };
  const border: Edges = { top: 2, right: 2, bottom: 2, left: 2 };
  const color: RGBA = { r: 0, g: 0, b: 0, a: 1 };
  const radius: Radius = {
    topLeft: { x: 0, y: 0 },
    topRight: { x: 0, y: 0 },
    bottomRight: { x: 0, y: 0 },
    bottomLeft: { x: 0, y: 0 },
  };

  it("computes dash pattern for dashed and dotted styles", () => {
    expect(computeDashForStyle("dashed", 2)).toEqual({ pattern: [6, 6], phase: 0 });
    expect(computeDashForStyle("dotted", 2)).toEqual({ pattern: [2, 2], phase: 0 });
    expect(computeDashForStyle("solid", 2)).toBeUndefined();
    expect(computeDashForStyle("none", 2)).toBeUndefined();
  });

  it("produces strokes only for visible sides", () => {
    const styles: BorderStyles = { top: "dashed", right: "none", bottom: "none", left: "none" };
    const strokes = computeBorderSideStrokes(rect, border, styles, color, radius);
    expect(strokes).toHaveLength(1);
    expect(strokes[0]?.side).toBe("top");
    expect(strokes[0]?.lineWidth).toBe(2);
    expect(strokes[0]?.dash?.pattern).toEqual([6, 6]);
  });

  it("calculates stroke centerlines inside border box", () => {
    const styles: BorderStyles = { top: "solid", right: "solid", bottom: "solid", left: "solid" };
    const strokes = computeBorderSideStrokes(rect, border, styles, color, radius);
    expect(strokes).toHaveLength(4);
    const top = strokes.find((s) => s.side === "top")!;
    const bottom = strokes.find((s) => s.side === "bottom")!;
    const left = strokes.find((s) => s.side === "left")!;
    const right = strokes.find((s) => s.side === "right")!;

    expect(top.points[0].y).toBeCloseTo(1);
    expect(top.points[1].y).toBeCloseTo(1);
    expect(bottom.points[0].y).toBeCloseTo(49);
    expect(bottom.points[1].y).toBeCloseTo(49);
    expect(left.points[0].x).toBeCloseTo(1);
    expect(left.points[1].x).toBeCloseTo(1);
    expect(right.points[0].x).toBeCloseTo(199);
    expect(right.points[1].x).toBeCloseTo(199);
  });
});

