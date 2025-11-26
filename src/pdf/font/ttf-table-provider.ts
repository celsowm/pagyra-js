/**
 * TrueType table provider interfaces.
 * 
 * These interfaces are segregated following the Interface Segregation Principle (ISP).
 * Clients can depend only on the interfaces they actually need.
 */

/**
 * Provides access to TrueType font tables.
 */
export interface TableProvider {
    /**
     * Retrieves a font table by its 4-byte tag.
     * @param tag - Table tag as a 32-bit integer (e.g., 0x676c7966 for 'glyf')
     * @returns DataView of the table data, or null if table doesn't exist
     */
    getTable(tag: number): DataView | null;
}

/**
 * Provides methods for reading binary data from DataViews.
 * Abstracts the byte-order and offset calculations.
 */
export interface DataViewReader {
    getUint16(view: DataView, offset: number): number;
    getUint32(view: DataView, offset: number): number;
    getInt16(view: DataView, offset: number): number;
    getInt8(view: DataView, offset: number): number;
    getUint8(view: DataView, offset: number): number;
}

/**
 * Combined interface for backward compatibility.
 * Provides both table access and binary reading capabilities.
 */
export interface GlyphTableProvider extends TableProvider, DataViewReader { }

/**
 * Default implementation of DataViewReader using big-endian byte order (TrueType standard).
 */
export class DefaultDataViewReader implements DataViewReader {
    getUint16(view: DataView, offset: number): number {
        return view.getUint16(offset, false);
    }

    getUint32(view: DataView, offset: number): number {
        return view.getUint32(offset, false);
    }

    getInt16(view: DataView, offset: number): number {
        return view.getInt16(offset, false);
    }

    getInt8(view: DataView, offset: number): number {
        return view.getInt8(offset);
    }

    getUint8(view: DataView, offset: number): number {
        return view.getUint8(offset);
    }
}
