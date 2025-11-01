import type { LinearGradient, GradientStop } from "../../css/parsers/gradient-parser.js";
import { CoordinateTransformer } from "../utils/coordinate-transformer.js";

export interface GradientShading {
  readonly shadingName: string;
  readonly dictionary: string;
}

let GLOBAL_GRADIENT_SERVICE_ID = 0;

export class GradientService {
  private readonly shadings = new Map<string, GradientShading>();
  private shadingCounter = 0;
  private readonly serviceId = GLOBAL_GRADIENT_SERVICE_ID++;

  constructor(
    private readonly coordinateTransformer: CoordinateTransformer,
  ) {}

  createLinearGradient(
    gradient: LinearGradient,
    rect: { x?: number; y?: number; width: number; height: number },
  ): GradientShading {
    const shadingName = this.generateShadingName();
    const stops = this.normalizeStops(gradient.stops);
    // If gradient provides explicit coords (from SVG), honor them
    let coords: [number, number, number, number];
    if (gradient.coords && gradient.coords.units === "userSpace") {
      // coords are absolute page pixels; convert to rectangle-local points
      const x0 = gradient.coords.x1 - (rect.x ?? 0);
      const y0 = gradient.coords.y1 - (rect.y ?? 0);
      const x1 = gradient.coords.x2 - (rect.x ?? 0);
      const y1 = gradient.coords.y2 - (rect.y ?? 0);
      coords = [
        this.coordinateTransformer.convertPxToPt(x0),
        this.coordinateTransformer.convertPxToPt(y0),
        this.coordinateTransformer.convertPxToPt(x1),
        this.coordinateTransformer.convertPxToPt(y1),
      ];
    } else if (gradient.coords && gradient.coords.units === "ratio") {
      // coords are in objectBoundingBox (0..1) relative to rect
      const widthPt = Math.max(this.coordinateTransformer.convertPxToPt(rect.width), 0);
      const heightPt = Math.max(this.coordinateTransformer.convertPxToPt(rect.height), 0);
      const x0 = gradient.coords.x1 * widthPt;
      const y0 = gradient.coords.y1 * heightPt;
      const x1 = gradient.coords.x2 * widthPt;
      const y1 = gradient.coords.y2 * heightPt;
      coords = [x0, y0, x1, y1];
    } else {
      coords = this.calculateGradientCoordinates(gradient, rect);
    }
    const interpolationFn = this.buildInterpolationFunction(stops);

    const dictionary = [
      "<<",
      "/ShadingType 2",
      "/ColorSpace /DeviceRGB",
      `/Coords [${coords.map(formatNumber).join(" ")}]`,
      "/Domain [0 1]",
      `/Function ${interpolationFn}`,
      "/Extend [true true]",
      ">>",
    ].join("\n");

    const shading: GradientShading = { shadingName, dictionary };
    this.shadings.set(shadingName, shading);
    return shading;
  }

