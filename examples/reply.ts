import * as zmq from "../mod.ts";

const socket = zmq.Reply();
await socket.bind("tcp://127.0.0.1:5555");

for await (const messages of socket) {
  console.log(
    `Receive: [${
      messages.map((it) => new TextDecoder().decode(it as Uint8Array)).join(",")
    }]`,
  );
  socket.send("World");
}
