import type { LinearGradient, GradientStop } from "../../css/parsers/gradient-parser.js";
import type { RGBA } from "../types.js";
import { CoordinateTransformer } from "../utils/coordinate-transformer.js";

export interface GradientPattern {
  readonly patternName: string;
  readonly commands: string[];
}

export class GradientService {
  private readonly patterns = new Map<string, GradientPattern>();
  private readonly graphicsStates = new Map<string, number>();
  private patternCounter = 0;

  constructor(
    private readonly coordinateTransformer: CoordinateTransformer
  ) {}

  createLinearGradient(
    gradient: LinearGradient,
    rect: { x: number; y: number; width: number; height: number },
    colorSpace: "DeviceRGB" = "DeviceRGB"
  ): GradientPattern {
    // Generate a unique name for this gradient pattern
    const patternName = this.generatePatternName();
    
    // Calculate gradient coordinates based on direction
    const coords = this.calculateGradientCoordinates(gradient, rect);
    
    // Calculate bounding box for the pattern
    const bbox = this.calculatePatternBbox(gradient, rect);
    
    // Create PDF pattern definition
    const patternDef = this.createPatternDefinition(
      patternName,
      gradient,
      coords,
      bbox,
      colorSpace
    );
    
    // Store the pattern
    this.patterns.set(patternName, {
      patternName,
      commands: patternDef
    });

    return {
      patternName,
      commands: patternDef
    };
  }

  private generatePatternName(): string {
    return `Grad${this.patternCounter++}`;
  }

  private calculateGradientCoordinates(
    gradient: LinearGradient,
    rect: { x: number; y: number; width: number; height: number }
  ): [number, number, number, number] {
    switch (gradient.direction) {
      case "to right":
        return [
          this.coordinateTransformer.convertPxToPt(rect.x),
          this.coordinateTransformer.convertPxToPt(rect.y + rect.height / 2),
          this.coordinateTransformer.convertPxToPt(rect.x + rect.width),
          this.coordinateTransformer.convertPxToPt(rect.y + rect.height / 2)
        ];
      case "to left":
        return [
          this.coordinateTransformer.convertPxToPt(rect.x + rect.width),
          this.coordinateTransformer.convertPxToPt(rect.y + rect.height / 2),
          this.coordinateTransformer.convertPxToPt(rect.x),
          this.coordinateTransformer.convertPxToPt(rect.y + rect.height / 2)
        ];
      case "to bottom":
        return [
          this.coordinateTransformer.convertPxToPt(rect.x + rect.width / 2),
          this.coordinateTransformer.convertPxToPt(rect.y),
          this.coordinateTransformer.convertPxToPt(rect.x + rect.width / 2),
          this.coordinateTransformer.convertPxToPt(rect.y + rect.height)
        ];
      case "to top":
        return [
          this.coordinateTransformer.convertPxToPt(rect.x + rect.width / 2),
          this.coordinateTransformer.convertPxToPt(rect.y + rect.height),
          this.coordinateTransformer.convertPxToPt(rect.x + rect.width / 2),
          this.coordinateTransformer.convertPxToPt(rect.y)
        ];
      case "to top right":
        return [
          this.coordinateTransformer.convertPxToPt(rect.x),
          this.coordinateTransformer.convertPxToPt(rect.y + rect.height),
          this.coordinateTransformer.convertPxToPt(rect.x + rect.width),
          this.coordinateTransformer.convertPxToPt(rect.y)
        ];
      case "to top left":
        return [
          this.coordinateTransformer.convertPxToPt(rect.x + rect.width),
          this.coordinateTransformer.convertPxToPt(rect.y + rect.height),
          this.coordinateTransformer.convertPxToPt(rect.x),
          this.coordinateTransformer.convertPxToPt(rect.y)
        ];
      case "to bottom right":
        return [
          this.coordinateTransformer.convertPxToPt(rect.x),
          this.coordinateTransformer.convertPxToPt(rect.y),
          this.coordinateTransformer.convertPxToPt(rect.x + rect.width),
          this.coordinateTransformer.convertPxToPt(rect.y + rect.height)
        ];
      case "to bottom left":
        return [
          this.coordinateTransformer.convertPxToPt(rect.x + rect.width),
          this.coordinateTransformer.convertPxToPt(rect.y),
          this.coordinateTransformer.convertPxToPt(rect.x),
          this.coordinateTransformer.convertPxToPt(rect.y + rect.height)
        ];
      default:
        // Handle angle-based directions
        if (gradient.direction.endsWith("deg")) {
          const angle = parseFloat(gradient.direction);
          return this.calculateCoordinatesFromAngle(angle, rect);
        }
        // Default to horizontal gradient
        return [
          this.coordinateTransformer.convertPxToPt(rect.x),
          this.coordinateTransformer.convertPxToPt(rect.y + rect.height / 2),
          this.coordinateTransformer.convertPxToPt(rect.x + rect.width),
          this.coordinateTransformer.convertPxToPt(rect.y + rect.height / 2)
        ];
    }
  }

