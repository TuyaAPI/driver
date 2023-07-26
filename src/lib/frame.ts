import {COMMANDS} from './constants';
import {encrypt, decrypt} from './crypto';

interface FrameInterface {
  version: number;
  command: COMMANDS;
  payload: Buffer;
  packet: Buffer;
  encrypted: boolean;
  returnCode: number;
}

class Frame implements FrameInterface {
  version: number;

  command: COMMANDS;

  payload: Buffer;

  packet: Buffer;

  encrypted: boolean;

  returnCode: number;

  constructor() {
    this.version = 3.1;
    this.command = COMMANDS.UDP;
    this.payload = Buffer.from('');
    this.packet = Buffer.from('');
    this.encrypted = false;
    this.returnCode = 0;
  }

  setPayload(data: Buffer | object): Frame {
    if (data instanceof Buffer) {
      this.payload = data;
    } else if (typeof data === 'object') {
      this.payload = Buffer.from(JSON.stringify(data));
    }

    return this;
  }

  encrypt(key: string | Buffer): Frame {
    if (!this.encrypted) {
      this.payload = encrypt(key, this.payload);

      this.encrypted = true;
    }

    return this;
  }

  decrypt(key: string | Buffer): Frame {
    if (this.encrypted) {
      this.payload = decrypt(key, this.payload);
      this.encrypted = false;
    }

    return this;
  }
}

export default Frame;
