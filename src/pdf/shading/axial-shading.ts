import { log } from "../../debug/log.js";
import type { PdfObjectRef } from "../primitives/pdf-document.js";
import type { LinearGradient } from "../../css/parsers/gradient-parser.js";
import type { RGBA } from "../types.js";

/**
 * Axial Shading (Type 2) implementation for PDF linear gradients
 * Based on PDF specification ISO 32000-2:2020, clause 8.7 "Shading patterns"
 */

export interface AxialShadingConfig {
  shadingType: 2;
  colorSpace: "DeviceRGB" | "DeviceCMYK";
  coords: [number, number, number, number]; // [x0, y0, x1, y1]
  domain: [number, number]; // [0, 1] for linear gradients
  function: PdfFunction;
  extend: [boolean, boolean]; // [before, after]
}

export interface PdfFunction {
  type: 2; // Exponential interpolation function
  domain: [number, number];
  range: [number, number, number]; // RGB range
  c0: [number, number, number]; // Start color
  c1: [number, number, number]; // End color
}

export interface ShadingPattern {
  shading: AxialShadingConfig;
  matrix?: [number, number, number, number, number, number]; // CTM transformation
  bbox?: [number, number, number, number]; // Bounding box
}

export class AxialShadingGenerator {
  private static readonly SHADING_COUNTER = "shading_counter";
  private static readonly PATTERN_COUNTER = "pattern_counter";

  /**
   * Generate axial shading configuration from CSS linear gradient
   */
  static createFromLinearGradient(
    gradient: LinearGradient,
    rect: { x: number; y: number; width: number; height: number },
    pxToPt: (value: number) => number
  ): AxialShadingConfig {
    log("SHADING", "DEBUG", "Creating axial shading from linear gradient", {
      gradient,
      rect,
    });

    // Convert CSS direction to PDF coordinates
    const coords = this.convertDirectionToCoords(gradient.direction, rect, pxToPt);
    
    // Create function for color interpolation
    const functionDef = this.createFunctionFromStops(gradient.stops);
    
    const config: AxialShadingConfig = {
      shadingType: 2,
      colorSpace: "DeviceRGB",
      coords,
      domain: [0, 1],
      function: functionDef,
      extend: [true, true], // Extend beyond endpoints like CSS
    };

    log("SHADING", "TRACE", "Generated axial shading config", {
      config,
      originalGradient: gradient,
    });

    return config;
  }

  /**
   * Convert CSS direction to PDF coordinate system
   */
  private static convertDirectionToCoords(
    direction: string,
    rect: { x: number; y: number; width: number; height: number },
    pxToPt: (value: number) => number
  ): [number, number, number, number] {
    const { x, y, width, height } = rect;
    const xPt = pxToPt(x);
    const yPt = pxToPt(y);
    const widthPt = pxToPt(width);
    const heightPt = pxToPt(height);

    // Default: to bottom (vertical gradient)
    let x0 = xPt + widthPt / 2;
    let y0 = yPt + heightPt;
    let x1 = xPt + widthPt / 2;
    let y1 = yPt;

    if (direction.includes("to right")) {
      // Horizontal gradient
      x0 = xPt;
      y0 = yPt + heightPt / 2;
      x1 = xPt + widthPt;
      y1 = yPt + heightPt / 2;
    } else if (direction.includes("to left")) {
      // Horizontal gradient (reversed)
      x0 = xPt + widthPt;
      y0 = yPt + heightPt / 2;
      x1 = xPt;
      y1 = yPt + heightPt / 2;
    } else if (direction.includes("to top")) {
      // Vertical gradient (reversed)
      x0 = xPt + widthPt / 2;
      y0 = yPt;
      x1 = xPt + widthPt / 2;
      y1 = yPt + heightPt;
    } else if (direction.includes("to top right")) {
      // Diagonal gradient
      x0 = xPt;
      y0 = yPt + heightPt;
      x1 = xPt + widthPt;
      y1 = yPt;
    } else if (direction.includes("to top left")) {
      // Diagonal gradient
      x0 = xPt + widthPt;
      y0 = yPt + heightPt;
      x1 = xPt;
      y1 = yPt;
    } else if (direction.includes("to bottom right")) {
      // Diagonal gradient
      x0 = xPt;
      y0 = yPt;
      x1 = xPt + widthPt;
      y1 = yPt + heightPt;
    } else if (direction.includes("to bottom left")) {
      // Diagonal gradient
      x0 = xPt + widthPt;
      y0 = yPt;
      x1 = xPt;
      y1 = yPt + heightPt;
    } else if (direction.endsWith("deg")) {
      // Angle-based gradient
      const angle = parseFloat(direction);
      const radians = (angle * Math.PI) / 180;
      const centerX = xPt + widthPt / 2;
      const centerY = yPt + heightPt / 2;
      const length = Math.sqrt(widthPt * widthPt + heightPt * heightPt) / 2;

      x0 = centerX - Math.cos(radians) * length;
      y0 = centerY - Math.sin(radians) * length;
      x1 = centerX + Math.cos(radians) * length;
      y1 = centerY + Math.sin(radians) * length;
    }

    log("SHADING", "DEBUG", "Converted direction to coordinates", {
      direction,
      originalRect: rect,
      coords: [x0, y0, x1, y1],
    });

    return [x0, y0, x1, y1];
  }

