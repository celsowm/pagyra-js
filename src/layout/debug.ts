import type { LayoutContext } from "./pipeline/strategy.js";

let LAYOUT_DEBUG: boolean | undefined;

const initialize = (context: LayoutContext) => {
  if (LAYOUT_DEBUG === undefined) {
    LAYOUT_DEBUG = context.env.getEnv("PAGYRA_DEBUG_LAYOUT") === "1";
  }
};

export const createLayoutDebug = (context: LayoutContext) => {
  initialize(context);
  return (...args: unknown[]): void => {
    if (LAYOUT_DEBUG) {
      console.log(...args);
    }
  };
};
