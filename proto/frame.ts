import { Decoder } from "../misc/mod.ts";

export const FLAG_COMMAND = 1 << 2;
export const FLAG_LONG = 1 << 1;
export const FLAG_MORE = 1;

export enum FrameType {
  Command,
  Message,
}

export class Frame {
  static EMPTY_HAS_MORE: Frame = new Frame(new Uint8Array([FLAG_MORE, 0]));

  constructor(protected body: Uint8Array) {
  }

  get flags(): number {
    return this.body[0];
  }

  get size(): number {
    const dec = new Decoder(this.body);
    if ((this.flags & FLAG_LONG) !== 0) {
      return Number(dec.readUint64(1));
    } else {
      return dec.readByte(1);
    }
  }

  get type(): FrameType {
    const isCommand = (this.flags & FLAG_COMMAND) !== 0;
    return isCommand ? FrameType.Command : FrameType.Message;
  }

  protected getPayloadOffset(): number {
    return 1 + ((this.flags & FLAG_LONG) !== 0 ? 8 : 1);
  }

  more(): boolean {
    return (this.flags & FLAG_MORE) !== 0;
  }

  bytes(): Uint8Array {
    return this.body;
  }
}
