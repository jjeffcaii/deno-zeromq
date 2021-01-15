import { log } from "./deps.ts";
import { createReader, createWriter } from "./protocol/codec.ts";
import { Frame, FrameType, Greeting } from "./protocol/frame.ts";

const port = 5555;

const listener = Deno.listen({ transport: "tcp", port, hostname: "127.0.0.1" });
log.info("echo server start success!");

const onConn = async (conn: Deno.Conn) => {
  const reader = createReader(conn);
  const writer = createWriter(conn);
  const n = await writer.write(Greeting.defaultValue());
  log.info(`snd greeting: wrote=${n}`);
  await writer.flush();
  for await (const it of reader) {
    if (it instanceof Greeting) {
      // TODO:
    } else if (it instanceof Frame) {
      switch (it.type) {
        case FrameType.Command: {
          const cmd = it.decodeAsCommand();
          log.info(`rcv command: ${cmd.name}`);
          break;
        }
        case FrameType.Message: {
          // TODO:
          break;
        }
        default:
          break;
      }
    }
  }
};

for await (const conn of listener) {
  log.info("new connection established!");
  onConn(conn);
}