  /**
   * Create PDF function from gradient stops
   */
  private static createFunctionFromStops(stops: GradientStop[]): PdfFunction {
    // For now, handle simple two-color gradients
    // TODO: Implement multi-stop gradients with function arrays
    if (stops.length === 1) {
      // Single color - duplicate it
      const color = this.parseColor(stops[0].color);
      return {
        type: 2,
        domain: [0, 1],
        range: [0, 1, 1],
        c0: color,
        c1: color,
      };
    }

    // Use first and last stops for now
    const firstStop = stops[0];
    const lastStop = stops[stops.length - 1];

    const c0 = this.parseColor(firstStop.color);
    const c1 = this.parseColor(lastStop.color);

    log("SHADING", "DEBUG", "Created function from gradient stops", {
      stops,
      c0,
      c1,
    });

    return {
      type: 2,
      domain: [0, 1],
      range: [0, 1, 1],
      c0,
      c1,
    };
  }

  /**
   * Parse CSS color to PDF RGB values (0-1 range)
   */
  private static parseColor(color: string): [number, number, number] {
    // Simple hex color parsing
    if (color.startsWith("#")) {
      const hex = color.slice(1);
      if (hex.length === 3) {
        const r = parseInt(hex[0] + hex[0], 16) / 255;
        const g = parseInt(hex[1] + hex[1], 16) / 255;
        const b = parseInt(hex[2] + hex[2], 16) / 255;
        return [r, g, b];
      } else if (hex.length === 6) {
        const r = parseInt(hex.slice(0, 2), 16) / 255;
        const g = parseInt(hex.slice(2, 4), 16) / 255;
        const b = parseInt(hex.slice(4, 6), 16) / 255;
        return [r, g, b];
      }
    }

    // Named colors
    const namedColors: Record<string, [number, number, number]> = {
      red: [1, 0, 0],
      green: [0, 1, 0],
      blue: [0, 0, 1],
      yellow: [1, 1, 0],
      black: [0, 0, 0],
      white: [1, 1, 1],
    };

    if (color in namedColors) {
      return namedColors[color];
    }

    // Default to black
    return [0, 0, 0];
  }

  /**
   * Generate unique shading name
   */
  static generateShadingName(): string {
    const counter = this.getCounter(AxialShadingGenerator.SHADING_COUNTER);
    return `Sh${counter}`;
  }

  /**
   * Generate unique pattern name
   */
  static generatePatternName(): string {
    const counter = this.getCounter(AxialShadingGenerator.PATTERN_COUNTER);
    return `P${counter}`;
  }

  private static getCounter(name: string): number {
    const key = `pdf_${name}`;
    let counter = parseInt(localStorage.getItem(key) || "0", 10);
    counter++;
    localStorage.setItem(key, counter.toString());
    return counter;
  }

  /**
   * Serialize axial shading to PDF dictionary format
   */
  static serializeShading(config: AxialShadingConfig, name: string): string {
    const entries = [
      `/ShadingType ${config.shadingType}`,
      `/ColorSpace /${config.colorSpace}`,
      `/Coords [${config.coords.join(" ")}]`,
      `/Domain [${config.domain.join(" ")}]`,
      `/Extend [${config.extend[0]} ${config.extend[1]}]`,
    ];

    // Add function definition
    entries.push(this.serializeFunction(config.function));

    const shadingDict = [
      `<<`,
      `/Shading << /ShadingType 2 /ColorSpace /DeviceRGB /Coords [${config.coords.join(" ")}] /Domain [0 1] /Function ${this.serializeFunctionRef(config.function)} /Extend [true true] >>`,
      `>>`,
    ].join("\n");

    log("SHADING", "TRACE", "Serialized shading dictionary", {
      name,
      shadingDict,
    });

    return shadingDict;
  }

  /**
   * Serialize function to PDF format
   */
  private static serializeFunction(functionDef: PdfFunction): string {
    return [
      `<<`,
      `/FunctionType ${functionDef.type}`,
      `/Domain [${functionDef.domain.join(" ")}]`,
      `/Range [${functionDef.range.join(" ")}]`,
      `/C0 [${functionDef.c0.join(" ")}]`,
      `/C1 [${functionDef.c1.join(" ")}]`,
      `>>`,
    ].join("\n");
  }

  /**
   * Get function reference for shading dictionary
   */
  private static serializeFunctionRef(functionDef: PdfFunction): string {
    // For now, inline the function
    return this.serializeFunction(functionDef);
  }

  /**
   * Serialize pattern to PDF dictionary format
   */
  static serializePattern(pattern: ShadingPattern, shadingName: string, patternName: string): string {
    const entries = [
      `/Type /Pattern`,
      `/PatternType 2`, // Shading pattern
      `/Shading /${shadingName}`,
    ];

    if (pattern.matrix) {
      entries.push(`/Matrix [${pattern.matrix.join(" ")}]`);
    }

    if (pattern.bbox) {
      entries.push(`/BBox [${pattern.bbox.join(" ")}]`);
    }

    const patternDict = [`<<`, ...entries, `>>`].join("\n");

    log("SHADING", "TRACE", "Serialized pattern dictionary", {
      patternName,
      patternDict,
    });

    return patternDict;
  }
}

interface GradientStop {
  color: string;
  position?: number;
}
