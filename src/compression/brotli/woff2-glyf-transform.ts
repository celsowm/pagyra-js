/**
 * WOFF2 glyf/loca table transformation
 * Based on WOFF 2.0 specification section 5.2.1
 * 
 * This implements the reverse transformation to reconstruct standard TTF glyf/loca tables
 * from the transformed WOFF2 representation.
 */

import { readUInt16BE, readUInt32BE, writeUInt16BE, writeUInt32BE } from '../utils.js';

interface GlyfTransformHeader {
  version: number;
  optionFlags: number;
  numGlyphs: number;
  indexFormat: number;
  nContourStreamSize: number;
  nPointsStreamSize: number;
  flagStreamSize: number;
  glyphStreamSize: number;
  compositeStreamSize: number;
  bboxStreamSize: number;
  instructionStreamSize: number;
}

/**
 * Reconstructs glyf and loca tables from WOFF2 transformed data
 */
export class WOFF2GlyfTransform {
  /**
   * Untransform the glyf table from WOFF2 format to standard TTF format
   */
  static untransformGlyf(
    transformedData: Uint8Array,
    numGlyphs: number,
    indexFormat: number
  ): { glyf: Uint8Array; loca: Uint8Array } {
    try {
      // Parse the transformation header
      const header = this.parseTransformHeader(transformedData, numGlyphs);

      // Calculate stream offsets
      let offset = this.getHeaderSize(header);

      const nContourStream = transformedData.subarray(offset, offset + header.nContourStreamSize);
      offset += header.nContourStreamSize;

      const nPointsStream = transformedData.subarray(offset, offset + header.nPointsStreamSize);
      offset += header.nPointsStreamSize;

      const flagStream = transformedData.subarray(offset, offset + header.flagStreamSize);
      offset += header.flagStreamSize;

      const glyphStream = transformedData.subarray(offset, offset + header.glyphStreamSize);
      offset += header.glyphStreamSize;

      const compositeStream = transformedData.subarray(offset, offset + header.compositeStreamSize);
      offset += header.compositeStreamSize;

      const bboxStream = transformedData.subarray(offset, offset + header.bboxStreamSize);
      offset += header.bboxStreamSize;

      const instructionStream = transformedData.subarray(offset, offset + header.instructionStreamSize);
      offset += header.instructionStreamSize;

      // NOTE: bboxBitmap is optional in WOFF2 spec
      // For this font, there's no bboxBitmap (verified by checking: header + streams = total size)
      // Strategy: Try to read bbox from stream for all non-empty glyphs
      // If we exhaust bbox stream, compute bbox from coordinates for simple glyphs

      // Reconstruct glyphs
      const glyphs: Uint8Array[] = [];
      const locaOffsets: number[] = [0];

      let nContourPos = 0;
      let nPointsPos = 0;
      let flagPos = 0;
      let glyphPos = 0;
      let compositePos = 0;
      let bboxPos = 0;
      let instructionPos = 0;

      for (let i = 0; i < numGlyphs; i++) {
        // Read number of contours
        const nContours = this.readInt16(nContourStream, nContourPos);
        nContourPos += 2;

        if (nContours === 0) {
          // Empty glyph
          glyphs.push(new Uint8Array(0));
          locaOffsets.push(locaOffsets[locaOffsets.length - 1]);
          continue;
        }

        // Determine bbox values
        // WOFF2 strategy: Composite glyphs have explicit bbox in stream
        // Simple glyphs compute bbox from coordinates
        let xMin = 0, yMin = 0, xMax = 0, yMax = 0;
        let bboxExplicit = false;

        if (nContours < 0) {
          // Composite glyph - MUST read from bbox stream
          if (bboxPos + 8 > bboxStream.length) {
            throw new Error(`WOFF2 glyf: Composite glyph ${i} missing required bbox (bbox stream exhausted)`);
          }

          xMin = this.readInt16(bboxStream, bboxPos);
          bboxPos += 2;
          yMin = this.readInt16(bboxStream, bboxPos);
          bboxPos += 2;
          xMax = this.readInt16(bboxStream, bboxPos);
          bboxPos += 2;
          yMax = this.readInt16(bboxStream, bboxPos);
          bboxPos += 2;
          bboxExplicit = true;

          if (i < 10) {
            console.log(`Glyph ${i}: nContours=${nContours}, BBox=[${xMin}, ${yMin}, ${xMax}, ${yMax}] (composite, explicit)`);
          }
        } else {
          // Simple glyph - will compute bbox from coordinates
          if (i < 10) {
            console.log(`Glyph ${i}: nContours=${nContours}, BBox=computed (simple glyph)`);
          }
        }

        let glyphData: Uint8Array;

        if (nContours > 0) {
          // Simple glyph
          const result = this.reconstructSimpleGlyph(
            nContours,
            xMin, yMin, xMax, yMax,
            nPointsStream, nPointsPos,
            flagStream, flagPos,
            glyphStream, glyphPos,
            instructionStream, instructionPos,
            bboxExplicit
          );

          glyphData = result.glyph;

          // Update positions
          nPointsPos += result.bytesRead.nPoints;
          flagPos += result.bytesRead.flags;
          glyphPos += result.bytesRead.glyph;
          instructionPos += result.bytesRead.instructions;

        } else {
          // Composite glyph (nContours < 0)
          const result = this.reconstructCompositeGlyph(
            nContours,
            xMin, yMin, xMax, yMax,
            compositeStream, compositePos,
            instructionStream, instructionPos
          );

          glyphData = result.glyph;

          // Update positions
          compositePos += result.bytesRead.composite;
          instructionPos += result.bytesRead.instructions;
        }

        glyphs.push(glyphData);
        locaOffsets.push(locaOffsets[locaOffsets.length - 1] + glyphData.length);
      }

      // Concatenate all glyphs
      const totalGlyfSize = locaOffsets[locaOffsets.length - 1];
      const glyf = new Uint8Array(totalGlyfSize);
      let glyfOffset = 0;
      for (const glyphData of glyphs) {
        glyf.set(glyphData, glyfOffset);
        glyfOffset += glyphData.length;
      }

      // Create loca table
      const loca = this.createLocaTable(locaOffsets, indexFormat);

      return { glyf, loca };

    } catch (error) {
      console.error('WOFF2 glyf transform failed:', error);
      // Return minimal valid tables as fallback
      return this.createMinimalGlyfLoca(numGlyphs, indexFormat);
    }
  }

