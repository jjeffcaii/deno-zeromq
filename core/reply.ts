import { Connection } from "../transport/mod.ts";
import { Binder, MessageLike, Sender, SocketType } from "../types.ts";
import { DataFrame, Frame } from "../proto/mod.ts";
import { Unbounded } from "../misc/mod.ts";
import { EOFError } from "../errors.ts";
import { sendMessages } from "./utils.ts";
import { ServerSocket } from "./socket.ts";

export interface Replier extends Sender, Binder {
  [Symbol.asyncIterator](): AsyncIterableIterator<MessageLike[]>;
}

export const create = (): Replier => {
  return new ReplierImpl();
};

interface Chunk {
  conn: Connection;
  reqs: Uint8Array[];
}

class ReplierImpl extends ServerSocket implements Replier {
  #active?: Connection;
  #store: Unbounded<Chunk> = new Unbounded();

  constructor() {
    super(SocketType.REP);
  }

  async send(...msg: MessageLike[]): Promise<void> {
    if (!this.#active) throw new Error("No actived connection!");
    await this.#active.write(Frame.EMPTY_HAS_MORE);
    await sendMessages(this.#active, ...msg);
  }

  private async *iter() {
    while (true) {
      this.#store.load();
      const next = await this.#store.next();
      if (next === null) return;
      const { reqs, conn: active } = next;
      this.active = active;
      yield reqs;
    }
  }

  [Symbol.asyncIterator](): AsyncIterableIterator<MessageLike[]> {
    return this.iter();
  }

  set active(c: Connection) {
    this.#active = c;
  }

  private async *genChunk(conn: Connection): AsyncIterableIterator<Chunk> {
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

  async onConnect(conn: Connection): Promise<void> {
    for await (const it of this.genChunk(conn)) {
      this.#store.push(it);
    }
  }
}
