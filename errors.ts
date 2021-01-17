export class EOFError extends Error {
}

export class ConnectionClosedError extends Error {
}

export class SubscriptionClosedError extends Error {
}

export class ErrorReplyError extends Error {
}

export class InvalidStateError extends Error {
  constructor() {
    super("Invalid state");
  }
}

export class InvalidTransportURL extends Error {
  constructor(addr: string) {
    super(`invalid transport url: ${addr}`);
  }
}

export class ConnectionNotReadyError extends Error {
  constructor() {
    super("connection is not ready");
  }
}
