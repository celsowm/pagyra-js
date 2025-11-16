import { readFile } from "node:fs/promises";
import { parseTtfBuffer } from "../src/pdf/font/ttf-lite.js";

const data = await readFile("assets/fonts/Roboto-Regular.ttf");
const metrics = parseTtfBuffer(data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength));
console.log("glyphId", metrics.cmap.getGlyphId(0x25AA));
