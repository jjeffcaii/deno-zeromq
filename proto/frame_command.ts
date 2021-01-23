import { ASCII_DECODER } from "../misc/mod.ts";
import { Frame } from "./frame.ts";

export enum CommandName {
  Ready = "READY",
  Error = "ERROR",
}

export class CommandFrame extends Frame {
  get name(): string {
    let offset = this.getPayloadOffset();
    const commandNameSize = this.body[offset];
    offset++;
    return ASCII_DECODER.decode(
      this.body.subarray(offset, offset + commandNameSize),
    );
  }
}
