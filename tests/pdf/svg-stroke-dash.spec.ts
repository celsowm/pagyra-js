import { parseElement } from "../../src/svg/parser.js";
import { renderPath } from "../../src/pdf/svg/shape-renderer.js";
import { createDefaultStyle, deriveStyle } from "../../src/pdf/svg/style-computer.js";
import { ShapeRenderer } from "../../src/pdf/renderers/shape-renderer.js";
import { CoordinateTransformer } from "../../src/pdf/utils/coordinate-transformer.js";
import { GraphicsStateManager } from "../../src/pdf/renderers/graphics-state-manager.js";
import { parseHTML } from "linkedom";
import type { SvgRenderContext } from "../../src/pdf/svg/render-svg.js";
import type { SvgPathNode } from "../../src/svg/types.js";

describe("SVG Stroke Dash Support", () => {
  it("should render path with stroke-dasharray", async () => {
    const { document } = parseHTML(`
      <svg>
        <path d="M10 10 L90 10" stroke="black" stroke-width="2" stroke-dasharray="5,5" />
      </svg>
    `);
    const pathElement = document.querySelector("path");
    const context = { warn: () => { } };
    const svgNode = parseElement(pathElement!, context) as SvgPathNode;
    expect(svgNode).not.toBeNull();
    expect(svgNode.type).toBe("path");

    const transformer = new CoordinateTransformer(100, (x) => x * 0.75);
    const graphicsStateManager = new GraphicsStateManager();
    const shapeRenderer = new ShapeRenderer(transformer, graphicsStateManager);

    const renderContext: SvgRenderContext = {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      painter: shapeRenderer as any,
      viewportMatrix: { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 },
      transform: { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 },
      strokeScale: 1,
    };

    const style = deriveStyle(createDefaultStyle(), svgNode);
    renderPath(svgNode, style, renderContext);

    const result = shapeRenderer.getResult();
    const commands = result.commands.join("\n");

    // Check for dash pattern command
    // [5 5] 0 d -> [3.75 3.75] 0 d
    expect(commands).toContain("[3.75 3.75] 0 d");
  });

  it("should render path with stroke-dasharray and stroke-dashoffset", async () => {
    const { document } = parseHTML(`
      <svg>
        <path d="M10 30 L90 30" stroke="black" stroke-width="2" stroke-dasharray="10 5" stroke-dashoffset="5" />
      </svg>
    `);
    const pathElement = document.querySelector("path");
    const context = { warn: () => { } };
    const svgNode = parseElement(pathElement!, context) as SvgPathNode;
    expect(svgNode).not.toBeNull();

    const transformer = new CoordinateTransformer(100, (x) => x * 0.75);
    const graphicsStateManager = new GraphicsStateManager();
    const shapeRenderer = new ShapeRenderer(transformer, graphicsStateManager);

    const renderContext: SvgRenderContext = {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      painter: shapeRenderer as any,
      viewportMatrix: { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 },
      transform: { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 },
      strokeScale: 1,
    };

    const style = deriveStyle(createDefaultStyle(), svgNode);
    renderPath(svgNode, style, renderContext);

    const result = shapeRenderer.getResult();
    const commands = result.commands.join("\n");

    // Check for dash pattern command with offset
    // [10 5] 5 d -> [7.5 3.75] 3.75 d
    expect(commands).toContain("[7.5 3.75] 3.75 d");
  });
});
