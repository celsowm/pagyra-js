import type { ParsedFont } from "../types.js";
import { decompressWoff2, type AsyncDecompressFn } from "../../compression/decompress.js";
import { Buf, readBase128, read255UShort } from "./buffer.js";

export interface Woff2Dependencies {
  decompress?: AsyncDecompressFn;
  transformers?: Map<number, Woff2Transform>;
}

interface ResolvedWoff2Dependencies {
  decompress: AsyncDecompressFn;
  transformers: Map<number, Woff2Transform>;
}

// --- Constants & helpers ----------------------------------------------------

const WOFF2_SIGNATURE = 0x774f4632; // "wOF2"
const WOFF2_HEADER_SIZE = 48;
const WOFF2_FLAG_TRANSFORM = 1 << 8;
const SFNT_HEADER_SIZE = 12;
const SFNT_ENTRY_SIZE = 16;
const CHECKSUM_ADJUSTMENT_OFFSET = 8;
const MAX_PLAUSIBLE_COMPRESSION_RATIO = 100;

const TAG = (text: string) =>
  (text.charCodeAt(0) << 24) |
  (text.charCodeAt(1) << 16) |
  (text.charCodeAt(2) << 8) |
  text.charCodeAt(3);

const TAG_GLYF = TAG("glyf");
const TAG_LOCA = TAG("loca");
const TAG_HMTX = TAG("hmtx");
const TAG_HHEA = TAG("hhea");
const TAG_HEAD = TAG("head");

// Known tag lookup as defined in table_tags.cc
const KNOWN_TAGS: number[] = [
  TAG("cmap"),
  TAG("head"),
  TAG("hhea"),
  TAG("hmtx"),
  TAG("maxp"),
  TAG("name"),
  TAG("OS/2"),
  TAG("post"),
  TAG("cvt "),
  TAG("fpgm"),
  TAG_GLYF,
  TAG_LOCA,
  TAG("prep"),
  TAG("CFF "),
  TAG("VORG"),
  TAG("EBDT"),
  TAG("EBLC"),
  TAG("gasp"),
  TAG("hdmx"),
  TAG("kern"),
  TAG("LTSH"),
  TAG("PCLT"),
  TAG("VDMX"),
  TAG("vhea"),
  TAG("vmtx"),
  TAG("BASE"),
  TAG("GDEF"),
  TAG("GPOS"),
  TAG("GSUB"),
  TAG("EBSC"),
  TAG("JSTF"),
  TAG("MATH"),
  TAG("CBDT"),
  TAG("CBLC"),
  TAG("COLR"),
  TAG("CPAL"),
  TAG("SVG "),
  TAG("sbix"),
  TAG("acnt"),
  TAG("avar"),
  TAG("bdat"),
  TAG("bloc"),
  TAG("bsln"),
  TAG("cvar"),
  TAG("fdsc"),
  TAG("feat"),
  TAG("fmtx"),
  TAG("fvar"),
  TAG("gvar"),
  TAG("hsty"),
  TAG("just"),
  TAG("lcar"),
  TAG("mort"),
  TAG("morx"),
  TAG("opbd"),
  TAG("prop"),
  TAG("trak"),
  TAG("Zapf"),
  TAG("Silf"),
  TAG("Glat"),
  TAG("Gloc"),
  TAG("Feat"),
  TAG("Sill")
];

function tagToString(tag: number): string {
  return String.fromCharCode(
    (tag >> 24) & 0xff,
    (tag >> 16) & 0xff,
    (tag >> 8) & 0xff,
    tag & 0xff
  );
}

const round4 = (v: number) => (v + 3) & ~3;

function resolveDependencies(deps?: Partial<Woff2Dependencies>): ResolvedWoff2Dependencies {
  return {
    decompress: deps?.decompress ?? decompressWoff2,
    transformers: deps?.transformers ?? createDefaultTransformers(),
  };
}

function computeULongSum(data: Uint8Array): number {
  let checksum = 0 >>> 0;
  const aligned = data.length & ~3;
  for (let i = 0; i < aligned; i += 4) {
    const value =
      (data[i] << 24) |
      (data[i + 1] << 16) |
      (data[i + 2] << 8) |
      data[i + 3];
    checksum = (checksum + value) >>> 0;
  }

  if (aligned !== data.length) {
    let v = 0;
    for (let i = aligned; i < data.length; i++) {
      v |= data[i] << (24 - 8 * (i & 3));
    }
    checksum = (checksum + v) >>> 0;
  }
  return checksum >>> 0;
}

