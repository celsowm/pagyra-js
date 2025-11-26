import type { PdfObjectRef } from "./pdf-types.js";

/**
 * Manages PDF object reference assignment and numbering.
 * 
 * This class follows the Single Responsibility Principle by handling
 * only object reference creation and number assignment.
 */
export class PdfReferenceManager {
    private currentObjectNumber = 1;

    /**
     * Creates a new PDF object reference with an unassigned object number.
     * The actual number will be assigned later by ensureRefNumber().
     */
    createRef(): PdfObjectRef {
        return { objectNumber: -1 };
    }

    /**
     * Ensures the given reference has a valid object number.
     * If the reference already has a number, it updates the internal counter.
     * Otherwise, it assigns the next available number.
     */
    ensureRefNumber(ref: PdfObjectRef): PdfObjectRef {
        if (ref.objectNumber <= 0) {
            ref.objectNumber = this.currentObjectNumber++;
        } else if (ref.objectNumber >= this.currentObjectNumber) {
            this.currentObjectNumber = ref.objectNumber + 1;
        }
        return ref;
    }

    /**
     * Returns the next available object number without incrementing.
     */
    getNextObjectNumber(): number {
        return this.currentObjectNumber;
    }

    /**
     * Returns the current total count of objects (for PDF size field).
     */
    getObjectCount(): number {
        return this.currentObjectNumber;
    }
}
