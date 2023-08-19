import { EventEmitter } from "events";
import Frame, { Packet } from "./frame";
import crc from "./crc";
import { decrypt, encrypt, hmac } from "./crypto";
import { COMMANDS, HEADER_SIZE } from "./constants";

/// for protocol description, see: https://github.com/jasonacox/tinytuya/discussions/260
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
    if (frame.version < 3.4) {
      const packet = this.wrapPacketPre34(
        this.encryptPayload(frame),
        frame.command
      );
      return packet;
    } else {
      const packet = this.wrapPacketPost34(
        this.encryptPayload(frame),
        frame.command,
        frame.sequenceN
      );
      return packet;
    }
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
    if (returnCode != 0) {
      console.error(`return code Error: ${returnCode}`);
    }
    const hasVersionPrefix = payload.indexOf(this._version.toString()) === 0;
    const shouldDecrypt =
      payload.length && (this._version >= 3.3 || hasVersionPrefix);
    const decrypted = shouldDecrypt
      ? decrypt(this._key, payload, this._version)
      : payload;

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

  wrapPacketPost34(
    encrypted: Buffer,
    command: COMMANDS,
    sequenceN?: number
  ): Packet {
    // Allocate buffer with room for payload + 24 bytes for
    // prefix, sequence, command, length, crc, and suffix
    const buffer = Buffer.alloc(encrypted.length + 52);

    // Add prefix, command, and length
    buffer.writeUInt32BE(0x000055aa, 0);
    if (sequenceN) {
      buffer.writeUInt32BE(sequenceN, 4);
    }
    buffer.writeUInt32BE(command, 8);
    buffer.writeUInt32BE(encrypted.length + 0x24, 12);

    // Add payload, crc, and suffix
    encrypted.copy(buffer, 16);

    const calculatedCrc = hmac(this._key, buffer.slice(0, encrypted.length + 16));
    calculatedCrc.copy(buffer, encrypted.length + 16);

    buffer.writeUInt32BE(0x0000aa55, encrypted.length + 48);

    return { buffer };
  }

  wrapPacketPre34(payload: Buffer, command: COMMANDS): Packet {
    const len = payload.length;

    const prefixLength = 16;
    const suffixLength = 8;
    const buffer = Buffer.alloc(prefixLength + len + suffixLength);

    // Add prefix, command, and length
    const startMarker = 0x000055aa;
    buffer.writeUInt32BE(startMarker, 0);
    buffer.writeUInt32BE(command, 8);
    buffer.writeUInt32BE(len + 8, 12);

    // Add payload, crc, and suffix
    payload.copy(buffer, 16);

    const checksum = crc(buffer.slice(0, len + 16));

    buffer.writeInt32BE(checksum, len + 16);
    const endMarker = 0x0000aa55;
    buffer.writeUInt32BE(endMarker, len + 20);

    return { buffer };
  }

  encryptPayload(frame: Frame): Buffer {
    if (frame.version < 3.3) {
      throw new Error("Encryption not supported for version < 3.3");
    }
    if (frame.version < 3.4) {
      return this.encryptPre34(frame);
    } else {
      return this.encryptPost34(frame);
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

  pad(buffer: Buffer) {
    //if (payload.length > 0) {
    // is null messages need padding - PING work without
    const padding = 0x10 - (buffer.length & 0xf);
    const padded = Buffer.alloc(buffer.length + padding, padding);
    buffer.copy(padded);

    return padded;
    //}
  }
  encryptPost34(frame: Frame): Buffer {
    //payload = Buffer.from(payload);

    const notVersionedCommands = [
      COMMANDS.DP_QUERY,
      COMMANDS.HEART_BEAT,
      COMMANDS.DP_QUERY_NEW,
      COMMANDS.SESS_KEY_NEG_START,
      COMMANDS.SESS_KEY_NEG_FINISH,
      COMMANDS.DP_REFRESH,
    ];

    if (notVersionedCommands.includes(frame.command)) {
      const payload = frame.payload;
      const padded = this.pad(payload);
      const encrypted = encrypt(this._key, padded, frame.version);
      return encrypted;
    } else {
      const payload = frame.payload;
      // Add 3.4 header
      // check this: mqc_very_pcmcd_mcd(int a1, unsigned int a2)
      const buffer = Buffer.alloc(payload.length + 15);
      Buffer.from(frame.version.toFixed(1)).copy(buffer, 0);
      payload.copy(buffer, 15);

      const padded = this.pad(buffer);

      const encrypted = encrypt(this._key, padded, frame.version);
      // return Buffer.from(buffer.toString("base64"), "ascii");
      return encrypted;
    }
  }

  encryptPre34(frame: Frame): Buffer {
    // V3.3 is always encrypted
    const encrypted = encrypt(this._key, frame.payload, this._version);

    const notVersionedCommands = [COMMANDS.DP_QUERY];

    if (notVersionedCommands.includes(frame.command)) {
      return encrypted;
    } else {
      // Add 3.3 header (only for certain commands)
      const buffer = Buffer.alloc(encrypted.length + 15);
      Buffer.from(this._version.toFixed(1)).copy(buffer, 0);
      encrypted.copy(buffer, 15);
      return buffer;
    }
  }
}

export default Messenger;
