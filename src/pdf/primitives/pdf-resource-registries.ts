import type {
    PdfObjectRef,
    PdfFontResource,
    PdfImageResource,
    PdfExtGStateResource,
    PdfShadingResource,
    PdfPatternResource,
    PdfRegisteredObject,
    PdfRegisteredStream,
} from "./pdf-types.js";

/**
 * Registry for standard Type1 PDF fonts.
 * Handles font registration with deduplication by base font name.
 */
export class FontRegistry {
    private readonly fonts = new Map<string, PdfFontResource>();

    register(baseFont: string): PdfObjectRef {
        const existing = this.fonts.get(baseFont);
        if (existing) {
            return existing.objectRef!;
        }
        const objectRef: PdfObjectRef = { objectNumber: -1 };
        this.fonts.set(baseFont, { name: baseFont, baseFont, objectRef });
        return objectRef;
    }

    getAll(): PdfFontResource[] {
        return Array.from(this.fonts.values());
    }
}

/**
 * Registry for image resources.
 * Handles image registration with deduplication and PNG alpha channel separation.
 */
export class ImageRegistry {
    private readonly images: PdfImageResource[] = [];

    register(image: {
        src: string;
        width: number;
        height: number;
        format: "jpeg" | "png" | "gif" | "webp";
        channels: number;
        bitsPerComponent: number;
        data: Uint8Array;
    }): PdfObjectRef {
        const expectedColorSpace =
            image.channels === 1
                ? "DeviceGray"
                : "DeviceRGB";
        const expectsSoftMask = image.format === "png" && image.channels === 4;
        const expectedBitsPerComponent = expectsSoftMask ? 8 : image.bitsPerComponent;

        // Deduplicate by src when provided
        if (image.src) {
            for (const existing of this.images) {
                if (
                    existing.src === image.src &&
                    existing.width === image.width &&
                    existing.height === image.height &&
                    existing.colorSpace === expectedColorSpace &&
                    existing.bitsPerComponent === expectedBitsPerComponent &&
                    Boolean(existing.sMask) === expectsSoftMask
                ) {
                    return existing.ref;
                }
            }
        }

        // Handle PNG with alpha channel - split into RGB + SMask
        if (expectsSoftMask) {
            return this.registerPngWithAlpha(image);
        }

        // Regular image registration
        const filter = image.format === "jpeg" ? "DCTDecode" : undefined;
        const ref: PdfObjectRef = { objectNumber: -1 };

        this.images.push({
            ref,
            src: image.src,
            width: image.width,
            height: image.height,
            colorSpace: expectedColorSpace,
            bitsPerComponent: image.bitsPerComponent,
            filter,
            data: image.data.slice(),
            sMask: undefined,
        });

        return ref;
    }

    private registerPngWithAlpha(image: {
        src: string;
        width: number;
        height: number;
        data: Uint8Array;
    }): PdfObjectRef {
        const rgbData = new Uint8Array(image.width * image.height * 3);
        const alphaData = new Uint8Array(image.width * image.height);

        for (let i = 0, j = 0, k = 0; i < image.data.length; i += 4, j += 3, k++) {
            rgbData[j] = image.data[i];
            rgbData[j + 1] = image.data[i + 1];
            rgbData[j + 2] = image.data[i + 2];
            alphaData[k] = image.data[i + 3];
        }

        // Register alpha mask first
        const sMaskRef: PdfObjectRef = { objectNumber: -1 };
        this.images.push({
            ref: sMaskRef,
            src: image.src,
            width: image.width,
            height: image.height,
            colorSpace: "DeviceGray",
            bitsPerComponent: 8,
            data: alphaData,
            sMask: undefined,
        });

        // Register RGB image with reference to alpha mask
        const ref: PdfObjectRef = { objectNumber: -1 };
        this.images.push({
            ref,
            src: image.src,
            width: image.width,
            height: image.height,
            colorSpace: "DeviceRGB",
            bitsPerComponent: 8,
            data: rgbData,
            sMask: sMaskRef,
        });

        return ref;
    }

    getAll(): PdfImageResource[] {
        return this.images;
    }
}

/**
 * Registry for ExtGState (graphics state) resources.
 * Handles registration with deduplication by alpha value.
 */
export class ExtGStateRegistry {
    private readonly states = new Map<string, PdfExtGStateResource>();

    register(alpha: number): PdfObjectRef {
        const normalized = this.clampAlpha(alpha);
        const key = normalized.toFixed(4);
        const existing = this.states.get(key);

        if (existing) {
            return existing.ref;
        }

        const ref: PdfObjectRef = { objectNumber: -1 };
        this.states.set(key, { ref, alpha: normalized });
        return ref;
    }

    private clampAlpha(value: number): number {
        if (!Number.isFinite(value)) return 1;
        if (value <= 0) return 0;
        if (value >= 1) return 1;
        return value;
    }

    getAll(): PdfExtGStateResource[] {
        return Array.from(this.states.values());
    }
}

/**
 * Registry for shading resources.
 * Handles registration with deduplication by name.
 */
export class ShadingRegistry {
    private readonly shadings = new Map<string, PdfShadingResource>();

    register(name: string, dict: string): PdfObjectRef {
        const existing = this.shadings.get(name);
        if (existing) {
            return existing.ref;
        }

        const ref: PdfObjectRef = { objectNumber: -1 };
        this.shadings.set(name, { ref, dict });
        return ref;
    }

    getAll(): PdfShadingResource[] {
        return Array.from(this.shadings.values());
    }
}

/**
 * Registry for pattern resources.
 * Handles registration with deduplication by name.
 */
export class PatternRegistry {
    private readonly patterns = new Map<string, PdfPatternResource>();

    register(name: string, dict: string): PdfObjectRef {
        const existing = this.patterns.get(name);
        if (existing) {
            return existing.ref;
        }

        const ref: PdfObjectRef = { objectNumber: -1 };
        this.patterns.set(name, { ref, dict });
        return ref;
    }

    getAll(): PdfPatternResource[] {
        return Array.from(this.patterns.values());
    }
}

/**
 * Generic registry for custom PDF objects.
 * Stores arbitrary values to be serialized later.
 */
export class ObjectRegistry {
    private readonly objects: PdfRegisteredObject[] = [];

    register(value: string | Record<string, unknown> | readonly unknown[] | object): PdfObjectRef {
        const ref = { objectNumber: -1 };
        this.objects.push({ ref, value });
        return ref;
    }

    getAll(): PdfRegisteredObject[] {
        return this.objects;
    }
}

/**
 * Registry for stream objects with custom headers.
 */
export class StreamRegistry {
    private readonly streams: PdfRegisteredStream[] = [];

    register(data: Uint8Array, headers: Record<string, string> = {}): PdfObjectRef {
        const ref = { objectNumber: -1 };
        this.streams.push({ ref, data, headers });
        return ref;
    }

    getAll(): PdfRegisteredStream[] {
        return this.streams;
    }
}
