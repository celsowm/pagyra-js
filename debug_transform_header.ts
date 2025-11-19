import { readFileSync } from 'fs';
import { resolve } from 'path';

// Manually decompress the WOFF2 file and inspect the transformed glyf data
async function run() {
    // We need to manually decompress the WOFF2
    const path = resolve('assets/fonts/woff2/caveat/Caveat-Regular.woff2');
    const buffer = readFileSync(path);

    // Read WOFF2 header
    const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.length);

    let offset = 0;
    const signature = view.getUint32(offset, false);
    offset += 4;

    const flavor = view.getUint32(offset, false);
    offset += 4;

    const length = view.getUint32(offset, false);
    offset += 4;

    const numTables = view.getUint16(offset, false);
    offset += 2;

    const reserved = view.getUint16(offset, false);
    offset += 2;

    const totalSfntSize = view.getUint32(offset, false);
    offset += 4;

    const totalCompressedSize = view.getUint32(offset, false);
    offset += 4;

    const majorVersion = view.getUint16(offset, false);
    offset += 2;

    const minorVersion = view.getUint16(offset, false);
    offset += 2;

    const metaOffset = view.getUint32(offset, false);
    offset += 4;

    const metaLength = view.getUint32(offset, false);
    offset += 4;

    const metaOrigLength = view.getUint32(offset, false);
    offset += 4;

    const privOffset = view.getUint32(offset, false);
    offset += 4;

    const privLength = view.getUint32(offset, false);
    offset += 4;

    console.log('=== WOFF2 Header ===');
    console.log(`Signature: 0x${signature.toString(16)}`);
    console.log(`Flavor: 0x${flavor.toString(16)}`);
    console.log(`Length: ${length}`);
    console.log(`NumTables: ${numTables}`);
    console.log(`TotalCompressedSize: ${totalCompressedSize}`);
    console.log(`Version: ${majorVersion}.${minorVersion}`);
    console.log(`Current offset after header: ${offset}`);

    // Now we need to parse the table directory
    // Each entry is variable length based on flags
    console.log('\n=== Table Directory ===');

    for (let i = 0; i < numTables; i++) {
        const flags = buffer[offset++];
        const tagValue = flags & 0x3F;

        // Decode tag
        let tag: string;
        if (tagValue < 63) {
            // Known tag index
            const knownTags = [
                'cmap', 'head', 'hhea', 'hmtx', 'maxp', 'name', 'OS/2', 'post',
                'cvt ', 'fpgm', 'glyf', 'loca', 'prep', 'CFF ', 'VORG', 'EBDT',
                'EBLC', 'gasp', 'hdmx', 'kern', 'LTSH', 'PCLT', 'VDMX', 'vhea',
                'vmtx', 'BASE', 'GDEF', 'GPOS', 'GSUB', 'EBSC', 'JSTF', 'MATH',
                'CBDT', 'CBLC', 'COLR', 'CPAL', 'SVG ', 'sbix', 'acnt', 'avar',
                'bdat', 'bloc', 'bsln', 'cvar', 'fdsc', 'feat', 'fmtx', 'fvar',
                'gvar', 'hsty', 'just', 'lcar', 'mort', 'morx', 'opbd', 'prop',
                'trak', 'Zapf', 'Silf', 'Glat', 'Gloc', 'Feat', 'Sill'
            ];
            tag = knownTags[tagValue] || `IDX${tagValue}`;
        } else {
            // Custom tag (4 bytes)
            tag = String.fromCharCode(buffer[offset], buffer[offset + 1], buffer[offset + 2], buffer[offset + 3]);
            offset += 4;
        }

        // Read origLength (UIntBase128)
        let origLength = 0;
        for (let j = 0; j < 5; j++) {
            const byte = buffer[offset++];
            origLength = (origLength << 7) | (byte & 0x7F);
            if ((byte & 0x80) === 0) break;
        }

        // Check transform version (upper 2 bits of flags)
        const transformVersion = (flags >> 6) & 0x03;

        // Read transformLength if present
        let transformLength: number | undefined;
        if (transformVersion !== 0 && (tag === 'glyf' || tag === 'loca')) {
            transformLength = 0;
            for (let j = 0; j < 5; j++) {
                const byte = buffer[offset++];
                transformLength = (transformLength << 7) | (byte & 0x7F);
                if ((byte & 0x80) === 0) break;
            }
        }

        console.log(`Table ${i}: ${tag}, origLength=${origLength}, transformVersion=${transformVersion}${transformLength !== undefined ? `, transformLength=${transformLength}` : ''}`);

        if (tag === 'glyf') {
            console.log(`\n*** GLYF TABLE FOUND ***`);
            console.log(`Transform version: ${transformVersion}`);
            console.log(`Original length: ${origLength}`);
            console.log(`Transform length: ${transformLength}`);
        }
    }

    console.log(`\nEnd of table directory, offset: ${offset}`);
    console.log(`Compressed data starts at: ${offset}`);
    console.log(`Compressed data size should be: ${totalCompressedSize}`);
}

run().catch(console.error);
