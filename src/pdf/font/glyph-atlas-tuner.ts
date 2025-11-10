/**
 * Simple heuristic tuner for glyph atlas parameters.
 *
 * Exports pickAtlasSettingsFromSamples(samples)
 * - samples: Array of { width:number, height:number } representing a sample
 *   of glyph mask sizes (in px) for a font/size combination.
 *
 * Heuristic:
 * - Try candidate page sizes (1024, 2048, 4096)
 * - Try padding values (0..3)
 * - For each (pageSize, padding) compute:
 *    * If any glyph (w+2p > pageSize or h+2p > pageSize) -> invalid
 *    * totalPaddedArea = sum((w+2p)*(h+2p))
 *    * estimatedPages = ceil(totalPaddedArea / (pageSize*pageSize))
 *    * wastedRatio = estimatedPages * pageSize*pageSize / totalPaddedArea
 * - Prefer configurations with smallest estimatedPages; tie-break by smallest wastedRatio,
 *   then smaller pageSize and smaller padding.
 *
 * This is fast and conservative. It doesn't run an actual packer; it's only a
 * lightweight selector to choose sensible defaults for pageSize and padding.
 */

export interface AtlasSettings {
  pageSize: number;
  padding: number;
  estimatedPages: number;
  wastedRatio: number;
  valid: boolean;
}

export function pickAtlasSettingsFromSamples(
  samples: Array<{ width: number; height: number }>,
  opts?: { candidates?: number[]; paddings?: number[] }
): AtlasSettings {
  const candidates = opts?.candidates ?? [1024, 2048, 4096];
  const paddings = opts?.paddings ?? [0, 1, 2, 3];

  // sanitize samples
  const filtered = (samples || []).map(s => ({ width: Math.max(0, Math.floor(s.width)), height: Math.max(0, Math.floor(s.height)) }));
  if (filtered.length === 0) {
    // default safe
    return { pageSize: 2048, padding: 1, estimatedPages: 1, wastedRatio: 1, valid: true };
  }

  let best: AtlasSettings | null = null;

  for (const pageSize of candidates) {
    for (const padding of paddings) {
      let invalid = false;
      let totalPaddedArea = 0;
      for (const s of filtered) {
        const pw = s.width + padding * 2;
        const ph = s.height + padding * 2;
        if (pw > pageSize || ph > pageSize) {
          invalid = true;
          break;
        }
        totalPaddedArea += pw * ph;
      }
      if (invalid) continue;
      const pageArea = pageSize * pageSize;
      const estimatedPages = Math.max(1, Math.ceil(totalPaddedArea / pageArea));
      const wastedRatio = (estimatedPages * pageArea) / Math.max(1, totalPaddedArea);

      const candidate: AtlasSettings = {
        pageSize,
        padding,
        estimatedPages,
        wastedRatio,
        valid: true,
      };

      if (!best) {
        best = candidate;
        continue;
      }

      // prefer fewer pages, then lower wastedRatio, then smaller pageSize, then smaller padding
      if (candidate.estimatedPages < best.estimatedPages) {
        best = candidate;
      } else if (candidate.estimatedPages === best.estimatedPages) {
        if (candidate.wastedRatio < best.wastedRatio - 1e-9) {
          best = candidate;
        } else if (Math.abs(candidate.wastedRatio - best.wastedRatio) < 1e-9) {
          if (candidate.pageSize < best.pageSize) best = candidate;
          else if (candidate.pageSize === best.pageSize && candidate.padding < best.padding) best = candidate;
        }
      }
    }
  }

  if (!best) {
    // fallback conservative
    return { pageSize: 2048, padding: 1, estimatedPages: 1, wastedRatio: 1, valid: false };
  }

  return best;
}
