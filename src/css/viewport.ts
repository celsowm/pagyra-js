// src/css/viewport.ts

let CURRENT_VIEWPORT_WIDTH_PX = 0;
let CURRENT_VIEWPORT_HEIGHT_PX = 0;

export function setViewportSize(width: number, height: number): void {
  CURRENT_VIEWPORT_WIDTH_PX = Number.isFinite(width) && width > 0 ? width : 0;
  CURRENT_VIEWPORT_HEIGHT_PX = Number.isFinite(height) && height > 0 ? height : 0;
}

export function getViewportWidth(): number {
  return CURRENT_VIEWPORT_WIDTH_PX;
}

export function getViewportHeight(): number {
  return CURRENT_VIEWPORT_HEIGHT_PX;
}
