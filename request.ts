import { Connector, Receiver, Sender, SocketType } from "./types.ts";
import { Socket } from "./socket.ts";

export interface Requester extends Connector, Sender, Receiver {
}

class RequesterImpl extends Socket implements Requester {
  constructor() {
    super(SocketType.REQ);
  }
}

export const create = (): Requester => {
  return new RequesterImpl();
};
