import {COMMANDS} from './constants';
import {encrypt, decrypt} from './crypto';

interface FrameInterface {
  version: number;
  command: COMMANDS;
  payload: Buffer;
  packet: Buffer;
  encrypted: boolean;
}

class Frame implements FrameInterface {
  version: number;

  command: COMMANDS;

  payload: Buffer;

  packet: Buffer;

  encrypted: boolean;

  constructor() {
    this.version = 3.1;
    this.command = COMMANDS.UDP;
    this.payload = Buffer.from('');
    this.packet = Buffer.from('');
    this.encrypted = false;
  }

  setPayload(data: Buffer | object): Frame {
    if (data instanceof Buffer) {
      this.payload = data;
    } else if (typeof data === 'object') {
      this.payload = Buffer.from(JSON.stringify(data));
    }

    return this;
  }

  encrypt(key: string): Frame {
    if (!this.encrypted) {
      this.payload = encrypt(key, this.payload);

      this.encrypted = true;
    }

    return this;
  }

  decrypt(key: string): Frame {
    if (this.encrypted) {
      this.payload = decrypt(key, this.payload);
      this.encrypted = false;
    }

    return this;
  }
}

export default Frame;
