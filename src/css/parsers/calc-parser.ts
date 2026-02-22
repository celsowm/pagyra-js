import { cmToPx, inToPx, mmToPx, pcToPx, ptToPx, qToPx } from "../../units/units.js";
import { getViewportHeight, getViewportWidth } from "../viewport.js";
import type { CalcLength } from "../length.js";

type CalcToken =
  | { type: "number"; value: number }
  | { type: "dimension"; value: number; unit: string }
  | { type: "op"; value: "+" | "-" | "*" | "/" }
  | { type: "lparen" }
  | { type: "rparen" };

type CalcNumberValue = { kind: "number"; value: number };
type CalcLengthValue = { kind: "length"; value: CalcLength };
type CalcValue = CalcNumberValue | CalcLengthValue;

function createCalcLength(partial: Partial<CalcLength> = {}): CalcLength {
  return {
    kind: "calc",
    px: partial.px ?? 0,
    percent: partial.percent ?? 0,
    em: partial.em ?? 0,
    rem: partial.rem ?? 0,
    cqw: partial.cqw ?? 0,
    cqh: partial.cqh ?? 0,
    cqi: partial.cqi ?? 0,
    cqb: partial.cqb ?? 0,
    cqmin: partial.cqmin ?? 0,
    cqmax: partial.cqmax ?? 0,
  };
}

function addCalcLengths(left: CalcLength, right: CalcLength): CalcLength {
  return createCalcLength({
    px: left.px + right.px,
    percent: left.percent + right.percent,
    em: (left.em ?? 0) + (right.em ?? 0),
    rem: (left.rem ?? 0) + (right.rem ?? 0),
    cqw: (left.cqw ?? 0) + (right.cqw ?? 0),
    cqh: (left.cqh ?? 0) + (right.cqh ?? 0),
    cqi: (left.cqi ?? 0) + (right.cqi ?? 0),
    cqb: (left.cqb ?? 0) + (right.cqb ?? 0),
    cqmin: (left.cqmin ?? 0) + (right.cqmin ?? 0),
    cqmax: (left.cqmax ?? 0) + (right.cqmax ?? 0),
  });
}

function scaleCalcLength(value: CalcLength, scalar: number): CalcLength {
  return createCalcLength({
    px: value.px * scalar,
    percent: value.percent * scalar,
    em: (value.em ?? 0) * scalar,
    rem: (value.rem ?? 0) * scalar,
    cqw: (value.cqw ?? 0) * scalar,
    cqh: (value.cqh ?? 0) * scalar,
    cqi: (value.cqi ?? 0) * scalar,
    cqb: (value.cqb ?? 0) * scalar,
    cqmin: (value.cqmin ?? 0) * scalar,
    cqmax: (value.cqmax ?? 0) * scalar,
  });
}

class CalcParser {
  private index = 0;

  constructor(private readonly tokens: CalcToken[]) {}

  parse(): CalcValue | undefined {
    const value = this.parseExpression();
    if (!value) {
      return undefined;
    }
    if (this.index !== this.tokens.length) {
      return undefined;
    }
    return value;
  }

  private parseExpression(): CalcValue | undefined {
    let left = this.parseTerm();
    if (!left) {
      return undefined;
    }

    while (true) {
      const token = this.peek();
      if (!token || token.type !== "op" || (token.value !== "+" && token.value !== "-")) {
        break;
      }
      this.index += 1;
      const right = this.parseTerm();
      if (!right) {
        return undefined;
      }
      left = token.value === "+" ? addValues(left, right) : subtractValues(left, right);
      if (!left) {
        return undefined;
      }
    }
    return left;
  }

  private parseTerm(): CalcValue | undefined {
    let left = this.parseFactor();
    if (!left) {
      return undefined;
    }

    while (true) {
      const token = this.peek();
      if (!token || token.type !== "op" || (token.value !== "*" && token.value !== "/")) {
        break;
      }
      this.index += 1;
      const right = this.parseFactor();
      if (!right) {
        return undefined;
      }
      left = token.value === "*" ? multiplyValues(left, right) : divideValues(left, right);
      if (!left) {
        return undefined;
      }
    }
    return left;
  }

  private parseFactor(): CalcValue | undefined {
    const token = this.peek();
    if (!token) {
      return undefined;
    }

    if (token.type === "op" && (token.value === "+" || token.value === "-")) {
      this.index += 1;
      const factor = this.parseFactor();
      if (!factor) {
        return undefined;
      }
      if (token.value === "+") {
        return factor;
      }
      return multiplyValues({ kind: "number", value: -1 }, factor);
    }

    if (token.type === "lparen") {
      this.index += 1;
      const expression = this.parseExpression();
      if (!expression) {
        return undefined;
      }
      const closing = this.peek();
      if (!closing || closing.type !== "rparen") {
        return undefined;
      }
      this.index += 1;
      return expression;
    }

    this.index += 1;
    if (token.type === "number") {
      return { kind: "number", value: token.value };
    }
    if (token.type === "dimension") {
      return dimensionToValue(token.value, token.unit);
    }
    return undefined;
  }

  private peek(): CalcToken | undefined {
    return this.tokens[this.index];
  }
}

