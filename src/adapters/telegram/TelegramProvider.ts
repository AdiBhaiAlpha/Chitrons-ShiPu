import {
  MessagingProvider,
  IncomingMessageHandler
} from '../base/MessagingProvider';
import {
  IncomingMessage,
  OutgoingMessage,
  ProviderDeliveryResult,
  ProviderStatus,
  MessageProviderType
} from '../../core/bus/messageTypes';
import { telegramBotManager } from '../../services/telegram/TelegramBotManager';
import { TelegramTransport } from '../../services/telegram/TelegramTransport';
import { TelegramMessage, TelegramUpdate } from '../../types/telegram';

export class TelegramProvider implements MessagingProvider {
  public readonly providerId: MessageProviderType = 'telegram';
  public readonly accountId: string = 'default';
  public readonly displayName: string = 'Telegram Bot API';

  private incomingHandler: IncomingMessageHandler | null = null;
  private isHooked = false;

  constructor() {
    this.setupIncomingBridge();
  }

  private setupIncomingBridge(): void {
    if (this.isHooked) return;
    this.isHooked = true;

    // Hook TelegramBotManager update dispatcher to normalize incoming updates
    telegramBotManager.setIncomingUpdateHandler(async (update: TelegramUpdate) => {
      const msg = update.message || update.edited_message || update.channel_post;
      if (!msg) return;

      const normalized = this.normalizeIncomingTelegramMessage(msg, update);
      if (this.incomingHandler && normalized) {
        await this.incomingHandler(normalized);
      }
    });
  }

  private normalizeIncomingTelegramMessage(msg: TelegramMessage, rawUpdate: TelegramUpdate): IncomingMessage | null {
    if (!msg || !msg.chat) return null;

    const sender = msg.from;
    const senderName = sender
      ? [sender.first_name, sender.last_name].filter(Boolean).join(' ') || sender.username || `User ${sender.id}`
      : 'Telegram User';

    let chatType: 'private' | 'group' | 'channel' | 'thread' = 'group';
    if (msg.chat.type === 'private') chatType = 'private';
    else if (msg.chat.type === 'channel') chatType = 'channel';

    const text = msg.text || msg.caption || '';

    return {
      provider: this.providerId,
      accountId: this.accountId,
      messageId: String(msg.message_id),
      chatId: String(msg.chat.id),
      senderId: String(sender?.id || msg.chat.id),
      senderName,
      chatType,
      text,
      timestamp: (msg.date ? msg.date * 1000 : Date.now()),
      replyToMessageId: msg.reply_to_message ? String(msg.reply_to_message.message_id) : null,
      raw: rawUpdate
    };
  }

  public setIncomingHandler(handler: IncomingMessageHandler): void {
    this.incomingHandler = handler;
  }

  public async startProvider(): Promise<boolean> {
    const res = await telegramBotManager.connect();
    return res.success;
  }

  public async stopProvider(): Promise<boolean> {
    const res = await telegramBotManager.disconnect();
    return res.success;
  }

  public async restartProvider(): Promise<boolean> {
    const res = await telegramBotManager.reconnect();
    return res.success;
  }

  public getProviderStatus(): ProviderStatus {
    const status = telegramBotManager.getStatus();
    return {
      provider: this.providerId,
      accountId: this.accountId,
      status: status.status,
      receiverStatus: status.receiverStatus,
      accountName: status.botFirstName || 'Telegram Bot',
      accountUsername: status.botUsername || '',
      accountIdOrUid: status.botId || '',
      uptimeSeconds: status.uptimeSeconds || 0,
      lastError: status.lastError,
      lastUpdateAt: status.lastUpdateAt,
      stats: status.stats
    };
  }

  public async sendOutgoing(message: OutgoingMessage): Promise<ProviderDeliveryResult> {
    try {
      const transport = telegramBotManager.getTransport();
      if (!transport) {
        return {
          success: false,
          error: 'Telegram transport not active (Bot offline)',
          timestamp: Date.now()
        };
      }

      const chatId = message.chatId;
      const text = message.text;
      const replyToMessageId = message.replyToMessageId ? Number(message.replyToMessageId) : undefined;

      // Handle file attachments if provided
      if (message.attachments && message.attachments.length > 0) {
        for (const att of message.attachments) {
          const url = typeof att === 'string' ? att : att?.url;
          if (url) {
            try {
              const res = await transport.sendPhoto(chatId, url, text, replyToMessageId);
              if (res && res.ok) {
                return {
                  messageId: String(res.result?.message_id || Date.now()),
                  success: true,
                  timestamp: Date.now()
                };
              }
            } catch (attErr) {
              console.warn('[TelegramProvider] Photo send fallback to text:', attErr);
            }
          }
        }
      }

      // Default text delivery with Markdown entity fallback
      let res = await transport.sendMessage(chatId, text, {
        parseMode: 'Markdown',
        replyToMessageId
      });

      if (!res || !res.ok) {
        res = await transport.sendMessage(chatId, text, {
          replyToMessageId
        });
      }

      return {
        messageId: String(res?.result?.message_id || `tg_msg_${Date.now()}`),
        success: res?.ok ?? false,
        timestamp: Date.now()
      };
    } catch (err: any) {
      return {
        success: false,
        error: err?.message || 'Failed to deliver message to Telegram',
        timestamp: Date.now()
      };
    }
  }
}

export const telegramProvider = new TelegramProvider();
