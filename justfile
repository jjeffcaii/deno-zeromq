fmt:
  deno fmt
lock:
  rm -f lock.json
  deno cache --lock=lock.json --lock-write deps.ts
rep:
  deno run --allow-net ./examples/reply.ts
req:
  deno run --allow-net ./examples/request.ts
pub:
  deno run --allow-net ./examples/pub.ts
sub:
  deno run --allow-net ./examples/sub.ts
