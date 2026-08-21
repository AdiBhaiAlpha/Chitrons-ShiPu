import axios from 'axios';
import fs from 'fs-extra';
import path from 'path';

export interface GeminiInlineData {
  inlineData: {
    mimeType: string;
    data: string; // Base64 string
  };
}

export interface ParsedAIMessage {
  prompt: string;
  imageParts: GeminiInlineData[];
  hasImages: boolean;
}

/**
 * Extracts raw attachment objects/strings from an incoming event or message object,
 * including direct attachments and replied message attachments.
 */
export function getRawAttachmentsFromEvent(eventOrMsg: any): any[] {
  if (!eventOrMsg) return [];

  const attachments: any[] = [];

  // Check direct attachments array or single object
  if (Array.isArray(eventOrMsg.attachments)) {
    attachments.push(...eventOrMsg.attachments);
  } else if (eventOrMsg.attachments) {
    attachments.push(eventOrMsg.attachments);
  }

  if (eventOrMsg.attachment) {
    if (Array.isArray(eventOrMsg.attachment)) {
      attachments.push(...eventOrMsg.attachment);
    } else {
      attachments.push(eventOrMsg.attachment);
    }
  }

  // Check messageReply attachments (when user replies to a message containing an image)
  if (eventOrMsg.messageReply) {
    const replyAtts = eventOrMsg.messageReply.attachments || eventOrMsg.messageReply.attachment;
    if (Array.isArray(replyAtts)) {
      attachments.push(...replyAtts);
    } else if (replyAtts) {
      attachments.push(replyAtts);
    }
  }

  return attachments;
}

/**
 * Helper to check if a URL or path string represents an image.
 */
function isImageUrlOrPath(str: string): boolean {
  if (!str || typeof str !== 'string') return false;
  if (str.startsWith('data:image/')) return true;
  const lower = str.toLowerCase();
  const extMatch = /\.(jpg|jpeg|png|webp|gif|bmp|tiff|heic)(\?.*)?$/i.test(lower);
  if (extMatch) return true;
  if (lower.startsWith('http://') || lower.startsWith('https://')) {
    if (
      lower.includes('scontent') ||
      lower.includes('fbcdn') ||
      lower.includes('image') ||
      lower.includes('photo') ||
      lower.includes('img') ||
      lower.includes('attachment')
    ) {
      return true;
    }
  }
  return false;
}

/**
 * Determines whether a single attachment item is an image.
 */
export function isImageAttachment(att: any): boolean {
  if (!att) return false;

  if (typeof att === 'string') {
    return isImageUrlOrPath(att);
  }

  if (Buffer.isBuffer(att)) return true;

  if (typeof att === 'object') {
    if (att.inlineData && att.inlineData.mimeType && att.inlineData.mimeType.startsWith('image/')) {
      return true;
    }

    const type = String(att.type || att.mimeType || '').toLowerCase();
    if (type.includes('photo') || type.includes('image') || type.includes('sticker') || type.includes('animated_image')) {
      return true;
    }

    const url = att.url || att.largePreviewUrl || att.previewUrl || att.path;
    if (url && typeof url === 'string') {
      return isImageUrlOrPath(url);
    }
  }

  return false;
}

/**
 * Detects if a message or event contains image attachments (directly or in reply context).
 */
export function hasImageAttachment(eventOrMsg: any): boolean {
  if (!eventOrMsg) return false;

  // Check raw attachments from event or message reply
  const atts = getRawAttachmentsFromEvent(eventOrMsg);
  if (atts.some(att => isImageAttachment(att))) return true;

  // Check if eventOrMsg itself is an image attachment item
  if (isImageAttachment(eventOrMsg)) return true;

  return false;
}

/**
 * Detects buffer MIME type from magic numbers.
 */

function detectMimeTypeFromBuffer(buf: Buffer): string {
  if (buf.length >= 8 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) {
    return 'image/png';
  }
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return 'image/jpeg';
  }
  if (buf.length >= 6 && (buf.toString('ascii', 0, 6) === 'GIF87a' || buf.toString('ascii', 0, 6) === 'GIF89a')) {
    return 'image/gif';
  }
  if (buf.length >= 12 && buf.toString('ascii', 8, 12) === 'WEBP') {
    return 'image/webp';
  }
  return 'image/jpeg';
}

function detectMimeTypeFromUrl(urlStr: string): string {
  const cleanUrl = urlStr.split('?')[0].split('#')[0];
  const ext = path.extname(cleanUrl).toLowerCase();
  switch (ext) {
    case '.png': return 'image/png';
    case '.gif': return 'image/gif';
    case '.webp': return 'image/webp';
    case '.bmp': return 'image/bmp';
    case '.heic': return 'image/heic';
    case '.jpg':
    case '.jpeg':
    default:
      return 'image/jpeg';
  }
}

/**
 * Converts a single image item (URL, Buffer, Base64 data string, local path, or FCA attachment object)
 * into a Gemini vision-compatible inlineData structure.
 */
