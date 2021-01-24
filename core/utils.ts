import { Connection } from "../transport/mod.ts";
import { MessageLike } from "../types.ts";
import { DataFrame, Frame } from "../proto/mod.ts";
import { bytes } from "../deps.ts";

export const encodeMessages = (...messages: MessageLike[]): Uint8Array => {
  const b = [];
  // write head
  for (let i = 0; i < messages.length - 1; i++) {
    const next = DataFrame.builder().hasMore(true).payload(messages[i]).build();
    b.push(next.bytes());
  }
  // write last
  const tail = DataFrame.builder().payload(messages[messages.length - 1])
    .build();
  b.push(tail.bytes());
  return bytes.concat(...b);
};

export const sendMessages = async (
  conn: Connection,
  ...msgs: MessageLike[]
): Promise<void> => {
  if (msgs.length < 1) throw new Error("At least one message!");
  const b = encodeMessages(...msgs);
  await conn.write(b);
  await conn.flush();
};
