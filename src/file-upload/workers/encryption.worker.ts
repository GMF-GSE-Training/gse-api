import * as crypto from 'crypto';
import { workerData, parentPort } from 'worker_threads';

interface WorkerData {
  buffer: Buffer;
  key: string;
  iv?: string;
  decrypt?: boolean;
}

if (!parentPort) throw new Error('Must be run in a worker thread');

const { buffer, key, iv, decrypt } = workerData as WorkerData;

try {
  if (decrypt) {
    const decipher = crypto.createDecipheriv(
      'aes-256-cbc',
      Buffer.from(key, 'hex'),
      Buffer.from(iv!, 'hex')
    );
    const decrypted = Buffer.concat([
      decipher.update(buffer),
      decipher.final(),
    ]);
    parentPort.postMessage({ decrypted });
  } else {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(
      'aes-256-cbc',
      Buffer.from(key, 'hex'),
      iv
    );
    const encrypted = Buffer.concat([cipher.update(buffer), cipher.final()]);
    parentPort.postMessage({ encrypted, iv: iv.toString('hex') });
  }
} catch (error) {
  parentPort.postMessage({ error: (error as Error).message });
}
