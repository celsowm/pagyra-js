
export class BinaryWriter {
    private buffer: Uint8Array;
    private view: DataView;
    private offset: number;

    constructor(initialSize: number = 1024) {
        this.buffer = new Uint8Array(initialSize);
        this.view = new DataView(this.buffer.buffer);
        this.offset = 0;
    }

    ensureSize(size: number) {
        if (this.offset + size > this.buffer.length) {
            const newSize = Math.max(this.buffer.length * 2, this.offset + size);
            const newBuffer = new Uint8Array(newSize);
            newBuffer.set(this.buffer);
            this.buffer = newBuffer;
            this.view = new DataView(this.buffer.buffer);
        }
    }

    writeUint8(value: number) {
        this.ensureSize(1);
        this.view.setUint8(this.offset, value);
        this.offset += 1;
    }

    writeInt8(value: number) {
        this.ensureSize(1);
        this.view.setInt8(this.offset, value);
        this.offset += 1;
    }

    writeUint16(value: number) {
        this.ensureSize(2);
        this.view.setUint16(this.offset, value, false);
        this.offset += 2;
    }

    writeInt16(value: number) {
        this.ensureSize(2);
        this.view.setInt16(this.offset, value, false);
        this.offset += 2;
    }

    writeUint32(value: number) {
        this.ensureSize(4);
        this.view.setUint32(this.offset, value, false);
        this.offset += 4;
    }

    writeInt32(value: number) {
        this.ensureSize(4);
        this.view.setInt32(this.offset, value, false);
        this.offset += 4;
    }

    writeFixed(value: number) {
        const integer = Math.floor(value);
        const fraction = Math.floor((value - integer) * 65536);
        this.writeInt16(integer);
        this.writeUint16(fraction);
    }

    writeString(value: string) {
        const encoded = new TextEncoder().encode(value);
        this.writeBytes(encoded);
    }

    writeBytes(bytes: Uint8Array) {
        this.ensureSize(bytes.length);
        this.buffer.set(bytes, this.offset);
        this.offset += bytes.length;
    }

    getData(): Uint8Array {
        return this.buffer.subarray(0, this.offset);
    }

    byteLength(): number {
        return this.offset;
    }
}
