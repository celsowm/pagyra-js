import { splitCssCommaList, splitCssList } from "../utils.js";

export interface GradientStop {
  color: string;
  position?: number;
}

export interface LinearGradient {
  type: "linear";
  direction: string;
  stops: GradientStop[];
}

export function parseLinearGradient(value: string): LinearGradient | null {
  const trimmed = value.trim().toLowerCase();
  
  // Check if it's a linear gradient
  if (!trimmed.startsWith("linear-gradient(")) {
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
  const commaPos = content.indexOf(',');
  if (commaPos !== -1) {
    const potentialDirection = content.substring(0, commaPos).trim();
    const lowerDirection = potentialDirection.toLowerCase();

    // Check if this part is a known direction
    const directionPatterns = ['to', 'to bottom', 'to right', 'to left', 'to top', 'to top right', 'to top left', 'to bottom right', 'to bottom left'];
    const isDirection = directionPatterns.some(pattern => lowerDirection === pattern) ||
                       lowerDirection.endsWith('deg');

    if (isDirection) {
      direction = lowerDirection;
      colorStopsContent = content.substring(commaPos + 1).trim();
    }
    // If not a direction, treat the whole content as color stops
  } else {
    // Single part - check if it's just a direction
    const trimmedContent = content.trim().toLowerCase();
    if (trimmedContent === 'to' ||
        trimmedContent.startsWith('to ') ||
        trimmedContent.endsWith('deg')) {
      direction = trimmedContent;
      colorStopsContent = '';
    }
    // Otherwise, treat as color stops
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
  
  // Parse color stops
  const stops: GradientStop[] = [];
  for (const stopValue of colorStopValues) {
    if (!stopValue.trim()) continue;
    
    const stop = parseGradientStop(stopValue);
    if (stop) {
      stops.push(stop);
    }
  }
  
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
  
  const color = parts[0].trim();
  if (!color) {
    return null;
  }
  
  // Check if there's a position
  let position: number | undefined;
  if (parts.length > 1) {
    const positionStr = parts[1].trim();
    // Try to parse as percentage
    if (positionStr.endsWith("%")) {
      const num = parseFloat(positionStr.slice(0, -1));
      if (!isNaN(num)) {
        position = num / 100;
      }
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
