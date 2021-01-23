import { assertEquals } from "../deps.ts";
import { CommandName, FrameType, ReadyCommandFrame } from "./mod.ts";

Deno.test("frame codec", () => {
  const metadata = ["Socket-Type", "REQ"];
  const frame = ReadyCommandFrame.builder().set(metadata[0], metadata[1])
    .build();
  console.log(`frame len: ${frame.bytes.length}`);
  assertEquals(frame.type, FrameType.Command);
  const cmd = new ReadyCommandFrame(frame.bytes());
  assertEquals(cmd.name, CommandName.Ready);
  assertEquals(cmd.metadata, metadata);
});
