import fs from 'fs-extra';
import axios from 'axios';
import { Readable } from 'stream';

export async function prepareAttachments(input: any): Promise<any> {
  if (!input) return undefined;

  const isArray = Array.isArray(input);
  const items = isArray ? input : [input];
  const processed: any[] = [];

  for (const item of items) {
    if (!item) continue;

    // If it's already a stream (has pipe method)
    if (typeof item === 'object' && typeof item.pipe === 'function') {
      processed.push(item);
      continue;
    }

    // If it's a Buffer
    if (Buffer.isBuffer(item)) {
      try {
        const stream = Readable.from(item);
        processed.push(stream);
      } catch (err) {
        console.error('[AttachmentUtils] Failed to create stream from Buffer:', err);
      }
      continue;
    }

    // If it's a string (URL or File Path)
    if (typeof item === 'string') {
      if (item.startsWith('http://') || item.startsWith('https://')) {
        try {
          const response = await axios.get(item, { responseType: 'stream' });
          processed.push(response.data);
        } catch (err) {
          console.error('[AttachmentUtils] Failed to fetch URL attachment:', item, err);
        }
      } else {
        // Local file path
        try {
          if (await fs.pathExists(item)) {
            const stream = fs.createReadStream(item);
            processed.push(stream);
          } else {
            console.error('[AttachmentUtils] Local file path does not exist:', item);
          }
        } catch (err) {
          console.error('[AttachmentUtils] Failed to create read stream for file:', item, err);
        }
      }
      continue;
    }

    // If it's an object with path or url
    if (typeof item === 'object') {
      if (item.path) {
        try {
          if (await fs.pathExists(item.path)) {
            const stream = fs.createReadStream(item.path);
            processed.push(stream);
          }
        } catch (err) {
          console.error('[AttachmentUtils] Failed to read object path:', item.path, err);
        }
      } else if (item.url) {
        try {
          const res = await axios.get(item.url, { responseType: 'stream' });
          processed.push(res.data);
        } catch (err) {
          console.error('[AttachmentUtils] Failed to fetch object url:', item.url, err);
        }
      }
    }
  }

  if (processed.length === 0) return undefined;
  return isArray ? processed : processed[0];
}