export async function convertToGeminiImagePart(item: any): Promise<GeminiInlineData | null> {
  if (!item) return null;

  // 1. Existing Gemini inlineData format
  if (item.inlineData && item.inlineData.data && item.inlineData.mimeType) {
    return {
      inlineData: {
        mimeType: String(item.inlineData.mimeType),
        data: String(item.inlineData.data)
      }
    };
  }

  // 2. Base64 data URL string
  if (typeof item === 'string' && item.startsWith('data:image/')) {
    const matches = item.match(/^data:(image\/[a-zA-Z0-9+-]+);base64,(.+)$/);
    if (matches && matches[2]) {
      return {
        inlineData: {
          mimeType: matches[1],
          data: matches[2]
        }
      };
    }
  }

  // 3. Buffer
  if (Buffer.isBuffer(item)) {
    const mimeType = detectMimeTypeFromBuffer(item);
    return {
      inlineData: {
        mimeType,
        data: item.toString('base64')
      }
    };
  }

  // Extract URL or file path from string or attachment object
  let targetUrlOrPath: string | null = null;
  if (typeof item === 'string') {
    targetUrlOrPath = item;
  } else if (typeof item === 'object') {
    targetUrlOrPath = item.url || item.largePreviewUrl || item.previewUrl || item.path || null;
  }

  if (!targetUrlOrPath || typeof targetUrlOrPath !== 'string') {
    return null;
  }

  // 4. HTTP / HTTPS URL
  if (targetUrlOrPath.startsWith('http://') || targetUrlOrPath.startsWith('https://')) {
    try {
      const response = await axios.get(targetUrlOrPath, {
        responseType: 'arraybuffer',
        timeout: 15000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
      });

      const buffer = Buffer.from(response.data);
      const contentTypeHeader = String(response.headers['content-type'] || '');
      let mimeType = contentTypeHeader.startsWith('image/')
        ? contentTypeHeader
        : (detectMimeTypeFromUrl(targetUrlOrPath) || detectMimeTypeFromBuffer(buffer));

      return {
        inlineData: {
          mimeType: String(mimeType),
          data: buffer.toString('base64')
        }
      };
    } catch (err: any) {
      console.error('[FileParser] Failed to fetch image URL:', targetUrlOrPath, err.message || err);
      return null;
    }
  }

  // 5. Local file path
  try {
    if (await fs.pathExists(targetUrlOrPath)) {
      const buffer = await fs.readFile(targetUrlOrPath);
      const mimeType = detectMimeTypeFromUrl(targetUrlOrPath) || detectMimeTypeFromBuffer(buffer);
      return {
        inlineData: {
          mimeType,
          data: buffer.toString('base64')
        }
      };
    }
  } catch (err: any) {
    console.error('[FileParser] Failed to read local image file:', targetUrlOrPath, err.message || err);
  }

  return null;
}

/**
 * Extracts and converts all image attachments into Gemini vision-compatible inlineData objects.
 */
export async function extractImageParts(input: any): Promise<GeminiInlineData[]> {
  if (!input) return [];

  let rawItems: any[] = [];

  if (Array.isArray(input)) {
    rawItems = input;
  } else {
    rawItems = getRawAttachmentsFromEvent(input);
    if (rawItems.length === 0 && isImageAttachment(input)) {
      rawItems = [input];
    }
  }

  const results: GeminiInlineData[] = [];

  for (const item of rawItems) {
    try {
      const part = await convertToGeminiImagePart(item);
      if (part) {
        results.push(part);
      }
    } catch (err) {
      console.error('[FileParser] Failed to process image item:', err);
    }
  }

  return results;
}

/**
 * Extracts image parts from an event even when invoked via pairing commands or reply messages.
 */
export async function extractImagePartsFromPairing(eventOrMsg: any, args?: string[]): Promise<GeminiInlineData[]> {
  const parts = await extractImageParts(eventOrMsg);
  
  // If args contain a direct image URL
  if (args && args.length > 0) {
    for (const arg of args) {
      if (typeof arg === 'string' && (arg.startsWith('http://') || arg.startsWith('https://')) && isImageUrlOrPath(arg)) {
        const extraPart = await convertToGeminiImagePart(arg);
        if (extraPart) {
          parts.push(extraPart);
        }
      }
    }
  }

  return parts;
}

/**
 * Main File Parser utility function for the AI response pipeline.
 * Parses prompt text and image data blobs into a format Gemini vision models can process.
 */
export async function parseMessageWithAttachments(
  eventOrMsg: any,
  defaultPrompt: string = ''
): Promise<ParsedAIMessage> {
  const rawText = typeof eventOrMsg === 'string' 
    ? eventOrMsg 
    : (eventOrMsg?.body || eventOrMsg?.text || defaultPrompt);

  const imageParts = await extractImageParts(eventOrMsg);

  return {
    prompt: rawText.trim() || defaultPrompt || 'Describe this image in detail.',
    imageParts,
    hasImages: imageParts.length > 0
  };
}
