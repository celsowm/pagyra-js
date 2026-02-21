import { FloatMode } from "../enums.js";

export function mapFloatToMode(value: string | undefined): FloatMode | undefined {
  switch (value) {
    case "left":
      return FloatMode.Left;
    case "right":
      return FloatMode.Right;
    case "none":
      return FloatMode.None;
    default:
      return undefined;
  }
}
