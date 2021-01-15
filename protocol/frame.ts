export const FLAG_COMMAND = 1 << 2;
export const FLAG_LONG = 1 << 1;
export const FLAG_MORE = 1;

const TEXT_DECODER = new TextDecoder("utf-8");

export class Greeting {
  public static SIZE = 64;

  constructor(private body: Uint8Array) {
  }

  static defaultValue(): Greeting {
    const b = new Uint8Array(Greeting.SIZE);
    b[0] = 0xFF;
    b[8] = 0x01;
    b[9] = 0x7F;
    b[10] = 0x03;

    b[12] = 0x4E;
    b[13] = 0x55;
    b[14] = 0x4C;
    b[15] = 0x4C;

    // is master
    b[32] = 0x01;
    return new Greeting(b);
  }

  bytes(): Uint8Array {
    return this.body;
  }

  get signature(): Uint8Array {
    return this.body.subarray(0, 10);
  }

  get version(): { major: number; minor: number } {
    const major: number = this.body[10];
    const minor: number = this.body[11];
    return { major, minor };
  }

  get securityMechism(): Uint8Array {
    return this.body.subarray(12, 32);
  }

  get isServer(): boolean {
    return this.body[32] !== 0;
  }

  public toString = (): string => {
    return `signature=${this.signature},version=${this.version.major}.${this.version.minor}`;
  };
}

export enum FrameType {
  Command,
  Message,
}

export class Frame {
  constructor(private body: Uint8Array) {
  }

  get flags(): number {
    return this.body[0];
  }

  bytes(): Uint8Array {
    return this.body;
  }

  get type(): FrameType {
    const isCommand = (this.flags & FLAG_COMMAND) !== 0;
    return isCommand ? FrameType.Command : FrameType.Message;
  }

  private isLong(): boolean {
    return (this.flags & FLAG_LONG) !== 0;
  }

  private isMore(): boolean {
    return (this.flags & FLAG_MORE) !== 0;
  }

  private getPayloadOffset(): number {
    return 1 + (this.isLong() ? 8 : 1);
  }

  decodeAsCommand(): Command {
    const offset = this.getPayloadOffset();
    return new Command(this.body.subarray(offset));
  }
}

export class Command {
  constructor(private body: Uint8Array) {
  }

  get name(): string {
    const commandNameSize = this.body[0];
    const name = this.body.subarray(1, 1 + commandNameSize);
    return TEXT_DECODER.decode(name);
  }
}
