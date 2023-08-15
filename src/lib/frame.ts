import { COMMANDS } from "./constants";

export type Packet = {
 buffer: Buffer;
}

interface Frame {
  readonly version: number;
  readonly command: COMMANDS;
  readonly payload: Buffer;
  //public rawPayload: Buffer = Buffer.from("");
  //readonly packet: Buffer;
  //readonly encrypted: boolean;
  readonly returnCode?: number;
  readonly sequenceN?: number;

  // setPayload(data: Buffer | object): Frame {
  //   if (data instanceof Buffer) {
  //     this.payload = data;
  //   } else if (typeof data === 'object') {
  //     this.payload = Buffer.from(JSON.stringify(data));
  //   }

  //   return this;
  // }
}

// encrypt(key: string | Buffer) {
//   const binaryPayload =
//     this.payload instanceof Buffer
//       ? this.payload
//       : Buffer.from(JSON.stringify(this.payload));

//   return encrypt(key, binaryPayload);
// }

// decrypt(key: string | Buffer): Frame {
//     this.payload = decrypt(key, this.rawPayload);
// }

export default Frame;
