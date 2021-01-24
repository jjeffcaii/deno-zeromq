export enum SocketType {
  REQ = "REQ",
  REP = "REP",
  PULL = "PULL",
  PUSH = "PUSH",
  PUB = "PUB",
  SUB = "SUB",
}

export type MessageLike = Uint8Array | string;

export interface Binder {
  bind(addr: string): Promise<void>;
}

export interface Connector {
  connect(addr: string): Promise<void>;
}

export interface Sender {
  send(...messages: MessageLike[]): Promise<void>;
}

export interface Receiver {
  receive(): Promise<MessageLike[]>;
}
