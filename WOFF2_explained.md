# WOFF2 Explained

## Introduction

WOFF2 (Web Open Font Format 2.0) is a font packaging format for use in web pages. It was developed by the World Wide Web Consortium (W3C) as a successor to WOFF 1.0. The primary goal of WOFF2 is to provide significantly better compression than its predecessor, resulting in smaller font files and faster download times for web fonts. This is achieved through a combination of a content-aware preprocessing step and the use of the Brotli compression algorithm.

## File Structure

A WOFF2 file is composed of several distinct blocks of data, arranged in a specific order. The overall structure is as follows:

1.  **WOFF2 Header:** A fixed-size header containing basic information about the font, such as its signature, version, and offsets to other data blocks.
2.  **Table Directory:** A directory of font tables, similar to the one in an SFNT font file, but with some modifications to improve compression.
3.  **Collection Directory (Optional):** This block is only present if the WOFF2 file is a font collection (i.e., a `.ttc` file).
4.  **Compressed Font Data:** A single block of data containing all the font tables, compressed using the Brotli algorithm.
5.  **Extended Metadata (Optional):** A block of compressed XML metadata.
6.  **Private Data (Optional):** A block of arbitrary data for use by the font designer or foundry.

## WOFF2 Header

The WOFF2 header is a 48-byte structure at the beginning of the file. It provides essential information about the font and the file's structure.

| Field               | Type   | Description                                                                                             |
| ------------------- | ------ | ------------------------------------------------------------------------------------------------------- |
| `signature`         | UInt32 | 0x774F4632 ('wOF2'), identifies the file as WOFF2.                                                     |
| `flavor`            | UInt32 | The "sfnt version" of the input font (e.g., 0x00010000 for TrueType or 'OTTO' for CFF).                  |
| `length`            | UInt32 | Total size of the WOFF2 file.                                                                           |
| `numTables`         | UInt16 | Number of entries in the font table directory.                                                          |
| `reserved`          | UInt16 | Reserved; must be set to 0.                                                                             |
| `totalSfntSize`     | UInt32 | Total size of the uncompressed font data.                                                               |
| `totalCompressedSize`| UInt32| Total length of the compressed data block.                                                              |
| `majorVersion`      | UInt16 | Major version of the WOFF2 file.                                                                        |
| `minorVersion`      | UInt16 | Minor version of the WOFF2 file.                                                                        |
| `metaOffset`        | UInt32 | Offset to the metadata block from the beginning of the file.                                            |
| `metaLength`        | UInt32 | Length of the compressed metadata block.                                                                |
| `metaOrigLength`    | UInt32 | Uncompressed size of the metadata block.                                                                |
| `privOffset`        | UInt32 | Offset to the private data block from the beginning of the file.                                        |
| `privLength`        | UInt32 | Length of the private data block.                                                                       |

## Font Directory

The Font Directory immediately follows the WOFF2 Header. It's an array of `TableDirectoryEntry` items, one for each font table. Unlike a standard SFNT font, the tables are not necessarily in alphabetical order by tag. Instead, their order defines the physical sequence of tables within the compressed data stream.

Each entry in the directory has the following format:

| Field | Type | Description |
|---|---|---|
| `flags` | UInt8 | A byte indicating the table type and transformation version. |
| `tag` | UInt32 | The 4-byte table tag (optional). This is only present if the tag is not one of the "known table tags". |
| `origLength` | UIntBase128 | The original, uncompressed length of the table. |
| `transformLength`| UIntBase128 | The length of the table after pre-processing, but before Brotli compression. This field is only present for transformed tables. |

The `flags` field is a key part of the WOFF2 compression strategy. The lower 6 bits ([0..5]) are an index into a predefined list of "Known Table Tags" (e.g., 'cmap', 'head', 'glyf'). If the tag is in this list, the 4-byte `tag` field is omitted, saving space. If the index is 63, it signifies that a 4-byte `tag` field follows.

The upper 2 bits ([6..7]) of the `flags` field specify the transformation version applied to the table before compression. A version of 0 typically means no transformation (a "null transform"), except for `glyf` and `loca` tables where specific transforms are defined.

## Compressed Data Format and Transformations

The core of WOFF2's efficiency comes from its two-stage compression process. First, specific font tables are pre-processed with content-aware transformations to reduce redundancy. Second, the entire collection of (potentially transformed) font tables is concatenated and compressed as a single data stream using the Brotli algorithm.

