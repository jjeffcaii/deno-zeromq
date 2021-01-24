import * as zmq from "../mod.ts";

const socket = zmq.Publish();
await socket.bind("tcp://127.0.0.1:5555");

let seq = 0;

while (true) {
  await socket.send("kitty cats", `meow_${seq++}!`);
  await new Promise((resolve) => setTimeout(resolve, 500));
}