// --- Data writers -----------------------------------------------------------

function store16(value: number, out: Uint8Array, offset: number): number {
  const v = value & 0xffff;
  out[offset] = (v >> 8) & 0xff;
  out[offset + 1] = v & 0xff;
  return offset + 2;
}

function store32(value: number, out: Uint8Array, offset: number): number {
  out[offset] = (value >>> 24) & 0xff;
  out[offset + 1] = (value >>> 16) & 0xff;
  out[offset + 2] = (value >>> 8) & 0xff;
  out[offset + 3] = value & 0xff;
  return offset + 4;
}

// --- Types used internally --------------------------------------------------

interface Woff2Table {
  tag: number;
  flags: number;
  srcOffset: number;
  srcLength: number;
  transformLength: number;
  dstLength: number;
}

interface Woff2Header {
  flavor: number;
  numTables: number;
  compressedOffset: number;
  compressedLength: number;
  uncompressedSize: number;
  tables: Woff2Table[];
}

interface GlyfReconstruction {
  glyfData: Uint8Array;
  locaData: Uint8Array;
  glyfChecksum: number;
  locaChecksum: number;
  numGlyphs: number;
  indexFormat: number;
  xMins: Int16Array;
}

interface TransformState {
  glyfInfo: GlyfReconstruction | null;
  numHMetrics: number;
}

interface TransformContext {
  header: Woff2Header;
  tableMap: Map<number, Uint8Array>;
  tablesByTag: Map<number, Woff2Table>;
  state: TransformState;
}

type Woff2Transform = (table: Woff2Table, srcData: Uint8Array, context: TransformContext) => void;

// --- Table directory parsing ------------------------------------------------

function readTableDirectory(buf: Buf, numTables: number): Woff2Table[] {
  const tables: Woff2Table[] = [];
  let srcOffset = 0;

  for (let i = 0; i < numTables; i++) {
    const flagByte = buf.readU8();
    let tag: number;
    if ((flagByte & 0x3f) === 0x3f) {
      tag = buf.readU32();
    } else {
      tag = KNOWN_TAGS[flagByte & 0x3f] ?? 0;
    }
    const xformVersion = (flagByte >> 6) & 0x03;
    let flags = 0;
    if (tag === TAG_GLYF || tag === TAG_LOCA) {
      if (xformVersion === 0) {
        flags |= WOFF2_FLAG_TRANSFORM;
      }
    } else if (xformVersion !== 0) {
      flags |= WOFF2_FLAG_TRANSFORM;
    }
    flags |= xformVersion;

    const dstLength = readBase128(buf);
    let transformLength = dstLength;
    if (flags & WOFF2_FLAG_TRANSFORM) {
      transformLength = readBase128(buf);
      if (tag === TAG_LOCA && transformLength !== 0) {
        throw new Error("Invalid WOFF2: transformed loca must have zero length");
      }
    }

    tables.push({
      tag,
      flags,
      srcOffset,
      srcLength: transformLength,
      transformLength,
      dstLength
    });

    srcOffset += transformLength;
  }

  return tables;
}

