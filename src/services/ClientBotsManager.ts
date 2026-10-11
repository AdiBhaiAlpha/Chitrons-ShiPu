import { supabaseService } from './SupabaseService';
import { encryptAuthState, decryptAuthState, encryptPassword } from '../utils/crypto';
import { coerceAppState } from '../adapters/messenger/fca/normalizeAppState';
import { CookieLoader } from '../adapters/messenger/CookieLoader';
import { FCAFallbackManager } from '../adapters/messenger/fca/FCAFallbackManager';
import { MultiAccountManager } from '../adapters/messenger/MultiAccountManager';
import { AccountConnection } from '../adapters/messenger/AccountConnection';
import { messengerAccountsData } from '../db/database';
import { accountRuntimeLogManager } from './AccountRuntimeLogManager';

export class ClientBotsManager {
  private static instance: ClientBotsManager;
  private realtimeChannel: any = null;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private supervisorInterval: NodeJS.Timeout | null = null;

  // In-memory runtime registry mapping accountId -> bot state
  private runtimes = new Map<string, {
    sessionId: string;
    botId: string;
    managedVersion: number;
    accountId: string;
    lastSeen: number;
  }>();
  private activationLocks = new Set<string>();

  private fallbackManager = new FCAFallbackManager();

  private constructor() {}

  public static getInstance(): ClientBotsManager {
    if (!ClientBotsManager.instance) {
      ClientBotsManager.instance = new ClientBotsManager();
    }
    return ClientBotsManager.instance;
  }

  public async init(): Promise<void> {
    this.logConsole('SYSTEM', 'INFO', 'startup', 'Initializing Supabase Cloud Client Bots Manager...');

    // 1. Check if Supabase is configured
    if (!supabaseService.isConfigured()) {
      this.logConsole('SYSTEM', 'WARNING', 'startup', 'Supabase is not configured yet. Client Bots Manager in standby.');
      return;
    }

    // 1.5. Validate connection before starting scans and subscriptions
    try {
      const connTest = await supabaseService.testConnection();
      if (!connTest.success) {
        this.logConsole('SYSTEM', 'WARNING', 'startup', `Supabase connection validation failed (${connTest.error}). Client Bots Manager in standby.`);
        return;
      }
    } catch (testErr: any) {
      this.logConsole('SYSTEM', 'WARNING', 'startup', `Supabase connection test threw an error: ${testErr.message}. Client Bots Manager in standby.`);
      return;
    }

    try {
      // 2. Perform startup recovery of previously active bots
      await this.startupScanAndRecover();

      // 3. Start Realtime Subscriptions
      this.startRealtimeSubscriptions();

      // 4. Start 30-Second Heartbeat & Supervisor Loops
      this.startHeartbeatLoop();
      this.startSupervisorLoop();

      this.logConsole('SYSTEM', 'SUCCESS', 'startup', 'Supabase Cloud Client Bots Manager active.');
    } catch (err: any) {
      this.logConsole('SYSTEM', 'ERROR', 'startup', `Initialization error: ${err.message}`);
    }
  }

  /**
   * Scans and recovers bots that were left in running or connected states before restart.
   */
  private async startupScanAndRecover(): Promise<void> {
    try {
      const client = supabaseService.getClient();
      const { data: activeSessions, error } = await client
        .from('client_bot_sessions')
        .select('*')
        .in('status', ['running', 'connected', 'recovering', 'logging_in', 'processing', 'pending']);

      if (error) {
        if (error.message?.includes('Invalid API key') || error.message?.includes('JWT') || error.code === 'PGRST301') {
          this.logConsole('SYSTEM', 'WARNING', 'recovery', `Supabase credentials invalid (${error.message}). Client Bots Manager standing by.`);
          return;
        }
        throw error;
      }

      if (activeSessions && activeSessions.length > 0) {
        this.logConsole('SYSTEM', 'INFO', 'recovery', `Found ${activeSessions.length} active client bots. Recovering...`);
        for (const session of activeSessions) {
          // Push to activation pipeline asynchronously to avoid blocking
          this.activationPipeline(session).catch((err: any) => {
            this.log(session.bot_id, 'ERROR', 'SYSTEM', `Startup recovery failed: ${err.message}`);
          });
        }
      }
    } catch (err: any) {
      this.logConsole('SYSTEM', 'WARNING', 'recovery_error', `Startup scan error: ${err.message}`);
    }
  }

