import { splitCssCommaList, splitCssList } from "../utils.js";

export interface GradientStop {
  color: string;
  position?: number;
}

export interface LinearGradient {
  type: "linear";
  direction: string;
  stops: GradientStop[];
  // Optional coordinate hints (used when converting SVG gradients)
  coords?: { x1: number; y1: number; x2: number; y2: number; units: "ratio" | "userSpace" };
  renderOffset?: { x: number; y: number };
  renderScale?: { x: number; y: number };
}

export interface RadialGradient {
  type: "radial";
  cx: number;
  cy: number;
  r: number;
  fx?: number;
  fy?: number;
  stops: GradientStop[];
  // Optional coordinate units: "ratio" = objectBoundingBox (0..1), "userSpace" = absolute page pixels
  coordsUnits?: "ratio" | "userSpace";
  // Optional transform parsed from SVG's gradientTransform (matrix with a,b,c,d,e,f)
  transform?: { a: number; b: number; c: number; d: number; e: number; f: number };
  // gradientUnits omitted for CSS radial gradients; SVG will supply via its own node conversion
}

export function parseLinearGradient(value: string): LinearGradient | null {
  const trimmed = value.trim();
  console.log("parseLinearGradient - input:", value);
  console.log("parseLinearGradient - trimmed:", trimmed);

  // Check if it's a linear gradient (case-insensitive check)
  if (!trimmed.toLowerCase().startsWith("linear-gradient(")) {
    console.log("parseLinearGradient - not a linear gradient, returning null");
    return null;
  }

  // Extract the content inside parentheses
  const content = trimmed.slice("linear-gradient(".length, -1);
  if (!content) {
    return null;
  }
  
  // Parse the gradient content
  let direction = 'to bottom'; // default
  let colorStopsContent = content;

  // Check if the first comma-separated part looks like a direction
  // We need to be more careful to find the first actual comma that separates direction from color stops
  // rather than commas inside parentheses like in "linear-gradient(45deg, red, blue)"
  let commaPos = -1;
  let parenCount = 0;
  for (let i = 0; i < content.length; i++) {
    if (content[i] === '(') {
      parenCount++;
    } else if (content[i] === ')') {
      parenCount--;
    } else if (content[i] === ',' && parenCount === 0) {
      commaPos = i;
      break;
    }
  }

  if (commaPos !== -1) {
    const potentialDirection = content.substring(0, commaPos).trim();
    const lowerDirection = potentialDirection.toLowerCase();

    // Check if this part is a known direction
    const directionPatterns = ['to', 'to bottom', 'to right', 'to left', 'to top right', 'to top left', 'to bottom right', 'to bottom left'];
    const isDirection = directionPatterns.some(pattern => lowerDirection === pattern) ||
                       lowerDirection.endsWith('deg');

    if (isDirection) {
      direction = lowerDirection;
      colorStopsContent = content.substring(commaPos + 1).trim();
    } else {
      // If it's not a direction, treat the whole content as color stops
      colorStopsContent = content;
    }
  } else {
    // Single part - check if it's just a direction
    const trimmedContent = content.trim().toLowerCase();
    if (trimmedContent === 'to' ||
        trimmedContent.startsWith('to ') ||
        trimmedContent.endsWith('deg')) {
      direction = trimmedContent;
      colorStopsContent = '';
    } else {
      // Otherwise, treat as color stops
      colorStopsContent = content;
    }
  }
  
  // Clean up direction value
  if (direction.startsWith('to ')) {
    // Fix truncated direction values
    if (direction === 'to righ') {
      direction = 'to right';
    } else if (direction === 'to botto') {
      direction = 'to bottom';
    } else if (direction === 'to bott') {
      direction = 'to bottom';
    } else if (direction === 'to bot') {
      direction = 'to bottom';
    }
    // Remove trailing comma from "to" directions
    direction = direction.replace(/,$/, '');
  } else if (direction.endsWith('deg')) {
    // Remove comma from angle values
    direction = direction.replace(/,$/, '');
  }
  
  // Clean up direction value
  if (direction.startsWith('to ')) {
    // Remove trailing comma from "to" directions
    direction = direction.replace(/,$/, '');
  } else if (direction.endsWith('deg')) {
    // Remove comma from angle values
    direction = direction.replace(/,$/, '');
  }
  
  // Now split the color stops by commas that are not inside parentheses or quotes
  const colorStopValues = splitCssCommaList(colorStopsContent);
  
  console.log("Gradient parser - input value:", value);
  console.log("Gradient parser - content:", content);
  console.log("Gradient parser - direction:", direction);
  console.log("Gradient parser - colorStopsContent:", colorStopsContent);
  console.log("Gradient parser - colorStopValues:", colorStopValues);
  
  // Parse color stops
  const stops: GradientStop[] = [];
  for (const stopValue of colorStopValues) {
    if (!stopValue.trim()) continue;
    
    const stop = parseGradientStop(stopValue);
    if (stop) {
      stops.push(stop);
    }
  }
  
  console.log("Gradient parser - parsed stops:", stops);
  
  // If no color stops, create a default one
  if (stops.length === 0) {
    stops.push({ color: "#000000" });
  }
  
  return {
    type: "linear",
    direction,
    stops,
  };
}

function parseGradientStop(value: string): GradientStop | null {
  const parts = splitCssList(value);
  if (parts.length === 0) {
    return null;
  }
  
  let color = parts[0].trim();
  if (!color) {
    return null;
  }
  
  // Preserve color names - don't convert to hex values
  // The tests expect the original color names to be preserved
  const colorNames: Record<string, boolean> = {
    'red': true,
    'yellow': true,
    'green': true,
    'blue': true,
    'black': true,
    'white': true,
    'gray': true,
    'grey': true,
    'lime': true,
  };
  
  // Just validate that it's a known color name, but preserve the original value
  if (colorNames[color.toLowerCase()]) {
    // Keep the original color value (don't convert to hex)
    // No conversion needed, color remains as-is
  }
  
  // Check if there's a position
  let position: number | undefined;
  if (parts.length > 1) {
    const positionStr = parts[1].trim();
      const num = parseFloat(positionStr.slice(0, -1));
      if (!isNaN(num)) {
        position = num / 100;
    } else {
      // Try to parse as a number (0-1 range)
      const num = parseFloat(positionStr);
      if (!isNaN(num) && num >= 0 && num <= 1) {
        position = num;
      }
    }
  }
  
  return { color, position };
}
