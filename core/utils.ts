import { Connection } from "../transport/mod.ts";
import { MessageLike } from "../types.ts";
import { DataFrame, Frame } from "../proto/mod.ts";

export const sendMessages = async (
  conn: Connection,
  ...messages: MessageLike[]
): Promise<void> => {
  if (messages.length < 1) throw new Error("At least one message!");

  await conn.write(Frame.EMPTY_HAS_MORE);

  // write head
  for (let i = 0; i < messages.length - 1; i++) {
    const next = DataFrame.builder().hasMore(true).payload(messages[i]).build();
    await conn.write(next);
  }
  // write last
  const tail = DataFrame.builder().payload(messages[messages.length - 1])
    .build();
  await conn.write(tail);

  await conn.flush();
};