  /**
   * Starts Supabase Realtime subscriptions to listen to live insertions/updates.
   */
  public startRealtimeSubscriptions(): void {
    if (this.realtimeChannel) {
      try {
        this.realtimeChannel.unsubscribe();
      } catch {}
    }

    try {
      const client = supabaseService.getClient();

      this.realtimeChannel = client
        .channel('client_bot_changes')
        // Listen to active sessions changes
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'client_bot_sessions' },
          async (payload: any) => {
            const eventType = payload.eventType;
            const record = payload.new || payload.old;

            if (!record) return;

            if (eventType === 'INSERT') {
              if (record.status === 'pending') {
                this.log(record.bot_id, 'INFO', 'SESSION', `Realtime insert detected. Enqueuing bot for sync.`);
                this.activationPipeline(record).catch(() => {});
              }
            } else if (eventType === 'UPDATE') {
              const oldRecord = payload.old;
              if (record.status === 'pending') {
                this.log(record.bot_id, 'INFO', 'SESSION', `Realtime update detected status pending. Starting sync.`);
                this.activationPipeline(record).catch(() => {});
              } else if (record.status === 'removed') {
                this.log(record.bot_id, 'INFO', 'SESSION', `Realtime update detected status removed. Tearing down.`);
                this.handleDeleteFlow(record.bot_id).catch(() => {});
              } else if (oldRecord && record.version > oldRecord.version) {
                // Hot reload on cookie update
                this.log(record.bot_id, 'INFO', 'SESSION', `Cookie version bump detected (v${oldRecord.version} -> v${record.version}). Hot-reloading...`);
                this.activationPipeline(record).catch(() => {});
              }
            } else if (eventType === 'DELETE') {
              this.log(record.bot_id || 'unknown', 'WARNING', 'SESSION', `Session deleted from database. Cleaning up runtime...`);
              if (record.bot_id) {
                this.handleDeleteFlow(record.bot_id).catch(() => {});
              }
            }
          }
        )
        // Listen to client queue
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'client_bot_queue' },
          async (payload: any) => {
            const queueItem = payload.new;
            if (!queueItem || queueItem.status !== 'pending') return;

            this.log(queueItem.bot_id, 'INFO', 'SESSION', `Realtime queue command received: ${queueItem.action}`);
            this.processQueueItem(queueItem).catch(() => {});
          }
        )
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            this.logConsole('SYSTEM', 'INFO', 'realtime_status', `Supabase Realtime subscription status: SUBSCRIBED`);
          } else if (status === 'CHANNEL_ERROR') {
            this.logConsole('SYSTEM', 'INFO', 'realtime_status', `Supabase Realtime subscription status: CHANNEL_ERROR (Supervisor polling active as primary synchronization engine)`);
          } else if (status === 'CLOSED' || status === 'TIMED_OUT') {
            this.logConsole('SYSTEM', 'INFO', 'realtime_status', `Supabase Realtime channel ${status.toLowerCase()}; falling back to supervisor loop`);
          } else {
            this.logConsole('SYSTEM', 'INFO', 'realtime_status', `Supabase Realtime subscription status: ${status}`);
          }
        });

    } catch (err: any) {
      this.logConsole('SYSTEM', 'WARNING', 'realtime_error', `Failed to start Realtime subscription: ${err.message}`);
    }
  }

  /**
   * Processes a task item in the client queue.
   */
  private async processQueueItem(item: any): Promise<void> {
    const client = supabaseService.getClient();
    await client.from('client_bot_queue').update({ status: 'processing' }).eq('id', item.id);

    try {
      const { data: session } = await client
        .from('client_bot_sessions')
        .select('*')
        .eq('bot_id', item.bot_id)
        .single();

      if (!session) {
        throw new Error('Associated bot session not found.');
      }

      if (item.action === 'SYNC' || item.action === 'REFRESH' || item.action === 'RESTART') {
        await this.activationPipeline(session);
      } else if (item.action === 'DELETE' || item.action === 'LOGOUT') {
        await this.handleDeleteFlow(item.bot_id);
      } else if (item.action === 'RECONNECT') {
        await this.reconnectBot(item.bot_id);
      }

      await client.from('client_bot_queue').update({ status: 'completed' }).eq('id', item.id);
    } catch (err: any) {
      this.log(item.bot_id, 'ERROR', 'SYSTEM', `Queue processing failed: ${err.message}`);
      await client.from('client_bot_queue').update({ status: 'failed', last_error: err.message }).eq('id', item.id);
    }
  }

  /**
   * The Centralized Activation Pipeline:
   * Validates Cookie -> Decrypts -> FB Login -> Select FCA -> Restore Session -> Connect MQTT -> Run
   */
  public async activationPipeline(session: any): Promise<void> {
    const botId = session.bot_id;
    const accountId = `cloud_${botId}`;
    const client = supabaseService.getClient();

    if (this.activationLocks.has(accountId)) {
      this.log(botId, 'INFO', 'SESSION', 'Activation pipeline already running for this bot. Skipping duplicate event.');
      return;
    }
    this.activationLocks.add(accountId);

    try {
      this.log(botId, 'INFO', 'SESSION', 'Starting client bot activation pipeline...');
      await client.from('client_bot_sessions').update({ status: 'processing', updated_at: new Date() }).eq('id', session.id);

      // 1. Cookie validation stage
    await client.from('client_bot_sessions').update({ status: 'validating', updated_at: new Date() }).eq('id', session.id);
    const valResult = CookieLoader.validateCookieJson(session.cookie);
    if (!valResult.valid) {
      const err = valResult.error || 'Invalid cookie format';
      this.log(botId, 'ERROR', 'AUTH', `Cookie validation failed: ${err}`);
      await client.from('client_bot_sessions').update({ status: 'failed', last_error: err, updated_at: new Date() }).eq('id', session.id);
      return;
    }
    this.log(botId, 'SUCCESS', 'AUTH', 'Cookie format validation passed.');

    // 2. FB login & authentication stage
    await client.from('client_bot_sessions').update({ status: 'logging_in', updated_at: new Date() }).eq('id', session.id);
    this.log(botId, 'INFO', 'LOGIN', 'Authenticating and selecting FCA provider...');

    // coerceAppState accepts the array form and the object-export form; the old
    // `Array.isArray` guard rejected valid exports outright.
    const parsedCookies = coerceAppState(session.cookie);
      if (parsedCookies.length === 0) {
        throw new Error('Cookie payload contained no usable cookies');
      }
      const authResult = await this.fallbackManager.authenticate(parsedCookies);

      if (!authResult.connection) {
        const authErr = authResult.failureReason || 'FCA authentication failed';
        this.log(botId, 'ERROR', 'LOGIN', `FCA Authentication failed: ${authErr}. Preserving existing session if active.`);
        
        const existing = this.runtimes.get(accountId);
        if (existing) {
            await client.from('client_bot_sessions').update({ status: 'running', last_error: `Update failed: ${authErr}. Reverted to previous session.`, updated_at: new Date() }).eq('id', session.id);
        } else {
            await client.from('client_bot_sessions').update({ status: 'failed', last_error: authErr, updated_at: new Date() }).eq('id', session.id);
        }
        return;
      }

      // Stop current instance if running for version upgrade / hot reload
      const existing = this.runtimes.get(accountId);
      if (existing) {
        this.log(botId, 'INFO', 'SESSION', `Replacing current active instance (v${existing.managedVersion} -> v${session.version})`);
        await this.stopAccount(accountId);
      }

      this.log(botId, 'SUCCESS', 'LOGIN', `FB Login successful via ${authResult.activeProviderName}`);
      await client.from('client_bot_sessions').update({ status: 'connected', updated_at: new Date() }).eq('id', session.id);

      // 3. Construct DB Record in memory (NO MONGODB)
      const encryptedAuthState = encryptAuthState(session.cookie);
      const dbRecord = {
        accountId,
        uid: valResult.userId || botId,
        slotId: session.slot_id || '',
        botId: session.bot_id,
        displayName: session.owner || 'Client Bot',
        authType: 'cookie',
        provider: authResult.activeProviderName || 'FCA',
        encryptedAuthState,
        status: 'CONNECTED',
        mqttStatus: 'OFF',
        creationSource: 'CLIENT_SYNC',
        source: 'client',
        botEnabled: true,
        enabled: true,
        aiEnabled: true,
        connectionMode: session.connection_mode || 'default',
        dbName: session.db_name || '',
        updatedAt: Date.now()
      } as any;

      // 4. Initialize MQTT connection and start receiving messages
      await client.from('client_bot_sessions').update({ status: 'mqtt_connecting', updated_at: new Date() }).eq('id', session.id);
      this.log(botId, 'INFO', 'MQTT', 'Establishing MQTT listening session...');

      const multiMgr = MultiAccountManager.getInstance();
      let connection = multiMgr.getAccountConnection(accountId);

      if (!connection) {
        connection = new AccountConnection(dbRecord);
        connection.registerEventListener((evt) => {
          if (evt && (evt.type === 'message' || evt.type === 'message_reply' || Boolean(evt.body))) {
            connection?.recordIncomingMessage(
              String(evt.threadID || evt.thread_fbid || ''),
              String(evt.senderID || evt.senderId || evt.author || ''),
              String(evt.messageID || evt.messageId || '')
            );
          }
        });
        multiMgr.addAccountConnection(accountId, connection);
      } else {
        connection.updateRecord(dbRecord);
      }

      // Reuse the session authenticated above. connect() would otherwise
      // decrypt dbRecord.encryptedAuthState and perform a second Facebook
      // login for the same account.
      connection.setFcaConnection(authResult.connection, authResult.activeProviderName);

      const connected = await connection.connect();

      if (connected) {
        this.log(botId, 'SUCCESS', 'SYSTEM', 'Client bot engine fully active and running.');
        
        // Persist to MongoDB for synchronization and recovery
        try {
          await messengerAccountsData.upsert(dbRecord);
        } catch (err: any) {
          this.log(botId, 'ERROR', 'DATABASE', `Failed to persist account to MongoDB: ${err.message}`);
        }

        await client.from('client_bot_sessions').update({
          status: 'running',
          last_login: new Date(),
          last_error: '',
          updated_at: new Date()
        }).eq('id', session.id);

        // Register running instance in registry
        this.runtimes.set(accountId, {
          sessionId: session.id,
          botId: botId,
          managedVersion: session.version,
          accountId: accountId,
          lastSeen: Date.now()
        });

        // Initialize metrics record in Supabase
        await client.from('client_bot_metrics').upsert({
          bot_id: botId,
          total_messages: 0,
          ai_messages: 0,
          reconnects: 0,
          updated_at: new Date()
        }, { onConflict: 'bot_id' });

      } else {
        throw new Error('MQTT connection handshake timed out');
      }

    } catch (err: any) {
      this.log(botId, 'ERROR', 'SYSTEM', `Pipeline Error: ${err.message}`);
      await client.from('client_bot_sessions').update({
        status: 'failed',
        last_error: err.message,
        updated_at: new Date()
      }).eq('id', session.id);
    } finally {
      this.activationLocks.delete(accountId);
    }
  }

  /**
   * Direct manual reconnection triggered by user / recovery engine.
   */
  public async reconnectBot(botId: string): Promise<void> {
    const accountId = `cloud_${botId}`;
    this.log(botId, 'INFO', 'SYSTEM', 'Manual reconnect triggered. Restarting pipeline...');
    await this.stopAccount(accountId);

    const client = supabaseService.getClient();
    const { data: session } = await client
      .from('client_bot_sessions')
      .select('*')
      .eq('bot_id', botId)
      .single();

    if (session) {
      await this.activationPipeline(session);
    }
  }

  /**
   * Safe teardown & deletion flow of client bot.
   */
  public async handleDeleteFlow(botId: string): Promise<void> {
    const accountId = `cloud_${botId}`;
    this.log(botId, 'WARNING', 'SESSION', 'Client bot deletion / teardown triggered.');

    await this.stopAccount(accountId);
    this.runtimes.delete(accountId);

    // Clean up local Mongo sync mirroring
    try {
      await messengerAccountsData.delete(accountId);
    } catch {}

    const client = supabaseService.getClient();
    // Update Supabase session status to removed if still exists
    try {
      await client.from('client_bot_sessions').update({
        status: 'removed',
        updated_at: new Date()
      }).eq('bot_id', botId);
    } catch {}

    this.log(botId, 'INFO', 'SESSION', 'Client bot successfully terminated & resources released.');
  }

  /**
   * Stops an account's execution and releases all listeners.
   */
  private async stopAccount(accountId: string): Promise<void> {
    const multiMgr = MultiAccountManager.getInstance();
    try {
      await multiMgr.disconnectAccount(accountId);
      await multiMgr.removeAccount(accountId);
    } catch (err: any) {
      console.error(`[ClientBotsManager] Error stopping account ${accountId}:`, err.message);
    }
  }

  /**
   * Writes live logs programmatically to the Supabase client_bot_logs table.
   */
  public async log(botId: string, level: 'INFO' | 'WARNING' | 'ERROR' | 'SUCCESS', category: string, message: string, details: any = {}): Promise<void> {
    const timestamp = new Date().toISOString();
    const prefix = `[CLIENT_BOT][${category}][${level}] [${botId}]`;
    console.log(`${prefix} ${message}`);

    // Map log to local Runtime Log Manager for global console view
    const accountId = `cloud_${botId}`;
    const mappedLevel: 'INFO' | 'SUCCESS' | 'WARN' | 'ERROR' | 'DEBUG' = 
      level === 'ERROR' ? 'ERROR' : 
      level === 'WARNING' ? 'WARN' : 'INFO';

    accountRuntimeLogManager.addLog(accountId, {
      level: mappedLevel,
      category: category as any,
      message,
      details,
      accountId,
      accountName: 'Client Bot',
      uid: botId,
      provider: 'SupabaseClient',
      mqttStatus: 'OFF',
      stage: category
    });

    // Mirror to Supabase logs
    try {
      if (supabaseService.isConfigured()) {
        const client = supabaseService.getClient();
        const runtime = this.runtimes.get(accountId);
        await client.from('client_bot_logs').insert({
          bot_id: botId,
          session_id: runtime?.sessionId || null,
          level,
          category,
          message,
          details: typeof details === 'object' ? details : { raw: details }
        });
      }
    } catch (err: any) {
      console.error(`[ClientBotsManager] Failed to write live log to Supabase: ${err.message}`);
    }
  }

  private logConsole(tag: string, level: string, action: string, message: string): void {
    console.log(`[CLIENT_BOT_MANAGER][${tag}][${level}][${action}] ${message}`);
  }

  /**
   * Periodic loop updating bot heartbeats to Supabase every 30 seconds.
   */
  private startHeartbeatLoop(): void {
    if (this.heartbeatInterval) clearInterval(this.heartbeatInterval);

    this.heartbeatInterval = setInterval(async () => {
      if (!supabaseService.isConfigured()) return;

      const client = supabaseService.getClient();
      const multiMgr = MultiAccountManager.getInstance();

      const memUsage = process.memoryUsage();
      const heapMB = Math.round((memUsage.heapUsed / 1024 / 1024) * 100) / 100;

      for (const [accountId, runtime] of this.runtimes.entries()) {
        const conn = multiMgr.getAccountConnection(accountId);
        if (!conn) continue;

        const stats = conn.getSafeMetadata();
        const isOnline = conn.status === 'CONNECTED' || conn.status === 'ONLINE' || conn.status === 'AI_READY';

        try {
          const fbStatus = conn.status || 'DISCONNECTED';
          const mqttStatus = conn.mqttStatus || 'OFF';

          // Update active heartbeats table
          await client.from('client_bot_heartbeats').insert({
            bot_id: runtime.botId,
            session_id: runtime.sessionId,
            status: isOnline ? 'running' : 'offline',
            messages_today: stats.stats?.messagesToday || 0,
            commands_today: stats.stats?.aiMessages || 0,
            errors_today: stats.lastErrorCode ? 1 : 0,
            uptime_seconds: Math.floor((Date.now() - runtime.lastSeen) / 1000),
            cpu_usage: 1.5, // approximate
            memory_usage: heapMB,
            mqtt_status: mqttStatus,
            facebook_status: fbStatus
          });

          // Update main session heartbeat
          await client.from('client_bot_sessions').update({
            last_heartbeat: new Date(),
            updated_at: new Date()
          }).eq('id', runtime.sessionId);

          // Update runtime metrics locally mapped to session
          await client.from('client_bot_runtime').upsert({
            bot_id: runtime.botId,
            cpu: 1.5,
            memory: heapMB,
            uptime: Math.floor((Date.now() - runtime.lastSeen) / 1000),
            last_updated: new Date()
          }, { onConflict: 'bot_id' });

          // Update metrics
          if (stats.stats) {
            await client.from('client_bot_metrics').upsert({
              bot_id: runtime.botId,
              total_messages: stats.stats.totalMessages || 0,
              ai_messages: stats.stats.aiMessages || 0,
              reconnects: stats.reconnectCount || 0,
              uptime_ms: stats.sessionDurationMs || 0,
              updated_at: new Date()
            }, { onConflict: 'bot_id' });
          }

        } catch (err: any) {
          console.error(`[ClientBotsManager] Heartbeat failure for ${runtime.botId}:`, err.message);
        }
      }
    }, 30000); // 30 seconds interval as per requirement
  }

  /**
   * Supervisor loop running every 30 seconds to automatically recover broken connections.
   */
  private startSupervisorLoop(): void {
    if (this.supervisorInterval) clearInterval(this.supervisorInterval);

    this.supervisorInterval = setInterval(async () => {
      if (!supabaseService.isConfigured()) return;

      const client = supabaseService.getClient();
      const multiMgr = MultiAccountManager.getInstance();

      for (const [accountId, runtime] of this.runtimes.entries()) {
        const conn = multiMgr.getAccountConnection(accountId);

        // Auto-recovery triggering if bot went offline or disconnected unexpectedly
        if (!conn || (conn.status !== 'CONNECTED' && conn.status !== 'ONLINE' && conn.status !== 'AI_READY')) {
          this.log(runtime.botId, 'WARNING', 'SYSTEM', 'Unexpected disconnection detected. Attempting automatic recovery...');

          const { data: session } = await client
            .from('client_bot_sessions')
            .select('*')
            .eq('id', runtime.sessionId)
            .single();

          if (session && session.status !== 'removed') {
            await client.from('client_bot_sessions').update({ status: 'recovering', updated_at: new Date() }).eq('id', runtime.sessionId);
            this.activationPipeline(session).catch((err: any) => {
              this.log(runtime.botId, 'ERROR', 'SYSTEM', `Auto recovery failed: ${err.message}`);
            });
          }
        }
      }
    }, 30000); // 30 seconds check
  }

  public shutdown(): void {
    if (this.heartbeatInterval) clearInterval(this.heartbeatInterval);
    if (this.supervisorInterval) clearInterval(this.supervisorInterval);
    if (this.realtimeChannel) {
      try {
        this.realtimeChannel.unsubscribe();
      } catch {}
    }
  }
}

export const clientBotsManager = ClientBotsManager.getInstance();
export default clientBotsManager;
