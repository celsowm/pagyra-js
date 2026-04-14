export type ClipPathReferenceBox = "border-box" | "padding-box" | "content-box";

export type ClipPathLength =
  | { unit: "px"; value: number }
  | { unit: "percent"; value: number };

export interface ClipPathPolygon {
  type: "polygon";
  points: Array<{ x: ClipPathLength; y: ClipPathLength }>;
  referenceBox?: ClipPathReferenceBox;
}

export interface ClipPathEllipse {
  type: "ellipse";
  rx: ClipPathLength;
  ry: ClipPathLength;
  cx: ClipPathLength;
  cy: ClipPathLength;
  referenceBox?: ClipPathReferenceBox;
}

export type ClipPath = ClipPathPolygon | ClipPathEllipse;
