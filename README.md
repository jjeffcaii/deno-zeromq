# deno-zeromq

Deno bindings for ZeroMQ. (UNFINISHED! DO NOT USE IT!!!)

## Examples

### Request/Reply

> Reply

```typescript
import * as zmq from "https://deno.land/x/zeromq/mod.ts";

const socket = zmq.Reply();
await socket.bind("tcp://127.0.0.1:5555");

for await (const [req] of socket) {
  console.log(`Receive: [${new TextDecoder().decode(req as Uint8Array)}]`);
  socket.send("World");
}
```

> Request

```typescript
import * as zmq from "https://deno.land/x/zeromq/mod.ts";

const socket = zmq.Request();
await socket.connect("tcp://127.0.0.1:5555");

await socket.send("Hello");

const [res] = await socket.receive();
console.log(`Receive: ${new TextDecoder().decode(res as Uint8Array)}`);
```

## TODO

- [x] Basic ZMTP Framing
- [ ] ZMTP-NULL
- [ ] ZMTP-PLAIN
- [ ] ZMTP-CURVE
- [x] REQ/REP
- [ ] PUB/SUB
- [ ] PUSH/PULL
- [ ] ...
