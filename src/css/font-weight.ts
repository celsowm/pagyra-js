const FONT_WEIGHT_STEPS = [100, 200, 300, 400, 500, 600, 700, 800, 900] as const;

type FontWeightDirection = "bolder" | "lighter";

export function normalizeFontWeight(weight: number | undefined): number {
  if (!Number.isFinite(weight ?? NaN)) {
    return 400;
  }
  const clamped = Math.min(900, Math.max(100, weight as number));
  let nearest = 400;
  let smallestDiff = Math.abs(nearest - clamped);
  for (const step of FONT_WEIGHT_STEPS) {
    const diff = Math.abs(step - clamped);
    if (diff < smallestDiff) {
      smallestDiff = diff;
      nearest = step;
    }
  }
  return nearest;
}

export function stepFontWeight(weight: number | undefined, direction: FontWeightDirection): number {
  const normalized = normalizeFontWeight(weight);
  const index = FONT_WEIGHT_STEPS.indexOf(normalized as (typeof FONT_WEIGHT_STEPS)[number]);
  if (index === -1) {
    return normalized;
  }
  if (direction === "bolder") {
    return FONT_WEIGHT_STEPS[Math.min(FONT_WEIGHT_STEPS.length - 1, index + 1)];
  }
  return FONT_WEIGHT_STEPS[Math.max(0, index - 1)];
}

export function parseFontWeightValue(value: string, inherited?: number): number | undefined {
  const token = value.trim().toLowerCase();
  switch (token) {
    case "normal":
      return 400;
    case "bold":
      return 700;
    case "bolder":
      return stepFontWeight(inherited, "bolder");
    case "lighter":
      return stepFontWeight(inherited, "lighter");
    case "inherit":
      return inherited !== undefined ? normalizeFontWeight(inherited) : undefined;
    case "initial":
      return 400;
    default: {
      const numeric = Number.parseFloat(token);
      if (Number.isFinite(numeric)) {
        return normalizeFontWeight(numeric);
      }
      return undefined;
    }
  }
}

export function fontWeightCacheKey(weight: number | undefined): string {
  return normalizeFontWeight(weight).toString();
}

export function isBoldFontWeight(weight: number | undefined): boolean {
  return normalizeFontWeight(weight) >= 600;
}
