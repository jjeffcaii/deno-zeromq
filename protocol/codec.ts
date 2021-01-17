import { FLAG_LONG, Frame, Greeting } from "./frame.ts";
import { BufReader, BufWriter } from "../deps.ts";
import { EOFError } from "../errors.ts";

export enum SocketType {
  REQ = "REQ",
  REP = "REP",
}

export interface Connection {
  [Symbol.asyncIterator](): AsyncIterableIterator<Frame | Greeting>;

  write(message: Greeting | Frame): Promise<number>;

  read(): Promise<Greeting | Frame>;

  flush(): Promise<void>;
}

export const createConnection = (
  reader: BufReader,
  writer: BufWriter,
): Connection => {
  return new ConnectionImpl(reader, writer);
};

const readGreeting = async (reader: BufReader): Promise<Greeting> => {
  const b = new Uint8Array(Greeting.SIZE);
  if (await reader.readFull(b) === null) throw new EOFError();
  return new Greeting(b);
};

const readFrame = async (reader: BufReader): Promise<Frame> => {
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
};

const readOnce = async (reader: BufReader): Promise<Greeting | Frame> => {
  const first = await reader.peek(1);
  if (first === null) throw new EOFError();
  return first[0] === 0xFF
    ? await readGreeting(reader)
    : await readFrame(reader);
};

async function* iter(reader: BufReader) {
  for (;;) {
    yield await readOnce(reader);
  }
}

class ConnectionImpl implements Connection {
  constructor(private reader: BufReader, private writer: BufWriter) {
  }

  [Symbol.asyncIterator](): AsyncIterableIterator<Greeting | Frame> {
    return iter(this.reader);
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

  read(): Promise<Greeting | Frame> {
    return readOnce(this.reader);
  }
}
