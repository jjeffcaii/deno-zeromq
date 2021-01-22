import * as zmq from "../mod.ts";

const socket = zmq.Request();
await socket.connect("tcp://127.0.0.1:5555");

await socket.send("Hello");

const [res] = await socket.receive();
console.log(`Receive: ${new TextDecoder().decode(res as Uint8Array)}`);