function parseHeader(fontData: Uint8Array): Woff2Header {
  if (fontData.byteLength < WOFF2_HEADER_SIZE) {
    throw new Error("Invalid WOFF2: file too short");
  }

  const buf = new Buf(fontData);

  const signature = buf.readU32();
  if (signature !== WOFF2_SIGNATURE) {
    throw new Error("Invalid WOFF2 signature");
  }

  const flavor = buf.readU32() >>> 0;
  const reportedLength = buf.readU32();
  if (reportedLength !== fontData.byteLength) {
    throw new Error("Invalid WOFF2: length mismatch");
  }

  const numTables = buf.readU16();
  if (numTables === 0) {
    throw new Error("Invalid WOFF2: no tables");
  }

  buf.skip(2 + 4); // reserved + totalSfntSize (unused)
  const compressedLength = buf.readU32();
  buf.skip(4); // major/minorVersion

  // metadata and private blocks (validate bounds if present)
  const metaOffset = buf.readU32();
  const metaLength = buf.readU32();
  const metaOrigLen = buf.readU32();
  if (metaOffset !== 0) {
    if (metaOffset + metaLength > fontData.byteLength || metaOrigLen === 0) {
      throw new Error("Invalid WOFF2 metadata block");
    }
  }

  const privOffset = buf.readU32();
  const privLength = buf.readU32();
  if (privOffset !== 0 && privOffset + privLength > fontData.byteLength) {
    throw new Error("Invalid WOFF2 private block");
  }

  const tables = readTableDirectory(buf, numTables);

  const lastTable = tables[tables.length - 1];
  const uncompressedSize = lastTable.srcOffset + lastTable.srcLength;

  const compressedOffset = buf.offset;
  if (compressedOffset + compressedLength > fontData.byteLength) {
    throw new Error("Invalid WOFF2: compressed stream truncated");
  }

  // Basic ratio sanity check (similar to upstream impl)
  const compressionRatio = uncompressedSize / Math.max(1, fontData.byteLength);
  if (compressionRatio > MAX_PLAUSIBLE_COMPRESSION_RATIO) {
    throw new Error("Invalid WOFF2: implausible compression ratio");
  }

  return {
    flavor,
    numTables,
    compressedOffset,
    compressedLength,
    uncompressedSize,
    tables
  };
}

// --- Glyf reconstruction helpers -------------------------------------------

const GLYF_FLAGS = {
  ON_CURVE: 1 << 0,
  X_SHORT: 1 << 1,
  Y_SHORT: 1 << 2,
  REPEAT: 1 << 3,
  X_SAME: 1 << 4,
  Y_SAME: 1 << 5,
  OVERLAP_SIMPLE: 1 << 6
};

const COMPOSITE_FLAGS = {
  ARG_WORDS: 1 << 0,
  WE_HAVE_A_SCALE: 1 << 3,
  MORE_COMPONENTS: 1 << 5,
  WE_HAVE_AN_XY_SCALE: 1 << 6,
  WE_HAVE_A_TWO_BY_TWO: 1 << 7,
  WE_HAVE_INSTRUCTIONS: 1 << 8
};

function withSign(flag: number, base: number): number {
  return (flag & 1) ? base : -base;
}

function tripletDecode(
  flagsIn: Uint8Array,
  data: Uint8Array,
  nPoints: number
): { points: { x: number; y: number; onCurve: boolean }[]; consumed: number } {
  let x = 0;
  let y = 0;
  let tripletIndex = 0;
  const points: { x: number; y: number; onCurve: boolean }[] = new Array(
    nPoints
  );

  for (let i = 0; i < nPoints; i++) {
    let flag = flagsIn[i];
    const onCurve = (flag >> 7) === 0;
    flag &= 0x7f;
    let nDataBytes = 1;
    if (flag >= 84 && flag < 120) nDataBytes = 2;
    else if (flag < 84) nDataBytes = 1;
    else if (flag < 124) nDataBytes = 3;
    else nDataBytes = 4;

    if (tripletIndex + nDataBytes > data.length) {
      throw new Error("Invalid WOFF2 glyf triplet");
    }
    let dx: number;
    let dy: number;
    if (flag < 10) {
      dx = 0;
      dy = withSign(flag, ((flag & 14) << 7) + data[tripletIndex]);
    } else if (flag < 20) {
      dx = withSign(flag, (((flag - 10) & 14) << 7) + data[tripletIndex]);
      dy = 0;
    } else if (flag < 84) {
      const b0 = flag - 20;
      const b1 = data[tripletIndex];
      dx = withSign(flag, 1 + (b0 & 0x30) + (b1 >> 4));
      dy = withSign(flag >> 1, 1 + ((b0 & 0x0c) << 2) + (b1 & 0x0f));
    } else if (flag < 120) {
      const b0 = flag - 84;
      dx = withSign(flag, 1 + ((b0 / 12) << 8) + data[tripletIndex]);
      dy = withSign(
        flag >> 1,
        1 + (((b0 % 12) >> 2) << 8) + data[tripletIndex + 1]
      );
    } else if (flag < 124) {
      const b2 = data[tripletIndex + 1];
      dx = withSign(flag, (data[tripletIndex] << 4) + (b2 >> 4));
      dy = withSign(flag >> 1, ((b2 & 0x0f) << 8) + data[tripletIndex + 2]);
    } else {
      dx = withSign(flag, (data[tripletIndex] << 8) + data[tripletIndex + 1]);
      dy = withSign(
        flag >> 1,
        (data[tripletIndex + 2] << 8) + data[tripletIndex + 3]
      );
    }
    tripletIndex += nDataBytes;
    x += dx;
    y += dy;
    points[i] = { x, y, onCurve };
  }

  return { points, consumed: tripletIndex };
}

