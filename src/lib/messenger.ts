import { EventEmitter } from "events";
import Frame, { Packet } from "./frame";
import crc from "./crc";
import { decrypt, encrypt, hmac, md5 } from "./crypto";
import { COMMANDS, HEADER_SIZE } from "./constants";

class Messenger extends EventEmitter {
  private readonly _key: string | Buffer;

  private readonly _version: number;

  constructor({
    key,
    version = 3.3,
  }: {
    key: string | Buffer;
    version?: number;
  }) {
    super();

    // Copy arguments
    this._key = key;
    this._version = version;
  }

  encode(frame: Frame): Packet {
    const packet = this.wrapPacket(this.encryptPayload(frame), frame.command);

    return packet;
  }

  splitPackets(p: Buffer): Packet[] {
    const packets: Packet[] = [];

    const empty = Buffer.from("");

    while (!p.equals(empty)) {
      const startIndex = p.indexOf(Buffer.from("000055aa", "hex"));
      const endIndex = p.indexOf(Buffer.from("0000aa55", "hex")) + 4; // TODO: why 4 not 8?

      packets.push({ buffer: p.slice(startIndex, endIndex) });

      p = p.slice(endIndex, p.length);
    }

    return packets;
  }

  decode(message: Buffer): Frame {
    const packet = this.checkPacket(message);
    const { command, returnCode, payload } = this.parsePacket(packet);

    
    const shouldDecrypt = payload.length && (this._version >= 3.3 || payload.indexOf(this._version.toString()) === 0);
    const decrypted = shouldDecrypt ? decrypt(this._key, payload) : payload;
    
    // TODO: leftover can contain another packet, so we should parse it
    const frame: Frame = {
      version: this._version,
      command,
      payload: decrypted,
      returnCode,
    };
    
    return frame;
  }

  private parsePacket(p: Packet) {
    const { buffer: packet } = p;
    
    const sequenceN = packet.readUInt32BE(4);
    const command = packet.readUInt32BE(8);
    const payloadSize = packet.readUInt32BE(12);

    if (packet.length - 8 < payloadSize) {
      throw new TypeError(
        `Packet missing payload: payload has length ${payloadSize}.`
      );
    }

    const packageFromDiscovery =
      command === COMMANDS.UDP ||
      command === COMMANDS.UDP_NEW ||
      command === COMMANDS.BROADCAST_LPV34;

    // Get the return code, 0 = success
    // This field is only present in messages from the devices
    // Absent in messages sent to device
    const returnCode = packet.readUInt32BE(16);

    const offset = returnCode & 0xffffff00 ? HEADER_SIZE : HEADER_SIZE + 4;
    const length =
      this._version === 3.4 && !packageFromDiscovery
        ? HEADER_SIZE + payloadSize - 36
        : HEADER_SIZE + payloadSize - 8;

    const payload = packet.slice(offset, length);

    // Check CRC
    this.checkCrc(packet, payloadSize, packageFromDiscovery);
    return { payload, command, sequenceN, returnCode };
  }

  private checkCrc(
    buffer: Buffer,
    payloadSize: number,
    packageFromDiscovery: boolean
  ) {
    if (this._version === 3.4 && !packageFromDiscovery) {
      const expectedCrc = buffer
        .slice(HEADER_SIZE + payloadSize - 36, buffer.length - 4)
        .toString("hex");
      const computedCrc = hmac(
        this._key,
        buffer.slice(0, HEADER_SIZE + payloadSize - 36)
      ).toString("hex");

      if (expectedCrc !== computedCrc) {
        throw new Error(
          `HMAC mismatch: expected ${expectedCrc}, was ${computedCrc}. ${buffer.toString(
            "hex"
          )}`
        );
      }
    } else {
      const expectedCrc = buffer.readInt32BE(HEADER_SIZE + payloadSize - 8);
      const computedCrc = crc(buffer.slice(0, payloadSize + 8));

      if (expectedCrc !== computedCrc) {
        throw new Error(
          `CRC mismatch: expected ${expectedCrc}, was ${computedCrc}. ${buffer.toString(
            "hex"
          )}`
        );
      }
    }
  }

  checkPacket(packet: Buffer): Packet {
    // Check for length
    // At minimum requires: prefix (4), sequence (4), command (4), length (4),
    // CRC (4), and suffix (4) for 24 total bytes
    // Messages from the device also include return code (4), for 28 total bytes
    if (packet.length < 24) {
      throw new TypeError(`Packet too short. Length: ${packet.length}.`);
    }

    // Check for prefix
    const prefix = packet.readUInt32BE(0);

    if (prefix !== 0x000055aa) {
      throw new TypeError(`Prefix does not match: ${packet.toString("hex")}`);
    }

    // Check for suffix
    const suffixLocation = packet.indexOf("0000AA55", 0, "hex");

    if (suffixLocation !== packet.length - 4) {
      //const leftover = packet.slice(suffixLocation + 4);
      packet = packet.slice(0, suffixLocation + 4);
    }
    const suffix = packet.readUInt32BE(packet.length - 4);

    if (suffix !== 0x0000aa55) {
      throw new TypeError(`Suffix does not match: ${packet.toString("hex")}`);
    }

    return { buffer: packet };
  }

  wrapPacket(packet: Buffer, command: COMMANDS): Packet {
    const len = packet.length;

    const prefixLength = 16;
    const suffixLength = 8;
    const buffer = Buffer.alloc(prefixLength + len + suffixLength);

    // Add prefix, command, and length
    const startMarker = 0x000055aa;
    buffer.writeUInt32BE(startMarker, 0);
    buffer.writeUInt32BE(command, 8);
    buffer.writeUInt32BE(len + 8, 12);

    // Add payload, crc, and suffix
    packet.copy(buffer, 16);

    const checksum = crc(buffer.slice(0, len + 16));

    buffer.writeInt32BE(checksum, len + 16);
    const endMarker = 0x0000aa55;
    buffer.writeUInt32BE(endMarker, len + 20);

    return { buffer };
  }

  encryptPayload(frame: Frame): Buffer {
    if (this._version >= 3.3) {
      // V3.3 is always encrypted
      const encrypted = encrypt(this._key, frame.payload);

      if (frame.command === COMMANDS.DP_QUERY) {
        return encrypted;
      } else {
        // Add 3.3 header (only for certain commands)
        const buffer = Buffer.alloc(encrypted.length + 15);
        Buffer.from(this._version.toFixed(1)).copy(buffer, 0);
        encrypted.copy(buffer, 15);

        return buffer;
      }
    } else {
      throw new Error(`Version ${this._version} not supported`);
    }
    //    else if (frame.encrypted) {
    //     const hash = md5(
    //       `data=${frame.payload.toString("base64")}||lpv=${this._version}||${
    //         this._key
    //       }`
    //     ).slice(8, 24);

    //     packet = Buffer.from(
    //       `${this._version.toString()}${hash}${packet.toString("base64")}`
    //     );
    //   }

    //   return packet;
    // }
  }
}

export default Messenger;
