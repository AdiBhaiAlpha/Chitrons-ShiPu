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
import { FacebookSession } from './FacebookSession';
import { multiAccountManager } from './MultiAccountManager';
import { IMessengerAdapter, MessengerAdapterImpl } from './MessengerAdapter';

export class MessengerProvider implements MessagingProvider {
  public readonly providerId: MessageProviderType = 'messenger';
  public readonly accountId?: string;
  public readonly displayName: string = 'Facebook Messenger (FCA)';

  private session: FacebookSession;
  private incomingHandler: IncomingMessageHandler | null = null;
  private isHooked = false;

  constructor(accountId?: string, session?: FacebookSession) {
    this.accountId = accountId;
    this.session = session || new FacebookSession();
    this.setupIncomingBridge();
  }

  private setupIncomingBridge(): void {
    if (this.isHooked) return;
    this.isHooked = true;

    // Listen to MultiAccountManager global events or standalone FacebookSession
    multiAccountManager.onGlobalEvent(async (event: any) => {
      // Filter if this provider instance is dedicated to a specific accountId
      if (this.accountId && event.accountId && event.accountId !== this.accountId) {
        return;
      }

      const normalized = this.normalizeIncomingMessengerEvent(event);
      if (this.incomingHandler && normalized) {
        await this.incomingHandler(normalized);
      }
    });
  }

  private normalizeIncomingMessengerEvent(event: any): IncomingMessage | null {
    if (!event || (!event.body && !event.attachments)) return null;

    const chatId = String(event.threadID || event.thread_fbid || '');
    const senderId = String(event.senderID || event.senderId || event.author || '');
    if (!chatId || !senderId) return null;

    const messageId = String(event.messageID || event.messageId || `msg_fca_${Date.now()}`);
    const isGroup = Boolean(event.isGroup || (chatId !== senderId));

    return {
      provider: this.providerId,
      accountId: event.accountId || this.accountId || 'default',
      messageId,
      chatId,
      senderId,
      senderName: event.senderName || `User ${senderId.slice(-4)}`,
      chatType: isGroup ? 'group' : 'private',
      text: event.body || '',
      timestamp: event.timestamp || Date.now(),
      replyToMessageId: event.messageReply?.messageID || null,
      raw: event
    };
  }

  public setIncomingHandler(handler: IncomingMessageHandler): void {
    this.incomingHandler = handler;
  }

  public async startProvider(): Promise<boolean> {
    try {
      if (this.accountId) {
        const acc = multiAccountManager.getAccount(this.accountId);
        if (acc) {
          return await acc.connect();
        }
      }
      return await this.session.connect();
    } catch (err) {
      console.error('[MessengerProvider] Failed to start:', err);
      return false;
    }
  }

  public async stopProvider(): Promise<boolean> {
    try {
      if (this.accountId) {
        const acc = multiAccountManager.getAccount(this.accountId);
        if (acc) {
          await acc.disconnect();
          return true;
        }
      }
      await this.session.disconnect();
      return true;
    } catch (err) {
      console.error('[MessengerProvider] Failed to stop:', err);
      return false;
    }
  }

  public async restartProvider(): Promise<boolean> {
    await this.stopProvider();
    await new Promise(r => setTimeout(r, 1000));
    return await this.startProvider();
  }

  public getProviderStatus(): ProviderStatus {
    const meta = this.session.getSafeMetadata();
    let status: any = 'OFFLINE';
    let receiverStatus: any = 'STOPPED';

    const rawStatus = String(meta.status || '');
    if (rawStatus === 'CONNECTED' || rawStatus === 'ONLINE') {
      status = 'ONLINE';
      receiverStatus = 'RUNNING';
    } else if (rawStatus === 'CONNECTING' || rawStatus === 'VALIDATING' || rawStatus === 'RECONNECTING') {
      status = 'CONNECTING';
      receiverStatus = 'STARTING';
    } else if (rawStatus === 'AUTH_BLOCKED' || rawStatus === 'INVALID_SESSION') {
      status = 'AUTH_FAILED';
    } else if (rawStatus === 'ERROR') {
      status = 'ERROR';
    }

    return {
      provider: this.providerId,
      accountId: this.accountId || 'default',
      status,
      receiverStatus,
      accountName: meta.accountName || 'Messenger Bot',
      accountIdOrUid: meta.botUserID || '',
      uptimeSeconds: 0,
      lastError: meta.lastError,
      lastUpdateAt: meta.connectedAt ? new Date(meta.connectedAt).getTime() : undefined
    };
  }

  public async sendOutgoing(message: OutgoingMessage): Promise<ProviderDeliveryResult> {
    try {
      let adapter: IMessengerAdapter;

      if (message.accountId) {
        const acc = multiAccountManager.getAccount(message.accountId);
        if (acc) {
          adapter = (acc as any).getAdapter ? (acc as any).getAdapter() : (acc as any).adapter || new MessengerAdapterImpl(this.session);
        } else {
          adapter = new MessengerAdapterImpl(this.session);
        }
      } else {
        adapter = new MessengerAdapterImpl(this.session);
      }

      const res = await adapter.sendMessage(message.chatId, message.text, message.attachments);
      return {
        messageId: res?.messageID || `msg_fca_out_${Date.now()}`,
        success: true,
        timestamp: Date.now()
      };
    } catch (err: any) {
      return {
        success: false,
        error: err?.message || 'Failed to deliver message via Messenger adapter',
        timestamp: Date.now()
      };
    }
  }
}

export const defaultMessengerProvider = new MessengerProvider();
