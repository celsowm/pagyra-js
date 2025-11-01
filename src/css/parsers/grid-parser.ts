import type { TrackDefinition, TrackSize, RepeatTrackDefinition, AutoRepeatTrackDefinition, FlexTrackSize } from "../style.js";
import { parseLength } from "./length-parser.js";

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

function parseTrackSize(token: string): TrackSize | undefined {
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
      const track: FlexTrackSize = { kind: "flex", flex, min };
      return track;
    }
    const maxLength = parseLength(maxArg);
    if (maxLength !== undefined) {
      return {
        kind: "fixed",
        size: Math.max(min, maxLength),
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

  const length = parseLength(normalized);
  if (length !== undefined) {
    return { kind: "fixed", size: length };
  }

  return undefined;
}

export function parseGridTemplate(value: string): TrackDefinition[] | undefined {
  if (!value) {
    return undefined;
  }
  const tokens = tokenizeTrackList(value.trim());
  if (tokens.length === 0) {
    return undefined;
  }

  const tracks: TrackDefinition[] = [];
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
        const repeat: AutoRepeatTrackDefinition = {
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
      const repeat: RepeatTrackDefinition = {
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

export function parseGap(value: string): { row: number; column: number } | undefined {
  if (!value) {
    return undefined;
  }
  const tokens = value
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 0);
  if (tokens.length === 0) {
    return undefined;
  }

  const first = parseLength(tokens[0]);
  if (first === undefined) {
    return undefined;
  }
  const second = tokens.length > 1 ? parseLength(tokens[1]) : undefined;
  return {
    row: first,
    column: second ?? first,
  };
}