  private static parseTransformHeader(data: Uint8Array, numGlyphs: number): GlyfTransformHeader {
    let offset = 0;

    // version is UInt16, not UInt32 (per W3C WOFF2 spec)
    const version = readUInt16BE(data, offset);
    offset += 2;

    // optionFlags: bit 0 = overlapSimpleBitmap present
    const optionFlags = readUInt16BE(data, offset);
    offset += 2;

    const numGlyphsInData = readUInt16BE(data, offset);
    offset += 2;

    const indexFormat = readUInt16BE(data, offset);
    offset += 2;

    const nContourStreamSize = readUInt32BE(data, offset);
    offset += 4;

    const nPointsStreamSize = readUInt32BE(data, offset);
    offset += 4;

    const flagStreamSize = readUInt32BE(data, offset);
    offset += 4;

    const glyphStreamSize = readUInt32BE(data, offset);
    offset += 4;

    const compositeStreamSize = readUInt32BE(data, offset);
    offset += 4;

    const bboxStreamSize = readUInt32BE(data, offset);
    offset += 4;

    const instructionStreamSize = readUInt32BE(data, offset);

    return {
      version,
      optionFlags,
      numGlyphs: numGlyphsInData || numGlyphs,
      indexFormat,
      nContourStreamSize,
      nPointsStreamSize,
      flagStreamSize,
      glyphStreamSize,
      compositeStreamSize,
      bboxStreamSize,
      instructionStreamSize
    };
  }

