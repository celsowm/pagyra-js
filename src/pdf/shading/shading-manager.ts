import { log } from "../../debug/log.js";
import type { PdfDocument } from "../primitives/pdf-document.js";
import type { PdfObjectRef } from "../primitives/pdf-document.js";
import type { LinearGradient } from "../../css/parsers/gradient-parser.js";
import type { Rect } from "../types.js";
import { AxialShadingGenerator } from "./axial-shading.js";
import type { AxialShadingConfig, ShadingPattern } from "./axial-shading.js";

/**
 * Shading Manager - Handles registration and management of PDF shadings and patterns
 * Provides a high-level interface for working with gradients in PDF
 */
export class ShadingManager {
  private readonly shadingResources = new Map<string, PdfObjectRef>();
  private readonly patternResources = new Map<string, PdfObjectRef>();
  private readonly pageShadings = new Map<string, Set<string>>();
  private readonly pagePatterns = new Map<string, Set<string>>();

  constructor(private readonly pdfDocument: PdfDocument) {}

  /**
   * Register a linear gradient as a shading pattern
   * Returns the pattern name to use in content streams
   */
  registerLinearGradient(
    gradient: LinearGradient,
    rect: Rect,
    pageId: string,
    pxToPt: (value: number) => number
  ): string {
    log("SHADING", "INFO", "Registering linear gradient", {
      gradient,
      rect,
      pageId,
    });

    // Generate unique names
    const shadingName = AxialShadingGenerator.generateShadingName();
    const patternName = AxialShadingGenerator.generatePatternName();

    // Create axial shading configuration
    const shadingConfig = AxialShadingGenerator.createFromLinearGradient(gradient, rect, pxToPt, this.pdfDocument);

    // Register shading and pattern with PDF document
    this.registerShadingResources(shadingConfig, shadingName, patternName, pageId);

    log("SHADING", "DEBUG", "Successfully registered gradient", {
      gradient,
      shadingName,
      patternName,
      pageId,
    });

    return patternName;
  }

  /**
   * Register shading and pattern resources with the PDF document
   */
  private registerShadingResources(
    shadingConfig: AxialShadingConfig,
    shadingName: string,
    patternName: string,
    pageId: string
  ): void {
    const shadingDict = AxialShadingGenerator.serializeShading(shadingConfig);
    const shadingRef = this.pdfDocument.registerShading(shadingName, shadingDict);

    const patternDict = AxialShadingGenerator.serializePattern({ shading: shadingConfig }, shadingRef);
    const patternRef = this.pdfDocument.registerPattern(patternName, patternDict);

    this.shadingResources.set(shadingName, shadingRef);
    this.patternResources.set(patternName, patternRef);

    // Track which shadings and patterns are used on which pages
    if (!this.pageShadings.has(pageId)) {
      this.pageShadings.set(pageId, new Set());
    }
    if (!this.pagePatterns.has(pageId)) {
      this.pagePatterns.set(pageId, new Set());
    }

    this.pageShadings.get(pageId)!.add(shadingName);
    this.pagePatterns.get(pageId)!.add(patternName);

    log("SHADING", "TRACE", "Registered shading resources", {
      shadingName,
      patternName,
      pageId,
      shadingDict,
      patternDict,
    });
  }

  /**
   * Get shading resources for a specific page
   */
  getPageShadingResources(pageId: string): Map<string, PdfObjectRef> {
    const result = new Map<string, PdfObjectRef>();
    
    const pageShadings = this.pageShadings.get(pageId);
    if (pageShadings) {
      for (const shadingName of pageShadings) {
        const shadingRef = this.shadingResources.get(shadingName);
        if (shadingRef) {
          result.set(shadingName, shadingRef);
        }
      }
    }
    
    return result;
  }

  /**
   * Get pattern resources for a specific page
   */
  getPagePatternResources(pageId: string): Map<string, PdfObjectRef> {
    const result = new Map<string, PdfObjectRef>();
    
    const pagePatterns = this.pagePatterns.get(pageId);
    if (pagePatterns) {
      for (const patternName of pagePatterns) {
        const patternRef = this.patternResources.get(patternName);
        if (patternRef) {
          result.set(patternName, patternRef);
        }
      }
    }
    
    return result;
  }

  /**
   * Generate content stream commands to apply a shading pattern
   */
  generateShadingCommands(patternName: string, rect: Rect): string[] {
    log("SHADING", "DEBUG", "Generating shading commands", {
      patternName,
      rect,
    });

    // Save graphics state
    const commands = ["q"];

    // Set the pattern as the fill color
    commands.push(`/${patternName} cs`);
    commands.push(`/${patternName} scn`);

    // Create and fill the path (rectangle)
    commands.push(`${rect.x} ${rect.y} ${rect.width} ${rect.height} re`);
    commands.push("f");

    // Restore graphics state
    commands.push("Q");

    log("SHADING", "TRACE", "Generated shading commands", {
      patternName,
      commands,
    });

    return commands;
  }

  /**
   * Generate content stream commands for simple shading (without pattern)
   */
  generateSimpleShadingCommands(shadingName: string): string[] {
    log("SHADING", "DEBUG", "Generating simple shading commands", {
      shadingName,
    });

    // Save graphics state
    const commands = ["q"];

    // Apply shading directly
    commands.push(`/${shadingName} sh`);

    // Restore graphics state
    commands.push("Q");

    return commands;
  }

  /**
   * Check if a gradient is supported
   */
  isGradientSupported(gradient: LinearGradient): boolean {
    // For now, support all linear gradients
    // Could add more sophisticated checks later
    return gradient.type === "linear";
  }

  /**
   * Get debug information about registered shadings
   */
  getDebugInfo(): Record<string, unknown> {
    return {
      totalShadings: this.shadingResources.size,
      totalPatterns: this.patternResources.size,
      pageShadings: Object.fromEntries(this.pageShadings),
      pagePatterns: Object.fromEntries(this.pagePatterns),
      shadingResources: Array.from(this.shadingResources.keys()),
      patternResources: Array.from(this.patternResources.keys()),
    };
  }
}
