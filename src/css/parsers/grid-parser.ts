import type {
  TrackDefinitionInput,
  TrackSizeInput,
  RepeatTrackDefinitionInput,
  AutoRepeatTrackDefinitionInput,
  FlexTrackSizeInput,
  ClampTrackSizeInput,
  NumericLength,
} from "../style.js";
import type { ClampNumericLength } from "../length.js";
import { parseClampArgs, parseLength } from "./length-parser.js";

type GapLengthInput = NumericLength | ClampNumericLength;

function tokenizeTrackList(value: string): string[] {
  const tokens: string[] = [];
  let buffer = "";
  let depth = 0;

  for (let i = 0; i < value.length; i++) {
    const char = value[i];
    if (char === "(") {
      depth += 1;
      buffer += char;
      continue;
    }
    if (char === ")") {
      depth = Math.max(0, depth - 1);
      buffer += char;
      continue;
    }
    if (/\s/.test(char) && depth === 0) {
      if (buffer) {
        tokens.push(buffer.trim());
        buffer = "";
      }
      continue;
    }
    buffer += char;
  }

  if (buffer) {
    tokens.push(buffer.trim());
  }

  return tokens;
}

function tokenizeSpaceSeparated(value: string): string[] {
  const tokens: string[] = [];
  let buffer = "";
  let depth = 0;

  for (let i = 0; i < value.length; i++) {
    const char = value[i];
    if (char === "(") {
      depth += 1;
      buffer += char;
      continue;
    }
    if (char === ")") {
      depth = Math.max(0, depth - 1);
      buffer += char;
      continue;
    }
    if (/\s/.test(char) && depth === 0) {
      if (buffer) {
        tokens.push(buffer.trim());
        buffer = "";
      }
      continue;
    }
    buffer += char;
  }

  if (buffer) {
    tokens.push(buffer.trim());
  }

  return tokens;
}

function splitArgs(value: string): string[] {
  const args: string[] = [];
  let buffer = "";
  let depth = 0;

  for (let i = 0; i < value.length; i++) {
    const char = value[i];
    if (char === "(") {
      depth += 1;
      buffer += char;
      continue;
    }
    if (char === ")") {
      depth = Math.max(0, depth - 1);
      buffer += char;
      continue;
    }
    if (char === "," && depth === 0) {
      args.push(buffer.trim());
      buffer = "";
      continue;
    }
    buffer += char;
  }

  if (buffer) {
    args.push(buffer.trim());
  }

  return args;
}

function parseFlex(value: string): number | undefined {
  const match = value.trim().match(/^(-?\d+(?:\.\d+)?)fr$/i);
  if (!match) {
    return undefined;
  }
  const parsed = Number.parseFloat(match[1]);
  return Number.isNaN(parsed) ? undefined : parsed;
}

function parseTrackSize(token: string): TrackSizeInput | undefined {
  const normalized = token.trim().toLowerCase();

  if (normalized.startsWith("minmax(") && normalized.endsWith(")")) {
    const inner = normalized.slice(7, -1);
    const [minArg, maxArg] = splitArgs(inner);
    if (!minArg || !maxArg) {
      return undefined;
    }
    const min = parseLength(minArg);
    if (min === undefined) {
      return undefined;
    }
    const flex = parseFlex(maxArg);
    if (flex !== undefined) {
      const track: FlexTrackSizeInput = { kind: "flex", flex, min };
      return track;
    }
    const maxLength = parseLength(maxArg);
    if (maxLength !== undefined) {
      if (typeof min === "number" && typeof maxLength === "number") {
        return {
          kind: "fixed",
          size: Math.max(min, maxLength),
        };
      }
      return {
        kind: "fixed",
        size: maxLength,
      };
    }
    if (maxArg.trim() === "auto") {
      return { kind: "auto", min };
    }
    return undefined;
  }

  const flex = parseFlex(normalized);
  if (flex !== undefined) {
    return { kind: "flex", flex };
  }

  if (normalized === "auto") {
    return { kind: "auto" };
  }

  const clampArgs = parseClampArgs(token);
  if (clampArgs) {
    const min = parseLength(clampArgs[0]);
    const preferred = parseLength(clampArgs[1]);
    const max = parseLength(clampArgs[2]);
    if (min !== undefined && preferred !== undefined && max !== undefined) {
      const track: ClampTrackSizeInput = {
        kind: "clamp",
        min,
        preferred,
        max,
      };
      return track;
    }
  }

  const length = parseLength(normalized);
  if (length !== undefined) {
    return { kind: "fixed", size: length };
  }

  return undefined;
}

export function parseGridTemplate(value: string): TrackDefinitionInput[] | undefined {
  if (!value) {
    return undefined;
  }
  const tokens = tokenizeTrackList(value.trim());
  if (tokens.length === 0) {
    return undefined;
  }

  const tracks: TrackDefinitionInput[] = [];
  for (const token of tokens) {
    const normalized = token.trim().toLowerCase();
    if (normalized.startsWith("repeat(") && normalized.endsWith(")")) {
      const inner = token.trim().slice(7, -1);
      const [countArg, trackArg] = splitArgs(inner);
      if (!countArg || !trackArg) {
        return undefined;
      }

      const track = parseTrackSize(trackArg);
      if (!track) {
        return undefined;
      }

      const normalizedCount = countArg.trim().toLowerCase();
      if (normalizedCount === "auto-fit" || normalizedCount === "auto-fill") {
        const repeat: AutoRepeatTrackDefinitionInput = {
          kind: "repeat-auto",
          mode: normalizedCount as "auto-fit" | "auto-fill",
          track,
        };
        tracks.push(repeat);
        continue;
      }

      const numericCount = Number.parseInt(normalizedCount, 10);
      if (!Number.isFinite(numericCount) || numericCount <= 0) {
        return undefined;
      }
      const repeat: RepeatTrackDefinitionInput = {
        kind: "repeat",
        count: numericCount,
        track,
      };
      tracks.push(repeat);
      continue;
    }

    const track = parseTrackSize(token);
    if (!track) {
      return undefined;
    }
    tracks.push(track);
  }
  return tracks;
}

function parseGapLengthValue(value: string): GapLengthInput | undefined {
  const parsed = parseLength(value);
  if (parsed !== undefined) {
    return parsed;
  }

  const clampArgs = parseClampArgs(value);
  if (!clampArgs) {
    return undefined;
  }

  const min = parseLength(clampArgs[0]);
  const preferred = parseLength(clampArgs[1]);
  const max = parseLength(clampArgs[2]);
  if (min === undefined || preferred === undefined || max === undefined) {
    return undefined;
  }
  return {
    kind: "clamp",
    min,
    preferred,
    max,
  };
}

export function parseGap(value: string): { row: GapLengthInput; column: GapLengthInput } | undefined {
  if (!value) {
    return undefined;
  }
  const tokens = tokenizeSpaceSeparated(value.trim());
  if (tokens.length === 0) {
    return undefined;
  }

  const first = parseGapLengthValue(tokens[0]);
  if (first === undefined) {
    return undefined;
  }
  const second = tokens.length > 1 ? parseGapLengthValue(tokens[1]) : undefined;
  return {
    row: first,
    column: second ?? first,
  };
}
