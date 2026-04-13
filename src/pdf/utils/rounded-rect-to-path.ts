import type { Rect, Radius } from "../types.js";
import type { PathCommand } from "../renderers/shape-renderer.js";

/**
 * Converte um retângulo arredondado em uma lista de comandos de caminho (PathCommand).
 * Os comandos estão em pixels da página.
 */
export function roundedRectToPath(rect: Rect, radius: Radius): PathCommand[] {
  const { x, y, width, height } = rect;
  const tl = radius.topLeft;
  const tr = radius.topRight;
  const br = radius.bottomRight;
  const bl = radius.bottomLeft;

  // Bézier approximation constant for circular arcs
  const k = 0.5522847498307936;

  const commands: PathCommand[] = [];

  // Início: Top-left após o raio
  commands.push({ type: "moveTo", x: x + tl.x, y: y });

  // Top edge
  commands.push({ type: "lineTo", x: x + width - tr.x, y: y });

  // Top-right corner
  if (tr.x > 0 || tr.y > 0) {
    commands.push({
      type: "curveTo",
      x1: x + width - tr.x + k * tr.x,
      y1: y,
      x2: x + width,
      y2: y + tr.y - k * tr.y,
      x: x + width,
      y: y + tr.y
    });
  } else {
    commands.push({ type: "lineTo", x: x + width, y: y });
  }

  // Right edge
  commands.push({ type: "lineTo", x: x + width, y: y + height - br.y });

  // Bottom-right corner
  if (br.x > 0 || br.y > 0) {
    commands.push({
      type: "curveTo",
      x1: x + width,
      y1: y + height - br.y + k * br.y,
      x2: x + width - br.x + k * br.x,
      y2: y + height,
      x: x + width - br.x,
      y: y + height
    });
  } else {
    commands.push({ type: "lineTo", x: x + width, y: y + height });
  }

  // Bottom edge
  commands.push({ type: "lineTo", x: x + bl.x, y: y + height });

  // Bottom-left corner
  if (bl.x > 0 || bl.y > 0) {
    commands.push({
      type: "curveTo",
      x1: x + bl.x - k * bl.x,
      y1: y + height,
      x2: x,
      y2: y + height - bl.y + k * bl.y,
      x: x,
      y: y + height - bl.y
    });
  } else {
    commands.push({ type: "lineTo", x: x, y: y + height });
  }

  // Left edge
  commands.push({ type: "lineTo", x: x, y: y + tl.y });

  // Top-left corner
  if (tl.x > 0 || tl.y > 0) {
    commands.push({
      type: "curveTo",
      x1: x,
      y1: y + tl.y - k * tl.y,
      x2: x + tl.x - k * tl.x,
      y2: y,
      x: x + tl.x,
      y: y
    });
  } else {
    commands.push({ type: "lineTo", x: x, y: y });
  }

  commands.push({ type: "closePath" });

  return commands;
}
