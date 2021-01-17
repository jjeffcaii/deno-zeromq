import {
  assert,
  assertEquals,
} from "https://deno.land/std@0.80.0/testing/asserts.ts";
import { Decoder, Encoder } from "./buffer.ts";

Deno.test("encdec", () => {
  const enc = new Encoder(1024);
  const s = "hello world!";
  enc.writeUint32(s.length);
  enc.writeString(s);
  const b = enc.freeze();
  const d = new Decoder(b);
  assertEquals(d.length, 4 + s.length);
  assertEquals(d.readUint32(), s.length);
  assertEquals(d.readString(s.length, 4), s);
});
