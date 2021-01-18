import { Deferred, deferred } from "./deps.ts";

export class Unbounded<T> {
  #head?: Deferred<T> = deferred();
  #backlog: T[] = [];
  #loaded = false;

  push(next: T) {
    if (this.#head && !this.#loaded) {
      this.#loaded = true;
      this.#head.resolve(next);
    } else {
      this.#backlog.push(next);
    }
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

  async next(): Promise<T> {
    if (!this.#head) throw new Error("call load first");
    const next = await this.#head;
    this.#head = undefined;
    this.#loaded = false;
    return next;
  }
}
