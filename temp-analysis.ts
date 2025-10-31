import { readFileSync } from "node:fs";
import path from "node:path";
import { prepareHtmlRender } from "./dist/src/html-to-pdf.js";
import {
  DEFAULT_PAGE_WIDTH_PX,
  DEFAULT_PAGE_HEIGHT_PX,
  resolvePageMarginsPx,
  maxContentDimension,
} from "./dist/src/units/page-utils.js";
import type { LayoutNode } from "./dist/src/dom/node.js";

function findNodes(node: LayoutNode, tagName: string, acc: LayoutNode[] = []): LayoutNode[] {
  if ((node.tagName ?? '').toLowerCase() === tagName) {
    acc.push(node);
  }
  for (const child of node.children) {
    findNodes(child, tagName, acc);
  }
  return acc;
}

async function main() {
  const docPath = "playground/public/examples/svg-path-gallery.html";
  const html = readFileSync(docPath, "utf-8");
  const pageWidth = DEFAULT_PAGE_WIDTH_PX;
  const pageHeight = DEFAULT_PAGE_HEIGHT_PX;
  const margins = resolvePageMarginsPx(pageWidth, pageHeight);
  const maxContentWidth = maxContentDimension(pageWidth, margins.left + margins.right);
  const maxContentHeight = maxContentDimension(pageHeight, margins.top + margins.bottom);
  const viewportWidth = Math.min(800, maxContentWidth);
  const viewportHeight = Math.min(1000, maxContentHeight);

  const prepared = await prepareHtmlRender({
    html,
    css: "",
    viewportWidth,
    viewportHeight,
    pageWidth,
    pageHeight,
    margins,
    debugLevel: "ERROR",
    resourceBaseDir: path.resolve("playground/public/examples"),
    assetRootDir: path.resolve("playground/public"),
  });

  console.log("Root layout node tag:", prepared.layoutRoot.tagName, {
    x: prepared.layoutRoot.box.x,
    y: prepared.layoutRoot.box.y,
    contentWidth: prepared.layoutRoot.box.contentWidth,
    contentHeight: prepared.layoutRoot.box.contentHeight,
    borderBoxWidth: prepared.layoutRoot.box.borderBoxWidth,
    borderBoxHeight: prepared.layoutRoot.box.borderBoxHeight,
  });

  const bodies = findNodes(prepared.layoutRoot, "body");
  console.log("Bodies:");
  for (const body of bodies) {
    console.log({
      x: body.box.x,
      y: body.box.y,
      contentWidth: body.box.contentWidth,
      contentHeight: body.box.contentHeight,
      borderBoxWidth: body.box.borderBoxWidth,
      borderBoxHeight: body.box.borderBoxHeight,
    });
  }

  const sections = findNodes(prepared.layoutRoot, "section");
  console.log("Sections:");
  for (const section of sections) {
    console.log({
      x: section.box.x,
      y: section.box.y,
      contentWidth: section.box.contentWidth,
      contentHeight: section.box.contentHeight,
      borderBoxWidth: section.box.borderBoxWidth,
      borderBoxHeight: section.box.borderBoxHeight,
    });
  }

  const figures = findNodes(prepared.layoutRoot, "figure");
  console.log("Figures:");
  for (const figure of figures) {
    console.log({
      x: figure.box.x,
      y: figure.box.y,
      contentWidth: figure.box.contentWidth,
      contentHeight: figure.box.contentHeight,
      borderBoxWidth: figure.box.borderBoxWidth,
      borderBoxHeight: figure.box.borderBoxHeight,
    });
  }

  const svgs = findNodes(prepared.layoutRoot, "svg");
  console.log("SVGs:");
  for (const svg of svgs) {
    console.log({
      x: svg.box.x,
      y: svg.box.y,
      contentWidth: svg.box.contentWidth,
      contentHeight: svg.box.contentHeight,
      borderBoxWidth: svg.box.borderBoxWidth,
      borderBoxHeight: svg.box.borderBoxHeight,
    });
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
