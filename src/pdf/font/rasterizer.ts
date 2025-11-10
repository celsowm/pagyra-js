import type { GlyphOutlineCmd } from "../../types/fonts.js";

export interface BitmapMask {
  width: number;
  height: number;
  data: Uint8ClampedArray; // alpha 0..255, length = width * height
}

/**
 * Flatten quadratic bezier adaptively.
 * p0, p1, p2 in pixel coordinates.
 */
function flattenQuadratic(p0: { x: number; y: number }, p1: { x: number; y: number }, p2: { x: number; y: number }, tol: number, out: { x: number; y: number }[]) {
  // recursive subdivision
  const stack: Array<{ x0: number; y0: number; cx: number; cy: number; x1: number; y1: number }> = [];
  stack.push({ x0: p0.x, y0: p0.y, cx: p1.x, cy: p1.y, x1: p2.x, y1: p2.y });

  while (stack.length > 0) {
    const seg = stack.pop()!;

    // approximate flatness: distance from control to chord
    const ax = seg.x0, ay = seg.y0;
    const bx = seg.x1, by = seg.y1;
    const cx = seg.cx, cy = seg.cy;

    // chord vector
    const vx = bx - ax, vy = by - ay;
    const len2 = vx * vx + vy * vy;
    let dist = 0;
    if (len2 === 0) {
      // degenerate, distance from control to p0
      const dx = cx - ax, dy = cy - ay;
      dist = Math.hypot(dx, dy);
    } else {
      // projection factor of control onto chord
      const t = ((cx - ax) * vx + (cy - ay) * vy) / len2;
      const projx = ax + t * vx;
      const projy = ay + t * vy;
      dist = Math.hypot(cx - projx, cy - projy);
    }

    if (dist <= tol) {
      // emit end point
      out.push({ x: bx, y: by });
    } else {
      // subdivide into two quadratics using De Casteljau
      const x01 = (ax + cx) / 2;
      const y01 = (ay + cy) / 2;
      const x12 = (cx + bx) / 2;
      const y12 = (cy + by) / 2;
      const x012 = (x01 + x12) / 2;
      const y012 = (y01 + y12) / 2;

      // push right then left so left is processed first
      stack.push({ x0: x012, y0: y012, cx: x12, cy: y12, x1: bx, y1: by });
      stack.push({ x0: ax, y0: ay, cx: x01, cy: y01, x1: x012, y1: y012 });
    }
  }
}

/**
 * Convert GlyphOutlineCmd sequence into flattened contours in pixel coordinates.
 * - scale: pixels per font unit (fontSizePx / unitsPerEm)
 * - tolPx: flatness tolerance in pixels (suggest 0.35..1.0)
 */
export function flattenOutline(cmds: GlyphOutlineCmd[], scale: number, tolPx = 0.5): { contours: { x: number; y: number }[][] } {
  const contours: { x: number; y: number }[][] = [];
  let cursorX = 0;
  let cursorY = 0;
  // Use an always-array for curContour to avoid union narrowing issues in TS.
  // Empty array means "no active contour".
  let curContour: { x: number; y: number }[] = [];

  const emitMove = (x: number, y: number) => {
    if (curContour.length > 0) {
      // implicit close previous
      contours.push(curContour);
    }
    curContour = [{ x, y }];
    cursorX = x;
    cursorY = y;
  };

  const emitLine = (x: number, y: number) => {
    if (!curContour) curContour = [{ x: cursorX, y: cursorY }];
    curContour.push({ x, y });
    cursorX = x;
    cursorY = y;
  };

  const emitQuad = (cx: number, cy: number, x: number, y: number) => {
    if (!curContour) curContour = [{ x: cursorX, y: cursorY }];
    // subdivide from current cursor -> control -> x,y
    const start = { x: cursorX, y: cursorY };
    const ctrl = { x: cx, y: cy };
    const end = { x: x, y: y };
    // flattening writes successive points ending with end
    flattenQuadratic(start, ctrl, end, tolPx, curContour);
    cursorX = x;
    cursorY = y;
  };

  for (const c of cmds) {
    switch (c.type) {
      case "moveTo": {
        const x = c.x * scale;
        const y = c.y * scale;
        emitMove(x, y);
        break;
      }
      case "lineTo": {
        const x = c.x * scale;
        const y = c.y * scale;
        emitLine(x, y);
        break;
      }
      case "quadTo": {
        const cx = c.cx * scale;
        const cy = c.cy * scale;
        const x = c.x * scale;
        const y = c.y * scale;
        emitQuad(cx, cy, x, y);
        break;
      }
      case "cubicTo": {
        // Not implementing cubic flattening for now — approximate by splitting into quads (simple approach)
        // Convert cubic to two quadratics via degree reduction (rough) or fallback: sample with small steps
        const steps = 8;
        for (let i = 1; i <= steps; i++) {
          const t = i / steps;
          // cubic bezier evaluate using standard formula
          const x = Math.pow(1 - t, 3) * (cursorX) + 3 * t * Math.pow(1 - t, 2) * (c.cx1 * scale) + 3 * t * t * (1 - t) * (c.cx2 * scale) + t * t * t * (c.x * scale);
          const y = Math.pow(1 - t, 3) * (cursorY) + 3 * t * Math.pow(1 - t, 2) * (c.cy1 * scale) + 3 * t * t * (1 - t) * (c.cy2 * scale) + t * t * t * (c.y * scale);
          emitLine(x, y);
        }
        break;
      }
      case "close": {
        if (curContour.length > 0) {
          // ensure last point equals first (closed)
          const first = curContour[0];
          const last = curContour[curContour.length - 1];
          if (Math.abs(first.x - last.x) > 1e-6 || Math.abs(first.y - last.y) > 1e-6) {
            curContour.push({ x: first.x, y: first.y });
          }
          contours.push(curContour);
          curContour = [];
        }
        break;
      }
    }
  }

  if (curContour.length > 0) {
    // close if needed
    const first = curContour[0];
    const last = curContour[curContour.length - 1];
    if (Math.abs(first.x - last.x) > 1e-6 || Math.abs(first.y - last.y) > 1e-6) {
      curContour.push({ x: first.x, y: first.y });
    }
    contours.push(curContour);
  }

  return { contours };
}

