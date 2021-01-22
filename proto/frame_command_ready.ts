import { Decoder, Encoder } from "../misc/mod.ts";
import { FLAG_COMMAND, Frame } from "./frame.ts";
import { CommandName } from "./frame_command.ts";

export interface Builder {
  set(key: string, value: string): Builder;
  build(): ReadyCommandFrame;
}

export class ReadyCommandFrame extends Frame {
  static builder(): Builder {
    return new BuilderImpl();
  }

  get metadata(): string[] {
    const offset = this.getPayloadOffset() + 1 + CommandName.Ready.length;
    const res = [];
    const dec = new Decoder(this.body);
    for (let cursor = offset; cursor < dec.length;) {
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

  toString(): string {
    const obj: { [key: string]: string } = {};
    const metadata = this.metadata;
    for (let i = 1; i < metadata.length; i += 2) {
      obj[metadata[i - 1]] = metadata[i];
    }
    return JSON.stringify(obj);
  }
}

class BuilderImpl implements Builder {
  #metadata: Array<string> = [];

  set(key: string, value: string): Builder {
    this.#metadata.push(key);
    this.#metadata.push(value);
    return this;
  }

  build(): ReadyCommandFrame {
    const payloadSize = 1 + CommandName.Ready.length +
      this.#metadata.map((v, i) => v.length + (i % 2 === 0 ? 1 : 4)).reduce(
        (a, b) => a + b,
        0,
      );
    const encoder = new Encoder(1 + 1 + payloadSize);
    // write flag
    encoder.writeByte(FLAG_COMMAND);
    // write payload len
    encoder.writeByte(payloadSize);
    // write command name len
    encoder.writeByte(CommandName.Ready.length);
    // write command name
    encoder.writeString(CommandName.Ready);
    // write metadata
    this.#metadata.forEach((it, i) => {
      const len = it.length;
      if (i % 2 === 0) {
        encoder.writeByte(len);
      } else {
        encoder.writeUint32(len);
      }
      encoder.writeString(it);
    });
    return new ReadyCommandFrame(encoder.freeze());
  }
}
