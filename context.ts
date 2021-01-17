import { SocketType } from "./protocol/codec.ts";
import { Socket, SocketImpl } from "./socket.ts";

export class Context {
  createSocket(socketType: SocketType): Socket {
    return new SocketImpl(socketType);
  }
}