function storePoints(
  points: { x: number; y: number; onCurve: boolean }[],
  nContours: number,
  instructionLength: number,
  hasOverlap: boolean
): Uint8Array {
  const nPoints = points.length;
  const xBytes: number[] = [];
  const yBytes: number[] = [];

  let lastX = 0;
  let lastY = 0;
  let lastFlag = -1;
  let repeatCount = 0;

  const flagOffset = 10 + 2 * nContours + 2 + instructionLength;

  const flagsOut: number[] = [];

  for (let i = 0; i < nPoints; i++) {
    const point = points[i];
    let flag = point.onCurve ? GLYF_FLAGS.ON_CURVE : 0;
    if (hasOverlap && i === 0) {
      flag |= GLYF_FLAGS.OVERLAP_SIMPLE;
    }
    const dx = point.x - lastX;
    const dy = point.y - lastY;

    if (dx === 0) flag |= GLYF_FLAGS.X_SAME;
    else if (dx > -256 && dx < 256) {
      flag |= GLYF_FLAGS.X_SHORT | (dx > 0 ? GLYF_FLAGS.X_SAME : 0);
      xBytes.push(Math.abs(dx));
    } else {
      xBytes.push((dx >> 8) & 0xff, dx & 0xff);
    }

    if (dy === 0) flag |= GLYF_FLAGS.Y_SAME;
    else if (dy > -256 && dy < 256) {
      flag |= GLYF_FLAGS.Y_SHORT | (dy > 0 ? GLYF_FLAGS.Y_SAME : 0);
      yBytes.push(Math.abs(dy));
    } else {
      yBytes.push((dy >> 8) & 0xff, dy & 0xff);
    }

    if (flag === lastFlag && repeatCount !== 255) {
      flagsOut[flagsOut.length - 1] |= GLYF_FLAGS.REPEAT;
      repeatCount++;
    } else {
      if (repeatCount !== 0) {
        flagsOut.push(repeatCount);
      }
      flagsOut.push(flag);
      repeatCount = 0;
      lastFlag = flag;
    }

    lastX = point.x;
    lastY = point.y;
  }

  if (repeatCount !== 0) {
    flagsOut.push(repeatCount);
  }

  const totalSize = flagOffset + flagsOut.length + xBytes.length + yBytes.length;
  const out = new Uint8Array(totalSize);
  let offset = flagOffset;
  for (const f of flagsOut) out[offset++] = f;
  for (const b of xBytes) out[offset++] = b;
  for (const b of yBytes) out[offset++] = b;
  return out;
}

function computeBBox(points: { x: number; y: number }[]): [number, number, number, number] {
  if (points.length === 0) {
    return [0, 0, 0, 0];
  }
  let xMin = points[0].x;
  let xMax = points[0].x;
  let yMin = points[0].y;
  let yMax = points[0].y;
  for (let i = 1; i < points.length; i++) {
    const p = points[i];
    if (p.x < xMin) xMin = p.x;
    if (p.x > xMax) xMax = p.x;
    if (p.y < yMin) yMin = p.y;
    if (p.y > yMax) yMax = p.y;
  }
  return [xMin, yMin, xMax, yMax];
}