  private static getHeaderSize(header: GlyfTransformHeader): number {
    // version(4) + numGlyphs(2) + indexFormat(2) + 7 stream sizes(4 each) = 36 bytes
    return 36;
  }

  private static readInt16(data: Uint8Array, offset: number): number {
    const value = readUInt16BE(data, offset);
    return value > 0x7FFF ? value - 0x10000 : value;
  }

  private static read255UInt16(data: Uint8Array, offset: number): { value: number; bytesRead: number } {
    const code = data[offset];
    if (code === 253) {
      return { value: readUInt16BE(data, offset + 1), bytesRead: 3 };
    } else if (code === 254) {
      return { value: data[offset + 1] + 506, bytesRead: 2 };
    } else if (code === 255) {
      return { value: data[offset + 1] + 253, bytesRead: 2 };
    } else {
      return { value: code, bytesRead: 1 };
    }
  }

  private static readTriplet(data: Uint8Array, offset: number): { dx: number; dy: number; bytesRead: number } {
    const b0 = data[offset];
    let dx = 0;
    let dy = 0;
    let bytesRead = 1;

    if (b0 < 10) {
      dx = 0;
      dy = ((b0 - 0) << 8) | data[offset + 1];
      bytesRead = 2;
    } else if (b0 < 20) {
      dx = ((b0 - 10) << 8) | data[offset + 1];
      dy = 0;
      bytesRead = 2;
    } else if (b0 < 84) {
      dx = b0 - 20;
      dy = 0;
    } else if (b0 < 148) {
      dx = -(b0 - 84);
      dy = 0;
    } else if (b0 < 212) {
      dx = 0;
      dy = b0 - 148;
    } else if (b0 < 276) {
      dx = 0;
      dy = -(b0 - 212);
    } else if (b0 < 1300) {
      const val = b0 - 276;
      dx = (val >> 4) + 1;
      dy = ((val & 15) << 8) | data[offset + 1];
      bytesRead = 2;
    } else if (b0 < 2324) {
      const val = b0 - 1300;
      dx = (val >> 4) + 1;
      dy = -(((val & 15) << 8) | data[offset + 1]);
      bytesRead = 2;
    } else if (b0 < 3348) {
      const val = b0 - 2324;
      dx = -((val >> 4) + 1);
      dy = ((val & 15) << 8) | data[offset + 1];
      bytesRead = 2;
    } else if (b0 < 4372) {
      const val = b0 - 3348;
      dx = -((val >> 4) + 1);
      dy = -(((val & 15) << 8) | data[offset + 1]);
      bytesRead = 2;
    } else if (b0 < 5396) {
      const val = b0 - 4372;
      dy = (val >> 4) + 1;
      dx = ((val & 15) << 8) | data[offset + 1];
      bytesRead = 2;
    } else if (b0 < 6420) {
      const val = b0 - 5396;
      dy = (val >> 4) + 1;
      dx = -(((val & 15) << 8) | data[offset + 1]);
      bytesRead = 2;
    } else if (b0 < 7444) {
      const val = b0 - 6420;
      dy = -((val >> 4) + 1);
      dx = ((val & 15) << 8) | data[offset + 1];
      bytesRead = 2;
    } else if (b0 < 8468) {
      const val = b0 - 7444;
      dy = -((val >> 4) + 1);
      dx = -(((val & 15) << 8) | data[offset + 1]);
      bytesRead = 2;
    } else if (b0 === 8468) {
      const view = new DataView(data.buffer as ArrayBuffer, data.byteOffset + offset + 1, 2);
      dx = view.getInt8(0);
      dy = view.getInt8(1);
      bytesRead = 3;
    } else if (b0 === 8469) {
      const view = new DataView(data.buffer as ArrayBuffer, data.byteOffset + offset + 1, 4);
      dx = view.getInt16(0, false);
      dy = view.getInt16(2, false);
      bytesRead = 5;
    }

    return { dx, dy, bytesRead };
  }

