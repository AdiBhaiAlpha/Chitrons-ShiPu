import mongoose from 'mongoose';
import { AsyncLocalStorage } from 'async_hooks';
import { messengerLogger } from '../adapters/messenger/MessengerLogger';
import { decryptPassword } from '../utils/crypto';
import { messengerAccountsData } from '../db/database';

export interface BotDbContext {
  accountId: string;
  connection: mongoose.Connection;
  collectionPrefix: string;
}

export class DynamicDbManager {
  private static instance: DynamicDbManager;
  
  // Maps a normalized connection string to an active Mongoose Connection
  private connectionPool = new Map<string, mongoose.Connection>();
  
  // Maps accountId to its current connection URI (for reference)
  private accountConnectionUri = new Map<string, string>();
  
  // Node.js AsyncLocalStorage to propagate active bot context down the async call stack
  private contextStorage = new AsyncLocalStorage<BotDbContext>();

  private constructor() {}

  public static getInstance(): DynamicDbManager {
    if (!DynamicDbManager.instance) {
      DynamicDbManager.instance = new DynamicDbManager();
    }
    return DynamicDbManager.instance;
  }

  /**
   * Run a callback function within the context of a specific bot's database
   */
  public runWithContext<T>(context: BotDbContext, callback: () => T): T {
    return this.contextStorage.run(context, callback);
  }

  /**
   * Get the currently active bot context (if any)
   */
  public getActiveContext(): BotDbContext | undefined {
    return this.contextStorage.getStore();
  }

  /**
   * Gets or creates a connection for a bot record.
   * Leverages Connection Pooling if multiple bots use the same URI.
   */
  public async getBotConnection(record: any): Promise<mongoose.Connection> {
    const mode = record.connectionMode || 'default';
    
    if (mode === 'default' || !record.encryptedMongoUri) {
      // Use the default/platform database connection
      return mongoose.connection;
    }

    let rawUri = '';
    try {
      rawUri = decryptPassword(record.encryptedMongoUri);
    } catch (err: any) {
      messengerLogger.error('DB_MANAGER', `Failed to decrypt Mongo URI for bot [${record.accountId}]: ${err.message}`);
      throw new Error('Failed to decrypt database connection URI.');
    }

    if (!rawUri) {
      throw new Error('Decrypted database connection URI is empty.');
    }

    // Normalization key for connection pooling
    const poolKey = rawUri.trim();

    // Check if we already have a pooled connection for this URI
    if (this.connectionPool.has(poolKey)) {
      const existingConn = this.connectionPool.get(poolKey)!;
      if (existingConn.readyState === 1) { // CONNECTED
        this.accountConnectionUri.set(record.accountId, poolKey);
        return existingConn;
      }
    }

    messengerLogger.info('DB_MANAGER', `Establishing isolated database connection for bot [${record.accountId}]...`);
    
    // Create isolated connection options
    const newConnection = mongoose.createConnection(rawUri, {
      connectTimeoutMS: 15000,
      socketTimeoutMS: 45000,
    } as any);

    this.connectionPool.set(poolKey, newConnection);
    this.accountConnectionUri.set(record.accountId, poolKey);

    // Setup connection monitoring and event listeners
    newConnection.on('connected', () => {
      messengerLogger.success('DB_MANAGER', `Database connected for bot [${record.accountId}] (Pool Size: ${this.connectionPool.size})`);
      // Update bot status to restore from offline if needed
      this.syncBotStatusIfOnline(record.accountId, true);
    });

    newConnection.on('disconnected', () => {
      messengerLogger.warn('DB_MANAGER', `Database disconnected for bot [${record.accountId}]. Attempting automatic recovery...`);
      this.syncBotStatusIfOnline(record.accountId, false);
    });

    newConnection.on('error', (err: any) => {
      messengerLogger.error('DB_MANAGER', `Database error on bot [${record.accountId}]: ${err.message}`);
      this.syncBotStatusIfOnline(record.accountId, false);
    });

    // Wait for connection to establish or timeout
    try {
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Database connection timeout.'));
        }, 15000);

        newConnection.once('connected', () => {
          clearTimeout(timeout);
          resolve();
        });

        newConnection.once('error', (err) => {
          clearTimeout(timeout);
          reject(err);
        });
      });
    } catch (err: any) {
      messengerLogger.error('DB_MANAGER', `Failed to initialize database connection for bot [${record.accountId}]: ${err.message}`);
      // Remove failed connection from pool
      this.connectionPool.delete(poolKey);
      this.accountConnectionUri.delete(record.accountId);
      throw err;
    }

    return newConnection;
  }

  /**
   * Close a bot's database connection safely, flushing any writes
   */
  public async disconnectBotDb(accountId: string): Promise<void> {
    const poolKey = this.accountConnectionUri.get(accountId);
    if (!poolKey) return;

    this.accountConnectionUri.delete(accountId);

    // Check if any other active bot is still using this pooled connection
    const inUse = Array.from(this.accountConnectionUri.values()).includes(poolKey);
    if (!inUse && this.connectionPool.has(poolKey)) {
      messengerLogger.info('DB_MANAGER', `Closing unused pooled database connection for bot [${accountId}]...`);
      const conn = this.connectionPool.get(poolKey)!;
      this.connectionPool.delete(poolKey);
      try {
        await conn.close();
        messengerLogger.success('DB_MANAGER', `Pooled database connection closed successfully.`);
      } catch (err: any) {
        messengerLogger.error('DB_MANAGER', `Error closing pooled database connection: ${err.message}`);
      }
    }
  }

  /**
   * Monitor health and sync bot status
   */
  private async syncBotStatusIfOnline(accountId: string, isHealthy: boolean): Promise<void> {
    try {
      const record = await messengerAccountsData.get(accountId);
      if (!record) return;

      if (!isHealthy) {
        if (record.status !== 'DATABASE_OFFLINE') {
          messengerLogger.error('DB_MANAGER', `Marking bot [${accountId}] as DATABASE_OFFLINE due to connection loss.`);
          await messengerAccountsData.update(accountId, { status: 'DATABASE_OFFLINE' });
        }
      } else {
        if (record.status === 'DATABASE_OFFLINE') {
          messengerLogger.info('DB_MANAGER', `Restoring bot [${accountId}] to ONLINE as database is healthy.`);
          await messengerAccountsData.update(accountId, { status: 'ONLINE' });
        }
      }
    } catch (err: any) {
      messengerLogger.error('DB_MANAGER', `Error syncing bot status: ${err.message}`);
    }
  }
}

export const dynamicDbManager = DynamicDbManager.getInstance();

(globalThis as any).getActiveBotDbContext = () => {
  return dynamicDbManager.getActiveContext();
};