function sizeOfComposite(stream: Buf): { size: number; haveInstructions: boolean } {
  const start = stream.offset;
  let flags = COMPOSITE_FLAGS.MORE_COMPONENTS;
  let haveInstructions = false;

  while (flags & COMPOSITE_FLAGS.MORE_COMPONENTS) {
    flags = stream.readU16();
    haveInstructions ||= (flags & COMPOSITE_FLAGS.WE_HAVE_INSTRUCTIONS) !== 0;
    let argSize = 2; // glyph index
    if (flags & COMPOSITE_FLAGS.ARG_WORDS) argSize += 4;
    else argSize += 2;

    if (flags & COMPOSITE_FLAGS.WE_HAVE_A_SCALE) argSize += 2;
    else if (flags & COMPOSITE_FLAGS.WE_HAVE_AN_XY_SCALE) argSize += 4;
    else if (flags & COMPOSITE_FLAGS.WE_HAVE_A_TWO_BY_TWO) argSize += 8;

    stream.skip(argSize);
  }

  return { size: stream.offset - start, haveInstructions };
}

function storeLoca(
  locaValues: number[],
  indexFormat: number
): { data: Uint8Array; checksum: number } {
  const offsetSize = indexFormat ? 4 : 2;
  const buffer = new Uint8Array(locaValues.length * offsetSize);
  let off = 0;
  for (const value of locaValues) {
    if (indexFormat) {
      off = store32(value, buffer, off);
    } else {
      off = store16(value >> 1, buffer, off);
    }
  }
  return { data: buffer, checksum: computeULongSum(buffer) };
}