  createRadialGradient(
    gradient: import("../../css/parsers/gradient-parser.js").RadialGradient,
    rect: { x?: number; y?: number; width: number; height: number },
  ): GradientShading {
    const shadingName = this.generateShadingName();
    const stops = this.normalizeStops(gradient.stops);

    const widthPt = Math.max(this.coordinateTransformer.convertPxToPt(rect.width), 0);
    const heightPt = Math.max(this.coordinateTransformer.convertPxToPt(rect.height), 0);
    const safeWidth = widthPt > 0 ? widthPt : 1;
    const safeHeight = heightPt > 0 ? heightPt : 1;

  let coords: [number, number, number, number, number, number];
  let matrixEntry: string | null = null;

  if (gradient.coordsUnits === "userSpace") {
      // gradient.cx/cy/r are in page pixels; convert to rectangle-local px then to points
      const cxPx = gradient.cx ?? 0;
      const cyPx = gradient.cy ?? 0;
      const rPx = gradient.r ?? 0;

      const localCxPx = cxPx - (rect.x ?? 0);
      const localCyPx = cyPx - (rect.y ?? 0);

      const centerX = this.coordinateTransformer.convertPxToPt(localCxPx);
      const centerY = this.coordinateTransformer.convertPxToPt(localCyPx);
      const radius = this.coordinateTransformer.convertPxToPt(rPx);

      // If focal point provided, place inner circle at focal, otherwise inner circle at center with r0 = 0
      if (gradient.fx !== undefined && gradient.fy !== undefined) {
        const fxPx = gradient.fx - (rect.x ?? 0);
        const fyPx = gradient.fy - (rect.y ?? 0);
        const focalX = this.coordinateTransformer.convertPxToPt(fxPx);
        const focalY = this.coordinateTransformer.convertPxToPt(fyPx);
        coords = [focalX, focalY, 0, centerX, centerY, radius];
      } else {
        coords = [centerX, centerY, 0, centerX, centerY, radius];
      }
    } else {
      // Treat as ratio (objectBoundingBox)
      const cx = gradient.cx ?? 0.5;
      const cy = gradient.cy ?? 0.5;
      const r = gradient.r ?? 0.5;

      // If the gradient supplied a transform (from SVG gradientTransform), we will
      // provide coordinates in ratio-space and emit a /Matrix that maps ratio-space
      // shading coordinates into local page points. This allows an exact mapping of
      // circles in shading space to ellipses in device space.
      if (gradient.transform) {
        // Apply the gradientTransform to center/focal and an edge point in ratio-space,
        // then convert those transformed ratio coords into local points. This preserves
        // the SVG semantics while producing absolute coords in the shading dictionary.
        const t = gradient.transform;
        const apply = (x: number, y: number) => {
          return {
            x: t.a * x + t.c * y + t.e,
            y: t.b * x + t.d * y + t.f,
          };
        };

        const tc = apply(cx, cy);
        const te = apply(cx + r, cy);

        const centerX = tc.x * safeWidth;
        const centerY = tc.y * safeHeight;
        const edgeX = te.x * safeWidth;
        const edgeY = te.y * safeHeight;
        const radius = Math.sqrt((edgeX - centerX) * (edgeX - centerX) + (edgeY - centerY) * (edgeY - centerY));

        if (gradient.fx !== undefined && gradient.fy !== undefined) {
          const tf = apply(gradient.fx, gradient.fy);
          const fx = tf.x * safeWidth;
          const fy = tf.y * safeHeight;
          coords = [fx, fy, 0, centerX, centerY, radius];
        } else {
          coords = [centerX, centerY, 0, centerX, centerY, radius];
        }
      } else {
        // No transform: convert ratio coords into local points (legacy behavior)
        const centerX = cx * safeWidth;
        const centerY = cy * safeHeight;
        const radius = r * Math.max(safeWidth, safeHeight);

        if (gradient.fx !== undefined && gradient.fy !== undefined) {
          const fx = gradient.fx * safeWidth;
          const fy = gradient.fy * safeHeight;
          coords = [fx, fy, 0, centerX, centerY, radius];
        } else {
          coords = [centerX, centerY, 0, centerX, centerY, radius];
        }
      }
    }

    const interpolationFn = this.buildInterpolationFunction(stops);

    const dictionary = [
      "<<",
      "/ShadingType 3",
      "/ColorSpace /DeviceRGB",
      `/Coords [${coords.map(formatNumber).join(" ")}]`,
      ...(matrixEntry ? [matrixEntry] : []),
      "/Domain [0 1]",
      `/Function ${interpolationFn}`,
      "/Extend [true true]",
      ">>",
    ].join("\n");

    const shading: GradientShading = { shadingName, dictionary };
    this.shadings.set(shadingName, shading);
    return shading;
  }

  getShadings(): Map<string, string> {
    const result = new Map<string, string>();
    for (const { shadingName, dictionary } of this.shadings.values()) {
      result.set(shadingName, dictionary);
    }
    return result;
  }

  clear(): void {
    this.shadings.clear();
    this.shadingCounter = 0;
  }

  private generateShadingName(): string {
    return `Sh${this.serviceId}_${this.shadingCounter++}`;
  }

  private calculateGradientCoordinates(
    gradient: LinearGradient,
    rect: { width: number; height: number },
  ): [number, number, number, number] {
    const widthPt = Math.max(this.coordinateTransformer.convertPxToPt(rect.width), 0);
    const heightPt = Math.max(this.coordinateTransformer.convertPxToPt(rect.height), 0);
    const safeWidth = widthPt > 0 ? widthPt : 1;
    const safeHeight = heightPt > 0 ? heightPt : 1;
    const centerX = safeWidth / 2;
    const centerY = safeHeight / 2;

    switch (gradient.direction) {
      case "to right":
        return [0, centerY, safeWidth, centerY];
      case "to left":
        return [safeWidth, centerY, 0, centerY];
      case "to bottom":
        return [centerX, 0, centerX, safeHeight];
      case "to top":
        return [centerX, safeHeight, centerX, 0];
      case "to top right":
        return [0, safeHeight, safeWidth, 0];
      case "to top left":
        return [safeWidth, safeHeight, 0, 0];
      case "to bottom right":
        return [0, 0, safeWidth, safeHeight];
      case "to bottom left":
        return [safeWidth, 0, 0, safeHeight];
      default:
        if (gradient.direction.endsWith("deg")) {
          const angle = Number.parseFloat(gradient.direction);
          return this.calculateCoordinatesFromAngle(angle, safeWidth, safeHeight);
        }
        return [0, centerY, safeWidth, centerY];
    }
  }

