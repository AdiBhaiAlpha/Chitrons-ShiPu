import { telegramLogger } from './TelegramLogger';
import { TelegramUser, TelegramUpdate, TelegramChat } from '../../types/telegram';

export interface TelegramApiResponse<T = any> {
  ok: boolean;
  result?: T;
  error_code?: number;
  description?: string;
  parameters?: {
    migrate_to_chat_id?: number;
    retry_after?: number;
  };
}

export class TelegramTransport {
  private token: string;
  private readonly baseUrl: string;

  constructor(token: string) {
    this.token = token.trim();
    this.baseUrl = `https://api.telegram.org/bot${this.token}`;
  }

  public getToken(): string {
    return this.token;
  }

  public setToken(token: string) {
    this.token = token.trim();
  }

  private async callApi<T = any>(
    method: string,
    payload?: any,
    signal?: AbortSignal,
    timeoutMs: number = 35000
  ): Promise<TelegramApiResponse<T>> {
    const url = `https://api.telegram.org/bot${this.token}/${method}`;
    const controller = new AbortController();

    let isInternalAbort = false;
    const timer = setTimeout(() => {
      isInternalAbort = true;
      controller.abort();
    }, timeoutMs);

    if (signal) {
      signal.addEventListener('abort', () => {
        controller.abort();
      });
    }

    try {
      const headers: Record<string, string> = {
        'User-Agent': 'ShiPu-AI-Telegram-Transport/2.5'
      };

      let body: string | undefined = undefined;
      if (payload && Object.keys(payload).length > 0) {
        headers['Content-Type'] = 'application/json';
        body = JSON.stringify(payload);
      }

      const res = await fetch(url, {
        method: 'POST',
        headers,
        body,
        signal: controller.signal
      });

      clearTimeout(timer);

      const json = await res.json() as TelegramApiResponse<T>;
      return json;
    } catch (err: any) {
      clearTimeout(timer);
      if (signal?.aborted || isInternalAbort) {
        throw new Error('REQUEST_ABORTED');
      }
      throw err;
    }
  }

  public async getMe(signal?: AbortSignal): Promise<TelegramApiResponse<TelegramUser>> {
    try {
      const res = await this.callApi<TelegramUser>('getMe', {}, signal, 10000);
      return res;
    } catch (err: any) {
      return {
        ok: false,
        description: err?.message || 'Network error connecting to Telegram API'
      };
    }
  }

  public async getUpdates(
    offset: number = 0,
    timeout: number = 25,
    limit: number = 50,
    signal?: AbortSignal
  ): Promise<TelegramApiResponse<TelegramUpdate[]>> {
    const payload = {
      offset,
      timeout,
      limit,
      allowed_updates: ['message', 'edited_message', 'channel_post', 'edited_channel_post', 'callback_query']
    };

    // Long poll HTTP timeout should be slightly greater than Telegram poll timeout
    const httpTimeout = (timeout + 10) * 1000;
    return this.callApi<TelegramUpdate[]>('getUpdates', payload, signal, httpTimeout);
  }

  public async sendMessage(
    chatId: number | string,
    text: string,
    options?: {
      replyToMessageId?: number | string;
      parseMode?: 'HTML' | 'Markdown' | 'MarkdownV2';
      disableWebPagePreview?: boolean;
    }
  ): Promise<TelegramApiResponse<any>> {
    const payload: any = {
      chat_id: chatId,
      text: text || ' '
    };

    if (options?.replyToMessageId) {
      payload.reply_to_message_id = options.replyToMessageId;
    }

    if (options?.parseMode) {
      payload.parse_mode = options.parseMode;
    }

    if (options?.disableWebPagePreview) {
      payload.disable_web_page_preview = true;
    }

    try {
      // First attempt with formatting if requested
      const res = await this.callApi('sendMessage', payload, undefined, 15000);
      if (!res.ok && res.description?.toLowerCase().includes('can\'t parse entities')) {
        // Fallback to plain text on Markdown/HTML entity parsing mismatch
        delete payload.parse_mode;
        return await this.callApi('sendMessage', payload, undefined, 15000);
      }
      return res;
    } catch (err: any) {
      return {
        ok: false,
        description: err?.message || 'Failed to send Telegram message'
      };
    }
  }

