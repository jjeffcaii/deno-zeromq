import { log } from "../deps.ts";
import {
  bind,
  ClientTransport,
  connect,
  Connection,
  ServerTransport,
} from "../transport/mod.ts";
import {
  Binder,
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
  Frame,
  FrameType,
  Greeting,
  ReadyCommandFrame,
} from "../proto/mod.ts";
import { METADATA_KEY_IDENTITY, METADATA_KEY_SOCKET_TYPE } from "../consts.ts";
import { ConnectionNotReadyError } from "../errors.ts";
import { sendMessages } from "./utils.ts";

export abstract class ServerSocket implements Binder {
  #transport?: ServerTransport;
  protected conns: Set<Connection> = new Set();

  constructor(protected socketType: SocketType) {
  }

  abstract onConnect(conn: Connection): Promise<void>;

  validateSignature(sig: Uint8Array): boolean {
    return true;
  }

  private async handleConn(conn: Connection): Promise<void> {
    conn.onceClose(() => this.conns.delete(conn));

    this.conns.add(conn);

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
      .set(METADATA_KEY_SOCKET_TYPE, this.socketType)
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

    this.onConnect(conn);
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
}

export class Socket implements Connector, Sender, Receiver {
  protected transport?: ClientTransport;

  constructor(private socketType: SocketType) {
  }

  protected mustGetConn(): Connection {
    const conn = this.transport?.connected();
    if (!conn) throw new ConnectionNotReadyError();
    return conn;
  }

  async send(...msgs: MessageLike[]): Promise<void> {
    const conn = this.transport!.connected()!;
    await conn.write(Frame.EMPTY_HAS_MORE);
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
