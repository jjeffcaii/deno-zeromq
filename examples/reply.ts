import { log } from "../deps.ts";
import { UTF8_DECODER } from "../misc.ts";
import * as zmq from "../mod.ts";

const socket = zmq.Reply();
await socket.bind("tcp://127.0.0.1:5555");

for await (const msgs of socket) {
  log.info(
    `RCV: [${
      msgs.map((it) => UTF8_DECODER.decode(it as Uint8Array)).join(",")
    }]`,
  );
  socket.send("World");
}
