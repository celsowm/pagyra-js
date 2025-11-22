import { DataReader } from "./webp-decoder.js";

/**
 * Represents a single RIFF chunk
 */
export interface RiffChunk {
    fourCC: string;
    size: number;
    data: DataView;
}

/**
 * Parser for WebP RIFF container structure
 * Responsibility: Parse and validate RIFF chunks
 */
export class WebpRiffParser {
    /**
     * Validate RIFF header signature
     */
    validateHeader(reader: DataReader): void {
        const riff = reader.getString(4);
        if (riff !== 'RIFF') {
            throw new Error("Invalid WebP: Missing RIFF header");
        }

        reader.getUint32(true); // File size (unused)

        const webp = reader.getString(4);
        if (webp !== 'WEBP') {
            throw new Error("Invalid WebP: Missing WEBP signature");
        }
    }

    /**
     * Parse all chunks from the RIFF container
     */
    parseChunks(reader: DataReader): RiffChunk[] {
        const chunks: RiffChunk[] = [];

        while (reader.hasMore()) {
            const fourCC = reader.getString(4);
            const size = reader.getUint32(true);
            const data = reader.getView(size);
            chunks.push({ fourCC, size, data });

            // Skip padding byte if chunk size is odd
            if (size % 2 === 1 && reader.hasMore()) {
                reader.seek(reader.tell() + 1);
            }
        }

        return chunks;
    }
}
