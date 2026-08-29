import { MessengerAdapter } from './messengerAdapter';
import { ShiPuBotResponse, ShiPuThread, ShiPuUser } from '../types/shipu';
import { TelegramTransport } from '../services/telegram/TelegramTransport';
import { telegramLogger } from '../services/telegram/TelegramLogger';

export class TelegramAdapter implements MessengerAdapter {
  private transport: TelegramTransport;
  private botName: string;
  private knownThreads = new Map<string, Partial<ShiPuThread>>();
  private knownUsers = new Map<string, Partial<ShiPuUser>>();

  constructor(transport: TelegramTransport, botName: string = 'ShiPu Ai (Telegram)') {
    this.transport = transport;
    this.botName = botName;
  }

  public setTransport(transport: TelegramTransport) {
    this.transport = transport;
  }

  public setBotName(name: string) {
    this.botName = name;
  }

  public cacheUserInfo(userID: string, user: Partial<ShiPuUser>) {
    this.knownUsers.set(String(userID), { ...this.knownUsers.get(String(userID)), ...user });
  }

  public cacheThreadInfo(threadID: string, thread: Partial<ShiPuThread>) {
    this.knownThreads.set(String(threadID), { ...this.knownThreads.get(String(threadID)), ...thread });
  }

  async sendMessage(threadID: string, text: string, attachments?: any): Promise<ShiPuBotResponse> {
    const rawChatId = threadID.replace(/^tg_/, '');
    const chatId = rawChatId.startsWith('-') || /^\d+$/.test(rawChatId) ? rawChatId : threadID;

    // Handle single or multiple image/file/buffer attachments if provided
    if (attachments) {
      const attList = Array.isArray(attachments) ? attachments : [attachments];
      const validAtts = attList.filter(Boolean);

      if (validAtts.length > 0) {
        const primaryAtt = validAtts[0];
        let isImage = false;
        let isVideo = false;
        let isAudio = false;

        // 1. Buffer detection by inspection or magic bytes
        if (Buffer.isBuffer(primaryAtt)) {
          if (
            (primaryAtt[0] === 0xff && primaryAtt[1] === 0xd8 && primaryAtt[2] === 0xff) || // JPEG
            (primaryAtt[0] === 0x89 && primaryAtt[1] === 0x50 && primaryAtt[2] === 0x4e && primaryAtt[3] === 0x47) || // PNG
            (primaryAtt[0] === 0x47 && primaryAtt[1] === 0x49 && primaryAtt[2] === 0x46) || // GIF
            (primaryAtt[8] === 0x57 && primaryAtt[9] === 0x45 && primaryAtt[10] === 0x42 && primaryAtt[11] === 0x50) // WEBP
          ) {
            isImage = true;
          } else if (
            (primaryAtt[4] === 0x66 && primaryAtt[5] === 0x74 && primaryAtt[6] === 0x79 && primaryAtt[7] === 0x70) || // MP4 / ISO Base Media
            (primaryAtt[0] === 0x1a && primaryAtt[1] === 0x45 && primaryAtt[2] === 0xdf && primaryAtt[3] === 0xa3) // Matroska / WebM
          ) {
            isVideo = true;
          } else if (
            (primaryAtt[0] === 0x49 && primaryAtt[1] === 0x44 && primaryAtt[2] === 0x33) || // MP3 ID3
            (primaryAtt[0] === 0xff && (primaryAtt[1] & 0xe0) === 0xe0) || // MP3 sync
            (primaryAtt[0] === 0x4f && primaryAtt[1] === 0x67 && primaryAtt[2] === 0x67 && primaryAtt[3] === 0x53) // OGG
          ) {
            isAudio = true;
          } else {
            // Default binary buffer to image unless proven otherwise
            isImage = true;
          }
        }
        // 2. Stream detection with path
        else if (typeof primaryAtt === 'object' && typeof primaryAtt.pipe === 'function') {
          const filePath = (primaryAtt as any).path ? String((primaryAtt as any).path) : '';
          if (/\.(jpg|jpeg|png|gif|webp)$/i.test(filePath)) isImage = true;
          else if (/\.(mp4|mov|avi|webm|mkv)$/i.test(filePath)) isVideo = true;
          else if (/\.(mp3|wav|ogg|m4a|aac)$/i.test(filePath)) isAudio = true;
          else isImage = true;
        }
        // 3. String (URL or Local path)
        else if (typeof primaryAtt === 'string') {
          const str = primaryAtt.trim();
          if (/\.(jpg|jpeg|png|gif|webp)(\?.*)?$/i.test(str) || str.startsWith('data:image/')) isImage = true;
          else if (/\.(mp4|mov|avi|webm|mkv)(\?.*)?$/i.test(str) || str.startsWith('data:video/')) isVideo = true;
          else if (/\.(mp3|wav|ogg|m4a|aac)(\?.*)?$/i.test(str) || str.startsWith('data:audio/')) isAudio = true;
        }
        // 4. Object with url/path/data
        else if (typeof primaryAtt === 'object') {
          const target = primaryAtt.path || primaryAtt.url || primaryAtt.uri || '';
          if (/\.(jpg|jpeg|png|gif|webp)(\?.*)?$/i.test(target)) isImage = true;
          else if (/\.(mp4|mov|avi|webm|mkv)(\?.*)?$/i.test(target)) isVideo = true;
          else if (/\.(mp3|wav|ogg|m4a|aac)(\?.*)?$/i.test(target)) isAudio = true;
        }

        try {
          if (isImage) {
            const photoRes = await this.transport.sendPhoto(chatId, primaryAtt, text || undefined);
            const msgId = photoRes?.result?.message_id ? String(photoRes.result.message_id) : `tg_${Date.now()}`;
            telegramLogger.info('MESSAGE_SENT', `Photo media delivered to Telegram chat ${chatId}`, { msgId, chatId });
            return {
              messageID: msgId,
              threadID,
              body: text,
              timestamp: Date.now(),
              senderName: this.botName,
              attachments: validAtts
            };
          } else if (isVideo) {
            const videoRes = await this.transport.sendVideo(chatId, primaryAtt, text || undefined);
            const msgId = videoRes?.result?.message_id ? String(videoRes.result.message_id) : `tg_${Date.now()}`;
            telegramLogger.info('MESSAGE_SENT', `Video media delivered to Telegram chat ${chatId}`, { msgId, chatId });
            return {
              messageID: msgId,
              threadID,
              body: text,
              timestamp: Date.now(),
              senderName: this.botName,
              attachments: validAtts
            };
          } else if (isAudio) {
            const audioRes = await this.transport.sendAudio(chatId, primaryAtt, text || undefined);
            const msgId = audioRes?.result?.message_id ? String(audioRes.result.message_id) : `tg_${Date.now()}`;
            telegramLogger.info('MESSAGE_SENT', `Audio media delivered to Telegram chat ${chatId}`, { msgId, chatId });
            return {
              messageID: msgId,
              threadID,
              body: text,
              timestamp: Date.now(),
              senderName: this.botName,
              attachments: validAtts
            };
          } else {
            const docRes = await this.transport.sendDocument(chatId, primaryAtt, text || undefined);
            const msgId = docRes?.result?.message_id ? String(docRes.result.message_id) : `tg_${Date.now()}`;
            telegramLogger.info('MESSAGE_SENT', `Document media delivered to Telegram chat ${chatId}`, { msgId, chatId });
            return {
              messageID: msgId,
              threadID,
              body: text,
              timestamp: Date.now(),
              senderName: this.botName,
              attachments: validAtts
            };
          }
        } catch (mediaErr: any) {
          telegramLogger.warn('API_ERROR', `Telegram media delivery error, falling back to message: ${mediaErr?.message || mediaErr}`);
        }
      }
    }

    const res = await this.transport.sendMessage(chatId, text);
    const msgId = res?.result?.message_id ? String(res.result.message_id) : `tg_${Date.now()}`;

    if (res.ok) {
      telegramLogger.info('MESSAGE_SENT', `Message delivered to Telegram chat ${chatId}`, {
        messageId: msgId,
        chatId,
        length: text.length
      });
    } else {
      telegramLogger.warn('API_ERROR', `Telegram sendMessage failed for chat ${chatId}: ${res.description || 'Unknown error'}`, {
        chatId,
        error: res.description
      });
    }

    return {
      messageID: msgId,
      threadID,
      body: text,
      timestamp: Date.now(),
      senderName: this.botName,
      attachments
    };
  }

