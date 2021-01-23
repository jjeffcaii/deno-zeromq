import * as zmq from "../mod.ts";

const dec = new TextDecoder();

const socket = zmq.Request();
await socket.connect("tcp://127.0.0.1:5555");

await socket.send("Hello", "Hello2");
const results = await socket.receive();
console.log(
  `Receive: [${results.map((it) => dec.decode(it as Uint8Array)).join(",")}]`,
);
