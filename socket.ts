import { BufReader, BufWriter, log } from "./deps.ts";
import { Connection, createConnection } from "./protocol/codec.ts";
import {
  CommandType,
  FLAG_MORE,
  Frame,
  FrameType,
  Greeting,
} from "./protocol/frame.ts";
import { SocketType } from "./protocol/codec.ts";
import {
  bind,
  ClientTransport,
  connect,
  ServerTransport,
  TcpClientTransport,
  TransportType,
} from "./transport.ts";
import { METADATA_KEY_IDENTITY, METADATA_KEY_SOCKET_TYPE } from "./consts.ts";
import { ConnectionNotReadyError } from "./errors.ts";

export type Message = Uint8Array | string;

export interface Socket {
  bind(addr: string): Promise<void>;
  connect(addr: string): Promise<void>;
  close(): Promise<void>;

  send(req: Message): Promise<void>;
  receive(): Promise<Message[]>;
}

export class SocketImpl implements Socket {
  private transport?: ClientTransport | ServerTransport;

  constructor(private socketType: SocketType) {
  }

  async send(req: Message): Promise<void> {
    const c = (this.transport as ClientTransport).connected()!;
    await c.write(Frame.EMPTY_HAS_MORE);
    // write first
    const first = Frame.builder().data(req).build();
    await c.write(first);
    await c.flush();
  }

  async receive(): Promise<Message[]> {
    if (!this.transport) throw new ConnectionNotReadyError();
    const conn = (this.transport as ClientTransport).connected()!;
    const first = await conn.read() as Frame;
    if ((first.flags & FLAG_MORE) === 0) {
      return [];
    }
    const next = await conn.read() as Frame;
    return [new TextDecoder().decode(next.payload)];
  }

  async bind(addr: string): Promise<void> {
    if (this.transport) throw new Error("bind already!");
    const tp = bind(addr);
    this.transport = tp;
    await tp.bind();
  }

  async connect(addr: string): Promise<void> {
    if (this.transport) throw new Error("connect already!");
    this.transport = connect(addr);
    const conn = await this.transport.connect();
    await this.handshake(conn);
  }

  private async handshake(conn: Connection): Promise<void> {
    await sendGreeting(conn, Greeting.mock());
    const first = await conn.read();
    if (first instanceof Greeting) {
      this.onGreeting(conn, first);
    } else {
      throw new Error("handshake failed!");
    }

    const second = await conn.read();
    if (second instanceof Frame && second.type === FrameType.Command) {
      const cmd = second.command;
      if (cmd.name !== CommandType.Ready) {
        throw new Error("handshake failed!");
      }
      const ready = cmd.ready;
      log.info(`COMMAND[READY]: ${ready}`);

      const readyReply = Frame.builder()
        .command()
        .ready(
          METADATA_KEY_SOCKET_TYPE,
          this.socketType,
          METADATA_KEY_IDENTITY,
          "",
        )
        .build();
      await conn.write(readyReply);
      await conn.flush();
    } else {
      throw new Error("handshake failed!");
    }
  }

  close(): Promise<void> {
    throw new Error("Method not implemented.");
  }

  private onGreeting(
    conn: Connection,
    greeting: Greeting,
  ): Promise<void> {
    switch (this.transport!.type()) {
      case TransportType.CLIENT:
        break;
      case TransportType.SERVER:
        break;
      default:
        break;
    }

    log.info(`GREETING: ${greeting}`);
    return Promise.resolve();
  }

  private async onFrame(conn: Connection, frame: Frame): Promise<void> {
    switch (frame.type) {
      case FrameType.Command: {
        const cmd = frame.command;
        if (cmd.name === CommandType.Ready) {
          const ready = cmd.ready;
          log.info(`COMMAND[READY]: ${ready}`);

          const ready2 = Frame.builder()
            .command()
            .ready(
              METADATA_KEY_SOCKET_TYPE,
              this.socketType,
              METADATA_KEY_IDENTITY,
              "",
            )
            .build();
          await conn.write(ready2);
          await conn.flush();
        }
        break;
      }
      case FrameType.Message: {
        break;
      }
      default:
        break;
    }
    return Promise.resolve();
  }

  async handleRecv(conn: Connection) {
    for await (const msg of conn) {
      if (msg instanceof Greeting) {
        await this.onGreeting(conn, msg);
      } else if (msg instanceof Frame) {
        await this.onFrame(conn, msg);
      } else {
        throw new Error("unreachable!");
      }
    }
  }
}

const sendGreeting = async (
  c: Connection,
  greeting: Greeting,
): Promise<void> => {
  await c.write(greeting);
  await c.flush();
};
