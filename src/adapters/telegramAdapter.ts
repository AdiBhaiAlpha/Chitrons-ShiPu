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

  async sendMessage(threadID: string, text: string, attachments?: string[]): Promise<ShiPuBotResponse> {
    const rawChatId = threadID.replace(/^tg_/, '');
    const chatId = rawChatId.startsWith('-') || /^\d+$/.test(rawChatId) ? rawChatId : threadID;

    // Handle single or multiple image/file attachments if provided
    if (attachments && attachments.length > 0) {
      const primaryUrl = attachments[0];
      const isImage = /\.(jpg|jpeg|png|gif|webp)(\?.*)?$/i.test(primaryUrl);
      const isVideo = /\.(mp4|mov|avi|webm)(\?.*)?$/i.test(primaryUrl);

      if (isImage) {
        const photoRes = await this.transport.sendPhoto(chatId, primaryUrl, text || undefined);
        const msgId = photoRes?.result?.message_id ? String(photoRes.result.message_id) : `tg_${Date.now()}`;
        telegramLogger.info('MESSAGE_SENT', `Photo message delivered to Telegram chat ${chatId}`, { msgId, chatId });
        return {
          messageID: msgId,
          threadID,
          body: text,
          timestamp: Date.now(),
          senderName: this.botName,
          attachments
        };
      } else if (isVideo) {
        const videoRes = await this.transport.sendVideo(chatId, primaryUrl, text || undefined);
        const msgId = videoRes?.result?.message_id ? String(videoRes.result.message_id) : `tg_${Date.now()}`;
        telegramLogger.info('MESSAGE_SENT', `Video message delivered to Telegram chat ${chatId}`, { msgId, chatId });
        return {
          messageID: msgId,
          threadID,
          body: text,
          timestamp: Date.now(),
          senderName: this.botName,
          attachments
        };
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

  async sendImage(threadID: string, url: string): Promise<ShiPuBotResponse> {
    return this.sendMessage(threadID, '', [url]);
  }

  async sendVideo(threadID: string, url: string): Promise<ShiPuBotResponse> {
    return this.sendMessage(threadID, '', [url]);
  }

  async sendFile(threadID: string, url: string): Promise<ShiPuBotResponse> {
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
