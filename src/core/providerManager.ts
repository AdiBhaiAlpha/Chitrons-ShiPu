import { MessagingProvider } from '../adapters/base/MessagingProvider';
import { defaultMessengerProvider } from '../adapters/messenger/MessengerProvider';
import { telegramProvider } from '../adapters/telegram/TelegramProvider';
import { messageBus } from './bus/MessageBus';
import { ProviderStatus, MessageProviderType } from './bus/messageTypes';

export class ProviderManager {
  private static instance: ProviderManager;
  private providers: Map<string, MessagingProvider> = new Map();
  private isInitialized = false;

  private constructor() {}

  public static getInstance(): ProviderManager {
    if (!ProviderManager.instance) {
      ProviderManager.instance = new ProviderManager();
    }
    return ProviderManager.instance;
  }

  private getKey(providerId: MessageProviderType, accountId?: string): string {
    return accountId ? `${providerId}:${accountId}` : providerId;
  }

  /**
   * Register and bind a provider with the ProviderManager and MessageBus.
   */
  public register(provider: MessagingProvider): void {
    const key = this.getKey(provider.providerId, provider.accountId);
    this.providers.set(key, provider);
    messageBus.registerProvider(provider);
  }

  /**
   * Unregister a provider.
   */
  public unregister(providerId: MessageProviderType, accountId?: string): void {
    const key = this.getKey(providerId, accountId);
    this.providers.delete(key);
    messageBus.unregisterProvider(providerId, accountId);
  }

  /**
   * Retrieve a specific provider by ID and optional account.
   */
  public get(providerId: MessageProviderType, accountId?: string): MessagingProvider | undefined {
    const key = this.getKey(providerId, accountId);
    return this.providers.get(key) || this.providers.get(providerId);
  }

  /**
   * Discover and start all configured messaging providers independently.
   * Continues starting healthy providers even if one encounters errors.
   */
  public async initializeAllProviders(): Promise<void> {
    if (this.isInitialized) return;
    this.isInitialized = true;

    console.log('[PROVIDER_MANAGER] Discovering and initializing messaging providers...');

    // 1. Register base providers
    this.register(defaultMessengerProvider);
    this.register(telegramProvider);

    // 2. Start Messenger provider independently (never blocks other providers)
    defaultMessengerProvider.startProvider().catch(err => {
      console.error('[PROVIDER_MANAGER] Messenger provider auto-start failed:', err);
    });

    // 3. Start Telegram provider independently (never blocks other providers)
    telegramProvider.startProvider().catch(err => {
      console.error('[PROVIDER_MANAGER] Telegram provider auto-start failed:', err);
    });

    console.log('[PROVIDER_MANAGER] All messaging transport providers dispatched.');
  }

  /**
   * Start an isolated provider without affecting any other providers.
   */
  public async startProvider(providerId: MessageProviderType, accountId?: string): Promise<boolean> {
    const provider = this.get(providerId, accountId);
    if (!provider) {
      throw new Error(`Provider [${providerId}] not found.`);
    }
    console.log(`[PROVIDER_MANAGER] Starting isolated provider [${providerId}:${accountId || 'default'}]`);
    return await provider.startProvider();
  }

  /**
   * Stop an isolated provider without affecting any other providers.
   */
  public async stopProvider(providerId: MessageProviderType, accountId?: string): Promise<boolean> {
    const provider = this.get(providerId, accountId);
    if (!provider) {
      throw new Error(`Provider [${providerId}] not found.`);
    }
    console.log(`[PROVIDER_MANAGER] Stopping isolated provider [${providerId}:${accountId || 'default'}]`);
    return await provider.stopProvider();
  }

  /**
   * Restart an isolated provider without affecting any other providers.
   */
  public async restartProvider(providerId: MessageProviderType, accountId?: string): Promise<boolean> {
    const provider = this.get(providerId, accountId);
    if (!provider) {
      throw new Error(`Provider [${providerId}] not found.`);
    }
    console.log(`[PROVIDER_MANAGER] Restarting isolated provider [${providerId}:${accountId || 'default'}]`);
    return await provider.restartProvider();
  }

  /**
   * Retrieve status for a specific provider.
   */
  public getProviderStatus(providerId: MessageProviderType, accountId?: string): ProviderStatus | null {
    const provider = this.get(providerId, accountId);
    if (!provider) return null;
    return provider.getProviderStatus();
  }

  /**
   * Retrieve status summary for all registered providers.
   */
  public getAllProviderStatuses(): ProviderStatus[] {
    return Array.from(this.providers.values()).map(p => p.getProviderStatus());
  }
}

export const providerManager = ProviderManager.getInstance();
