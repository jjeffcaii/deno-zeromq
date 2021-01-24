import { FLAG_LONG, Frame, Greeting } from "../proto/mod.ts";
import { BufReader, BufWriter, log } from "../deps.ts";
import { EOFError } from "../errors.ts";

export interface Connection {
  [Symbol.asyncIterator](): AsyncIterableIterator<Frame>;

  setTag(tag: string): Connection;

  hasTag(tag: string): boolean;

  listTags(): Set<string> | undefined;

  write(message: Greeting | Frame | Uint8Array): Promise<number>;

  peekSignature(): Promise<Uint8Array>;

  peekVersionMajor(): Promise<number>;

  readGreeting(): Promise<Greeting>;

  read(): Promise<Frame>;

  flush(): Promise<void>;

  close(): void;

  onceClose(handler: () => void): void;
}

export const createConnection = (conn: Deno.Conn): Connection => {
  return new ConnectionImpl(conn);
};

class ConnectionImpl implements Connection {
  #conn: Deno.Conn;
  #reader: BufReader;
  #writer: BufWriter;
  #closeHandlers?: Array<() => void>;
  #sig?: Uint8Array;
  #major?: number;
  #tags?: Set<string>;

  constructor(rawConn: Deno.Conn) {
    this.#conn = rawConn;
    this.#reader = new BufReader(rawConn);
    this.#writer = new BufWriter(rawConn);
  }

  listTags(): Set<string> | undefined {
    return this.#tags;
  }

  setTag(tag: string): Connection {
    if (!this.#tags) {
      this.#tags = new Set([tag]);
    } else {
      this.#tags?.add(tag);
    }
    return this;
  }

  hasTag(tag: string): boolean {
    return !!this.#tags?.has(tag);
  }

  close(): void {
    this.#conn.close();
  }

  async peekVersionMajor(): Promise<number> {
    if (this.#major) return this.#major;
    try {
      const b = await this.#reader.peek(11);
      if (b == null) throw new EOFError();
      this.#major = b[10];
      return this.#major;
    } catch (e) {
      this.notifyClose();
      throw e;
    }
  }

  async readGreeting(): Promise<Greeting> {
    try {
      const b = new Uint8Array(Greeting.SIZE);
      if (await this.#reader.readFull(b) === null) throw new EOFError();
      return new Greeting(b);
    } catch (e) {
      this.notifyClose();
      throw e;
    }
  }

  async peekSignature(): Promise<Uint8Array> {
    try {
      if (this.#sig) return this.#sig;
      const res = await this.#reader.peek(10);
      if (res === null) throw new EOFError();
      this.#sig = res;
      return res;
    } catch (e) {
      this.notifyClose();
      throw e;
    }
  }

  onceClose(handler: () => void): void {
    if (!this.#closeHandlers) {
      this.#closeHandlers = [handler];
    } else {
      this.#closeHandlers.push(handler);
    }
  }

  flush(): Promise<void> {
    return this.#writer.flush();
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
    return this.#writer.write(b)
      .catch((reason) => {
        this.notifyClose();
        throw reason;
      });
  }

  async read(): Promise<Frame> {
    try {
      let b = await this.#reader.peek(2);
      if (b === null) throw new EOFError();
      const flag = b[0];

      let size = 1;
      if ((flag & FLAG_LONG) === 0) {
        size += 1 + b[1];
      } else {
        b = await this.#reader.peek(10);
        if (b === null) throw new EOFError();
        size += 8 + Number(new DataView(b.buffer).getBigUint64(2));
      }
      const body = new Uint8Array(size);
      if (await this.#reader.readFull(body) === null) throw new EOFError();
      return new Frame(body);
    } catch (e) {
      this.notifyClose();
      throw e;
    }
  }

  private notifyClose() {
    while (true) {
      const fn = this.#closeHandlers?.shift();
      if (!fn) break;
      try {
        fn();
      } catch (e) {
        log.error(`exec onceClose failed: ${e}`);
      }
    }
  }

  private async *iter(): AsyncIterableIterator<Frame> {
    for (;;) {
      try {
        yield await this.read();
      } catch (e) {
        this.notifyClose();
        throw e;
      }
    }
  }

  [Symbol.asyncIterator](): AsyncIterableIterator<Frame> {
    return this.iter();
  }
}