function reconstructGlyfTable(
  transformed: Uint8Array,
  locaDstLength: number
): GlyfReconstruction {
  const stream = new Buf(transformed);
  /* const version = */ stream.readU16();
  const flags = stream.readU16();
  const hasOverlapBitmap = (flags & 1) !== 0;
  const numGlyphs = stream.readU16();
  const indexFormat = stream.readU16();

  const substreamSizes: number[] = [];
  for (let i = 0; i < 7; i++) {
    substreamSizes.push(stream.readU32());
  }

  let dataOffset = (2 + 7) * 4; // header (version/flags/numGlyphs/indexFormat + sizes)
  const substreams: Uint8Array[] = [];
  for (const sz of substreamSizes) {
    if (dataOffset + sz > transformed.length) {
      throw new Error("Invalid WOFF2 glyf stream");
    }
    substreams.push(transformed.subarray(dataOffset, dataOffset + sz));
    dataOffset += sz;
  }

  let overlapBitmap: Uint8Array | null = null;
  if (hasOverlapBitmap) {
    const len = (numGlyphs + 7) >> 3;
    if (dataOffset + len > transformed.length) {
      throw new Error("Invalid WOFF2 overlap bitmap");
    }
    overlapBitmap = transformed.subarray(dataOffset, dataOffset + len);
  }

  const nContourStream = new Buf(substreams[0]);
  const nPointsStream = new Buf(substreams[1]);
  const flagStream = new Buf(substreams[2]);
  const glyphStream = new Buf(substreams[3]);
  const compositeStream = new Buf(substreams[4]);
  const bboxStream = new Buf(substreams[5]);
  const instructionStream = new Buf(substreams[6]);

  const bboxBitmapLen = ((numGlyphs + 31) >> 5) << 2;
  const bboxBitmap = bboxStream.readBytes(bboxBitmapLen);

  const locaValues = new Array<number>(numGlyphs + 1).fill(0);
  const xMins = new Int16Array(numGlyphs);
  const glyfChunks: Uint8Array[] = [];
  let glyfChecksum = 0 >>> 0;
  let currentGlyfOffset = 0;

  for (let i = 0; i < numGlyphs; i++) {
    const nContours = nContourStream.readU16();
    const haveBbox = (bboxBitmap[i >> 3] & (0x80 >> (i & 7))) !== 0;
    let glyphBytes: Uint8Array | null = null;

    if (nContours === 0xffff) {
      // Composite
      const { size: compositeSize, haveInstructions } = sizeOfComposite(
        new Buf(compositeStream.peekRemaining())
      );
      let instructionSize = 0;
      if (haveInstructions) {
        instructionSize = read255UShort(glyphStream);
      }
      const total =
        12 + compositeSize + instructionSize; // nContours + bbox + composite + instructions
      const out = new Uint8Array(total);
      let off = 0;
      off = store16(nContours, out, off);
      if (!haveBbox) {
        throw new Error("Invalid WOFF2 glyf: composite without bbox");
      }
      const bboxData = bboxStream.readBytes(8);
      const xMinRaw = (bboxData[0] << 8) | bboxData[1];
      xMins[i] = xMinRaw & 0x8000 ? xMinRaw - 0x10000 : xMinRaw;
      out.set(bboxData, off);
      off += 8;
      out.set(compositeStream.readBytes(compositeSize), off);
      off += compositeSize;
      if (haveInstructions) {
        off = store16(instructionSize, out, off);
        out.set(instructionStream.readBytes(instructionSize), off);
      }
      glyphBytes = out;
    } else if (nContours > 0) {
      const nPoints: number[] = [];
      let totalPoints = 0;
      for (let c = 0; c < nContours; c++) {
        const pts = read255UShort(nPointsStream);
        totalPoints += pts;
        nPoints.push(pts);
      }
      const flagData = flagStream.readBytes(totalPoints);
      const tripletsView = glyphStream.peekRemaining();
      const { points, consumed } = tripletDecode(
        flagData,
        tripletsView,
        totalPoints
      );
      glyphStream.offset += consumed;
      const instructionSize = read255UShort(glyphStream);
      const bbox = haveBbox ? bboxStream.readBytes(8) : null;

      // const _baseSize = 12 + 2 * nContours + instructionSize;
      const ptsBuf = storePoints(
        points,
        nContours,
        instructionSize,
        !!(overlapBitmap && (overlapBitmap[i >> 3] & (0x80 >> (i & 7))))
      );
      const glyphBuf = new Uint8Array(ptsBuf.length);
      glyphBuf.set(ptsBuf);

      let off = 0;
      off = store16(nContours, glyphBuf, off);
      if (bbox) {
        glyphBuf.set(bbox, off);
        off += 8;
      } else {
        const [xMin, yMin, xMax, yMax] = computeBBox(points);
        off = store16(xMin, glyphBuf, off);
        off = store16(yMin, glyphBuf, off);
        off = store16(xMax, glyphBuf, off);
        off = store16(yMax, glyphBuf, off);
      }
      let endPoint = -1;
      for (const count of nPoints) {
        endPoint += count;
        off = store16(endPoint, glyphBuf, off);
      }
      off = store16(instructionSize, glyphBuf, off);
      const remaining = instructionStream.peekRemaining().length;
      const safeSize = Math.min(instructionSize, remaining);
      const instructions = instructionStream.readBytes(safeSize);
      glyphBuf.set(instructions, off);

      glyphBytes = glyphBuf;

      const xMinRaw = (glyphBuf[2] << 8) | glyphBuf[3];
      xMins[i] = xMinRaw & 0x8000 ? xMinRaw - 0x10000 : xMinRaw;
    } else {
      // Empty glyph
      if (haveBbox) {
        throw new Error("Invalid WOFF2 glyf: empty glyph with bbox");
      }
      glyphBytes = new Uint8Array(0);
    }

    locaValues[i] = currentGlyfOffset;
    glyfChunks.push(glyphBytes);
    currentGlyfOffset += round4(glyphBytes.length);
    glyfChecksum = (glyfChecksum + computeULongSum(glyphBytes)) >>> 0;
  }

  locaValues[numGlyphs] = currentGlyfOffset;

  if (locaDstLength !== (indexFormat ? 4 : 2) * (numGlyphs + 1)) {
    throw new Error("Invalid WOFF2 loca length");
  }

  // Build glyf table with per-glyph padding
  const glyfSize = locaValues[numGlyphs];
  const glyfData = new Uint8Array(glyfSize);
  let glyfOffset = 0;
  for (const chunk of glyfChunks) {
    glyfData.set(chunk, glyfOffset);
    glyfOffset += chunk.length;
    const padded = round4(glyfOffset) - glyfOffset;
    glyfOffset += padded;
  }

  const loca = storeLoca(locaValues, indexFormat);

  return {
    glyfData,
    locaData: loca.data,
    glyfChecksum,
    locaChecksum: loca.checksum,
    numGlyphs,
    indexFormat,
    xMins
  };
}

// --- HMTX reconstruction ----------------------------------------------------

function readNumHMetrics(hheaTable: Uint8Array): number {
  const buf = new Buf(hheaTable);
  buf.skip(34);
  return buf.readU16();
}