  async reply(threadID: string, messageID: string, text: string): Promise<ShiPuBotResponse> {
    const rawChatId = threadID.replace(/^tg_/, '');
    const chatId = rawChatId.startsWith('-') || /^\d+$/.test(rawChatId) ? rawChatId : threadID;
    const rawMsgId = messageID.replace(/^tg_/, '');
    const replyToId = parseInt(rawMsgId, 10);

    const res = await this.transport.sendMessage(chatId, text, {
      replyToMessageId: !isNaN(replyToId) ? replyToId : undefined
    });

    const msgId = res?.result?.message_id ? String(res.result.message_id) : `tg_${Date.now()}`;

    if (res.ok) {
      telegramLogger.info('MESSAGE_SENT', `Reply delivered to Telegram chat ${chatId} (in reply to ${messageID})`, {
        messageId: msgId,
        chatId,
        replyTo: messageID
      });
    } else {
      telegramLogger.warn('API_ERROR', `Telegram reply failed for chat ${chatId}: ${res.description || 'Unknown error'}`);
    }

    return {
      messageID: msgId,
      threadID,
      body: text,
      timestamp: Date.now(),
      senderName: this.botName
    };
  }

  async react(messageID: string, emoji: string): Promise<void> {
    const rawMsgId = messageID.replace(/^tg_/, '');
    const msgId = parseInt(rawMsgId, 10);
    // Find thread from cached messages or skip if unknown
    const defaultChat = Array.from(this.knownThreads.keys())[0] || '';
    if (defaultChat && !isNaN(msgId)) {
      await this.transport.setMessageReaction(defaultChat, msgId, emoji);
    }
  }

