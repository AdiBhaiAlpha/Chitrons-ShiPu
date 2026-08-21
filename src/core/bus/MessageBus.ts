import {
  IncomingMessage,
  OutgoingMessage,
  ProviderDeliveryResult,
  MessageProviderType
} from './messageTypes';
import { MessagingProvider, IncomingMessageHandler } from '../../adapters/base/MessagingProvider';

export type CoreMessageProcessor = (message: IncomingMessage) => Promise<OutgoingMessage | void>;

export class UnifiedMessageBus {
  private static instance: UnifiedMessageBus;
  private providers: Map<string, MessagingProvider> = new Map();
  private coreProcessor: CoreMessageProcessor | null = null;
  private incomingListeners: ((msg: IncomingMessage) => void)[] = [];
  private outgoingListeners: ((msg: OutgoingMessage) => void)[] = [];

  private constructor() {}

  public static getInstance(): UnifiedMessageBus {
    if (!UnifiedMessageBus.instance) {
      UnifiedMessageBus.instance = new UnifiedMessageBus();
    }
    return UnifiedMessageBus.instance;
  }

  private getProviderKey(providerId: MessageProviderType, accountId?: string): string {
    return accountId ? `${providerId}:${accountId}` : providerId;
  }

  /**
   * Register a transport provider with the unified bus.
   */
  public registerProvider(provider: MessagingProvider): void {
    const key = this.getProviderKey(provider.providerId, provider.accountId);
    this.providers.set(key, provider);

    // Wire up incoming handler to the bus
    provider.setIncomingHandler(async (incoming: IncomingMessage) => {
      return this.publishIncoming(incoming);
    });

    console.log(`[MESSAGE_BUS] Registered provider: [${key}] (${provider.displayName})`);
  }

  /**
   * Unregister a transport provider from the bus.
   */
  public unregisterProvider(providerId: MessageProviderType, accountId?: string): void {
    const key = this.getProviderKey(providerId, accountId);
    this.providers.delete(key);
    console.log(`[MESSAGE_BUS] Unregistered provider: [${key}]`);
  }

  /**
   * Retrieve a registered provider.
   */
  public getProvider(providerId: MessageProviderType, accountId?: string): MessagingProvider | undefined {
    // Exact match first (providerId:accountId)
    if (accountId) {
      const exact = this.providers.get(this.getProviderKey(providerId, accountId));
      if (exact) return exact;
    }
    // Fallback to default provider for that providerId
    return this.providers.get(providerId);
  }

  /**
   * Retrieve all registered providers.
   */
  public getAllProviders(): MessagingProvider[] {
    return Array.from(this.providers.values());
  }

  /**
   * Set the core AI & Command processor (e.g. ShiPuBotEngine).
   */
  public setCoreProcessor(processor: CoreMessageProcessor): void {
    this.coreProcessor = processor;
  }

  /**
   * Add a listener for incoming messages (e.g. for telemetry, audit, UI simulator).
   */
  public onIncoming(listener: (msg: IncomingMessage) => void): () => void {
    this.incomingListeners.push(listener);
    return () => {
      this.incomingListeners = this.incomingListeners.filter(l => l !== listener);
    };
  }

  /**
   * Add a listener for outgoing messages.
   */
  public onOutgoing(listener: (msg: OutgoingMessage) => void): () => void {
    this.outgoingListeners.push(listener);
    return () => {
      this.outgoingListeners = this.outgoingListeners.filter(l => l !== listener);
    };
  }

  /**
   * Publish an incoming message from ANY provider to the unified bus.
   * Routes the message through ShiPu AI Core and delivers any generated response.
   */
  public async publishIncoming(incoming: IncomingMessage): Promise<OutgoingMessage | void> {
    if (!incoming || !incoming.provider || !incoming.chatId) {
      console.warn('[MESSAGE_BUS] Dropping invalid incoming message:', incoming);
      return;
    }

    // Notify incoming listeners
    this.incomingListeners.forEach(listener => {
      try {
        listener(incoming);
      } catch (err) {
        console.error('[MESSAGE_BUS] Incoming listener error:', err);
      }
    });

    if (!this.coreProcessor) {
      console.warn('[MESSAGE_BUS] No core processor registered to handle incoming message');
      return;
    }

    try {
      // Execute ShiPu AI Core (Parser -> Permissions -> AI -> Business Logic)
      const response = await this.coreProcessor(incoming);

      if (response && response.text) {
        // Enforce strict identity retention
        response.provider = incoming.provider;
        response.accountId = incoming.accountId;
        response.chatId = incoming.chatId;

        // Deliver response back through originating provider
        await this.sendOutgoing(response);
        return response;
      }
    } catch (err: any) {
      console.error(`[MESSAGE_BUS] Error in core message processor [${incoming.provider}:${incoming.chatId}]:`, err);
    }
  }

  /**
   * Deliver an outgoing message to its matching destination provider.
   * Guarantees strict provider boundary isolation (Telegram only -> Telegram, Messenger only -> Messenger).
   */
  public async sendOutgoing(outgoing: OutgoingMessage): Promise<ProviderDeliveryResult> {
    if (!outgoing || !outgoing.provider || !outgoing.chatId) {
      return {
        success: false,
        error: 'Invalid outgoing message format: missing provider or chatId'
      };
    }

    // Notify outgoing listeners
    this.outgoingListeners.forEach(listener => {
      try {
        listener(outgoing);
      } catch (err) {
        console.error('[MESSAGE_BUS] Outgoing listener error:', err);
      }
    });

    const provider = this.getProvider(outgoing.provider, outgoing.accountId);
    if (!provider) {
      const err = `No active provider found for [provider=${outgoing.provider}, account=${outgoing.accountId || 'default'}]`;
      console.error(`[MESSAGE_BUS] ${err}`);
      return {
        success: false,
        error: err
      };
    }

    try {
      return await provider.sendOutgoing(outgoing);
    } catch (err: any) {
      console.error(`[MESSAGE_BUS] Delivery error via provider [${outgoing.provider}]:`, err);
      return {
        success: false,
        error: err?.message || 'Delivery error',
        timestamp: Date.now()
      };
    }
  }
}

export const messageBus = UnifiedMessageBus.getInstance();
