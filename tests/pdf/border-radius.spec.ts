import { generateRoundedRectPath } from "../../src/pdf/renderers/rounded-rect-path.js";
import type { Radius, Rect } from "../../src/pdf/types.js";
import { normalizeRadiiForRect, isZeroRadius } from "../../src/pdf/renderers/radius-utils.js";

describe("border-radius rendering", () => {
  it("generates correct path for rounded rectangle with 15px radius", () => {
    const width = 100;
    const height = 50;
    const radii: Radius = {
      topLeft: { x: 15, y: 15 },
      topRight: { x: 15, y: 15 },
      bottomRight: { x: 15, y: 15 },
      bottomLeft: { x: 15, y: 15 },
    };

    const path = generateRoundedRectPath(width, height, radii, 0, 0);

    console.log("Generated path:");
    console.log(path.join("\n"));

    // Should have move command, edges, and 4 Bézier curves for corners
    expect(path.length).toBeGreaterThan(0);
    
    // First command should be move to (tl.x, 0) = (15, 0)
    expect(path[0]).toBe("15 0 m");
    
    // Path should contain 4 cubic Bézier curves (for the 4 corners)
    const bezierCurves = path.filter(cmd => cmd.endsWith(" c"));
    expect(bezierCurves.length).toBe(4);
    
    // Last command should close the path
    expect(path[path.length - 1]).toBe("h");
  });

  it("generates straight lines for zero radius", () => {
    const width = 100;
    const height = 50;
    const radii: Radius = {
      topLeft: { x: 0, y: 0 },
      topRight: { x: 0, y: 0 },
      bottomRight: { x: 0, y: 0 },
      bottomLeft: { x: 0, y: 0 },
    };

    const path = generateRoundedRectPath(width, height, radii, 0, 0);

    console.log("Generated path for zero radius:");
    console.log(path.join("\n"));

    // Should not have any Bézier curves
    const bezierCurves = path.filter(cmd => cmd.endsWith(" c"));
    expect(bezierCurves.length).toBe(0);
  });

  it("normalizes radii correctly when they fit within bounds", () => {
    const width = 200;
    const height = 63;
    const radii: Radius = {
      topLeft: { x: 15, y: 15 },
      topRight: { x: 15, y: 15 },
      bottomRight: { x: 15, y: 15 },
      bottomLeft: { x: 15, y: 15 },
    };

    const normalized = normalizeRadiiForRect(width, height, radii);

    console.log("Normalized radii:", JSON.stringify(normalized, null, 2));

    // Radii should remain unchanged when they fit within bounds
    expect(normalized.topLeft.x).toBe(15);
    expect(normalized.topLeft.y).toBe(15);
    expect(normalized.topRight.x).toBe(15);
    expect(normalized.topRight.y).toBe(15);
    expect(normalized.bottomLeft.x).toBe(15);
    expect(normalized.bottomLeft.y).toBe(15);
    expect(normalized.bottomRight.x).toBe(15);
    expect(normalized.bottomRight.y).toBe(15);
  });

  it("generates correct outer and inner paths for border difference", () => {
    // Simulate what fillRoundedRectDifference does
    const outerRect: Rect = { x: 32, y: 22, width: 207.168, height: 63.2 };
    const outerRadii: Radius = {
      topLeft: { x: 15, y: 15 },
      topRight: { x: 15, y: 15 },
      bottomRight: { x: 15, y: 15 },
      bottomLeft: { x: 15, y: 15 },
    };
    const border = { top: 2, right: 2, bottom: 2, left: 2 };
    
    const innerRect: Rect = {
      x: outerRect.x + border.left,
      y: outerRect.y + border.top,
      width: Math.max(outerRect.width - border.left - border.right, 0),
      height: Math.max(outerRect.height - border.top - border.bottom, 0),
    };
    const innerRadii: Radius = {
      topLeft: { x: Math.max(15 - border.left, 0), y: Math.max(15 - border.top, 0) },
      topRight: { x: Math.max(15 - border.right, 0), y: Math.max(15 - border.top, 0) },
      bottomRight: { x: Math.max(15 - border.right, 0), y: Math.max(15 - border.bottom, 0) },
      bottomLeft: { x: Math.max(15 - border.left, 0), y: Math.max(15 - border.bottom, 0) },
    };

    const outerAdjusted = normalizeRadiiForRect(outerRect.width, outerRect.height, outerRadii);
    const innerAdjusted = normalizeRadiiForRect(innerRect.width, innerRect.height, innerRadii);

    const outerPath = generateRoundedRectPath(outerRect.width, outerRect.height, outerAdjusted, 0, 0);
    
    const offsetX = innerRect.x - outerRect.x;  // 2
    const offsetY = innerRect.y - outerRect.y;  // 2
    const innerPath = generateRoundedRectPath(innerRect.width, innerRect.height, innerAdjusted, offsetX, offsetY);

    console.log("\nOuter path (should have 15px radius):");
    console.log(outerPath.join("\n"));
    console.log("\nInner path (should have 13px radius, offset by 2,2):");
    console.log(innerPath.join("\n"));

    // Both paths should have Bézier curves
    const outerBeziers = outerPath.filter(cmd => cmd.endsWith(" c"));
    const innerBeziers = innerPath.filter(cmd => cmd.endsWith(" c"));
    expect(outerBeziers.length).toBe(4);
    expect(innerBeziers.length).toBe(4);
  });

  it("does not treat 15px radius as zero", () => {
    const radii: Radius = {
      topLeft: { x: 15, y: 15 },
      topRight: { x: 15, y: 15 },
      bottomRight: { x: 15, y: 15 },
      bottomLeft: { x: 15, y: 15 },
    };

    const isZero = isZeroRadius(radii);
    console.log("isZeroRadius for 15px:", isZero);
    expect(isZero).toBe(false);
  });

  it("correctly identifies zero radius", () => {
    const radii: Radius = {
      topLeft: { x: 0, y: 0 },
      topRight: { x: 0, y: 0 },
      bottomRight: { x: 0, y: 0 },
      bottomLeft: { x: 0, y: 0 },
    };

    const isZero = isZeroRadius(radii);
    console.log("isZeroRadius for 0px:", isZero);
    expect(isZero).toBe(true);
  });
});
