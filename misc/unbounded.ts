import { Deferred, deferred } from "../deps.ts";

export class Unbounded<T> {
  #head?: Deferred<T | null> = deferred();
  #backlog: Array<T | null> = [];
  #loaded = false;
  #closed = false;

  private innerPush(next: T | null) {
    if (this.#closed) throw new Error("Unbounded is closed!");
    if (this.#head && !this.#loaded) {
      this.#loaded = true;
      this.#head.resolve(next);
    } else {
      this.#backlog.push(next);
    }
  }

  close() {
    if (this.#closed) return;
    this.innerPush(null);
    this.#closed = true;
  }

  push(next: T) {
    this.innerPush(next);
  }

  load(): number {
    if (this.#loaded) {
      return 0;
    }

    if (!this.#head) {
      this.#head = deferred();
    }
    if (this.#backlog.length < 1) {
      return 0;
    }
    this.#loaded = true;
    const next = this.#backlog.shift();
    this.#head.resolve(next);
    return 1;
  }

  async next(): Promise<T | null> {
    if (!this.#head) {
      if (this.#closed) return null;
      throw new Error("Next item has not been loaded!");
    }
    const next = await this.#head;
    this.#head = undefined;
    this.#loaded = false;
    return next;
  }
}
