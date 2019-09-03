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
  private _payload: Buffer;

  encrypted: boolean;

  command: COMMANDS;

  packet: Buffer;

  version: number;

  constructor() {
    this.version = 3.1;
    this.packet = Buffer.from('');
    this.command = COMMANDS.UDP;
    this._payload = Buffer.from('');
    this.encrypted = false;
  }

  set payload(data: unknown) {
    if (data instanceof Buffer) {
      this._payload = data;
    } else if (typeof data === 'object') {
      this._payload = Buffer.from(JSON.stringify(data));
    }
  }

  get payload() {
    return this._payload;
  }

  encrypt(key: string) {
    if (!this.encrypted) {
      this.payload = encrypt(key, this.payload);

      this.encrypted = true;
    }
  }

  decrypt(key: string) {
    if (this.encrypted) {
      this.payload = decrypt(key, this.payload);
      this.encrypted = false;
    }
  }
}

export default Frame;
