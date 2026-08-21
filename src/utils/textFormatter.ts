// Unicode Font Dictionary provided by user
const SANS_BOLD_UPPER = '𝗔𝗕𝗖𝗗𝗘𝗙𝗚𝗛𝗜𝗝𝗞𝗟𝗠𝗡𝗢𝗣𝗤𝗥𝗦𝗧𝗨𝗩𝗪𝗫𝗬𝗭';
const SANS_BOLD_LOWER = '𝗮𝗯𝗰𝗱𝗲𝗳𝗴𝗵𝗶𝗷𝗸𝗹𝗺𝗻𝗼𝗽𝗾𝗿𝘀𝘁𝘂𝘃𝘄𝘅𝘆𝘇';
const SANS_BOLD_DIGITS = '𝟭𝟮𝟯𝟰𝟱𝟲𝟳𝟴𝟵𝟬'; // 1 2 3 4 5 6 7 8 9 0

const SERIF_BOLD_UPPER = '𝐀𝐁𝐂𝐃𝐄𝐅𝐆𝐇𝐈𝐉𝐊𝐋𝐌𝐍𝐎𝐏𝐐𝐑𝐒𝐓𝐔𝐕𝐖𝐗𝐘𝐙';
const SERIF_BOLD_LOWER = '𝐚𝐛𝐜𝐝𝐞𝐟𝐠𝐡𝐢𝐣𝐤𝐥𝐦𝐧𝐨𝐩𝐪𝐫𝐬𝐭𝐮𝐯𝐰𝐱𝐲𝐳';
const SERIF_BOLD_DIGITS = '𝟏𝟐𝟑𝟒𝟓𝟔𝟕𝟖𝟗𝟎';

const SMALL_CAPS_MAP: Record<string, string> = {
  a: 'ᴀ', b: 'ʙ', c: 'ᴄ', d: 'ᴅ', e: 'ᴇ', f: 'ꜰ', g: 'ɢ', h: 'ʜ', i: 'ɪ', j: 'ᴊ', k: 'ᴋ', l: 'ʟ', m: 'ᴍ',
  n: 'ɴ', o: 'ᴏ', p: 'ᴘ', q: 'Q', r: 'ʀ', s: 'ꜱ', t: 'ᴛ', u: 'ᴜ', v: 'ᴠ', w: 'ᴡ', x: 'x', y: 'ʏ', z: 'ᴢ'
};

/**
 * Converts a given string into Unicode Bold font (Sans-Serif Bold by default).
 */
export function toUnicodeBold(text: string, style: 'sans' | 'serif' | 'smallcaps' = 'sans'): string {
  if (!text) return '';

  return Array.from(text).map(char => {
    const code = char.charCodeAt(0);

    if (style === 'sans') {
      if (code >= 65 && code <= 90) {
        // Upper case A-Z
        const idx = code - 65;
        return Array.from(SANS_BOLD_UPPER)[idx] || char;
      }
      if (code >= 97 && code <= 122) {
        // Lower case a-z
        const idx = code - 97;
        return Array.from(SANS_BOLD_LOWER)[idx] || char;
      }
      if (code >= 48 && code <= 57) {
        // Digits 0-9 (1-9 then 0)
        const digitIndex = code === 48 ? 9 : code - 49;
        return Array.from(SANS_BOLD_DIGITS)[digitIndex] || char;
      }
    } else if (style === 'serif') {
      if (code >= 65 && code <= 90) {
        const idx = code - 65;
        return Array.from(SERIF_BOLD_UPPER)[idx] || char;
      }
      if (code >= 97 && code <= 122) {
        const idx = code - 97;
        return Array.from(SERIF_BOLD_LOWER)[idx] || char;
      }
      if (code >= 48 && code <= 57) {
        const digitIndex = code === 48 ? 9 : code - 49;
        return Array.from(SERIF_BOLD_DIGITS)[digitIndex] || char;
      }
    } else if (style === 'smallcaps') {
      const lower = char.toLowerCase();
      if (SMALL_CAPS_MAP[lower]) {
        return SMALL_CAPS_MAP[lower];
      }
    }

    return char;
  }).join('');
}

/**
 * Converts markdown bold (**text**) or (*text*) into Unicode Bold text automatically,
 * stripping markdown symbols so bot outputs use native Unicode bold font.
 * Preserves custom Unicode font characters intact!
 */
export function formatBotText(text: string, style: 'sans' | 'serif' | 'smallcaps' = 'sans'): string {
  if (!text) return '';

  // 1. Convert **bold** or __bold__ to Unicode Bold
  let formatted = text.replace(/\*\*(.*?)\*\*/g, (_, match) => toUnicodeBold(match, style));
  formatted = formatted.replace(/__(.*?)__/g, (_, match) => toUnicodeBold(match, style));

  // 2. Convert *italic* or _italic_ to Unicode Bold
  formatted = formatted.replace(/\*(.*?)\*/g, (_, match) => toUnicodeBold(match, style));
  formatted = formatted.replace(/_(.*?)_/g, (_, match) => toUnicodeBold(match, style));

  // 3. Remove code block syntax ```lang ... ``` and `code` backticks
  formatted = formatted.replace(/```[\s\S]*?```/g, (match) => {
    let content = match.slice(3, -3);
    const firstNL = content.indexOf('\n');
    if (firstNL !== -1) {
      const firstLine = content.slice(0, firstNL).trim();
      if (/^[a-zA-Z0-9_-]+$/.test(firstLine)) {
        content = content.slice(firstNL + 1);
      }
    }
    return content;
  });
  formatted = formatted.replace(/`(.*?)`/g, '$1');

  // 4. Convert markdown headings (# Heading) to Unicode Bold
  formatted = formatted.replace(/^#{1,6}\s+(.*)$/gm, (_, match) => toUnicodeBold(match, style));

  // 5. Clean strikethrough ~~text~~
  formatted = formatted.replace(/~~(.*?)~~/g, '$1');

  return formatted;
}

export function stripMarkdown(text: string): string {
  if (!text) return '';
  let cleaned = text
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/__(.*?)__/g, '$1')
    .replace(/_(.*?)_/g, '$1')
    .replace(/```[\s\S]*?```/g, (match) => {
      let content = match.slice(3, -3);
      const firstNL = content.indexOf('\n');
      if (firstNL !== -1) {
        const firstLine = content.slice(0, firstNL).trim();
        if (/^[a-zA-Z0-9_-]+$/.test(firstLine)) {
          content = content.slice(firstNL + 1);
        }
      }
      return content.trim();
    })
    .replace(/`(.*?)`/g, '$1')
    .replace(/~~(.*?)~~/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^>\s+/gm, '');
    
  // Remove markdown tables roughly
  cleaned = cleaned.replace(/\|.*\|/g, (match) => match.replace(/\|/g, ' ').trim());
  
  // Remove markdown links [text](url) -> text (url)
  cleaned = cleaned.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1 ($2)');
  
  return cleaned;
}

export function sanitizeOutgoingMessage(text: string): string {
  if (!text) return '';
  // Normalize Unicode securely (NFC)
  let result = text.normalize('NFC');
  
  // Remove Markdown
  result = stripMarkdown(result);
  
  // Collapse Extra Spaces
  result = result.replace(/ +/g, ' ').trim();
  
  return result;
}