  public async sendPhoto(
    chatId: number | string,
    photoUrl: string,
    caption?: string,
    replyToMessageId?: number | string
  ): Promise<TelegramApiResponse<any>> {
    const payload: any = {
      chat_id: chatId,
      photo: photoUrl
    };
    if (caption) payload.caption = caption;
    if (replyToMessageId) payload.reply_to_message_id = replyToMessageId;

    try {
      return await this.callApi('sendPhoto', payload, undefined, 25000);
    } catch (err: any) {
      // Fallback: send as text message containing photo link if photo upload fails
      return this.sendMessage(chatId, `${caption ? `${caption}\n` : ''}📷 ${photoUrl}`, { replyToMessageId });
    }
  }

  public async sendDocument(
    chatId: number | string,
    documentUrl: string,
    caption?: string,
    replyToMessageId?: number | string
  ): Promise<TelegramApiResponse<any>> {
    const payload: any = {
      chat_id: chatId,
      document: documentUrl
    };
    if (caption) payload.caption = caption;
    if (replyToMessageId) payload.reply_to_message_id = replyToMessageId;

    try {
      return await this.callApi('sendDocument', payload, undefined, 30000);
    } catch (err: any) {
      return this.sendMessage(chatId, `${caption ? `${caption}\n` : ''}📁 ${documentUrl}`, { replyToMessageId });
    }
  }

  public async sendVideo(
    chatId: number | string,
    videoUrl: string,
    caption?: string,
    replyToMessageId?: number | string
  ): Promise<TelegramApiResponse<any>> {
    const payload: any = {
      chat_id: chatId,
      video: videoUrl
    };
    if (caption) payload.caption = caption;
    if (replyToMessageId) payload.reply_to_message_id = replyToMessageId;

    try {
      return await this.callApi('sendVideo', payload, undefined, 30000);
    } catch (err: any) {
      return this.sendMessage(chatId, `${caption ? `${caption}\n` : ''}🎥 ${videoUrl}`, { replyToMessageId });
    }
  }

  public async setMessageReaction(
    chatId: number | string,
    messageId: number | string,
    emoji: string
  ): Promise<TelegramApiResponse<any>> {
    const payload = {
      chat_id: chatId,
      message_id: messageId,
      reaction: [{ type: 'emoji', emoji: emoji || '👍' }]
    };
    try {
      return await this.callApi('setMessageReaction', payload, undefined, 10000);
    } catch (err: any) {
      return { ok: false, description: err?.message };
    }
  }

  public async sendChatAction(
    chatId: number | string,
    action: 'typing' | 'upload_photo' | 'record_video' | 'upload_video' | 'record_voice' | 'upload_document' = 'typing'
  ): Promise<TelegramApiResponse<any>> {
    try {
      return await this.callApi('sendChatAction', { chat_id: chatId, action }, undefined, 6000);
    } catch {
      return { ok: false };
    }
  }

  public async getChat(chatId: number | string): Promise<TelegramApiResponse<TelegramChat>> {
    try {
      return await this.callApi<TelegramChat>('getChat', { chat_id: chatId }, undefined, 10000);
    } catch (err: any) {
      return { ok: false, description: err?.message };
    }
  }

  public async getChatAdministrators(chatId: number | string): Promise<TelegramApiResponse<any[]>> {
    try {
      return await this.callApi<any[]>('getChatAdministrators', { chat_id: chatId }, undefined, 10000);
    } catch (err: any) {
      return { ok: false, description: err?.message, result: [] };
    }
  }

  public async banChatMember(chatId: number | string, userId: number | string): Promise<TelegramApiResponse<any>> {
    try {
      return await this.callApi('banChatMember', { chat_id: chatId, user_id: userId }, undefined, 10000);
    } catch (err: any) {
      return { ok: false, description: err?.message };
    }
  }

  public async unbanChatMember(chatId: number | string, userId: number | string): Promise<TelegramApiResponse<any>> {
    try {
      return await this.callApi('unbanChatMember', { chat_id: chatId, user_id: userId, only_if_banned: true }, undefined, 10000);
    } catch (err: any) {
      return { ok: false, description: err?.message };
    }
  }
}
