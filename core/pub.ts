import { log } from "../deps.ts";
import { UTF8_DECODER } from "../misc/mod.ts";
import { DataFrame, FrameType } from "../proto/mod.ts";
import { Connection } from "../transport/mod.ts";
import { Binder, MessageLike, Sender, SocketType } from "../types.ts";
import { ServerSocket } from "./socket.ts";
import { encodeMessages } from "./utils.ts";

export interface Publisher extends Binder, Sender {
}

export const create = (): Publisher => {
  return new PublisherImpl();
};

class PublisherImpl extends ServerSocket implements Publisher {
  #topics: Map<string, Set<Connection>> = new Map();

  constructor() {
    super(SocketType.PUB);
  }

  async onConnect(conn: Connection): Promise<void> {
    conn.onceClose(() => {
      const tags = conn.listTags();
      if (!tags) return;
      tags.forEach((topic) => this.#topics.get(topic)?.delete(conn));
    });

    const next = await conn.read();
    if (next.type !== FrameType.Message) return;
    const data = new DataFrame(next.bytes());
    const payload = data.payload;
    const first = payload[0];
    // TODO: 1 byte before topic name
    log.debug(`FIRST: ${first}`);
    const topic = UTF8_DECODER.decode(payload.subarray(1));

    conn.setTag(topic);

    const exist = this.#topics.get(topic);
    if (!exist) {
      this.#topics.set(topic, new Set([conn]));
    } else {
      exist.add(conn);
    }
    log.debug(`connection ${conn} joins the topic "${topic}"`);
  }

  private findConns(topic: MessageLike): Set<Connection> | undefined {
    let k: string;
    if (typeof topic === "string") {
      k = topic as string;
    } else {
      k = UTF8_DECODER.decode(topic as Uint8Array);
    }
    return this.#topics.get(k);
  }

  async send(...messages: MessageLike[]): Promise<void> {
    const [topic] = messages;

    const conns = this.findConns(topic);
    if (!conns) return;

    const b = encodeMessages(...messages);

    for (const conn of conns) {
      try {
        await conn.write(b);
        await conn.flush();
      } catch (e) {
        log.debug(`send messages failed: ${e}`);
      }
    }
  }
}
