import type { ParsedFont } from '../types.js';

/**
 * Reconstructs a TTF buffer from parsed font tables.
 * This is useful when we have extracted tables from WOFF/WOFF2 and need to
 * pass them to a consumer that expects a valid TTF binary (like ttf-lite).
 * 
 * @param parsedFont - The parsed font containing tables and flavor
 * @returns A reconstructed TTF ArrayBuffer
 */
export function reconstructTtf(parsedFont: ParsedFont): ArrayBuffer {
    const sfntVersion = parsedFont.flavor >>> 0; // TTF/OTF flavor
    const numTables = parsedFont.numTables;

    // Calculate required space: header(12) + tableDir(16*numTables) + tableData
    const headerSize = 12;
    const tableDirSize = 16 * numTables;
    let totalDataSize = 0;
    const tableEntries: Array<{ tag: string, data: Uint8Array }> = [];

    // Sort tables by tag for deterministic order (required by TTF spec)
    Object.entries(parsedFont.tables).sort(([a], [b]) => a.localeCompare(b)).forEach(([tag, data]) => {
        let entryData = data;
        if (tag === 'head') {
            const view = new DataView(data.buffer, data.byteOffset, data.length);
            // Check unitsPerEm at offset 18
            if (data.length >= 20) {
                const units = view.getUint16(18, false);
                if (units === 0) {
                    // Patch unitsPerEm to 1000 if 0 (invalid)
                    // We need to copy the data to modify it as it might be a slice of a larger buffer
                    const patchedData = new Uint8Array(data);
                    const patchedView = new DataView(patchedData.buffer);
                    patchedView.setUint16(18, 1000, false);
                    entryData = patchedData;
                }
            }
        }
        tableEntries.push({ tag, data: entryData });
        // 4-byte alignment padding
        const padding = (4 - (entryData.length % 4)) % 4;
        totalDataSize += entryData.length + padding;
    });

    const buffer = new ArrayBuffer(headerSize + tableDirSize + totalDataSize);
    const view = new Uint8Array(buffer);
    const dataView = new DataView(buffer);

    // Write TTF header
    dataView.setUint32(0, sfntVersion, false); // Big endian
    dataView.setUint16(4, numTables, false);

    // Calculate searchRange, entrySelector, rangeShift
    let entrySelector = 0;
    let searchRange = 1;
    while (searchRange * 2 <= numTables) {
        searchRange *= 2;
        entrySelector++;
    }
    searchRange *= 16;
    const rangeShift = numTables * 16 - searchRange;

    dataView.setUint16(6, searchRange, false);
    dataView.setUint16(8, entrySelector, false);
    dataView.setUint16(10, rangeShift, false);

    let currentOffset = headerSize + tableDirSize;
    let dirOffset = 12;

    for (const entry of tableEntries) {
        const { tag, data } = entry;

        // Write table directory entry
        for (let i = 0; i < 4; i++) {
            view[dirOffset + i] = tag.charCodeAt(i);
        }

        // Calculate checksum (simplified)
        const checksum = calculateTableChecksum(data);
        dataView.setUint32(dirOffset + 4, checksum, false);

        dataView.setUint32(dirOffset + 8, currentOffset, false); // offset
        dataView.setUint32(dirOffset + 12, data.length, false); // length

        // Write table data
        view.set(data, currentOffset);

        // Add padding
        const padding = (4 - (data.length % 4)) % 4;
        currentOffset += data.length + padding;

        dirOffset += 16;
    }

    return buffer;
}

function calculateTableChecksum(data: Uint8Array): number {
    let sum = 0;
    const nlongs = Math.floor((data.length + 3) / 4);

    for (let i = 0; i < nlongs; i++) {
        // Read as uint32 big endian, handling potential out of bounds for last bytes
        let val = 0;
        const offset = i * 4;
        if (offset + 4 <= data.length) {
            val = (data[offset] << 24) | (data[offset + 1] << 16) | (data[offset + 2] << 8) | data[offset + 3];
        } else {
            // Handle partial last word
            for (let j = 0; j < 4; j++) {
                if (offset + j < data.length) {
                    val |= data[offset + j] << (24 - j * 8);
                }
            }
        }
        sum = (sum + val) >>> 0; // Keep as unsigned 32-bit
    }

    return sum;
}
