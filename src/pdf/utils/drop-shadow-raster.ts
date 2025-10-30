import type { Radius, Rect, RGBA, ImageRef } from "../types.js";

function clampUnit(value: number): number {
  if (!Number.isFinite(value)) return 0;
  if (value <= 0) return 0;
  if (value >= 1) return 1;
  return value;
}

function ceilPositive(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  return Math.ceil(value);
}

function inflateRect(rect: Rect, amount: number): Rect {
  const width = rect.width + amount * 2;
  const height = rect.height + amount * 2;
  if (width <= 0 || height <= 0) {
    return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2, width: 0, height: 0 };
  }
  return { x: rect.x - amount, y: rect.y - amount, width, height };
}

function max2(a: number, b: number): number { return a > b ? a : b; }

function pointInRoundedRect(px: number, py: number, rect: Rect, radius: Radius): boolean {
  if (px < rect.x || py < rect.y || px > rect.x + rect.width || py > rect.y + rect.height) {
    return false;
  }

  const leftMargin = max2(radius.topLeft.x, radius.bottomLeft.x);
  const rightMargin = max2(radius.topRight.x, radius.bottomRight.x);
  const topMargin = max2(radius.topLeft.y, radius.topRight.y);
  const bottomMargin = max2(radius.bottomLeft.y, radius.bottomRight.y);

  // Horizontal and vertical straight strips
  if (px >= rect.x + leftMargin && px <= rect.x + rect.width - rightMargin) return true;
  if (py >= rect.y + topMargin && py <= rect.y + rect.height - bottomMargin) return true;

  // Corner tests (elliptical)
  // Top-left
  if (px < rect.x + radius.topLeft.x && py < rect.y + radius.topLeft.y && radius.topLeft.x > 0 && radius.topLeft.y > 0) {
    const cx = rect.x + radius.topLeft.x;
    const cy = rect.y + radius.topLeft.y;
    const dx = (px - cx) / radius.topLeft.x;
    const dy = (py - cy) / radius.topLeft.y;
    return dx * dx + dy * dy <= 1;
  }
  // Top-right
  if (px > rect.x + rect.width - radius.topRight.x && py < rect.y + radius.topRight.y && radius.topRight.x > 0 && radius.topRight.y > 0) {
    const cx = rect.x + rect.width - radius.topRight.x;
    const cy = rect.y + radius.topRight.y;
    const dx = (px - cx) / radius.topRight.x;
    const dy = (py - cy) / radius.topRight.y;
    return dx * dx + dy * dy <= 1;
  }
  // Bottom-right
  if (px > rect.x + rect.width - radius.bottomRight.x && py > rect.y + rect.height - radius.bottomRight.y && radius.bottomRight.x > 0 && radius.bottomRight.y > 0) {
    const cx = rect.x + rect.width - radius.bottomRight.x;
    const cy = rect.y + rect.height - radius.bottomRight.y;
    const dx = (px - cx) / radius.bottomRight.x;
    const dy = (py - cy) / radius.bottomRight.y;
    return dx * dx + dy * dy <= 1;
  }
  // Bottom-left
  if (px < rect.x + radius.bottomLeft.x && py > rect.y + rect.height - radius.bottomLeft.y && radius.bottomLeft.x > 0 && radius.bottomLeft.y > 0) {
    const cx = rect.x + radius.bottomLeft.x;
    const cy = rect.y + rect.height - radius.bottomLeft.y;
    const dx = (px - cx) / radius.bottomLeft.x;
    const dy = (py - cy) / radius.bottomLeft.y;
    return dx * dx + dy * dy <= 1;
  }
  return false;
}

function buildGaussianKernel(sigma: number): { kernel: Float32Array; radius: number; sum: number } {
  const s = sigma > 0 ? sigma : 0.0001;
  const radius = Math.max(1, Math.ceil(s * 3));
  const size = radius * 2 + 1;
  const kernel = new Float32Array(size);
  const coeff = 1 / (Math.sqrt(2 * Math.PI) * s);
  const twoSigmaSq = 2 * s * s;
  let sum = 0;
  for (let i = -radius; i <= radius; i++) {
    const w = coeff * Math.exp(-(i * i) / twoSigmaSq);
    kernel[i + radius] = w;
    sum += w;
  }
  return { kernel, radius, sum };
}

function blurAlpha(alpha: Uint8Array, width: number, height: number, sigma: number): Uint8Array {
  if (sigma <= 0) return alpha;
  const { kernel, radius, sum } = buildGaussianKernel(sigma);
  const tmp = new Float32Array(width * height);
  // Horizontal pass
  for (let y = 0; y < height; y++) {
    const rowOffset = y * width;
    for (let x = 0; x < width; x++) {
      let acc = 0;
      let wsum = 0;
      for (let k = -radius; k <= radius; k++) {
        const xi = Math.min(width - 1, Math.max(0, x + k));
        const w = kernel[k + radius];
        acc += alpha[rowOffset + xi] * w;
        wsum += w;
      }
      tmp[rowOffset + x] = acc / (wsum || sum);
    }
  }
  // Vertical pass
  const out = new Uint8Array(width * height);
  for (let x = 0; x < width; x++) {
    for (let y = 0; y < height; y++) {
      let acc = 0;
      let wsum = 0;
      for (let k = -radius; k <= radius; k++) {
        const yi = Math.min(height - 1, Math.max(0, y + k));
        const w = kernel[k + radius];
        acc += tmp[yi * width + x] * w;
        wsum += w;
      }
      const v = acc / (wsum || sum);
      out[y * width + x] = v < 0 ? 0 : v > 255 ? 255 : v;
    }
  }
  return out;
}