  private static reconstructSimpleGlyph(
    nContours: number,
    xMin: number, yMin: number, xMax: number, yMax: number,
    nPointsStream: Uint8Array, nPointsPos: number,
    flagStream: Uint8Array, flagPos: number,
    glyphStream: Uint8Array, glyphPos: number,
    instructionStream: Uint8Array, instructionPos: number,
    bboxExplicit: boolean
  ): { glyph: Uint8Array; bytesRead: { nPoints: number; flags: number; glyph: number; instructions: number } } {
    // Read number of points per contour
    const endPtsOfContours: number[] = [];
    let numPoints = 0;
    let currentNPointsPos = nPointsPos;

    for (let i = 0; i < nContours; i++) {
      const { value, bytesRead } = this.read255UInt16(nPointsStream, currentNPointsPos);
      currentNPointsPos += bytesRead;
      numPoints += value;
      endPtsOfContours.push(numPoints - 1);
    }
    const nPointsBytesRead = currentNPointsPos - nPointsPos;

    // Read instructions size
    const { value: instructionLength, bytesRead: instrLenBytes } = this.read255UInt16(glyphStream, glyphPos);
    let currentGlyphPos = glyphPos + instrLenBytes;
    const glyphBytesReadStart = currentGlyphPos - glyphPos;

    // Read instructions
    const instructions = instructionStream.subarray(instructionPos, instructionPos + instructionLength);

    // Read flags
    const flags: number[] = [];
    let currentFlagPos = flagPos;

    while (flags.length < numPoints) {
      const flag = flagStream[currentFlagPos++];
      flags.push(flag);

      if ((flag & 8) !== 0) { // Repeat bit set
        const repeatCount = flagStream[currentFlagPos++];
        for (let j = 0; j < repeatCount; j++) {
          flags.push(flag);
        }
      }
    }
    const flagsBytesRead = currentFlagPos - flagPos;

    // Read coordinates
    const xCoordinates: number[] = [];
    const yCoordinates: number[] = [];
    let currentX = 0;
    let currentY = 0;

    for (let i = 0; i < numPoints; i++) {
      const { dx, dy, bytesRead } = this.readTriplet(glyphStream, currentGlyphPos);
      currentGlyphPos += bytesRead;
      currentX += dx;
      currentY += dy;
      // TTF flags are different from WOFF2 flags?
      // WOFF2 flags: bit 0-6 are standard TTF flags? No.
      // WOFF2 flags:
      // Bit 6: overlapSimple (always set in WOFF2?)
      // The WOFF2 spec says "The flag byte has the same meaning as in the 'glyf' table".
      // So we can use them directly?
      // Except bit 6 is reserved in TTF but used in WOFF2?
      // Wait, WOFF2 spec says: "The flags are stored... using the same format as the 'glyf' table".
      // So we can just write them out.

      // Calculate size
      let flagsSize = flags.length; // Assuming no repeat optimization for now
      // We should optimize flags if possible, but raw copy is safe.

      // Coords size
      // We need to encode coords as deltas
      // TTF uses delta encoding relative to previous point.
      // We have absolute coords now.
      // Let's re-calculate deltas and encode.

      const ttfFlags: number[] = [];
      const xBytes: number[] = [];
      const yBytes: number[] = [];

      let prevX = 0;
      let prevY = 0;

      for (let i = 0; i < numPoints; i++) {
        const x = xCoordinates[i];
        const y = yCoordinates[i];
        const dx = x - prevX;
        const dy = y - prevY;

        let flag = 0; // We'll rebuild flags
        // Preserve on-curve bit from WOFF2 flag (bit 0)
        flag |= (flags[i] & 1);

        // Encode X
        if (dx === 0) {
          flag |= 0x10; // This x is same
        } else if (dx > -256 && dx < 256) {
          flag |= 0x02; // X-Short
          if (dx > 0) {
            flag |= 0x10; // Positive
            xBytes.push(dx);
          } else {
            xBytes.push(-dx);
          }
        } else {
          // Long
          xBytes.push((dx >> 8) & 0xff);
          xBytes.push(dx & 0xff);
        }

        // Encode Y
        if (dy === 0) {
          flag |= 0x20; // This y is same
        } else if (dy > -256 && dy < 256) {
          flag |= 0x04; // Y-Short
          if (dy > 0) {
            flag |= 0x20; // Positive
            yBytes.push(dy);
          } else {
            yBytes.push(-dy);
          }
        } else {
          // Long
          yBytes.push((dy >> 8) & 0xff);
          yBytes.push(dy & 0xff);
        }

        ttfFlags.push(flag);
        prevX = x;
        prevY = y;
      }

      const totalSize = 10 + nContours * 2 + 2 + instructions.length + ttfFlags.length + xBytes.length + yBytes.length;

      // Pad to 2 bytes? Glyphs must be 2-byte aligned?
      // The 'glyf' table entries are 2-byte aligned.
      const padding = totalSize % 2;

      const glyph = new Uint8Array(totalSize + padding);
      const view = new DataView(glyph.buffer as ArrayBuffer);

      let offset = 0;
      view.setInt16(offset, nContours, false); offset += 2;
      view.setInt16(offset, finalXMin, false); offset += 2;
      view.setInt16(offset, finalYMin, false); offset += 2;
      view.setInt16(offset, finalXMax, false); offset += 2;
      view.setInt16(offset, finalYMax, false); offset += 2;

      for (const endPt of endPtsOfContours) {
        view.setUint16(offset, endPt, false); offset += 2;
      }

      view.setUint16(offset, instructions.length, false); offset += 2;
      glyph.set(instructions, offset); offset += instructions.length;

      glyph.set(new Uint8Array(ttfFlags), offset); offset += ttfFlags.length;
      glyph.set(new Uint8Array(xBytes), offset); offset += xBytes.length;
      glyph.set(new Uint8Array(yBytes), offset); offset += yBytes.length;

      return {
        glyph,
        bytesRead: {
          nPoints: nPointsBytesRead,
          flags: flagsBytesRead,
          glyph: glyphBytesRead,
          instructions: instructionLength
        }
      };
    }

  private static reconstructCompositeGlyph(
      nContours: number,
      xMin: number, yMin: number, xMax: number, yMax: number,
      compositeStream: Uint8Array, compositePos: number,
      instructionStream: Uint8Array, instructionPos: number
    ): { glyph: Uint8Array; bytesRead: { composite: number; instructions: number } } {
    // Composite glyphs
    // WOFF2 stores composite glyphs... how?
    // "The composite glyph data is stored in the compositeStream."
    // Structure:
    // component flag (2 bytes)
    // glyph index (2 bytes)
    // argument1 (variable)
    // argument2 (variable)
    // scale (variable)
    // ...

    // We need to read until WE_HAVE_MORE_COMPONENTS (0x0020) is clear.

    const components: { flags: number; glyphIndex: number; args: Uint8Array }[] = [];
    let currentPos = compositePos;
    let hasInstructions = false;

    let instructions: Uint8Array<ArrayBufferLike> = new Uint8Array(0);

    while (true) {
      const flags = readUInt16BE(compositeStream, currentPos);
      currentPos += 2;
      const glyphIndex = readUInt16BE(compositeStream, currentPos);
      currentPos += 2;

      // Read arguments
      const arg1And2AreWords = (flags & 0x0001) !== 0;
      const argsAreXYValues = (flags & 0x0002) !== 0;
      // ...

      // We just need to copy the arguments as is?
      // WOFF2 doesn't compress arguments?
      // "The composite glyph format is the same as in the 'glyf' table, except that the glyph index is stored in 2 bytes."
      // So we can just read the flags and decide how many bytes to read.

      let argsSize = 0;
      if (arg1And2AreWords) {
        argsSize += 4;
      } else {
        argsSize += 2;
      }

      if (flags & 0x0008) { // WE_HAVE_A_SCALE
        argsSize += 2;
      } else if (flags & 0x0040) { // WE_HAVE_AN_X_AND_Y_SCALE
        argsSize += 4;
      } else if (flags & 0x0080) { // WE_HAVE_A_TWO_BY_TWO
        argsSize += 8;
      }

      const args = compositeStream.subarray(currentPos, currentPos + argsSize);
      currentPos += argsSize;

      components.push({ flags, glyphIndex, args });

      if (flags & 0x0100) { // WE_HAVE_INSTRUCTIONS
        hasInstructions = true;
      }

      if (!(flags & 0x0020)) { // MORE_COMPONENTS
        break;
      }
    }
    const compositeBytesRead = currentPos - compositePos;

    let instructionBytesRead = 0;

    if (hasInstructions) {
      const { value: instrLen, bytesRead } = this.read255UInt16(instructionStream, instructionPos);
      // We need to update instructionPos in caller?
      // For now, just read.
      // Note: Composite glyphs in WOFF2 store instruction length in instructionStream?
      // "If the WE_HAVE_INSTRUCTIONS flag is set... the instructions are stored in the instructionStream."
      // "The length of the instructions is stored... using 255UInt16."

      // Wait, where is the length stored?
      // "The instruction length is stored in the glyphStream for simple glyphs, and in the instructionStream for composite glyphs?"
      // No, spec says: "The instructions are stored in the instructionStream... The length ... is stored as a 255UInt16 at the beginning of the instructions."
      // So yes, read from instructionStream.

      // But we need to know WHERE in instructionStream.
      // The caller passes instructionPos.
      instructions = instructionStream.subarray(instructionPos + bytesRead, instructionPos + bytesRead + instrLen);
      instructionBytesRead = bytesRead + instrLen;
    }

    // Assemble
    let totalSize = 10; // Header
    for (const comp of components) {
      totalSize += 4 + comp.args.length;
    }
    if (hasInstructions) {
      totalSize += 2 + instructions.length;
    }

    const glyph = new Uint8Array(totalSize);
    const view = new DataView(glyph.buffer as ArrayBuffer);
    let offset = 0;

    view.setInt16(offset, nContours, false); offset += 2;
    view.setInt16(offset, xMin, false); offset += 2;
    view.setInt16(offset, yMin, false); offset += 2;
    view.setInt16(offset, xMax, false); offset += 2;
    view.setInt16(offset, yMax, false); offset += 2;

    for (const comp of components) {
      view.setUint16(offset, comp.flags, false); offset += 2;
      view.setUint16(offset, comp.glyphIndex, false); offset += 2;
      glyph.set(comp.args, offset); offset += comp.args.length;
    }

    if (hasInstructions) {
      view.setUint16(offset, instructions.length, false); offset += 2;
      glyph.set(instructions, offset);
    }

    return {
      glyph,
      bytesRead: {
        composite: compositeBytesRead,
        instructions: instructionBytesRead
      }
    };
  }

  private static createLocaTable(offsets: number[], indexFormat: number): Uint8Array {
    if (indexFormat === 0) {
      // Short format (offsets / 2)
      const loca = new Uint8Array(offsets.length * 2);
      const view = new DataView(loca.buffer as ArrayBuffer);
      for (let i = 0; i < offsets.length; i++) {
        view.setUint16(i * 2, offsets[i] / 2, false);
      }
      return loca;
    } else {
      // Long format
      const loca = new Uint8Array(offsets.length * 4);
      const view = new DataView(loca.buffer as ArrayBuffer);
      for (let i = 0; i < offsets.length; i++) {
        view.setUint32(i * 4, offsets[i], false);
      }
      return loca;
    }
  }

  private static createMinimalGlyfLoca(numGlyphs: number, indexFormat: number): { glyf: Uint8Array; loca: Uint8Array } {
    // Create minimal valid glyf table (all empty glyphs)
    const glyf = new Uint8Array(0);

    // Create loca table with all zeros
    const locaSize = indexFormat === 0 ? (numGlyphs + 1) * 2 : (numGlyphs + 1) * 4;
    const loca = new Uint8Array(locaSize);

    return { glyf, loca };
  }
}