  private calculateCoordinatesFromAngle(
    angleDeg: number,
    widthPt: number,
    heightPt: number,
  ): [number, number, number, number] {
    if (!Number.isFinite(angleDeg)) {
      return [0, heightPt / 2, widthPt, heightPt / 2];
    }
    const normalized = ((angleDeg % 360) + 360) % 360;
    const radians = (normalized * Math.PI) / 180;
    // CSS angles measure 0deg as pointing to the right and grow clockwise.
    const dirX = Math.cos(radians);
    const dirY = Math.sin(radians);

    const halfWidth = widthPt / 2;
    const halfHeight = heightPt / 2;
    const extent = this.computeMaxExtent(dirX, dirY, halfWidth, halfHeight);

    const startX = halfWidth - dirX * extent;
    const startY = halfHeight - dirY * extent;
    const endX = halfWidth + dirX * extent;
    const endY = halfHeight + dirY * extent;
    return [startX, startY, endX, endY];
  }

  private computeMaxExtent(dirX: number, dirY: number, halfWidth: number, halfHeight: number): number {
    const epsilon = 1e-6;
    const tx = Math.abs(dirX) > epsilon ? halfWidth / Math.abs(dirX) : Number.POSITIVE_INFINITY;
    const ty = Math.abs(dirY) > epsilon ? halfHeight / Math.abs(dirY) : Number.POSITIVE_INFINITY;
    return Math.max(tx, ty);
  }

  private normalizeStops(stops: GradientStop[]): NormalizedStop[] {
    if (stops.length === 0) {
      return [{ color: this.parseColor("#000000"), position: 0 }];
    }

    const enriched = stops.map((stop) => ({
      color: this.parseColor(stop.color),
      position: stop.position,
    }));

    const hasExplicit = enriched.some((stop) => stop.position !== undefined);

    if (!hasExplicit) {
      if (enriched.length === 1) {
        return [{ color: enriched[0].color, position: 0 }];
      }
      const denom = enriched.length - 1;
      return enriched.map((stop, index) => ({
        color: stop.color,
        position: denom === 0 ? 0 : index / denom,
      }));
    }

    const positions: Array<number | undefined> = enriched.map((stop) => stop.position);
    if (positions[0] === undefined) {
      positions[0] = 0;
    }
    if (positions[positions.length - 1] === undefined) {
      positions[positions.length - 1] = 1;
    }

    let lastDefinedIndex = 0;
    positions[lastDefinedIndex] = clampUnit(positions[lastDefinedIndex] ?? 0);

    for (let i = 1; i < positions.length; i++) {
      const current = positions[i];
      if (current === undefined) {
        continue;
      }
      const start = positions[lastDefinedIndex] ?? 0;
      const end = clampUnit(current);
      const span = i - lastDefinedIndex;
      if (span > 1) {
        for (let j = 1; j < span; j++) {
          const ratio = j / span;
          const value = start + (end - start) * ratio;
          positions[lastDefinedIndex + j] = clampUnit(value);
        }
      }
      positions[i] = end;
      lastDefinedIndex = i;
    }

    for (let i = 1; i < positions.length; i++) {
      if (positions[i] === undefined) {
        positions[i] = positions[i - 1];
      }
    }

    const normalized: NormalizedStop[] = [];
    let previous = clampUnit(positions[0] ?? 0);
    normalized.push({ color: enriched[0].color, position: previous });
    for (let i = 1; i < positions.length; i++) {
      const current = clampUnit(positions[i] ?? previous);
      const monotonic = current < previous ? previous : current;
      normalized.push({ color: enriched[i].color, position: monotonic });
      previous = monotonic;
    }

    if (normalized.length === 1) {
      const [only] = normalized;
      return [{ color: only.color, position: 0 }, { color: only.color, position: 1 }];
    }

    normalized[0].position = 0;
    normalized[normalized.length - 1].position = 1;
    return normalized;
  }

