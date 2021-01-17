import { Context, Socket, SocketType } from "../mod.ts";

const context = new Context();
const socket: Socket = context.createSocket(SocketType.REQ);
await socket.connect("tcp://127.0.0.1:5555");

await socket.send("Foo");
