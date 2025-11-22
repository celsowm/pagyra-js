import { BitReader } from "./webp-decoder.js";

/**
 * Huffman code representation
 */
export interface HuffmanCode {
    symbol: number;
    length: number;
    code: number;
}

/**
 * Huffman tree with optional lookup table for performance
 */
export interface HuffmanTree {
    codes: HuffmanCode[];
    maxLength: number;
    lookupTable?: Map<number, number>;
}

const CODE_LENGTH_ORDER = [17, 18, 0, 1, 2, 3, 4, 5, 16, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15] as const;
const HUFFMAN_GROUPS = 5;

/**
 * Huffman code decoder for WebP VP8L format
 * Responsibility: Build and decode Huffman trees
 */
export class WebpHuffmanDecoder {
    /**
     * Read all Huffman code groups (5 groups for VP8L)
     */
    readHuffmanCodes(br: BitReader): HuffmanTree[] {
        const huffmanCodes: HuffmanTree[] = [];

        for (let i = 0; i < HUFFMAN_GROUPS; i++) {
            const alphabetSize = i === 4 ? 40 : 280; // 256 + 24 = 280
            huffmanCodes[i] = this.readHuffmanCode(br, alphabetSize);
        }

        return huffmanCodes;
    }

    /**
     * Read a single Huffman code
     */
    private readHuffmanCode(br: BitReader, alphabetSize: number): HuffmanTree {
        const simple = br.readBits(1);

        if (simple) {
            return this.readSimpleHuffmanCode(br);
        }

        // Read code length codes
        const codeLengthCodeLengths = new Array(19).fill(0);
        const numCodeLengthCodes = 4 + br.readBits(4);

        for (let i = 0; i < numCodeLengthCodes; i++) {
            codeLengthCodeLengths[CODE_LENGTH_ORDER[i]] = br.readBits(3);
        }

        const codeLengthTree = this.buildHuffmanTree(codeLengthCodeLengths);
        const codeLengths = this.readCodeLengths(br, codeLengthTree, alphabetSize);

        return this.buildHuffmanTree(codeLengths);
    }

    /**
     * Read simple Huffman code (1 or 2 symbols)
     */
    private readSimpleHuffmanCode(br: BitReader): HuffmanTree {
        const numSymbols = br.readBits(1) + 1;
        const symbols: number[] = [];

        const is8Bits = br.readBits(1);
        const bitCount = is8Bits ? 8 : 1;

        symbols.push(br.readBits(bitCount));
        if (numSymbols === 2) {
            symbols.push(br.readBits(bitCount));
        }

        return this.buildSimpleHuffman(symbols);
    }

    /**
     * Read code lengths for symbols
     */
    private readCodeLengths(br: BitReader, codeLengthTree: HuffmanTree, alphabetSize: number): number[] {
        const codeLengths = new Array(alphabetSize).fill(0);
        let i = 0;

        while (i < alphabetSize) {
            const code = this.readSymbol(br, codeLengthTree);

            if (code < 16) {
                codeLengths[i++] = code;
            } else {
                let repeatCount = 0;
                let repeatValue = 0;

                if (code === 16) {
                    repeatCount = 3 + br.readBits(2);
                    repeatValue = codeLengths[i - 1];
                } else if (code === 17) {
                    repeatCount = 3 + br.readBits(3);
                } else if (code === 18) {
                    repeatCount = 11 + br.readBits(7);
                }

                for (let j = 0; j < repeatCount && i < alphabetSize; j++) {
                    codeLengths[i++] = repeatValue;
                }
            }
        }

        return codeLengths;
    }

    /**
     * Build simple Huffman tree from 1-2 symbols
     */
    private buildSimpleHuffman(symbols: number[]): HuffmanTree {
        if (symbols.length === 1) {
            return { codes: [{ symbol: symbols[0], length: 0, code: 0 }], maxLength: 0 };
        }

        return {
            codes: [
                { symbol: symbols[0], length: 1, code: 0 },
                { symbol: symbols[1], length: 1, code: 1 }
            ],
            maxLength: 1
        };
    }

    /**
     * Build Huffman tree from code lengths using canonical Huffman code algorithm
     */
    buildHuffmanTree(codeLengths: number[]): HuffmanTree {
        // Filter out invalid values and find the max length
        const validLengths = codeLengths.filter(len => len > 0 && Number.isFinite(len));
        const maxLength = validLengths.length > 0 ? Math.max(...validLengths) : 0;
        const codes: HuffmanCode[] = [];

        if (maxLength === 0) {
            return { codes: [], maxLength: 0, lookupTable: new Map() };
        }

        const bl_count = new Array(maxLength + 1).fill(0);
        const next_code = new Array(maxLength + 1).fill(0);

        // Count codes per length
        for (const len of codeLengths) {
            if (len > 0 && Number.isFinite(len)) bl_count[len]++;
        }

        // Calculate starting codes for each length
        next_code[1] = 0;
        for (let bits = 2; bits <= maxLength; bits++) {
            next_code[bits] = (next_code[bits - 1] + bl_count[bits - 1]) << 1;
        }

        // Assign codes to symbols
        const lookupTable = new Map<number, number>();
        for (let n = 0; n < codeLengths.length; n++) {
            const len = codeLengths[n];
            if (len > 0 && Number.isFinite(len)) {
                const codeValue = next_code[len];
                codes.push({ symbol: n, length: len, code: codeValue });
                // Create lookup key using a bit shift approach
                // Store as (code << 4) | length for fast lookup
                const key = (codeValue << 4) | len;
                lookupTable.set(key, n);
                next_code[len]++;
            }
        }

        return { codes, maxLength, lookupTable };
    }

    /**
     * Read a symbol from the bitstream using the Huffman tree
     */
    readSymbol(br: BitReader, tree: HuffmanTree): number {
        if (tree.maxLength === 0) {
            return tree.codes[0].symbol;
        }

        // Use lookup table for O(1) access
        if (tree.lookupTable) {
            let code = 0;
            for (let i = 0; i < tree.maxLength; i++) {
                code = (code << 1) | br.readBits(1);
                // Check if this code with the current length exists
                const key = (code << 4) | (i + 1);
                const symbol = tree.lookupTable.get(key);
                if (symbol !== undefined) {
                    return symbol;
                }
            }
        }

        // Fallback to linear search through codes
        for (const codeInfo of tree.codes) {
            let code = 0;
            for (let i = 0; i < codeInfo.length; i++) {
                code = (code << 1) | br.readBits(1);
            }
            if (code === codeInfo.code) {
                return codeInfo.symbol;
            }
        }

        // If no symbol is found, return 0 as fallback
        // This prevents the decoder from failing completely
        return 0;
    }
}
