import {EventEmitter} from 'events';
import Frame from './frame';
import crc from './crc';
import {md5} from './crypto';
import {COMMANDS, HEADER_SIZE} from './constants';

class Messenger extends EventEmitter {
  private readonly key: string;

  private readonly version: number;

  constructor({key, version}: {key: string; version: number}) {
    super();

    // Copy arguments
    this.key = key;
    this.version = version;
  }

  encode(frame: Frame) {
    frame.packet = this.wrapPacket(this.versionPacket(frame), frame.command);

    return frame;
  }

  decode(packet: Buffer) {
    this.checkPacket(packet);

    // Get command byte
    const command = packet.readUInt32BE(8);

    // Get payload size
    const payloadSize = packet.readUInt32BE(12);

    // Check for payload
    if (packet.length - 8 < payloadSize) {
      throw new TypeError(`Packet missing payload: payload has length ${payloadSize}.`);
    }

    // Get the return code, 0 = success
    // This field is only present in messages from the devices
    // Absent in messages sent to device
    // Should we throw here or attach the return code to the Frame and bubble up?
    const returnCode = packet.readUInt32BE(16);

    // Get the payload
    // Adjust for messages lacking a return code
    let payload;
    if (returnCode & 0xFFFFFF00) {
      payload = packet.slice(HEADER_SIZE, HEADER_SIZE + payloadSize - 8);
    } else {
      payload = packet.slice(HEADER_SIZE + 4, HEADER_SIZE + payloadSize - 8);
    }

    // Check CRC
    const expectedCrc = packet.readInt32BE(HEADER_SIZE + payloadSize - 8);
    const computedCrc = crc(packet.slice(0, payloadSize + 8));

    if (expectedCrc !== computedCrc) {
      // eslint-disable-next-line max-len
      throw new Error(`CRC mismatch: expected ${expectedCrc}, was ${computedCrc}. ${packet.toString('hex')}`);
    }

    const frame = new Frame();

    frame.version = this.version;
    frame.packet = packet;
    frame.command = command;

    // Check if packet is encrypted
    if (payload.indexOf(this.version.toString()) === 0) {
      frame.encrypted = true;

      // Remove packet header
      if (this.version === 3.3) {
        payload = payload.slice(15);
      } else {
        payload = payload.slice(19);
      }

      frame.payload = Buffer.from(payload.toString('ascii'), 'base64');

      frame.decrypt(this.key);
    } else {
      frame.payload = payload;
    }

    return frame;
  }

  checkPacket(packet: Buffer) {
    // Check for length
    // At minimum requires: prefix (4), sequence (4), command (4), length (4),
    // CRC (4), and suffix (4) for 24 total bytes
    // Messages from the device also include return code (4), for 28 total bytes
    if (packet.length < 24) {
      throw new TypeError(`Packet too short. Length: ${packet.length}.`);
    }

    // Check for prefix
    const prefix = packet.readUInt32BE(0);

    if (prefix !== 0x000055AA) {
      throw new TypeError(`Prefix does not match: ${packet.toString('hex')}`);
    }

    // Check for suffix
    const suffix = packet.readUInt32BE(packet.length - 4);

    if (suffix !== 0x0000AA55) {
      throw new TypeError(`Suffix does not match: ${packet.toString('hex')}`);
    }
  }

  wrapPacket(packet: Buffer, command: COMMANDS) {
    const len = packet.length;

    const buffer = Buffer.alloc(len + 24);

    // Add prefix, command, and length
    buffer.writeUInt32BE(0x000055AA, 0);
    buffer.writeUInt32BE(command, 8);
    buffer.writeUInt32BE(len + 8, 12);

    // Add payload, crc, and suffix
    packet.copy(buffer, 16);

    const code = crc(buffer.slice(0, len + 16));

    buffer.writeInt32BE(code, len + 16);
    buffer.writeUInt32BE(0x0000AA55, len + 20);

    packet = buffer;

    return packet;
  }

  versionPacket(frame: Frame) {
    let packet = frame.payload;

    if (this.version === 3.3) {
      // V3.3 is always encrypted
      frame.encrypt(this.key);
      packet = frame.payload;

      // Check if we need an extended header, only for certain Commands
      if (frame.command !== COMMANDS.DP_QUERY) {
        // Add 3.3 header
        const buffer = Buffer.alloc(packet.length + 15);
        Buffer.from('3.3').copy(buffer, 0);
        packet.copy(buffer, 15);

        packet = buffer;
      }
    } else if (frame.encrypted) {
      const hash = md5(`data=${frame.payload.toString('base64')}||lpv=${this.version}||${this.key}`).substr(8, 16);

      packet = Buffer.from(this.version.toString() + hash + packet.toString('base64'));
    }

    return packet;
  }
}

export default Messenger;