### `glyf` and `loca` Table Transformations (For TrueType Fonts)

For TrueType-outline fonts (`.ttf`), the `glyf` (glyph data) and `loca` (glyph location) tables often constitute the bulk of the file size. WOFF2 applies a sophisticated transformation to this data.

The `glyf` table is deconstructed into several separate substreams:
- **nContour stream:** Stores the number of contours for each glyph.
- **nPoints stream:** Stores the number of points for each contour.
- **flag stream:** Stores the flags for each outline point.
- **glyph stream:** Stores the x and y coordinates of the points, using a special variable-length encoding.
- **composite stream:** Stores data for composite glyphs.
- **bbox stream:** Stores explicit bounding boxes for glyphs that require them.
- **instruction stream:** Stores the hinting instructions for each glyph.

This separation groups similar data together, which is highly effective for the subsequent Brotli compression. The coordinate data in the `glyph stream` is further optimized using a "triplet encoding" where a flag byte determines how the following bytes encode the delta-x and delta-y values for a point.

Crucially, the `loca` table is entirely reconstructed from the transformed `glyf` data. Therefore, the `transformLength` for the `loca` table in the directory is always zero, as it contributes no bytes to the compressed data stream.

### `hmtx` Table Transformation

The `hmtx` table contains horizontal metrics for each glyph, such as advance widths and left side bearings (LSBs). The WOFF2 transformation for this table exploits a common feature of font design: for many glyphs, the LSB is identical to the glyph's `xMin` value (the minimum x-coordinate of its bounding box).

If this condition holds true for all glyphs in a font, the LSB data can be omitted from the `hmtx` table and reconstructed by the decoder using the `xMin` values from the `glyf` table. This eliminates redundant data and further improves compression.

### CFF Table Handling (For PostScript/CID Fonts)

For fonts with PostScript outlines, such as OpenType CFF or CID-keyed fonts, WOFF2 does not apply a complex transformation like it does for `glyf` data. Instead, the `CFF ` table is subjected to a "null transform," meaning its data is included directly in the stream for Brotli compression.

However, the WOFF2 specification makes a strong recommendation for an external preprocessing step: **de-subroutinization**. CFF fonts use subroutines to compactly store repeating path segments in glyphs. While this is efficient for the uncompressed font, the Brotli algorithm can achieve a much higher compression ratio on the raw, expanded glyph data. A WOFF2 encoder should therefore de-subroutinize the CFF data *before* WOFF2 compression to achieve the best results.

### `cmap` and Other Font Tables

The vast majority of other font tables (`cmap`, `head`, `OS/2`, etc.) are not transformed.WOFF2 treats them as opaque blocks of data. They are passed through with a "null transform" and compressed by Brotli along with all other table data.

This means that all the logic for character-to-glyph mapping (including complex mappings for CID fonts) is perfectly preserved, as the `cmap` table and any related tables are restored bit-for-bit after decompression. The compression benefit for these tables comes from Brotli's ability to find and compress patterns across the entire font data stream.

## Low-Level Example: Packaging a Non-Transformed Table

To understand the "caveat" that most tables are not transformed, let's trace a real-world example using the `head` table from the **Roboto-Regular.ttf** font.

1.  **Extract Real Data:**
    *   First, we extract the `head` table from the original `.ttf` file. It is **54 bytes** long and its content, in hexadecimal, is:
        ```
        00 01 00 00 00 03 02 4e b8 99 fb 39 5f 0f 3c f5
        00 1b 08 00 00 00 00 00 c4 f0 11 2e 00 00 00 00
        e1 d4 02 6f fa 1a fd d5 09 31 08 73 00 00 00 09
        00 02 00 00 00 00
        ```

2.  **Create the WOFF2 `TableDirectoryEntry`:**
    *   When we compress `Roboto-Regular.ttf` to WOFF2, the encoder creates an entry in the table directory for the `head` table. Analysis with Google's `woff2_info` tool shows:
        *   **`flags`**: `0x01`
            *   The upper 2 bits (`00`) signify a **null transform** (version 0).
            *   The lower 6 bits (`000001`) are the index `1`, which corresponds to the `head` tag in the "Known Tags" list.
        *   **`tag`**: Because `head` is a "known tag", this 4-byte field is **omitted**.
        *   **`origLength`**: `54`. Since 54 is less than 128, it is encoded as a single `UIntBase128` byte: `0x36`.
        *   **`transformLength`**: Because this is a null transform, this field is **omitted**.

    The final, complete binary entry for the `head` table in the WOFF2 file's directory is just two bytes: `01 36`.

