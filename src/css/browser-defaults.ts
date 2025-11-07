/**
 * Browser-like User Agent (UA) defaults for PDF conversion.
 * SRP: this file now acts as a façade, re-exporting focused UA defaults modules.
 */

export type { ElementDefaults } from "./ua-defaults/types.js";
export {
  TypographyDefaults,
  BoxModelDefaults,
  LayoutDefaults,
  TextLayoutDefaults,
  createBaseDefaultsObject,
} from "./ua-defaults/base-defaults.js";
export { ElementSpecificDefaults } from "./ua-defaults/element-defaults.js";
export { BrowserDefaults } from "./ua-defaults/browser-defaults.js";