  async sendImage(threadID: string, url: any): Promise<ShiPuBotResponse> {
    return this.sendMessage(threadID, '', [url]);
  }

  async sendVideo(threadID: string, url: any): Promise<ShiPuBotResponse> {
    return this.sendMessage(threadID, '', [url]);
  }

  async sendFile(threadID: string, url: any): Promise<ShiPuBotResponse> {
    const rawChatId = threadID.replace(/^tg_/, '');
    const chatId = rawChatId.startsWith('-') || /^\d+$/.test(rawChatId) ? rawChatId : threadID;
    const res = await this.transport.sendDocument(chatId, url);
    const msgId = res?.result?.message_id ? String(res.result.message_id) : `tg_${Date.now()}`;
    return {
      messageID: msgId,
      threadID,
      body: `📁 Attachment`,
      timestamp: Date.now(),
      senderName: this.botName,
      attachments: [url]
    };
  }

  async getUserInfo(userID: string): Promise<Partial<ShiPuUser>> {
    const cached = this.knownUsers.get(String(userID));
    if (cached) return cached;
    return {
      userID,
      name: `Telegram User ${userID.slice(-4)}`
    };
  }

  async getThreadInfo(threadID: string): Promise<Partial<ShiPuThread>> {
    const cached = this.knownThreads.get(String(threadID));
    if (cached) return cached;

    const rawChatId = threadID.replace(/^tg_/, '');
    const chatRes = await this.transport.getChat(rawChatId);
    if (chatRes.ok && chatRes.result) {
      const c = chatRes.result;
      const name = c.title || `${c.first_name || ''} ${c.last_name || ''}`.trim() || c.username || `Telegram Chat ${threadID}`;
      const threadInfo: Partial<ShiPuThread> = {
        threadID,
        name,
        prefix: '#',
        language: 'en',
        members: [],
        adminIDs: []
      };
      this.knownThreads.set(threadID, threadInfo);
      return threadInfo;
    }

    return {
      threadID,
      name: `Telegram Chat ${threadID}`,
      prefix: '#'
    };
  }

  async getThreadList(): Promise<ShiPuThread[]> {
    return Array.from(this.knownThreads.values()) as ShiPuThread[];
  }

  async addUser(threadID: string, userID: string): Promise<void> {
    telegramLogger.info('MESSAGE_SENT', `addUser called on Telegram thread ${threadID} for user ${userID}`);
  }

  async removeUser(threadID: string, userID: string): Promise<void> {
    const rawChatId = threadID.replace(/^tg_/, '');
    const rawUserId = userID.replace(/^tg_/, '');
    await this.transport.banChatMember(rawChatId, rawUserId);
    telegramLogger.info('MESSAGE_SENT', `removeUser executed on Telegram chat ${threadID} for user ${userID}`);
  }

  async markAsRead(threadID: string): Promise<void> {
    const rawChatId = threadID.replace(/^tg_/, '');
    await this.transport.sendChatAction(rawChatId, 'typing');
  }
}