3.  **Append to Data Stream:**
    *   The encoder takes the **entire 54 bytes** of the original `head` table and appends them to the raw data stream, which will then be compressed by Brotli.

This real-world example proves that for a regular font table, WOFF2 acts as a simple container, relying on Brotli for compression without any complex data transformation.

## Extended Metadata and Private Data Blocks

WOFF2 allows for two optional data blocks at the end of the file:

-   **Extended Metadata Block:** This block can contain extended metadata about the font, in XML format. The metadata is compressed with Brotli. This block is useful for including licensing information or other details that are not part of the core font tables.

-   **Private Data Block:** This is a block of arbitrary data that can be used by font designers, foundries, or vendors for their own purposes. The content of this block is not interpreted by user agents and can be in any format.

## Comparison of WOFF2 Research

This section compares the WOFF2 decoder implementation found in this repository (`woff2-parser.ts`) with Google's official C++ reference implementation.

### Architectural Comparison

| Aspect | Your Implementation (`woff2-parser.ts`) | Google's Implementation (C++) |
| :--- | :--- | :--- |
| **Primary Goal** | Parse the WOFF2 container and orchestrate decompression. | Convert a full WOFF2 file back into a TTF/OTF file. |
| **Language/Style** | High-level, modern TypeScript. Asynchronous, clean. | Low-level, performance-critical C++. Monolithic functions. |
| **Architecture** | High cohesion, low coupling. Delegates transformation logic. | Vertically integrated. Parsing and transformation are tightly coupled. |
| **Abstraction** | High. Deals with concepts like "table entries" and "data streams". | Low. Deals with raw byte buffers, pointers, and manual memory management. |

**Conclusion:** Your `woff2-parser.ts` is a well-designed, modern parser component. It correctly handles the WOFF2 container format. However, the rendering bug indicates an issue not in the parser itself, but in the lower-level transformation logic it delegates to.

### Algorithm-Level Analysis and Bug Root Cause

The "texto embaralhado" (scrambled text) bug is caused by a critical flaw in the algorithm that reconstructs the glyph shapes from the transformed `glyf` table. The root cause is in the `woff2-glyf-transform.ts` file.

**The Bug:** The core of the issue lies in the **`readTriplet` function**. This function is responsible for decoding the compressed coordinates of each point in a glyph's outline. Your implementation of this function **does not correctly follow the WOFF2 specification's "Triplet Encoding" table**.

-   **Incorrect Logic:** The `readTriplet` function uses a series of `if/else if` conditions with hardcoded numerical ranges (e.g., `b0 < 84`, `b0 < 1300`) and mathematical operations that do not match the spec. The WOFF2 specification defines 128 different ways a "triplet" (a flag byte plus 0-4 data bytes) can encode the change in x and y coordinates (`dx`, `dy`).
-   **Comparison to Reference:** Google's `TripletDecode` function in `woff2_dec.cc` is a direct, faithful implementation of that specification table. It correctly interprets the flag bits to determine the signs of `dx` and `dy` and how to combine the subsequent data bytes.
-   **Result:** Because your `readTriplet` function calculates incorrect `dx` and `dy` values, the coordinates of the points that define each character's shape are placed in the wrong positions. This completely distorts the glyph outlines, causing the text to appear scrambled, garbled, or like a jumble of random lines.

**Secondary Issue:** The `reconstructSimpleGlyph` function attempts to rebuild the TrueType `flags` for each point from scratch. This is an unnecessarily complex and error-prone approach. The reference implementation, in contrast, correctly converts the WOFF2 flags into the appropriate TTF flags, preserving all necessary information.

**How to Fix:** To fix the rendering bug, the `readTriplet` function in `woff2-glyf-transform.ts` must be **completely rewritten** to be a direct and correct implementation of the "Triplet Encoding" table found in Section 5.2 of the WOFF2 specification. The logic in Google's `TripletDecode` function serves as a perfect reference for this.
