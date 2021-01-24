import { ConnectionNotReadyError, EOFError } from "../errors.ts";
import { Encoder, TEXT_ENCODER } from "../misc/mod.ts";
import { DataBuilder, DataFrame } from "../proto/frame_data.ts";
import { Connector, MessageLike, SocketType } from "../types.ts";
import { Socket } from "./socket.ts";

export interface Subscriber extends Connector {
  [Symbol.asyncIterator](): AsyncIterableIterator<MessageLike[]>;
  subscribe(topic: string): Promise<void>;
}

export const create = (): Subscriber => {
  return new SubscriberImpl();
};

class SubscriberImpl extends Socket implements Subscriber {
  constructor() {
    super(SocketType.SUB);
  }

  private async *iter(): AsyncIterableIterator<MessageLike[]> {
    const conn = this.mustGetConn();
    try {
      let messages: MessageLike[] = [];
      for await (const it of conn) {
        const next = new DataFrame(it.bytes());
        if (next.more()) {
          messages.push(next.payload);
        } else if (next.size > 0) {
          messages.push(next.payload);
          yield messages;
          messages = [];
        }
      }
    } catch (e) {
      if (e instanceof EOFError) {
        return;
      }
      throw e;
    }
  }

  [Symbol.asyncIterator](): AsyncIterableIterator<MessageLike[]> {
    return this.iter();
  }

  async subscribe(topic: string): Promise<void> {
    const conn = this.mustGetConn();

    const topicBytes = TEXT_ENCODER.encode(topic);
    const b = new Uint8Array(topicBytes.length + 1);
    b[0] = 0x01;
    b.set(topicBytes, 1);
    const sub = DataFrame.builder().payload(b).build();
    await conn.write(sub);
    await conn.flush();
  }
}
