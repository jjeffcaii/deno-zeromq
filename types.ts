export enum SocketType {
  REQ = "REQ",
  REP = "REP",
  PULL = "PULL",
  PUSH = "PUSH",
}

export type MessageLike = Uint8Array | string;

export interface Connector {
  connect(addr: string): Promise<void>;
}

export interface Sender {
  send(...messages: MessageLike[]): Promise<void>;
}

export interface Receiver {
  receive(): Promise<MessageLike[]>;
}