  private buildInterpolationFunction(stops: NormalizedStop[]): string {
    if (stops.length <= 1) {
      const color = stops.length === 1 ? stops[0].color : this.parseColor("#000000");
      return serializeType2Function(color, color);
    }

    const segments: Array<{ start: NormalizedStop; end: NormalizedStop }> = [];
    for (let i = 0; i < stops.length - 1; i++) {
      const start = stops[i];
      const end = stops[i + 1];
      if (end.position <= start.position) {
        continue;
      }
      segments.push({ start, end });
    }

    if (segments.length === 0) {
      const color = stops[stops.length - 1].color;
      return serializeType2Function(color, color);
    }

    if (segments.length === 1) {
      const [segment] = segments;
      return serializeType2Function(segment.start.color, segment.end.color);
    }

    const bounds: string[] = [];
    const encodeParts: string[] = [];
    const functionParts: string[] = [];

    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i];
      if (i < segments.length - 1) {
        bounds.push(formatNumber(segment.end.position));
      }
      encodeParts.push("0 1");
      functionParts.push(serializeType2Function(segment.start.color, segment.end.color));
    }

    const functionDict = [
      "<<",
      "/FunctionType 3",
      "/Domain [0 1]",
      `/Bounds [${bounds.join(" ")}]`,
      `/Encode [${encodeParts.join(" ")}]`,
      "/Functions [",
      functionParts.join("\n"),
      "]",
      ">>",
    ].join("\n");

    return functionDict;
  }

  private parseColor(colorStr: string): { r: number; g: number; b: number } {
    const lower = colorStr.trim().toLowerCase();
    const named: Record<string, { r: number; g: number; b: number }> = {
      red: { r: 1, g: 0, b: 0 },
      green: { r: 0, g: 0.50196, b: 0 },
      blue: { r: 0, g: 0, b: 1 },
      yellow: { r: 1, g: 1, b: 0 },
      black: { r: 0, g: 0, b: 0 },
      white: { r: 1, g: 1, b: 1 },
      gray: { r: 0.50196, g: 0.50196, b: 0.50196 },
      grey: { r: 0.50196, g: 0.50196, b: 0.50196 },
      lime: { r: 0, g: 1, b: 0 },
      fuchsia: { r: 1, g: 0, b: 1 },
      aqua: { r: 0, g: 1, b: 1 },
    };
    const namedMatch = named[lower];
    if (namedMatch) {
      return namedMatch;
    }

    if (lower.startsWith("#")) {
      const hex = lower.slice(1);
      if (hex.length === 3) {
        const r = Number.parseInt(hex[0] + hex[0], 16) / 255;
        const g = Number.parseInt(hex[1] + hex[1], 16) / 255;
        const b = Number.parseInt(hex[2] + hex[2], 16) / 255;
        return { r, g, b };
      }
      if (hex.length === 6) {
        const r = Number.parseInt(hex.slice(0, 2), 16) / 255;
        const g = Number.parseInt(hex.slice(2, 4), 16) / 255;
        const b = Number.parseInt(hex.slice(4, 6), 16) / 255;
        return { r, g, b };
      }
    }

    return { r: 0, g: 0, b: 0 };
  }
}

interface NormalizedStop {
  color: { r: number; g: number; b: number };
  position: number;
}

function clampUnit(value: number | undefined): number {
  if (!Number.isFinite(value ?? NaN)) {
    return 0;
  }
  if ((value ?? 0) <= 0) {
    return 0;
  }
  if ((value ?? 0) >= 1) {
    return 1;
  }
  return value ?? 0;
}

function serializeType2Function(
  start: { r: number; g: number; b: number },
  end: { r: number; g: number; b: number },
): string {
  return [
    "<<",
    "/FunctionType 2",
    "/Domain [0 1]",
    `/C0 [ ${formatNumber(start.r)} ${formatNumber(start.g)} ${formatNumber(start.b)} ]`,
    `/C1 [ ${formatNumber(end.r)} ${formatNumber(end.g)} ${formatNumber(end.b)} ]`,
    "/N 1",
    ">>",
  ].join("\n");
}

function formatNumber(value: number): string {
  if (!Number.isFinite(value)) {
    return "0";
  }
  return Number.isInteger(value) ? value.toString() : value.toFixed(5).replace(/0+$/, "").replace(/\.$/, "");
}
