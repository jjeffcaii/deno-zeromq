import { bind, Connection, ServerTransport } from "../transport/mod.ts";
import { MessageLike, Sender, SocketType } from "../types.ts";
import { log } from "../deps.ts";
import {
  CommandFrame,
  CommandName,
  DataFrame,
  Frame,
  FrameType,
  Greeting,
  ReadyCommandFrame,
} from "../proto/mod.ts";
import { METADATA_KEY_SOCKET_TYPE } from "../consts.ts";
import { Unbounded } from "../misc/mod.ts";
import { EOFError } from "../errors.ts";
import { sendMessages } from "./utils.ts";

export interface Replier extends Sender {
  [Symbol.asyncIterator](): AsyncIterableIterator<MessageLike[]>;

  bind(addr: string): Promise<void>;
}

export const create = (): Replier => {
  return new ReplierImpl();
};

interface Chunk {
  conn: Connection;
  reqs: Uint8Array[];
}

async function* iter(rep: ReplierImpl, mut: Unbounded<Chunk>) {
  while (true) {
    mut.load();
    const next = await mut.next();
    if (next === null) return;
    const { reqs, conn: active } = next;
    rep.active = active;
    yield reqs;
  }
}

async function* genChunk(conn: Connection): AsyncIterableIterator<Chunk> {
  try {
    let requests = [];
    for await (const it of conn) {
      const next = new DataFrame(it.bytes());
      if (!next.more()) {
        requests.push(next.payload);
        yield {
          conn,
          reqs: requests,
        };
        requests = [];
      } else if (next.size > 0) {
        requests.push(next.payload);
      }
    }
  } catch (e) {
    if (e instanceof EOFError) {
      return;
    }
    throw e;
  }
}

class ReplierImpl implements Replier {
  #active?: Connection;
  #transport?: ServerTransport;
  #conns: Set<Connection> = new Set();
  #store: Unbounded<Chunk> = new Unbounded();

  constructor() {
  }

  async send(...msg: MessageLike[]): Promise<void> {
    if (!this.#active) throw new Error("No actived connection!");
    await sendMessages(this.#active, ...msg);
  }

  [Symbol.asyncIterator](): AsyncIterableIterator<MessageLike[]> {
    return iter(this, this.#store);
  }

  set active(c: Connection) {
    this.#active = c;
  }

  async bind(addr: string): Promise<void> {
    if (this.#transport) throw new Error("bind already!");
    const tp = bind(addr);
    this.#transport = tp;
    await tp.bind();

    (async () => {
      for await (const conn of tp) {
        this.handleConn(conn);
      }
    })();
  }

  validateSignature(signature: Uint8Array): boolean {
    // TODO: check signature
    return true;
  }

  async handleConn(conn: Connection): Promise<void> {
    conn.onClose((c) => {
      this.#conns.delete(c);
      log.info("delete conn");
    });
    this.#conns.add(conn);

    const sig = await conn.peekSignature();
    if (!this.validateSignature(sig)) {
      conn.close();
      return;
    }

    log.debug(`RCV: sig=${sig}`);

    const greetingReply = Greeting.builder().build();
    await conn.write(greetingReply.bytes());
    await conn.flush();

    const major = await conn.peekVersionMajor();
    log.debug(`RCV: version.major=${major}`);
    const greeting = await conn.readGreeting();
    log.debug(`RCV: greeting=${greeting}`);

    const ready = ReadyCommandFrame.builder()
      .set(METADATA_KEY_SOCKET_TYPE, SocketType.REP)
      .build();
    await conn.write(ready);
    await conn.flush();

    const first = await conn.read() as Frame;
    if (first.type !== FrameType.Command) {
      throw new Error("Require ready command!");
    }

    const cmd = new CommandFrame(first.bytes());
    if (cmd.name !== CommandName.Ready) {
      throw new Error("Require ready command!");
    }
    const rcvReady = new ReadyCommandFrame(first.bytes());
    log.debug(`RCV: ready=${rcvReady}`);

    (async () => {
      for await (const it of genChunk(conn)) {
        this.#store.push(it);
      }
    })();
  }
}
