import { ASCII_DECODER, TEXT_ENCODER } from "../misc/mod.ts";

export enum SecurityMechanism {
  NULL = "NULL",
  PLAIN = "PLAIN",
  CURVE = "CURVE",
}

export class GreetingBuilder {
  #major = 3;
  #minor = 0;
  #mechanism = SecurityMechanism.NULL;
  #asServer = false;

  version(major = 3, minor = 0): GreetingBuilder {
    this.#major = major;
    this.#minor = minor;
    return this;
  }

  mechanism(mechanism: SecurityMechanism): GreetingBuilder {
    this.#mechanism = this.#mechanism;
    return this;
  }

  asServer(asServer = true): GreetingBuilder {
    this.#asServer = asServer;
    return this;
  }

  build(): Greeting {
    const b = new Uint8Array(Greeting.SIZE);
    b[0] = 0xFF;
    b[8] = 0x01;
    b[9] = 0x7F;

    b[10] = this.#major & 0xFF;
    b[11] = this.#minor & 0xFF;

    const mechanism = TEXT_ENCODER.encode(this.#mechanism);
    b.set(mechanism.length < 6 ? mechanism : mechanism.subarray(0, 5), 12);

    if (this.#asServer) {
      b[32] = 0x01;
    }
    return new Greeting(b);
  }
}

export class Greeting {
  public static SIZE = 64;

  constructor(private body: Uint8Array) {
  }

  static builder(): GreetingBuilder {
    return new GreetingBuilder();
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

  get mechism(): string {
    let end = 17;
    for (let i = 1; i <= 5; i++) {
      if (this.body[17 - i] !== 0x00) {
        break;
      }
      end--;
    }
    return ASCII_DECODER.decode(this.body.subarray(12, end));
  }

  get asServer(): boolean {
    return this.body[32] === 0x01;
  }

  public toString = (): string => {
    return JSON.stringify({
      version: `${this.version.major}.${this.version.minor}`,
      mechism: this.mechism,
      asServer: this.asServer,
    });
  };
}
