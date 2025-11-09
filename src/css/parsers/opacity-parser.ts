import type { StyleAccumulator } from "../style.js";

export function parseOpacity(value: string, target: StyleAccumulator): void {
  console.log(`DEBUG: parseOpacity called with value: "${value}"`);
  // Normalize the value by trimming whitespace and converting to lowercase
  const normalizedValue = value.trim().toLowerCase();
  
  // Parse as a number - opacity can be a number between 0 and 1 or a percentage
  let opacityValue: number;
  
  if (normalizedValue.endsWith('%')) {
    // Handle percentage values (e.g., "50%")
    const percentStr = normalizedValue.slice(0, -1);
    const percent = parseFloat(percentStr);
    if (isNaN(percent)) {
      return; // Invalid percentage, don't set opacity
    }
    opacityValue = percent / 100;
  } else {
    // Handle decimal values (e.g., "0.5")
    opacityValue = parseFloat(normalizedValue);
    if (isNaN(opacityValue)) {
      return; // Invalid number, don't set opacity
    }
  }
  
  // Clamp the value between 0 and 1
  opacityValue = Math.max(0, Math.min(1, opacityValue));
  
  // Set the opacity in the target accumulator
  target.opacity = opacityValue;
}
