/**
 * Simple separable Gaussian blur for 8-bit alpha masks.
 *
 * Exports blurAlpha(data, width, height, radiusPx)
 * - data: Uint8ClampedArray (length = width*height) containing alpha 0..255
 * - radiusPx: blur radius in pixels (CSS pixels). If radius <= 0 returns a copy of input.
 *
 * Implementation notes:
 * - Builds a 1D Gaussian kernel from sigma derived from radius (sigma = radius / 3).
 * - Performs horizontal pass then vertical pass using Float32 accumulation.
 * - Clamps outputs back to Uint8ClampedArray.
 *
 * This is intentionally simple and robust. It favors correctness over ultimate perf.
 */

export function blurAlpha(src: Uint8ClampedArray, width: number, height: number, radiusPx: number): Uint8ClampedArray {
  if (!src || src.length === 0) return src;
  if (radiusPx <= 0) return src.slice();

  // Convert radius -> sigma. Use heuristic sigma ~= radius / 3 (so radius ~ 3*sigma)
  const sigma = Math.max(0.0001, radiusPx / 3);
  // Kernel size: 2*ceil(3*sigma)+1 ensures coverage
  const half = Math.ceil(3 * sigma);
  const ksize = half * 2 + 1;

  // Build 1D Gaussian kernel (normalized)
  const kernel = new Float32Array(ksize);
  const sigma2 = sigma * sigma;
  const denom = 1 / (Math.sqrt(2 * Math.PI) * sigma);
  let sum = 0;
  for (let i = -half; i <= half; i++) {
    const v = denom * Math.exp(-(i * i) / (2 * sigma2));
    kernel[i + half] = v;
    sum += v;
  }
  // normalize
  for (let i = 0; i < ksize; i++) kernel[i] /= sum;

  // Horizontal pass -> float buffer
  const tmp = new Float32Array(width * height);

  for (let y = 0; y < height; y++) {
    const row = y * width;
    for (let x = 0; x < width; x++) {
      let acc = 0;
      for (let k = -half; k <= half; k++) {
        const sx = x + k;
        if (sx < 0) {
          // clamp
          acc += kernel[k + half] * src[row + 0];
        } else if (sx >= width) {
          acc += kernel[k + half] * src[row + (width - 1)];
        } else {
          acc += kernel[k + half] * src[row + sx];
        }
      }
      tmp[row + x] = acc;
    }
  }

  // Vertical pass -> output uint8
  const out = new Uint8ClampedArray(width * height);
  for (let x = 0; x < width; x++) {
    for (let y = 0; y < height; y++) {
      let acc = 0;
      for (let k = -half; k <= half; k++) {
        const sy = y + k;
        if (sy < 0) {
          acc += kernel[k + half] * tmp[0 * width + x];
        } else if (sy >= height) {
          acc += kernel[k + half] * tmp[(height - 1) * width + x];
        } else {
          acc += kernel[k + half] * tmp[sy * width + x];
        }
      }
      out[y * width + x] = Math.round(acc);
    }
  }

  return out;
}