function addValues(left: CalcValue, right: CalcValue): CalcValue | undefined {
  if (left.kind === "number" && right.kind === "number") {
    return { kind: "number", value: left.value + right.value };
  }
  if (left.kind === "length" && right.kind === "length") {
    return {
      kind: "length",
      value: addCalcLengths(left.value, right.value),
    };
  }
  return undefined;
}

function subtractValues(left: CalcValue, right: CalcValue): CalcValue | undefined {
  const negated = multiplyValues({ kind: "number", value: -1 }, right);
  if (!negated) {
    return undefined;
  }
  return addValues(left, negated);
}

function multiplyValues(left: CalcValue, right: CalcValue): CalcValue | undefined {
  if (left.kind === "number" && right.kind === "number") {
    return { kind: "number", value: left.value * right.value };
  }
  if (left.kind === "number" && right.kind === "length") {
    return {
      kind: "length",
      value: scaleCalcLength(right.value, left.value),
    };
  }
  if (left.kind === "length" && right.kind === "number") {
    return multiplyValues(right, left);
  }
  return undefined;
}

function divideValues(left: CalcValue, right: CalcValue): CalcValue | undefined {
  if (right.kind !== "number") {
    return undefined;
  }
  if (right.value === 0) {
    return undefined;
  }
  return multiplyValues(left, { kind: "number", value: 1 / right.value });
}

function dimensionToValue(value: number, unit: string): CalcLengthValue | undefined {
  const normalizedUnit = unit.toLowerCase();
  switch (normalizedUnit) {
    case "px":
      return { kind: "length", value: createCalcLength({ px: value }) };
    case "pt":
      return { kind: "length", value: createCalcLength({ px: ptToPx(value) }) };
    case "cm":
      return { kind: "length", value: createCalcLength({ px: cmToPx(value) }) };
    case "mm":
      return { kind: "length", value: createCalcLength({ px: mmToPx(value) }) };
    case "q":
      return { kind: "length", value: createCalcLength({ px: qToPx(value) }) };
    case "in":
      return { kind: "length", value: createCalcLength({ px: inToPx(value) }) };
    case "pc":
      return { kind: "length", value: createCalcLength({ px: pcToPx(value) }) };
    case "vw":
      return {
        kind: "length",
        value: createCalcLength({ px: (value / 100) * getViewportWidth() }),
      };
    case "vh":
      return {
        kind: "length",
        value: createCalcLength({ px: (value / 100) * getViewportHeight() }),
      };
    case "%":
      return { kind: "length", value: createCalcLength({ percent: value / 100 }) };
    case "em":
      return { kind: "length", value: createCalcLength({ em: value }) };
    case "rem":
      return { kind: "length", value: createCalcLength({ rem: value }) };
    case "cqw":
      return { kind: "length", value: createCalcLength({ cqw: value / 100 }) };
    case "cqh":
      return { kind: "length", value: createCalcLength({ cqh: value / 100 }) };
    case "cqi":
      return { kind: "length", value: createCalcLength({ cqi: value / 100 }) };
    case "cqb":
      return { kind: "length", value: createCalcLength({ cqb: value / 100 }) };
    case "cqmin":
      return { kind: "length", value: createCalcLength({ cqmin: value / 100 }) };
    case "cqmax":
      return { kind: "length", value: createCalcLength({ cqmax: value / 100 }) };
    default:
      return undefined;
  }
}

function tokenizeCalcExpression(input: string): CalcToken[] | undefined {
  const tokens: CalcToken[] = [];
  let i = 0;

  while (i < input.length) {
    const char = input[i];
    if (/\s/.test(char)) {
      i += 1;
      continue;
    }
    if (char === "+" || char === "-" || char === "*" || char === "/") {
      tokens.push({ type: "op", value: char });
      i += 1;
      continue;
    }
    if (char === "(") {
      tokens.push({ type: "lparen" });
      i += 1;
      continue;
    }
    if (char === ")") {
      tokens.push({ type: "rparen" });
      i += 1;
      continue;
    }

    const numberMatch = input.slice(i).match(/^\d*\.?\d+/);
    if (!numberMatch) {
      return undefined;
    }
    const numberValue = Number.parseFloat(numberMatch[0]);
    if (Number.isNaN(numberValue)) {
      return undefined;
    }
    i += numberMatch[0].length;

    const unitMatch = input.slice(i).match(/^(%|[a-zA-Z]+)/);
    if (unitMatch) {
      tokens.push({
        type: "dimension",
        value: numberValue,
        unit: unitMatch[0],
      });
      i += unitMatch[0].length;
      continue;
    }

    tokens.push({ type: "number", value: numberValue });
  }

  return tokens;
}

export function parseCalcLength(value: string): CalcLength | undefined {
  if (!value) {
    return undefined;
  }
  const trimmed = value.trim();
  if (!trimmed.toLowerCase().startsWith("calc(") || !trimmed.endsWith(")")) {
    return undefined;
  }
  const expression = trimmed.slice(5, -1).trim();
  if (!expression) {
    return undefined;
  }
  const tokens = tokenizeCalcExpression(expression);
  if (!tokens || tokens.length === 0) {
    return undefined;
  }
  const parsed = new CalcParser(tokens).parse();
  if (!parsed) {
    return undefined;
  }
  if (parsed.kind === "number") {
    return createCalcLength({ px: parsed.value });
  }
  return parsed.value;
}
