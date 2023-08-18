import {
  createHash,
  createCipheriv,
  createDecipheriv,
  createHmac,
} from "crypto";
import { UDP_KEY } from "./constants";

const UDP_HASHED_KEY = createHash("md5")
  .update(UDP_KEY, "utf8")
  .digest();

export function md5(data: string): string {
  return createHash("md5")
    .update(data, "utf8")
    .digest("hex");
}

/**
 * Returns the HMAC for the current key (sessionKey if set for protocol 3.4 or key)
 * @param {Buffer} data data to hash
 * @returns {Buffer} HMAC
 */
export function hmac(key: string | Buffer, data: Buffer) {
  return createHmac("sha256", key)
    .update(data)
    .digest(); // .digest('hex');
}

export function encrypt(key: string | Buffer, data: Buffer, version: number): Buffer {
  return version < 3.4 ? encryptPre34(key, data) : encryptPost34(key, data);
}

function encryptPre34(key: string | Buffer, data: Buffer): Buffer {
  const cipher = createCipheriv("aes-128-ecb", key, "");

  return Buffer.concat([cipher.update(data), cipher.final()]);
}

function encryptPost34(key: string | Buffer, data: Buffer): Buffer {
  const cipher = createCipheriv("aes-128-ecb", key, null);
  cipher.setAutoPadding(false);
  const encrypted = cipher.update(data);
  cipher.final();

  // Default base64 enable TODO: check if this is needed?
  // if (options.base64 === false) {
  //   return Buffer.from(encrypted, 'base64');
  // }

  return encrypted;
}

export function decrypt(key: string | Buffer, data: Buffer, version: number): Buffer {
  try {

    if (data.indexOf(version.toString()) === 0) {
      if (version === 3.3 || version === 3.2) {
        // Remove 3.3/3.2 header
        data = data.slice(15);
      } else {
        // Data has version number and is encoded in base64

        // Remove prefix of version number and MD5 hash
        data = data.slice(19);
        // Decode incoming data as base64
        //format = 'base64';
      }
    }

    const decipher = createDecipheriv("aes-128-ecb", key, null);
    return Buffer.concat([decipher.update(data), decipher.final()]);
  } catch (err) {
    if (key !== UDP_HASHED_KEY) {
      // Try the universal key, in case it's a new UDP message format
      return decrypt(UDP_HASHED_KEY, data, version);
    }
    throw err;
  }
}
