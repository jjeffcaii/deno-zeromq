import {
  assert,
  assertEquals,
} from "https://deno.land/std@0.83.0/testing/asserts.ts";
import { Unbounded } from "./unbounded.ts";

Deno.test("mux", async () => {
  const ub = new Unbounded<number>();

  const total = 10;

  (async () => {
    for (let i = 0; i < total; i++) {
      await new Promise((res) => setTimeout(res, 50));
      ub.push(i);
    }
    ub.close();
  })();

  let cnt = 0;

  while (true) {
    ub.load();
    const next = await ub.next();
    if (next === null) {
      break;
    }
    console.log("next:", next);
    cnt++;
  }

  assertEquals(cnt, total);
});
