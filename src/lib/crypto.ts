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

export function encrypt(key: string | Buffer, data: Buffer): Buffer {
  const cipher = createCipheriv("aes-128-ecb", key, "");

  return Buffer.concat([cipher.update(data), cipher.final()]);
}

export function decrypt(key: string | Buffer, data: Buffer): Buffer {
  try {
    const decipher = createDecipheriv("aes-128-ecb", key, null);
    return Buffer.concat([decipher.update(data), decipher.final()]);
  } catch (err) {
    if (key !== UDP_HASHED_KEY) {
      // Try the universal key, in case it's a new UDP message format
      return decrypt(UDP_HASHED_KEY, data);
    }
    throw err;
  }
}
