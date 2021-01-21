import { Decoder, Encoder } from "../codec.ts";
import { TEXT_ENCODER, UTF8_DECODER } from "../misc.ts";
import { FLAG_LONG, FLAG_MORE, Frame } from "./frame.ts";

export interface Builder {
  hasMore(more?: boolean): Builder;
  payload(data: Uint8Array | string): Builder;
  build(): DataFrame;
}

export class DataFrame extends Frame {
  static builder(): Builder {
    return new DataBuilder();
  }

  get payload(): Uint8Array {
    const isLong = (this.flags & FLAG_LONG) !== 0;
    const dec = new Decoder(this.body);
    let n = 0;
    let offset = 1;
    if (isLong) {
      n = Number(dec.readUint64(offset));
      offset += 4;
    } else {
      n = dec.readByte(offset);
      offset++;
    }
    return dec.readUint8Array(n, offset);
  }
}

export class DataBuilder implements Builder {
  #more = false;
  #data?: Uint8Array;

  payload(data: string | Uint8Array): Builder {
    if (data instanceof Uint8Array) {
      this.#data = data;
    } else if (typeof data === "string") {
      this.#data = TEXT_ENCODER.encode(data);
    }
    return this;
  }

  hasMore(more = true): Builder {
    this.#more = more;
    return this;
  }

  build(): DataFrame {
    let flag = 0;
    if (this.#more) {
      flag |= FLAG_MORE;
    }
    let enc;
    const len = this.#data?.length || 0;
    if (len > 0xFF) {
      flag |= FLAG_LONG;
      enc = new Encoder(1 + 8 + len);
      enc.writeByte(flag);
      enc.writeUint64(BigInt(len));
    } else {
      enc = new Encoder(1 + 1 + len);
      enc.writeByte(flag);
      enc.writeByte(len);
    }
    if (len > 0) {
      enc.writeUint8Array(this.#data!);
    }
    return new DataFrame(enc.freeze());
  }
}
