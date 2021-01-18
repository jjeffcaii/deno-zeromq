import { Unbounded } from "./unbounded.ts";

Deno.test("mux", async () => {
  const ub = new Unbounded<number>();

  (async () => {
    while (true) {
      ub.load();
      const next = await ub.next();
      console.log("next:", next);
    }
  })();

  let seq = 0;
  setInterval(() => {
    for (let i = 0; i < 3; i++) {
      ub.push(++seq);
    }
  }, 1000);

  await new Promise((resolve) => setTimeout(resolve, 50000));
});
