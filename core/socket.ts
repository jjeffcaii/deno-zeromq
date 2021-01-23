import { log } from "../deps.ts";
import { ClientTransport, connect, Connection } from "../transport/mod.ts";
import {
  Connector,
  MessageLike,
  Receiver,
  Sender,
  SocketType,
} from "../types.ts";
import {
  CommandFrame,
  CommandName,
  DataFrame,
  FLAG_MORE,
  Frame,
  FrameType,
  Greeting,
  ReadyCommandFrame,
} from "../proto/mod.ts";
import { METADATA_KEY_IDENTITY, METADATA_KEY_SOCKET_TYPE } from "../consts.ts";
import { ConnectionNotReadyError } from "../errors.ts";
import { sendMessages } from "./utils.ts";

export class Socket implements Connector, Sender, Receiver {
  private transport?: ClientTransport;

  constructor(private socketType: SocketType) {
  }

  async send(...msgs: MessageLike[]): Promise<void> {
    const conn = this.transport!.connected()!;
    await sendMessages(conn, ...msgs);
  }

  async receive(): Promise<MessageLike[]> {
    if (!this.transport) throw new ConnectionNotReadyError();
    const conn = (this.transport as ClientTransport).connected()!;

    const res = [];

    let hasMore = false;
    do {
      const next = await conn.read();
      hasMore = next.more();
      if (next.size > 0) {
        const data = new DataFrame(next.bytes());
        res.push(data.payload);
      }
    } while (hasMore);
    return res;
  }

  async connect(addr: string): Promise<void> {
    if (this.transport) throw new Error("connect already!");
    this.transport = connect(addr);
    const conn = await this.transport.connect();
    await this.handshake(conn);
  }

  private async handshake(conn: Connection): Promise<void> {
    // TODO: signature + major -> rest of greeting
    await conn.write(Greeting.builder().build());
    await conn.flush();

    const greeting = await conn.readGreeting();
    log.debug(`RCV: greeting=${greeting}`);

    const first = await conn.read() as Frame;
    if (first.type !== FrameType.Command) throw new Error("handshake failed!");

    const cmd = new CommandFrame(first.bytes());
    if (cmd.name !== CommandName.Ready) throw new Error("handshake failed!");

    const ready = new ReadyCommandFrame(first.bytes());
    log.debug(`RCV: ready=${ready}`);

    const readyReply = ReadyCommandFrame.builder()
      .set(METADATA_KEY_SOCKET_TYPE, this.socketType)
      .set(METADATA_KEY_IDENTITY, "")
      .build();
    await conn.write(readyReply);
    await conn.flush();
  }
}
