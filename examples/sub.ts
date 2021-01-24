import { debug } from "https://deno.land/std@0.84.0/log/mod.ts";
import { UTF8_DECODER } from "../misc/mod.ts";
import * as zmq from "../mod.ts";

const sock = zmq.Subscribe();
await sock.connect("tcp://127.0.0.1:5555");
await sock.subscribe("kitty cats");

const dec = new TextDecoder();

for await (const [topic, msg] of sock) {
  console.log(
    `topic=${dec.decode(topic as Uint8Array)}, msg=${
      dec.decode(msg as Uint8Array)
    }`,
  );
}
