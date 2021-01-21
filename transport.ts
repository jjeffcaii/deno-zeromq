import { Connection, createConnection } from "./protocol/connection.ts";
import { BufReader, BufWriter } from "./deps.ts";
import { InvalidTransportURL } from "./errors.ts";

export enum TransportType {
  CLIENT,
  SERVER,
}

interface Transport {
  type(): TransportType;
}

export interface ClientTransport extends Transport {
  connect(): Promise<Connection>;
  connected(): Connection | undefined;
}

export interface ServerTransport extends Transport {
  [Symbol.asyncIterator](): AsyncIterableIterator<Connection>;
  bind(): Promise<void>;
}

export const bind = (addr: string): ServerTransport => {
  const url = new URL(addr);
  const { protocol, hostname, port } = url;
  switch (protocol.toLowerCase()) {
    case "tcp:":
      return new TcpServerTransport(hostname, parseInt(port));
    default:
      throw new InvalidTransportURL(addr);
  }
};

export const connect = (addr: string): ClientTransport => {
  const { protocol, hostname, port } = new URL(addr);
  switch (protocol.toLowerCase()) {
    case "tcp:":
      return new TcpClientTransport(hostname, parseInt(port));
    default:
      throw new InvalidTransportURL(addr);
  }
};

export class TcpServerTransport implements ServerTransport {
  private listener?: Deno.Listener;

  constructor(private hostname: string, private port: number) {
  }

  type(): TransportType {
    return TransportType.SERVER;
  }

  bind(): Promise<void> {
    return new Promise((resolve) => {
      if (this.listener) throw new Error("bind already!");
      this.listener = Deno.listen({
        transport: "tcp",
        port: this.port,
        hostname: this.hostname,
      });
      resolve();
    });
  }

  [Symbol.asyncIterator](): AsyncIterableIterator<Connection> {
    return iter(this.listener);
  }
}

export class TcpClientTransport implements ClientTransport {
  private conn?: Connection;

  constructor(
    private hostname: string,
    private port: number,
  ) {
  }

  type(): TransportType {
    return TransportType.CLIENT;
  }

  connected(): Connection | undefined {
    return this.conn;
  }

  async connect(): Promise<Connection> {
    if (this.conn) throw new Error("connect already");
    const rawConn = await Deno.connect({
      transport: "tcp",
      hostname: this.hostname,
      port: this.port,
    });
    const reader = new BufReader(rawConn);
    const writer = new BufWriter(rawConn);
    const conn = createConnection(reader, writer);
    this.conn = conn;
    return conn;
  }
}

async function* iter(listener?: Deno.Listener) {
  if (!listener) return;
  for await (const rawConn of listener) {
    const reader = new BufReader(rawConn);
    const writer = new BufWriter(rawConn);
    yield createConnection(reader, writer, (): Promise<void> => {
      return new Promise((resolve) => {
        rawConn.close();
        resolve();
      });
    });
  }
}
