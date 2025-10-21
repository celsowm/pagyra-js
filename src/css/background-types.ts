export type BackgroundLayer =
  | { kind: "color"; color: string }                          // ex: #fff, rgba(...)
  | { kind: "image"; url: string; repeat?: BackgroundRepeat; position?: BackgroundPosition; size?: BackgroundSize; origin?: BackgroundOrigin; clip?: BackgroundClip; attachment?: "scroll"|"fixed"|"local" }
  | { kind: "gradient"; gradient: Gradient }                  // linear/radial/conic

export type BackgroundRepeat = "repeat"|"repeat-x"|"repeat-y"|"no-repeat"|"space"|"round";
export type BackgroundOrigin = "padding-box"|"border-box"|"content-box";
export type BackgroundClip   = "border-box"|"padding-box"|"content-box"|"text";

export type BackgroundPosition = { x: string; y: string };    // "left"/"center"/"right"/<length|%>
export type BackgroundSize = "auto" | "cover" | "contain" | { width: string; height: string };

export type Gradient =
  | LinearGradient
  | RadialGradient
  | ConicGradient;

export interface LinearGradient {
  type: "linear";
  angleOrTo?: string;                 // "to right", "45deg"…
  stops: { color: string; pos?: number }[];
}

export interface RadialGradient {
  type: "radial";
  shape?: "circle"|"ellipse";
  sizeHint?: "closest-side"|"farthest-side"|"closest-corner"|"farthest-corner";
  at?: { x: string; y: string };
  stops: { color: string; pos?: number }[];
}

export interface ConicGradient {
  type: "conic";
  from?: string;                      // "0deg", "90deg"
  at?: { x: string; y: string };
  stops: { color: string; pos?: number }[];
}