function reconstructTransformedHmtx(
  transformed: Uint8Array,
  numGlyphs: number,
  numHMetrics: number,
  xMins: Int16Array
): { data: Uint8Array; checksum: number } {
  const buf = new Buf(transformed);
  const flags = buf.readU8();
  const hasPropLSB = (flags & 1) === 0;
  const hasMonoLSB = (flags & 2) === 0;
  if ((flags & 0xfc) !== 0) {
    throw new Error("Invalid hmtx flags");
  }
  if (hasPropLSB && hasMonoLSB) {
    throw new Error("Invalid hmtx transform state");
  }
  if (numHMetrics < 1 || numHMetrics > numGlyphs) {
    throw new Error("Invalid hmtx metrics count");
  }

  const advanceWidths: number[] = [];
  const lsbs: number[] = [];

  for (let i = 0; i < numHMetrics; i++) {
    advanceWidths.push(buf.readU16());
  }

  for (let i = 0; i < numHMetrics; i++) {
    lsbs.push(hasPropLSB ? buf.readS16() : xMins[i]);
  }

  for (let i = numHMetrics; i < numGlyphs; i++) {
    lsbs.push(hasMonoLSB ? buf.readS16() : xMins[i]);
  }

  const out = new Uint8Array(2 * numGlyphs + 2 * numHMetrics);
  let off = 0;
  for (let i = 0; i < numGlyphs; i++) {
    if (i < numHMetrics) {
      off = store16(advanceWidths[i], out, off);
    }
    off = store16(lsbs[i], out, off);
  }

  return { data: out, checksum: computeULongSum(out) };
}

// --- Transform registry ----------------------------------------------------

function transformGlyfTable(
  _table: Woff2Table,
  srcData: Uint8Array,
  context: TransformContext,
): void {
  const locaTable = context.tablesByTag.get(TAG_LOCA);
  if (!locaTable) {
    throw new Error("Invalid WOFF2: missing loca for glyf");
  }
  const glyfInfo = reconstructGlyfTable(srcData, locaTable.dstLength);
  context.state.glyfInfo = glyfInfo;
  context.tableMap.set(TAG_GLYF, glyfInfo.glyfData);
  context.tableMap.set(TAG_LOCA, glyfInfo.locaData);
}

function transformLocaTable(
  _table: Woff2Table,
  _srcData: Uint8Array,
  context: TransformContext,
): void {
  if (!context.tableMap.has(TAG_LOCA)) {
    throw new Error("Invalid WOFF2: loca transformed without glyf");
  }
}

function transformHmtxTable(
  _table: Woff2Table,
  srcData: Uint8Array,
  context: TransformContext,
): void {
  const glyfInfo = context.state.glyfInfo;
  if (!glyfInfo) {
    throw new Error("Invalid WOFF2: hmtx transform before glyf");
  }
  const hmtx = reconstructTransformedHmtx(
    srcData,
    glyfInfo.numGlyphs,
    context.state.numHMetrics,
    glyfInfo.xMins
  );
  context.tableMap.set(TAG_HMTX, hmtx.data);
}

function createDefaultTransformers(): Map<number, Woff2Transform> {
  return new Map<number, Woff2Transform>([
    [TAG_GLYF, transformGlyfTable],
    [TAG_LOCA, transformLocaTable],
    [TAG_HMTX, transformHmtxTable],
  ]);
}

// --- Font rebuild -----------------------------------------------------------

