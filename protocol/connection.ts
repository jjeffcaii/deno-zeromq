import { FLAG_LONG, Frame } from "./frame.ts";
import { Greeting } from "./greeting.ts";
import { BufReader, BufWriter } from "../deps.ts";
import { EOFError } from "../errors.ts";

export interface Connection {
  [Symbol.asyncIterator](): AsyncIterableIterator<Frame>;

  write(message: Greeting | Frame | Uint8Array): Promise<number>;

  peekSignature(): Promise<Uint8Array>;

  peekVersionMajor(): Promise<number>;

  readGreeting(): Promise<Greeting>;

  read(): Promise<Frame>;

  flush(): Promise<void>;

  close(): Promise<void>;

  onClose(handler: (c: Connection) => void): void;
}

export type Closer = () => Promise<void>;

export const createConnection = (
  reader: BufReader,
  writer: BufWriter,
  closer?: Closer,
): Connection => {
  return new ConnectionImpl(reader, writer, closer);
};

const readGreeting = async (reader: BufReader): Promise<Greeting> => {
  const b = new Uint8Array(Greeting.SIZE);
  if (await reader.readFull(b) === null) throw new EOFError();
  return new Greeting(b);
};

const readFrame = async (reader: BufReader): Promise<Frame> => {
  let b = await reader.peek(2);
  if (b === null) throw new EOFError();
  const flag = b[0];

  let size = 1;
  if ((flag & FLAG_LONG) === 0) {
    size += 1 + b[1];
  } else {
    b = await reader.peek(10);
    if (b === null) throw new EOFError();
    size += 8 + Number(new DataView(b.buffer).getBigUint64(2));
  }
  const body = new Uint8Array(size);
  if (await reader.readFull(body) === null) throw new EOFError();
  return new Frame(body);
};

async function* genFrames(reader: BufReader): AsyncIterableIterator<Frame> {
  for (;;) {
    yield await readFrame(reader);
  }
}

class ConnectionImpl implements Connection {
  #onClose?: (c: Connection) => void;
  #sig?: Uint8Array;
  #major?: number;

  constructor(
    private reader: BufReader,
    private writer: BufWriter,
    private closer?: Closer,
  ) {
  }

  async close(): Promise<void> {
    await this.closer?.();
  }

  async peekVersionMajor(): Promise<number> {
    if (this.#major) return this.#major;
    const b = await this.reader.peek(11);
    if (b == null) throw new EOFError();
    this.#major = b[10];
    return this.#major;
  }

  readGreeting(): Promise<Greeting> {
    return readGreeting(this.reader);
  }

  async peekSignature(): Promise<Uint8Array> {
    if (this.#sig) return this.#sig;
    const res = await this.reader.peek(10);
    if (res === null) throw new EOFError();
    this.#sig = res;
    return res;
  }

  onClose(handler: (c: Connection) => void): void {
    this.#onClose = handler;
  }

  flush(): Promise<void> {
    return this.writer.flush();
  }

  write(message: Greeting | Frame | Uint8Array): Promise<number> {
    let b: Uint8Array;
    if (message instanceof Greeting) {
      b = message.bytes();
    } else if (message instanceof Frame) {
      b = message.bytes();
    } else {
      b = message;
    }
    return this.writer.write(b);
  }

  async read(): Promise<Frame> {
    try {
      return await readFrame(this.reader);
    } catch (e) {
      if (this.#onClose) {
        const fn = this.#onClose;
        this.#onClose = undefined;
        fn(this);
      }
      throw e;
    }
  }

  [Symbol.asyncIterator](): AsyncIterableIterator<Frame> {
    return genFrames(this.reader);
  }
}
