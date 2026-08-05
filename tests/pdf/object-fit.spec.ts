import type { LayoutNode } from "../../src/dom/node.js";
import { parseObjectPositionValue } from "../../src/css/parsers/object-position-parser.js";
import { prepareHtmlRender } from "../../src/html-to-pdf/prepare-html-render.js";
import {
  ObjectFit,
  type ImageRef,
  type RenderBox,
} from "../../src/pdf/types.js";
import {
  objectFitNeedsClip,
  resolveObjectFitRect,
} from "../../src/pdf/utils/object-fit.js";

const image = {
  src: "fixture.png",
  width: 200,
  height: 100,
  format: "png",
  channels: 4,
  bitsPerComponent: 8,
  data: new ArrayBuffer(0),
} satisfies ImageRef;

const contentBox = { x: 10, y: 20, width: 100, height: 100 };

function findLayoutNodeById(root: LayoutNode, id: string): LayoutNode {
  let found: LayoutNode | undefined;
  root.walk((node) => {
    if (node.customData?.id === id) {
      found = node;
    }
  });
  if (!found) {
    throw new Error(`Missing layout node ${id}`);
  }
  return found;
}

function findRenderBoxById(root: RenderBox, id: string): RenderBox {
  if (root.customData?.id === id) {
    return root;
  }
  for (const child of root.children) {
    try {
      return findRenderBoxById(child, id);
    } catch {
      // Continue through siblings.
    }
  }
  throw new Error(`Missing render box ${id}`);
}

describe("object-position parsing", () => {
  it("parses keywords in horizontal and reversed orders", () => {
    expect(parseObjectPositionValue("right bottom")).toEqual({ x: 1, y: 1 });
    expect(parseObjectPositionValue("top left")).toEqual({ x: 0, y: 0 });
    expect(parseObjectPositionValue("center top")).toEqual({ x: 0.5, y: 0 });
  });

  it("parses one and two percentage values", () => {
    expect(parseObjectPositionValue("25%")).toEqual({ x: 0.25, y: 0.5 });
    expect(parseObjectPositionValue("25% 75%")).toEqual({ x: 0.25, y: 0.75 });
  });

  it("rejects unsupported or ambiguous values", () => {
    expect(parseObjectPositionValue("10px 20px")).toBeUndefined();
    expect(parseObjectPositionValue("left right")).toBeUndefined();
    expect(parseObjectPositionValue("top bottom")).toBeUndefined();
  });
});

describe("object-fit geometry", () => {
  it("contains an image and positions remaining space", () => {
    expect(resolveObjectFitRect(image, contentBox, ObjectFit.Contain)).toEqual({
      x: 10,
      y: 45,
      width: 100,
      height: 50,
    });
    expect(resolveObjectFitRect(image, contentBox, ObjectFit.Contain, { x: 1, y: 1 })).toEqual({
      x: 10,
      y: 70,
      width: 100,
      height: 50,
    });
  });

  it("covers the content box and clips overflow according to position", () => {
    const rect = resolveObjectFitRect(image, contentBox, ObjectFit.Cover, { x: 0.25, y: 0.75 });
    expect(rect).toEqual({ x: -15, y: 20, width: 200, height: 100 });
    expect(objectFitNeedsClip(rect, contentBox)).toBe(true);
  });

  it("preserves intrinsic dimensions for none and only shrinks scale-down", () => {
    expect(resolveObjectFitRect(image, contentBox, ObjectFit.None, { x: 1, y: 1 })).toEqual({
      x: -90,
      y: 20,
      width: 200,
      height: 100,
    });

    const smallImage = { ...image, width: 50, height: 25 };
    expect(resolveObjectFitRect(smallImage, contentBox, ObjectFit.ScaleDown)).toEqual({
      x: 35,
      y: 57.5,
      width: 50,
      height: 25,
    });
  });

  it("keeps fill as the default stretching behavior", () => {
    expect(resolveObjectFitRect(image, contentBox)).toEqual(contentBox);
    expect(objectFitNeedsClip(contentBox, contentBox)).toBe(false);
  });

  it("carries CSS fit and position through layout and render trees", async () => {
    const prepared = await prepareHtmlRender({
      html: `<img id="image" width="120" height="80">`,
      css: `#image { object-fit: cover; object-position: right bottom; }`,
      pagedBodyMargin: "zero",
    });

    const layoutNode = findLayoutNodeById(prepared.layoutRoot, "image");
    const renderBox = findRenderBoxById(prepared.renderTree.root, "image");

    expect(layoutNode.style.objectFit).toBe("cover");
    expect(layoutNode.style.objectPosition).toEqual({ x: 1, y: 1 });
    expect(renderBox.objectFit).toBe(ObjectFit.Cover);
    expect(renderBox.objectPosition).toEqual({ x: 1, y: 1 });
  });
});