function buildSfnt(
  flavor: number,
  tableData: Map<number, Uint8Array>
): { ttf: Uint8Array; tables: Record<string, Uint8Array> } {
  const entries = Array.from(tableData.entries()).sort((a, b) => a[0] - b[0]);
  const numTables = entries.length;
  let offset = SFNT_HEADER_SIZE + SFNT_ENTRY_SIZE * numTables;

  const records: {
    tag: number;
    checksum: number;
    offset: number;
    length: number;
    data: Uint8Array;
  }[] = [];

  for (const [tag, data] of entries) {
    const paddedLen = round4(data.length);
    records.push({
      tag,
      checksum: computeULongSum(data),
      offset,
      length: data.length,
      data
    });
    offset += paddedLen;
  }

  const ttf = new Uint8Array(offset);
  let off = 0;
  off = store32(flavor >>> 0, ttf, off);
  off = store16(numTables, ttf, off);
  let maxPow2 = 0;
  while ((1 << (maxPow2 + 1)) <= numTables) maxPow2++;
  const searchRange = (1 << maxPow2) * 16;
  off = store16(searchRange, ttf, off);
  off = store16(maxPow2, ttf, off);
  off = store16(numTables * 16 - searchRange, ttf, off);

  // table records
  for (const rec of records) {
    off = store32(rec.tag, ttf, off);
    off = store32(rec.checksum, ttf, off);
    off = store32(rec.offset, ttf, off);
    off = store32(rec.length, ttf, off);
  }

  for (const rec of records) {
    ttf.set(rec.data, rec.offset);
    // zero padding already present
  }

  // checkSumAdjustment for 'head'
  const headRecord = records.find((r) => r.tag === TAG_HEAD);
  if (headRecord) {
    const checksum = computeULongSum(ttf);
    const adjustment = (0xb1b0afba - checksum) >>> 0;
    store32(adjustment, ttf, headRecord.offset + CHECKSUM_ADJUSTMENT_OFFSET);
  }

  const tables: Record<string, Uint8Array> = {};
  for (const [tag, data] of entries) {
    tables[tagToString(tag)] = data;
  }

  return { ttf, tables };
}

function rebuildFont(
  header: Woff2Header,
  transformed: Uint8Array,
  deps: ResolvedWoff2Dependencies
): { ttf: Uint8Array; tables: Record<string, Uint8Array> } {
  const tableMap = new Map<number, Uint8Array>();
  const tablesByTag = new Map(header.tables.map((t) => [t.tag, t]));
  const state: TransformState = { glyfInfo: null, numHMetrics: 0 };
  const context: TransformContext = { header, tableMap, tablesByTag, state };
  const transformers = deps.transformers;

  const sortedTables = header.tables.slice().sort((a, b) => a.tag - b.tag);

  for (const table of sortedTables) {
    const srcStart = table.srcOffset;
    const srcEnd = srcStart + table.srcLength;
    if (srcEnd > transformed.length) {
      throw new Error("Invalid WOFF2: table outside brotli buffer");
    }
    const srcData = transformed.subarray(srcStart, srcEnd);

    if ((table.flags & WOFF2_FLAG_TRANSFORM) === 0) {
      const data = new Uint8Array(srcData); // copy
      if (table.tag === TAG_HEAD && data.length >= 12) {
        // Zero checkSumAdjustment before checksums
        data[CHECKSUM_ADJUSTMENT_OFFSET] = 0;
        data[CHECKSUM_ADJUSTMENT_OFFSET + 1] = 0;
        data[CHECKSUM_ADJUSTMENT_OFFSET + 2] = 0;
        data[CHECKSUM_ADJUSTMENT_OFFSET + 3] = 0;
      }
      tableMap.set(table.tag, data);
      if (table.tag === TAG_HHEA) {
        state.numHMetrics = readNumHMetrics(data);
      }
      continue;
    }

    const transformer = transformers.get(table.tag);
    if (!transformer) {
      throw new Error(`Unsupported WOFF2 transform for ${tagToString(table.tag)}`);
    }
    transformer(table, srcData, context);
  }

  return buildSfnt(header.flavor, tableMap);
}

// --- Public API -------------------------------------------------------------

export async function decodeWoff2(
  fontData: Uint8Array,
  deps?: Partial<Woff2Dependencies>
): Promise<{ parsed: ParsedFont; ttfBuffer: Uint8Array }> {
  const resolvedDeps = resolveDependencies(deps);
  const header = parseHeader(fontData);
  const compressed = fontData.subarray(
    header.compressedOffset,
    header.compressedOffset + header.compressedLength
  );

  const decompressed = await resolvedDeps.decompress(compressed);
  if (decompressed.byteLength !== header.uncompressedSize) {
    throw new Error("Invalid WOFF2: brotli size mismatch");
  }

  const rebuilt = rebuildFont(header, decompressed, resolvedDeps);

  const parsed: ParsedFont = {
    flavor: header.flavor,
    numTables: header.numTables,
    tables: rebuilt.tables
  };

  return { parsed, ttfBuffer: rebuilt.ttf };
}
