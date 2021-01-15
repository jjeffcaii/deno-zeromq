import { FLAG_LONG, Frame, Greeting } from "./frame.ts";
import { BufReader, BufWriter } from "../deps.ts";
import { EOFError } from "../errors.ts";

export interface FrameReader {
  [Symbol.asyncIterator](): AsyncIterableIterator<Frame | Greeting>;
}

export interface FrameWriter {
  write(message: Greeting | Frame): Promise<number>;

  flush(): Promise<void>;
}

export function createReader(conn: Deno.Conn): FrameReader {
  return new FrameReaderImpl(new BufReader(conn));
}

export function createWriter(conn: Deno.Conn): FrameWriter {
  return new FrameWriterImpl(new BufWriter(conn));
}

class FrameWriterImpl implements FrameWriter {
  constructor(private writer: BufWriter) {
  }

  flush(): Promise<void> {
    return this.writer.flush();
  }

  write(message: Greeting | Frame): Promise<number> {
    let b: Uint8Array;
    if (message instanceof Greeting) {
      b = message.bytes();
    } else {
      b = message.bytes();
    }
    return this.writer.write(b);
  }
}

class FrameReaderImpl implements FrameReader {
  constructor(private reader: BufReader) {
  }

  [Symbol.asyncIterator](): AsyncIterableIterator<Greeting | Frame> {
    return FrameReaderImpl.iter(this.reader);
  }

  static async readGreeting(reader: BufReader): Promise<Greeting> {
    const b = new Uint8Array(Greeting.SIZE);
    if (await reader.readFull(b) === null) throw new EOFError();
    return new Greeting(b);
  }

  static async readFrame(reader: BufReader): Promise<Frame> {
    const b = await reader.peek(2);
    if (b === null) throw new EOFError();
    const flag = b[0];

    let size = 1;
    if ((flag & FLAG_LONG) === 0) {
      size += 1 + b[1];
    } else {
      // TODO:
    }
    const body = new Uint8Array(size);
    if (await reader.readFull(body) === null) throw new EOFError();
    return new Frame(body);
  }

  static async *iter(reader: BufReader) {
    for (;;) {
      const first = await reader.peek(1);
      if (first === null) throw new EOFError();
      if (first[0] === 0xFF) {
        yield await FrameReaderImpl.readGreeting(reader);
      } else {
        yield await FrameReaderImpl.readFrame(reader);
      }
    }
  }
}
