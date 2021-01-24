# deno-zeromq

![GitHub Workflow Status](https://github.com/jjeffcaii/deno-zeromq/workflows/Deno/badge.svg)
[![License](https://img.shields.io/github/license/jjeffcaii/deno-zeromq.svg)](https://github.com/jjeffcaii/deno-zeromq/blob/master/LICENSE)
[![GitHub Release](https://img.shields.io/github/release-pre/jjeffcaii/deno-zeromq.svg)](https://github.com/jjeffcaii/deno-zeromq/releases)

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

### Pub/Sub

> Publish

```typescript
import * as zmq from "https://deno.land/x/zeromq/mod.ts";

const socket = zmq.Publish();
await socket.bind("tcp://127.0.0.1:5555");

while (true) {
  await socket.send("kitty cats", `meow!`);
  await new Promise((resolve) => setTimeout(resolve, 500));
}
```

> Subscribe

```typescript
import * as zmq from "https://deno.land/x/zeromq/mod.ts";

const sock = zmq.Subscribe();
await sock.connect("tcp://127.0.0.1:5555");
await sock.subscribe("kitty cats");

const dec = new TextDecoder();

for await (const [topic, msg] of sock) {
  console.log(
    `topic=${dec.decode(topic as Uint8Array)}, msg=${
      dec.decode(msg as Uint8Array)
    }`,
  );
}
```

## TODO

- [x] Basic ZMTP Framing
- [ ] ZMTP-NULL
- [ ] ZMTP-PLAIN
- [ ] ZMTP-CURVE
- [x] REQ/REP
- [x] PUB/SUB
- [ ] PUSH/PULL
- [ ] ...
