import { assertEquals } from "https://deno.land/std@0.80.0/testing/asserts.ts";
import { Command, CommandType, Frame, FrameType } from "../protocol/frame.ts";

Deno.test("dataview", () => {
  const b = new Uint8Array(16);
  new DataView(b.buffer).setUint32(4, 3);
  console.log(b);
});

Deno.test("frame codec", () => {
  const metadata = ["Socket-Type", "REQ"];
  const frame = Frame.builder().command().ready(...metadata).build();
  console.log(`frame len: ${frame.bytes.length}`);
  assertEquals(frame.type, FrameType.Command);
  const cmd = frame.command;
  assertEquals(cmd.name, CommandType.Ready);
  const ready = cmd.ready;
  assertEquals(ready.metadata, metadata);
});
