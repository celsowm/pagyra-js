# WOFF2 Explained

## Introduction

WOFF2 (Web Open Font Format 2.0) is a font packaging format for use in web pages. It was developed by the World Wide Web Consortium (W3C) as a successor to WOFF 1.0. The primary goal of WOFF2 is to provide significantly better compression than its predecessor, resulting in smaller font files and faster download times for web fonts. This is achieved through a combination of a content-aware preprocessing step and the use of the Brotli compression algorithm.

## File Structure

A WOFF2 file is composed of several distinct blocks of data, arranged in a specific order. The overall structure is as follows:

1.  **WOFF2 Header:** A fixed-size header containing basic information about the font, such as its signature, version, and offsets to other data blocks.
2.  **Table Directory:** A directory of font tables, similar to the one in an SFNT font file, but with some modifications to improve compression.
3.  **Collection Directory (Optional):** This block is only present if the WOFF2 file is a font collection (i.e., a `.ttc` file).
4.  **Compressed Font Data:** A single block of data containing all the font tables, compressed using the Brotli algorithm.
5.  **Extended Metadata (Optional):_ A block of compressed XML metadata.
6.  **Private Data (Optional):_ A block of arbitrary data for use by the font designer or foundry.

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

### `glyf` and `loca` Table Transformations

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

## Extended Metadata and Private Data Blocks

WOFF2 allows for two optional data blocks at the end of the file:

-   **Extended Metadata Block:** This block can contain extended metadata about the font, in XML format. The metadata is compressed with Brotli. This block is useful for including licensing information or other details that are not part of the core font tables.

-   **Private Data Block:** This is a block of arbitrary data that can be used by font designers, foundries, or vendors for their own purposes. The content of this block is not interpreted by user agents and can be in any format.

## Comparison of WOFF2 Research

This section is reserved for a comparison between the information presented in this document and your own research. Please provide your findings.