  private calculateCoordinatesFromAngle(
    angle: number,
    rect: { x: number; y: number; width: number; height: number }
  ): [number, number, number, number] {
    // Convert angle to radians (0deg = to right, 90deg = to bottom)
    const rad = (angle - 90) * Math.PI / 180;
    
    // Calculate center point
    const centerX = rect.x + rect.width / 2;
    const centerY = rect.y + rect.height / 2;
    
    // Calculate the length of the gradient line
    const halfDiagonal = Math.sqrt(rect.width * rect.width + rect.height * rect.height) / 2;
    
    // Calculate start and end points
    const startX = centerX - halfDiagonal * Math.cos(rad);
    const startY = centerY - halfDiagonal * Math.sin(rad);
    const endX = centerX + halfDiagonal * Math.cos(rad);
    const endY = centerY + halfDiagonal * Math.sin(rad);
    
    return [
      this.coordinateTransformer.convertPxToPt(startX),
      this.coordinateTransformer.convertPxToPt(startY),
      this.coordinateTransformer.convertPxToPt(endX),
      this.coordinateTransformer.convertPxToPt(endY)
    ];
  }

  private calculatePatternBbox(
    gradient: LinearGradient,
    rect: { x: number; y: number; width: number; height: number }
  ): [number, number, number, number] {
    // For linear gradients, the pattern bbox should match the rectangle
    return [
      this.coordinateTransformer.convertPxToPt(rect.x),
      this.coordinateTransformer.convertPxToPt(rect.y),
      this.coordinateTransformer.convertPxToPt(rect.width),
      this.coordinateTransformer.convertPxToPt(rect.height)
    ];
  }

  private createPatternDefinition(
    patternName: string,
    gradient: LinearGradient,
    coords: [number, number, number, number],
    bbox: [number, number, number, number],
    colorSpace: string
  ): string[] {
    const commands: string[] = [];
    
    // Start pattern definition
    commands.push(`/PatternType 2`);
    commands.push(`/ShadingType 2`);
    commands.push(`/ColorSpace /${colorSpace}`);
    
    // Add coordinates
    commands.push(`/Coords [${coords.join(" ")}]`);
    
    // Add bounding box
    commands.push(`/BBox [${bbox.join(" ")}]`);
    
    // Add color stops
    if (gradient.stops.length >= 2) {
      const c0 = this.parseColor(gradient.stops[0].color);
      const c1 = this.parseColor(gradient.stops[gradient.stops.length - 1].color);
      
      commands.push(`/C0 [${c0.r} ${c0.g} ${c0.b}]`);
      commands.push(`/C1 [${c1.r} ${c1.g} ${c1.b}]`);
      commands.push(`/N 1`);
    }
    
    // Function definition
    commands.push(`/Function <<`);
    commands.push(`/FunctionType 2`);
    commands.push(`/Domain [0 1]`);
    commands.push(`/C0 [${this.parseColor(gradient.stops[0].color).r} ${this.parseColor(gradient.stops[0].color).g} ${this.parseColor(gradient.stops[0].color).b}]`);
    commands.push(`/C1 [${this.parseColor(gradient.stops[gradient.stops.length - 1].color).r} ${this.parseColor(gradient.stops[gradient.stops.length - 1].color).g} ${this.parseColor(gradient.stops[gradient.stops.length - 1].color).b}]`);
    commands.push(`/N 1`);
    commands.push(`>>`);
    
    // End pattern definition
    commands.push(`>>`);
    commands.push(`def`);
    
    return commands;
  }

  private parseColor(colorStr: string): { r: number; g: number; b: number } {
    // Handle named colors
    const namedColors: Record<string, { r: number; g: number; b: number }> = {
      red: { r: 1, g: 0, b: 0 },
      green: { r: 0, g: 1, b: 0 },
      blue: { r: 0, g: 0, b: 1 },
      yellow: { r: 1, g: 1, b: 0 },
      black: { r: 0, g: 0, b: 0 },
      white: { r: 1, g: 1, b: 1 },
    };
    
    if (namedColors[colorStr.toLowerCase()]) {
      return namedColors[colorStr.toLowerCase()];
    }
    
    // Handle hex colors
    if (colorStr.startsWith("#")) {
      const hex = colorStr.slice(1);
      if (hex.length === 3) {
        // Parse shorthand hex (e.g., #RGB)
        const r = parseInt(hex[0] + hex[0], 16) / 255;
        const g = parseInt(hex[1] + hex[1], 16) / 255;
        const b = parseInt(hex[2] + hex[2], 16) / 255;
        return { r, g, b };
      } else if (hex.length === 6) {
        // Parse full hex (e.g., #RRGGBB)
        const r = parseInt(hex.slice(0, 2), 16) / 255;
        const g = parseInt(hex.slice(2, 4), 16) / 255;
        const b = parseInt(hex.slice(4, 6), 16) / 255;
        return { r, g, b };
      }
    }
    
    // Default to black if color can't be parsed
    return { r: 0, g: 0, b: 0 };
  }

  getPatternCommands(): string[] {
    const allCommands: string[] = [];
    
    // Add all pattern definitions
    this.patterns.forEach(pattern => {
      allCommands.push(`/${pattern.patternName} ${pattern.commands.join("\n")}`);
    });
    
    return allCommands;
  }

  getGraphicsStates(): Map<string, number> {
    return new Map(this.graphicsStates);
  }

  clearPatterns(): void {
    this.patterns.clear();
    this.patternCounter = 0;
  }
}
