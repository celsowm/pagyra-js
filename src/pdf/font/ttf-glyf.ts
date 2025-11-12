import type { GlyphOutlineCmd } from "../../types/fonts.js";
import { TtfTableParser } from "./ttf-table-parser.js";

// Table tags
const LOCA = 0x6c6f6361; // 'loca'
const GLYF = 0x676c7966; // 'glyf'
const HEAD = 0x68656164; // 'head'

/**
 * Minimal TrueType glyf/loca parser.
 *
 * - Supports simple glyphs (contours with on-curve + off-curve quadratic points).
 * - Returns null for composite glyphs (components) to keep implementation small for now.
 * - Provides robust bounds checks and defensive behavior.
 *
 * Produces a function getGlyphOutline(gid) => GlyphOutlineCmd[] | null
 */

type Point = { x: number; y: number; onCurve: boolean };

export function createGlyfOutlineProvider(parser: TtfTableParser): (gid: number) => GlyphOutlineCmd[] | null {
  const headTable = parser.getTable(HEAD);
  if (!headTable) {
    // If head missing we cannot tell indexToLocFormat; return provider that always null
    return () => null;
  }

  // indexToLocFormat at offset 50 in head (uint16): 0 = short (u16/2), 1 = long (u32)
  let indexToLocFormat = 0;
  try {
    indexToLocFormat = parser.getUint16(headTable, 50);
  } catch {
    indexToLocFormat = 0;
  }

  const locaTable = parser.getTable(LOCA);
  const glyfTable = parser.getTable(GLYF);

  if (!locaTable || !glyfTable) {
    return () => null;
  }

  // Decode loca into offsets array
  const offsets: number[] = [];
  try {
    if (indexToLocFormat === 0) {
      // u16 entries, actual offset = entry * 2
      const entryCount = locaTable.byteLength / 2;
      for (let i = 0; i < entryCount; i++) {
        const v = parser.getUint16(locaTable, i * 2);
        offsets.push(v * 2);
      }
    } else {
      const entryCount = locaTable.byteLength / 4;
      for (let i = 0; i < entryCount; i++) {
        const v = parser.getUint32(locaTable, i * 4);
        offsets.push(v);
      }
    }
  } catch {
    // Malformed loca -> no outlines
    return () => null;
  }

  // Return provider that parses a glyph on demand
  return (gid: number): GlyphOutlineCmd[] | null => {
    if (gid < 0 || gid >= offsets.length - 1) return null;

    const start = offsets[gid];
    const end = offsets[gid + 1];

    if (start === end) return null; // empty glyph

    if (start < 0 || end > glyfTable.byteLength || start > end) return null;

    // Read glyph data from glyf table region
    const view = new DataView(glyfTable.buffer, (glyfTable.byteOffset + start), end - start);

    // numberOfContours: Int16 at offset 0
    if (view.byteLength < 10) return null; // minimal header
    const numberOfContours = view.getInt16(0, false);
    if (numberOfContours < 0) {
      // composite glyph - parse components and compose outlines
      // See TrueType spec for flags and component structure.
      // We'll implement a minimal subset:
      // - ARG_1_AND_2_ARE_WORDS: args are int16, else int8
      // - we will support simple translations and optional scale(s).
      // - recursion guarded to avoid malicious fonts.
      const MORE_COMPONENTS = 0x0020;
      const ARG_1_AND_2_ARE_WORDS = 0x0001;
      const WE_HAVE_A_SCALE = 0x0008;
      const WE_HAVE_AN_X_AND_Y_SCALE = 0x0040;
      const WE_HAVE_A_TWO_BY_TWO = 0x0080;

      // start reading component records at offset 10
      const visited: Set<number> = new Set();
      const recursionLimit = 8;

      const applyTransformToCmds = (cmds: GlyphOutlineCmd[], tx: number, ty: number, mxx: number, mxy: number, myx: number, myy: number) => {
        const out: GlyphOutlineCmd[] = [];
        for (const c of cmds) {
          switch (c.type) {
            case "moveTo": {
              const x = c.x * mxx + c.y * myx + tx;
              const y = c.x * mxy + c.y * myy + ty;
              out.push({ type: "moveTo", x, y });
              break;
            }
            case "lineTo": {
              const x = c.x * mxx + c.y * myx + tx;
              const y = c.x * mxy + c.y * myy + ty;
              out.push({ type: "lineTo", x, y });
              break;
            }
            case "quadTo": {
              const cx = c.cx * mxx + c.cy * myx + tx;
              const cy = c.cx * mxy + c.cy * myy + ty;
              const x = c.x * mxx + c.y * myx + tx;
              const y = c.x * mxy + c.y * myy + ty;
              out.push({ type: "quadTo", cx, cy, x, y });
              break;
            }
            case "cubicTo": {
              const cx1 = c.cx1 * mxx + c.cy1 * myx + tx;
              const cy1 = c.cx1 * mxy + c.cy1 * myy + ty;
              const cx2 = c.cx2 * mxx + c.cy2 * myx + tx;
              const cy2 = c.cx2 * mxy + c.cy2 * myy + ty;
              const x = c.x * mxx + c.y * myx + tx;
              const y = c.y * mxy + c.y * myy + ty;
              out.push({ type: "cubicTo", cx1, cy1, cx2, cy2, x, y });
              break;
            }
            case "close": {
              out.push({ type: "close" });
              break;
            }
          }
        }
        return out;
      };

      const parseComponentRecords = (startOff: number, depth: number): GlyphOutlineCmd[] | null => {
        if (depth > recursionLimit) return null;
        let p = startOff;
        const localCmds: GlyphOutlineCmd[] = [];

        while (true) {
          if (p + 4 > view.byteLength) return null;
          const flags = view.getUint16(p, false);
          const compGlyphIndex = view.getUint16(p + 2, false);
          p += 4;

          // args
          let arg1 = 0, arg2 = 0;
          if (flags & ARG_1_AND_2_ARE_WORDS) {
            if (p + 4 > view.byteLength) return null;
            arg1 = view.getInt16(p, false);
            arg2 = view.getInt16(p + 2, false);
            p += 4;
          } else {
            if (p + 2 > view.byteLength) return null;
            arg1 = view.getInt8(p);
            arg2 = view.getInt8(p + 1);
            p += 2;
          }

          // default transform = identity
          let mxx = 1, mxy = 0, myx = 0, myy = 1;
          // read optional scale(s)
          if (flags & WE_HAVE_A_SCALE) {
            if (p + 2 > view.byteLength) return null;
            const sc = view.getInt16(p, false) / (1 << 14);
            mxx = sc;
            myy = sc;
            p += 2;
          } else if (flags & WE_HAVE_AN_X_AND_Y_SCALE) {
            if (p + 4 > view.byteLength) return null;
            const sx = view.getInt16(p, false) / (1 << 14);
            const sy = view.getInt16(p + 2, false) / (1 << 14);
            mxx = sx;
            myy = sy;
            p += 4;
          } else if (flags & WE_HAVE_A_TWO_BY_TWO) {
            if (p + 8 > view.byteLength) return null;
            mxx = view.getInt16(p, false) / (1 << 14);
            mxy = view.getInt16(p + 2, false) / (1 << 14);
            myx = view.getInt16(p + 4, false) / (1 << 14);
            myy = view.getInt16(p + 6, false) / (1 << 14);
            p += 8;
          }

          // The args are either (x,y) translation or matching points; we'll treat them as translation (simple case)
          const tx = arg1;
          const ty = arg2;

          // Prevent cycles
          if (visited.has(compGlyphIndex)) {
            // Skip to avoid infinite loop
          } else {
            visited.add(compGlyphIndex);
            // get component outline via provider by computing its glyf bytes region using offsets array
            const compStart = offsets[compGlyphIndex];
            const compEnd = offsets[compGlyphIndex + 1];
            if (compStart === compEnd) {
              // empty, skip
            } else if (compStart < 0 || compEnd > glyfTable.byteLength || compStart > compEnd) {
              // invalid, skip
            } else {
              // parse comp glyph locally by calling the same parsing logic: reuse outer provider via closure
              // To avoid duplicating low-level parsing, call the main provider function recursively using gid
              const compCmds = providerInternal(compGlyphIndex, depth + 1);
              if (compCmds) {
                const transformed = applyTransformToCmds(compCmds, tx, ty, mxx, mxy, myx, myy);
                // append transformed commands, but ensure moveTo markers properly placed
                if (transformed.length > 0) {
                  // If first command isn't moveTo, insert a moveTo to its first point
                  const first = transformed[0];
                  if (first.type !== "moveTo") {
                    // find initial coordinates
                    let fx = 0, fy = 0;
                    for (const c of transformed) {
                      if (c.type === "moveTo") { fx = c.x; fy = c.y; break; }
                      if (c.type === "lineTo") { fx = c.x; fy = c.y; break; }
                      if (c.type === "quadTo") { fx = c.x; fy = c.y; break; }
                    }
                    localCmds.push({ type: "moveTo", x: fx, y: fy });
                  }
                  for (const tcmd of transformed) localCmds.push(tcmd);
                }
              }
            }
          }

          // continue if MORE_COMPONENTS flag set
          if (!(flags & MORE_COMPONENTS)) break;
        }

        return localCmds.length > 0 ? localCmds : null;
      };

      // providerInternal allows recursion by reading glyph outlines for a gid with depth
      const providerInternal = (requestGid: number, depth = 0): GlyphOutlineCmd[] | null => {
        if (depth > recursionLimit) return null;
        if (requestGid < 0 || requestGid >= offsets.length - 1) return null;
        const s = offsets[requestGid];
        const e = offsets[requestGid + 1];
        if (s === e) return null;
        if (s < 0 || e > glyfTable.byteLength || s > e) return null;
        const v = new DataView(glyfTable.buffer, glyfTable.byteOffset + s, e - s);
        if (v.byteLength < 10) return null;
        const nContours = v.getInt16(0, false);
        if (nContours >= 0) {
          // simple glyph - reuse same parsing logic as above by constructing commands from this v
          // To avoid duplicating code, temporarily create a small helper that parses a simple glyph DataView into GlyphOutlineCmd[]
          const simpleParse = (simpleView: DataView): GlyphOutlineCmd[] | null => {
            // replicates the earlier simple glyph parsing logic (flags/coords -> cmds)
            // Read endPtsOfContours
            const cCount = simpleView.getInt16(0, false);
            const endPtsOff = 10;
            const endPts: number[] = [];
            for (let i = 0; i < cCount; i++) {
              if (endPtsOff + i * 2 + 2 > simpleView.byteLength) return null;
              endPts.push(simpleView.getUint16(endPtsOff + i * 2, false));
            }
            const instrLenOff = endPtsOff + cCount * 2;
            if (instrLenOff + 2 > simpleView.byteLength) return null;
            const instrLen = simpleView.getUint16(instrLenOff, false);
            const flagsOff = instrLenOff + 2 + instrLen;
            if (flagsOff > simpleView.byteLength) return null;
            const nPoints = endPts.length === 0 ? 0 : endPts[endPts.length - 1] + 1;
            if (nPoints <= 0) return [];
            const flagsArr: number[] = [];
            let pp = flagsOff;
            while (flagsArr.length < nPoints) {
              if (pp >= simpleView.byteLength) return null;
              const fl = simpleView.getUint8(pp++);
              flagsArr.push(fl);
              if (fl & 0x08) {
                if (pp >= simpleView.byteLength) return null;
                const rc = simpleView.getUint8(pp++);
                for (let r = 0; r < rc; r++) flagsArr.push(fl);
              }
            }
            let xOff = pp;
            const xs: number[] = new Array(nPoints);
            for (let i = 0; i < nPoints; i++) {
              const f = flagsArr[i];
              if (f & 0x02) {
                if (xOff >= simpleView.byteLength) return null;
                const val = simpleView.getUint8(xOff++);
                xs[i] = (f & 0x10) ? val : -val;
              } else {
                if (f & 0x10) {
                  xs[i] = 0;
                } else {
                  if (xOff + 2 > simpleView.byteLength) return null;
                  xs[i] = simpleView.getInt16(xOff, false);
                  xOff += 2;
                }
              }
            }
            let yOff = xOff;
            const ys: number[] = new Array(nPoints);
            for (let i = 0; i < nPoints; i++) {
              const f = flagsArr[i];
              if (f & 0x04) {
                if (yOff >= simpleView.byteLength) return null;
                const val = simpleView.getUint8(yOff++);
                ys[i] = (f & 0x20) ? val : -val;
              } else {
                if (f & 0x20) {
                  ys[i] = 0;
                } else {
                  if (yOff + 2 > simpleView.byteLength) return null;
                  ys[i] = simpleView.getInt16(yOff, false);
                  yOff += 2;
                }
              }
            }
            const pts: Point[] = new Array(nPoints);
            let cx = 0, cy = 0;
            for (let i = 0; i < nPoints; i++) {
              cx += xs[i];
              cy += ys[i];
              pts[i] = { x: cx, y: cy, onCurve: !!(flagsArr[i] & 0x01) };
            }
            // build contours and commands (reuse existing logic lightly)
            const contoursPts: Point[][] = [];
            let si = 0;
            for (let ci = 0; ci < cCount; ci++) {
              const ei = endPts[ci];
              if (ei < si || ei >= pts.length) return null;
              contoursPts.push(pts.slice(si, ei + 1));
              si = ei + 1;
            }
            const outCmds: GlyphOutlineCmd[] = [];
            for (const contour of contoursPts) {
              if (contour.length === 0) continue;
              const n = contour.length;
              const getIdx = (i: number) => ((i % n) + n) % n;
              let startPtIndex = -1;
              for (let i = 0; i < n; i++) if (contour[i].onCurve) { startPtIndex = i; break; }
              let firstPoint: Point;
              let curIndex: number;
              if (startPtIndex === -1) {
                const p0 = contour[0];
                const plast = contour[n - 1];
                const mid = { x: (plast.x + p0.x) / 2, y: (plast.y + p0.y) / 2, onCurve: true };
                firstPoint = mid;
                curIndex = 0;
                outCmds.push({ type: "moveTo", x: firstPoint.x, y: firstPoint.y });
              } else {
                const p = contour[startPtIndex];
                firstPoint = { x: p.x, y: p.y, onCurve: true };
                curIndex = startPtIndex;
                outCmds.push({ type: "moveTo", x: firstPoint.x, y: firstPoint.y });
              }
              let i = curIndex + 1;
              let steps = 0;
              while (steps < n) {
                const idx = getIdx(i);
                const pt = contour[idx];
                const next = contour[getIdx(i + 1)];
                if (pt.onCurve) {
                  outCmds.push({ type: "lineTo", x: pt.x, y: pt.y });
                } else {
                  if (next.onCurve) {
                    outCmds.push({ type: "quadTo", cx: pt.x, cy: pt.y, x: next.x, y: next.y });
                    i++;
                    steps++;
                  } else {
                    const midx = (pt.x + next.x) / 2;
                    const midy = (pt.y + next.y) / 2;
                    outCmds.push({ type: "quadTo", cx: pt.x, cy: pt.y, x: midx, y: midy });
                  }
                }
                i++;
                steps++;
              }
              outCmds.push({ type: "close" });
            }
            return outCmds;
          };

          const parsedSimple = simpleParse(v);
          return parsedSimple;
        } else {
          // composite glyph - recursively parse components using parseComponentRecords starting at current view's component data offset
          // In this context, start offset for components is 10
          const composed = parseComponentRecords(10, depth);
          return composed;
        }
      };

      const composedCmds = providerInternal(gid, 0);
      return composedCmds;
    }

    const contourCount = numberOfContours;

    // Read endPtsOfContours: array of uint16[contourCount]
    const endPtsOffset = 10;
    const endPtsSize = contourCount * 2;
    if (endPtsOffset + endPtsSize > view.byteLength) return null;
    const endPts: number[] = [];
    for (let i = 0; i < contourCount; i++) {
      endPts.push(view.getUint16(endPtsOffset + i * 2, false));
    }

    // instruction length
    const instrLenOffset = endPtsOffset + endPtsSize;
    if (instrLenOffset + 2 > view.byteLength) return null;
    const instructionLength = view.getUint16(instrLenOffset, false);
    const instructionsOffset = instrLenOffset + 2;
    const flagsOffset = instructionsOffset + instructionLength;
    if (flagsOffset > view.byteLength) return null;

    // Number of points = last endPt + 1
    const nPoints = endPts.length === 0 ? 0 : endPts[endPts.length - 1] + 1;
    if (nPoints <= 0) return [];

    // Parse flags (variable-length with repeats)
    const flags: number[] = [];
    let p = flagsOffset;
    try {
      while (flags.length < nPoints) {
        if (p >= view.byteLength) return null;
        const flag = view.getUint8(p++);
        flags.push(flag);
        if (flag & 0x08) {
          // repeat flag
          if (p >= view.byteLength) return null;
          const repeatCount = view.getUint8(p++);
          for (let r = 0; r < repeatCount; r++) flags.push(flag);
        }
      }
    } catch {
      return null;
    }

    // After flags, come xCoordinates then yCoordinates
    let xCoordOffset = p;
    // Parse x deltas
    const xs: number[] = new Array(nPoints);
    let xi = 0;
    try {
      while (xi < nPoints) {
        const f = flags[xi];
        if (f & 0x02) {
          // xShortVector -> uint8
          if (xCoordOffset >= view.byteLength) return null;
          const val = view.getUint8(xCoordOffset++);
          // if xIsSameOrPositive flag set -> positive, else negative
          if (f & 0x10) xs[xi] = val; else xs[xi] = -val;
        } else {
          // xShortVector == 0
          if (f & 0x10) {
            // x is same (zero delta)
            xs[xi] = 0;
          } else {
            // int16
            if (xCoordOffset + 2 > view.byteLength) return null;
            xs[xi] = view.getInt16(xCoordOffset, false);
            xCoordOffset += 2;
          }
        }
        xi++;
      }
    } catch {
      return null;
    }

    // Now y coordinates begin at xCoordOffset
    let yCoordOffset = xCoordOffset;
    const ys: number[] = new Array(nPoints);
    let yi = 0;
    try {
      while (yi < nPoints) {
        const f = flags[yi];
        if (f & 0x04) {
          // yShortVector -> uint8
          if (yCoordOffset >= view.byteLength) return null;
          const val = view.getUint8(yCoordOffset++);
          if (f & 0x20) ys[yi] = val; else ys[yi] = -val;
        } else {
          if (f & 0x20) {
            // y is same (zero delta)
            ys[yi] = 0;
          } else {
            if (yCoordOffset + 2 > view.byteLength) return null;
            ys[yi] = view.getInt16(yCoordOffset, false);
            yCoordOffset += 2;
          }
        }
        yi++;
      }
    } catch {
      return null;
    }

    // Convert deltas to absolute coordinates (cumulative)
    const points: Point[] = new Array(nPoints);
    let curX = 0;
    let curY = 0;
    for (let i = 0; i < nPoints; i++) {
      curX += xs[i];
      curY += ys[i];
      points[i] = { x: curX, y: curY, onCurve: !!(flags[i] & 0x01) };
    }

    // Build contours as sequences of points
    const contours: Point[][] = [];
    let startIndex = 0;
    for (let c = 0; c < contourCount; c++) {
      const endIndex = endPts[c];
      if (endIndex < startIndex || endIndex >= points.length) return null;
      contours.push(points.slice(startIndex, endIndex + 1));
      startIndex = endIndex + 1;
    }

    // Convert each contour into GlyphOutlineCmd[] using quadratic bezier handling
    const cmds: GlyphOutlineCmd[] = [];

    for (const contour of contours) {
      if (contour.length === 0) continue;

      // Helper to get point with wrap around index
      const n = contour.length;
      const getIdx = (i: number) => ((i % n) + n) % n;

      // Find a starting point: prefer an on-curve. If none, create implicit midpoint between last and first
      let startPtIndex = -1;
      for (let i = 0; i < n; i++) if (contour[i].onCurve) { startPtIndex = i; break; }

      let firstPoint: Point;
      let curIndex: number;

      if (startPtIndex === -1) {
        // no on-curve points: create implied on-curve point between last and first off-curve
        const p0 = contour[0];
        const plast = contour[n - 1];
        const mid = { x: (plast.x + p0.x) / 2, y: (plast.y + p0.y) / 2, onCurve: true };
        firstPoint = mid;
        curIndex = 0; // we will treat mid as previous "cursor"
        cmds.push({ type: "moveTo", x: firstPoint.x, y: firstPoint.y });
      } else {
        // if start is off-curve we need to insert implied point between prev and start
        const p = contour[startPtIndex];
        firstPoint = { x: p.x, y: p.y, onCurve: true };
        curIndex = startPtIndex;
        cmds.push({ type: "moveTo", x: firstPoint.x, y: firstPoint.y });
      }

      // We'll iterate through contour points in order, producing lineTo / quadTo as needed
      // Walk points starting from next index after curIndex
      let i = curIndex + 1;
      let steps = 0;
      while (steps < n) {
        const idx = getIdx(i);
        const pt = contour[idx];
        const next = contour[getIdx(i + 1)];

        if (pt.onCurve) {
          // straight to on-curve point
          cmds.push({ type: "lineTo", x: pt.x, y: pt.y });
        } else {
          // pt is off-curve; need to find next on-curve or handle consecutive off-curve
          if (next.onCurve) {
            // single control -> quadratic from cursor to next with control pt
            cmds.push({ type: "quadTo", cx: pt.x, cy: pt.y, x: next.x, y: next.y });
            i++; // consumed next as well
            steps++; // extra consume accounted below
          } else {
            // consecutive off-curve: create implied midpoint between pt and next, use that as end
            const midx = (pt.x + next.x) / 2;
            const midy = (pt.y + next.y) / 2;
            cmds.push({ type: "quadTo", cx: pt.x, cy: pt.y, x: midx, y: midy });
            // do not advance extra here; next will be processed as off-curve then paired with its successor
          }
        }

        i++;
        steps++;
      }

      cmds.push({ type: "close" });
    }

    return cmds;
  };
}
