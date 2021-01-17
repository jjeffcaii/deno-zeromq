import { Frame } from "./protocol/frame.ts";

const TEXT_ENCODER = new TextEncoder();
const TEXT_DECODER = new TextDecoder();

export class Decoder {
  constructor(private b: Uint8Array) {
  }

  get length(): number {
    return this.b.length;
  }

  readByte(offset = 0): number {
    return this.b[offset];
  }

  readUint32(offset = 0): number {
    return new DataView(this.b.buffer).getUint32(offset);
  }

  readInt32(offset = 0): number {
    return new DataView(this.b.buffer).getInt32(offset);
  }

  readInt16(offset = 0): number {
    return new DataView(this.b.buffer).getInt16(offset);
  }

  readUint16(offset = 0): number {
    return new DataView(this.b.buffer).getUint16(offset);
  }

  readUint8Array(len: number, offset = 0): Uint8Array {
    return this.b.subarray(offset, offset + len);
  }

  readString(len: number, offset = 0, dec = TEXT_DECODER): string {
    return dec.decode(this.readUint8Array(len, offset));
  }
}

export class Encoder {
  private cursor = 0;
  private b: Uint8Array;

  constructor(cap: number) {
    this.b = new Uint8Array(cap);
  }

  freeze(): Uint8Array {
    return this.cursor === this.b.length
      ? this.b
      : this.b.subarray(0, this.cursor);
  }

  writeByte(value: number) {
    this.b[this.cursor++] = value & 0xFF;
  }

  writeUint64(value: bigint) {
    new DataView(this.b.buffer).setBigUint64(this.cursor, value);
    this.cursor += 8;
  }

  writeInt64(value: bigint) {
    new DataView(this.b.buffer).setBigInt64(this.cursor, value);
    this.cursor += 8;
  }

  writeUint32(value: number) {
    new DataView(this.b.buffer).setUint32(this.cursor, value);
    this.cursor += 4;
  }

  writeInt32(value: number) {
    new DataView(this.b.buffer).setInt32(this.cursor, value);
    this.cursor += 4;
  }

  writeUint16(value: number) {
    new DataView(this.b.buffer).setUint16(this.cursor, value);
    this.cursor += 2;
  }

  writeInt16(value: number) {
    new DataView(this.b.buffer).setInt16(this.cursor, value);
    this.cursor += 2;
  }

  writeString(value: string, enc: TextEncoder = TEXT_ENCODER) {
    if (!value) return;
    const { written } = enc.encodeInto(value, this.b.subarray(this.cursor));
    this.cursor += written;
  }

  writeUint8Array(value: Uint8Array) {
    this.b.set(value, this.cursor);
    this.cursor += value.length;
  }
}
