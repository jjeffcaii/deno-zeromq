import { log } from "../deps.ts";
import { Decoder, Encoder } from "../buffer.ts";
import { Buffer } from "https://deno.land/std@0.80.0/node/buffer.ts";

export const FLAG_COMMAND = 1 << 2;
export const FLAG_LONG = 1 << 1;
export const FLAG_MORE = 1;

const TEXT_ENCODER = new TextEncoder();
const TEXT_DECODER = new TextDecoder();

export enum CommandType {
  Ready = "READY",
  Error = "ERROR",
}

export class Greeting {
  public static SIZE = 64;

  constructor(private body: Uint8Array) {
  }

  static mock(isMaster?: boolean): Greeting {
    const b = new Uint8Array(Greeting.SIZE);
    b[0] = 0xFF;
    b[8] = 0x01;
    b[9] = 0x7F;
    b[10] = 0x03;

    b[12] = 0x4E;
    b[13] = 0x55;
    b[14] = 0x4C;
    b[15] = 0x4C;

    // is master
    if (isMaster) {
      b[32] = 0x01;
    }

    return new Greeting(b);
  }

  bytes(): Uint8Array {
    return this.body;
  }

  get signature(): Uint8Array {
    return this.body.subarray(0, 10);
  }

  get version(): { major: number; minor: number } {
    const major: number = this.body[10];
    const minor: number = this.body[11];
    return { major, minor };
  }

  get securityMechism(): Uint8Array {
    return this.body.subarray(12, 32);
  }

  get isServer(): boolean {
    return this.body[32] !== 0;
  }

  public toString = (): string => {
    return `signature=${this.signature},version=${this.version.major}.${this.version.minor}`;
  };
}

export enum FrameType {
  Command,
  Message,
}

export class Frame {
  static builder(): FrameBuilder {
    return new FrameBuilder();
  }

  static EMPTY_HAS_MORE: Frame = new Frame(new Uint8Array([FLAG_MORE, 0]));

  constructor(private body: Uint8Array) {
  }

  get flags(): number {
    return this.body[0];
  }

  bytes(): Uint8Array {
    return this.body;
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

  get type(): FrameType {
    const isCommand = (this.flags & FLAG_COMMAND) !== 0;
    return isCommand ? FrameType.Command : FrameType.Message;
  }

  private isLong(): boolean {
    return (this.flags & FLAG_LONG) !== 0;
  }

  private isMore(): boolean {
    return (this.flags & FLAG_MORE) !== 0;
  }

  private getPayloadOffset(): number {
    return 1 + (this.isLong() ? 8 : 1);
  }

  get command(): Command {
    const offset = this.getPayloadOffset();
    return new Command(this.body.subarray(offset));
  }
}

class FrameBuilder {
  command(): CommandBuilder {
    return new CommandBuilder();
  }

  data(data: string | Uint8Array): DataBuilder {
    if (data instanceof Uint8Array) {
      return new DataBuilder(data);
    }
    if (typeof data === "string") {
      return new DataBuilder(TEXT_ENCODER.encode(data as string));
    }
    throw new Error("invalid data type");
  }
}

class DataBuilder {
  private more = false;

  constructor(private data: Uint8Array) {
  }

  hasMore(more = true): DataBuilder {
    this.more = more;
    return this;
  }

  build(): Frame {
    let flag = 0;
    if (this.more) {
      flag |= FLAG_MORE;
    }
    let enc;
    const len = this.data.length;
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
    enc.writeUint8Array(this.data);
    return new Frame(enc.freeze());
  }
}

class CommandBuilder {
  ready(...kvPairs: string[]): ReadyCommandBuilder {
    return new ReadyCommandBuilder(kvPairs);
  }
}

class ReadyCommandBuilder {
  constructor(private kv: string[]) {
  }

  build(): Frame {
    const payloadSize = 1 + CommandType.Ready.length +
      this.kv.map((v, i) => v.length + (i % 2 === 0 ? 1 : 4)).reduce(
        (a, b) => a + b,
        0,
      );
    const encoder = new Encoder(1 + 1 + payloadSize);
    // write flag
    encoder.writeByte(FLAG_COMMAND);
    // write payload len
    encoder.writeByte(payloadSize);
    // write command name len
    encoder.writeByte(CommandType.Ready.length);
    // write command name
    encoder.writeString(CommandType.Ready);
    // write metadata
    this.kv.forEach((it, i) => {
      const len = it.length;
      if (i % 2 === 0) {
        encoder.writeByte(len);
      } else {
        encoder.writeUint32(len);
      }
      encoder.writeString(it);
    });
    return new Frame(encoder.freeze());
  }
}

export class Command {
  constructor(private body: Uint8Array) {
  }

  get name(): string {
    const commandNameSize = this.body[0];
    const name = this.body.subarray(1, 1 + commandNameSize);
    return TEXT_DECODER.decode(name);
  }

  get ready(): Ready {
    return new Ready(this.body.subarray(6));
  }
}

export class Ready {
  constructor(private body: Uint8Array) {
  }

  get metadata(): string[] {
    const res = [];
    const dec = new Decoder(this.body);
    for (let cursor = 0; cursor < dec.length;) {
      let n = 0;
      if (res.length % 2 === 0) {
        n = dec.readByte(cursor);
        cursor++;
      } else {
        n = dec.readUint32(cursor);
        cursor += 4;
      }
      res.push(dec.readString(n, cursor));
      cursor += n;
    }
    return res;
  }

  public toString = (): string => {
    return this.metadata.toString();
  };
}
