alias rep := reply
alias req := request

fmt:
  deno fmt
lock:
  rm -f lock.json
  deno cache --lock=lock.json --lock-write deps.ts
reply:
  deno run --allow-net ./examples/reply.ts
request:
  deno run --allow-net ./examples/request.ts
