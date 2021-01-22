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

export class Socket implements Connector, Sender, Receiver {
  private transport?: ClientTransport;

  constructor(private socketType: SocketType) {
  }

  async send(req: MessageLike, ...other: MessageLike[]): Promise<void> {
    const c = (this.transport as ClientTransport).connected()!;
    await c.write(Frame.EMPTY_HAS_MORE);

    const [...rest,last] = [req, ...other];


    rest.map(it => DataFrame.builder().hasMore(true).payload(it))


    // write first
    const first = DataFrame.builder()
      .hasMore(other.length > 0)
      .payload(req)
      .build();
    await c.write(first);

    await c.flush();
  }

  async receive(): Promise<MessageLike[]> {
    if (!this.transport) throw new ConnectionNotReadyError();
    const conn = (this.transport as ClientTransport).connected()!;
    const first = await conn.read() as Frame;
    if ((first.flags & FLAG_MORE) === 0) {
      return [];
    }
    const next = await conn.read();
    const data = new DataFrame(next.bytes());
    return [data.payload];
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