/**
 * Rasterize flattened contours using scanline even-odd fill on an integer high-res grid and downsample.
 * - contours: array of closed polylines (points in pixel coordinates)
 * - supersample: integer factor >=1
 * Returns alpha bitmap in target pixels.
 */
export function rasterizeContours(contours: { x: number; y: number }[][], supersample = 4): BitmapMask | null {
  if (!contours || contours.length === 0) return null;

  // compute bounding box
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const c of contours) {
    for (const p of c) {
      if (p.x < minX) minX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.x > maxX) maxX = p.x;
      if (p.y > maxY) maxY = p.y;
    }
  }

  if (!isFinite(minX) || !isFinite(minY)) return null;

  // Add small padding so strokes at edge are visible
  const pad = 1;
  minX = Math.floor(minX) - pad;
  minY = Math.floor(minY) - pad;
  maxX = Math.ceil(maxX) + pad;
  maxY = Math.ceil(maxY) + pad;

  const width = maxX - minX;
  const height = maxY - minY;
  if (width <= 0 || height <= 0) return null;

  const hiW = width * supersample;
  const hiH = height * supersample;
  // allocate high-res buffer (byte per pixel)
  const hi = new Uint8ClampedArray(hiW * hiH);

  // For each scanline in high-res, compute intersections with edges
  for (let y = 0; y < hiH; y++) {
    const fy = minY + y / supersample + 0.5 / supersample; // sample at center of hi-pixel
    const intersections: number[] = [];

    for (const contour of contours) {
      for (let i = 0; i < contour.length - 1; i++) {
        const a = contour[i];
        const b = contour[i + 1];
        const y0 = a.y;
        const y1 = b.y;
        // skip horizontal edges or scanlines outside edge bounds
        if (y0 === y1) continue;
        // include when fy is >= min(y0,y1) and < max(y0,y1) (half-open)
        const ymin = Math.min(y0, y1);
        const ymax = Math.max(y0, y1);
        if (fy < ymin || fy >= ymax) continue;
        const t = (fy - y0) / (y1 - y0);
        const ix = a.x + t * (b.x - a.x);
        intersections.push(ix);
      }
    }

    if (intersections.length === 0) continue;
    intersections.sort((a, b) => a - b);

    // fill between pairs
    for (let k = 0; k < intersections.length; k += 2) {
      const x0 = intersections[k];
      const x1 = intersections[k + 1];
      if (x1 === undefined) break;
      // convert to high-res x indices
      const hiX0 = Math.max(0, Math.floor((x0 - minX) * supersample));
      const hiX1 = Math.min(hiW, Math.ceil((x1 - minX) * supersample));
      if (hiX1 <= hiX0) continue;
      const base = y * hiW;
      for (let hx = hiX0; hx < hiX1; hx++) hi[base + hx] = 255;
    }
  }

  // Downsample hi -> target
  const outW = width;
  const outH = height;
  const out = new Uint8ClampedArray(outW * outH);

  for (let ty = 0; ty < outH; ty++) {
    for (let tx = 0; tx < outW; tx++) {
      let sum = 0;
      const startY = ty * supersample;
      const startX = tx * supersample;
      for (let sy = 0; sy < supersample; sy++) {
        const row = (startY + sy) * hiW;
        for (let sx = 0; sx < supersample; sx++) {
          sum += hi[row + startX + sx];
        }
      }
      const avg = Math.round(sum / (supersample * supersample));
      out[ty * outW + tx] = avg;
    }
  }

  return { width: outW, height: outH, data: out };
}
