import {createHash, createCipheriv, createDecipheriv} from 'crypto';
import {UDP_KEY} from './constants';

const UDP_HASHED_KEY = createHash('md5').update(UDP_KEY, 'utf8').digest().toString();

function md5(data: string): string {
  return createHash('md5').update(data, 'utf8').digest('hex');
}

function encrypt(key: string, data: Buffer): Buffer {
  const cipher = createCipheriv('aes-128-ecb', key, '');

  return Buffer.concat([cipher.update(data), cipher.final()]);
}

function decrypt(key: string, data: Buffer): Buffer {
  try {
    const decipher = createDecipheriv('aes-128-ecb', key, '');
    return Buffer.concat([decipher.update(data), decipher.final()]);
  } catch (_) {
    if (key !== UDP_HASHED_KEY) {
      // Try the universal key, in case it's a new UDP message format
      return decrypt(UDP_HASHED_KEY, data);
    }

    throw new Error('Decrypt failed.');
  }
}

export {encrypt, decrypt, md5};