export interface ShadowRasterResult {
  readonly image: ImageRef;
  readonly drawRect: Rect; // where to place the image in page coordinates (px)
}

export function rasterizeDropShadowForRect(
  baseRect: Rect,
  baseRadius: Radius,
  color: RGBA,
  blur: number,
  spread: number,
): ShadowRasterResult | null {
  const blurPx = Math.max(0, blur);
  const shapeRect: Rect = inflateRect(baseRect, spread);
  const shapeRadius: Radius = adjustRadius(baseRadius, spread);
  const outRect: Rect = inflateRect(shapeRect, blurPx);
  const width = ceilPositive(outRect.width);
  const height = ceilPositive(outRect.height);
  if (width === 0 || height === 0) {
    return null;
  }

  // Build alpha mask for the unblurred rounded rectangle (shapeRect within outRect)
  const alpha = new Uint8Array(width * height);
  const shapeLocal: Rect = { x: shapeRect.x - outRect.x, y: shapeRect.y - outRect.y, width: shapeRect.width, height: shapeRect.height };

  for (let y = 0; y < height; y++) {
    const py = y + 0.5; // pixel center
    for (let x = 0; x < width; x++) {
      const px = x + 0.5;
      const inside = pointInRoundedRect(px, py, shapeLocal, shapeRadius);
      alpha[y * width + x] = inside ? 255 : 0;
    }
  }

  const sigma = blurPx > 0 ? Math.max(0.5, blurPx / 2) : 0;
  const blurred = blurAlpha(alpha, width, height, sigma);

  // Compose RGBA data with straight alpha (non-premultiplied RGB)
  // sRGB compensation: push base color slightly towards display sRGB to better match browser compositing
  const [r, g, b] = compensateSrgbColor(color.r, color.g, color.b);
  const aMul = clampUnit(color.a ?? 1);
  const data = new Uint8Array(width * height * 4);
  let di = 0;
  for (let i = 0; i < blurred.length; i++) {
    data[di++] = r;
    data[di++] = g;
    data[di++] = b;
    const a = Math.round(blurred[i] * aMul);
    data[di++] = a < 0 ? 0 : a > 255 ? 255 : a;
  }

  const image: ImageRef = {
    src: `internal:shadow:${Math.random().toString(36).slice(2)}`,
    width,
    height,
    format: "png",
    channels: 4,
    bitsPerComponent: 8,
    data: data.buffer,
  };

  return { image, drawRect: outRect };
}

function adjustRadius(radius: Radius, delta: number): Radius {
  const clampNN = (v: number) => (Number.isFinite(v) && v > 0 ? v : 0);
  return {
    topLeft: { x: clampNN(radius.topLeft.x + delta), y: clampNN(radius.topLeft.y + delta) },
    topRight: { x: clampNN(radius.topRight.x + delta), y: clampNN(radius.topRight.y + delta) },
    bottomRight: { x: clampNN(radius.bottomRight.x + delta), y: clampNN(radius.bottomRight.y + delta) },
    bottomLeft: { x: clampNN(radius.bottomLeft.x + delta), y: clampNN(radius.bottomLeft.y + delta) },
  };
}

function srgbToLinearByte(c: number): number {
  const cs = Math.min(1, Math.max(0, c > 1 ? c / 255 : c));
  const lin = cs <= 0.04045 ? cs / 12.92 : Math.pow((cs + 0.055) / 1.055, 2.4);
  return lin * 255;
}

function linearToSrgbByte(c: number): number {
  const cl = Math.min(1, Math.max(0, c > 1 ? c / 255 : c));
  const srgb = cl <= 0.0031308 ? 12.92 * cl : 1.055 * Math.pow(cl, 1 / 2.4) - 0.055;
  return Math.round(Math.min(255, Math.max(0, srgb * 255)));
}

// Simple compensation to reduce perceived desaturation in some PDF viewers
function compensateSrgbColor(rIn: number, gIn: number, bIn: number): [number, number, number] {
  // Convert to linear, nudge saturation, convert back to sRGB
  const rl = srgbToLinearByte(rIn) / 255;
  const gl = srgbToLinearByte(gIn) / 255;
  const bl = srgbToLinearByte(bIn) / 255;
  const max = Math.max(rl, gl, bl);
  const min = Math.min(rl, gl, bl);
  const mid = (rl + gl + bl) / 3;
  const sat = max - min;
  const boosted = Math.min(1, sat * 1.08); // small boost only
  const scale = sat > 0 ? boosted / sat : 1;
  const r = mid + (rl - mid) * scale;
  const g = mid + (gl - mid) * scale;
  const b = mid + (bl - mid) * scale;
  return [linearToSrgbByte(r), linearToSrgbByte(g), linearToSrgbByte(b)];
}
