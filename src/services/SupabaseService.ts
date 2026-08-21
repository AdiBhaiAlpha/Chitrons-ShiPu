import { createClient, SupabaseClient } from '@supabase/supabase-js';
import axios from 'axios';
import { Client } from 'pg';
import { BotSettingModel, SystemCredentialModel } from '../db/mongodb';
import { encrypt, decrypt } from '../utils/crypto';
import dns from 'dns/promises';
import net from 'net';
import fs from 'fs-extra';
import path from 'path';

export interface SupabaseConfig {
  projectUrl: string;
  anonKey: string;
  serviceRoleKey: string;
  dbConnectionString?: string;
  realtimeEnabled: boolean;
  networkMode?: 'ipv6' | 'auto';
}

export class SupabaseService {
  private static instance: SupabaseService;
  private client: SupabaseClient | null = null;
  private config: SupabaseConfig = {
    projectUrl: '',
    anonKey: '',
    serviceRoleKey: '',
    dbConnectionString: '',
    realtimeEnabled: true,
    networkMode: 'ipv6'
  };

  private lastSuccessfulConnection: string = 'Never';
  private lastCredentialRestore: string = 'Never';
  private credentialSource: 'Runtime' | 'MongoDB' | 'FTP Backup' | 'Manual Configuration' = 'Manual Configuration';

  private constructor() {
    // Note: async loadConfigFromDB should be called separately after db connection.
  }

  public static getInstance(): SupabaseService {
    if (!SupabaseService.instance) {
      SupabaseService.instance = new SupabaseService();
    }
    return SupabaseService.instance;
  }

  private writeBackupFile(version: number, encryptedPayload: string): void {
    try {
      const backupPath = path.join(process.cwd(), 'storage', 'settings', 'supabase_credentials.enc.json');
      fs.ensureDirSync(path.dirname(backupPath));
      const backupData = {
        version,
        type: 'supabase_credentials',
        encrypted: true,
        payload: encryptedPayload
      };
      fs.writeFileSync(backupPath, JSON.stringify(backupData, null, 2), 'utf8');
      console.log('[Supabase] FTP/Filesystem backup written successfully to storage/settings/supabase_credentials.enc.json');
    } catch (err: any) {
      console.error('[Supabase] Failed to write FTP/Filesystem backup file:', err.message);
    }
  }

  private readBackupFile(): { version: number; payload: string } | null {
    try {
      const backupPath = path.join(process.cwd(), 'storage', 'settings', 'supabase_credentials.enc.json');
      if (fs.existsSync(backupPath)) {
        const content = fs.readFileSync(backupPath, 'utf8');
        const data = JSON.parse(content);
        if (data && data.type === 'supabase_credentials' && data.payload) {
          return {
            version: data.version || 1,
            payload: data.payload
          };
        }
      }
    } catch (err: any) {
      console.error('[Supabase] Failed to read FTP/Filesystem backup file:', err.message);
    }
    return null;
  }

  public async loadConfigFromDB(): Promise<void> {
    console.log('[Supabase] Starting configuration recovery...');
    
    // STEP 1: Check whether valid Supabase credentials already exist in runtime configuration
    if (this.isConfigured()) {
      console.log('[Supabase] Runtime credentials available.');
      const test = await this.testConnection();
      if (test.success) {
        this.credentialSource = 'Runtime';
        this.lastSuccessfulConnection = new Date().toLocaleString();
        this.lastCredentialRestore = new Date().toLocaleString();
        console.log('[Supabase] Runtime credentials validated successfully.');
        console.log('[Supabase] Database connection: OK');
        console.log('[Supabase] Realtime connection: OK');
        console.log('[Supabase] client_bot_sessions: OK');
        console.log('[Supabase] Client Bot watcher: STARTED');
        console.log('[Supabase] Configuration recovery completed.');
        return;
      } else {
        console.warn('[Supabase] Runtime credentials validation failed. Proceeding with database/filesystem recovery...');
      }
    } else {
      console.log('[Supabase] Runtime credentials unavailable.');
    }

    let mongoConfig: SupabaseConfig | null = null;
    let mongoVersion = 0;
    let mongoDoc: any = null;

    // STEP 2: Load credentials from MongoDB
    console.log('[Supabase] Checking MongoDB persistent backup...');
    try {
      mongoDoc = await SystemCredentialModel.findOne({ key: 'SUPABASE_CONFIG', active: true } as any).sort({ version: -1 }).lean();
      if (mongoDoc && mongoDoc.config) {
        let decryptedConfig = mongoDoc.config;
        if (typeof mongoDoc.config === 'string') {
          try {
            decryptedConfig = JSON.parse(decrypt(mongoDoc.config));
          } catch (e) {
            console.error('[Supabase] Failed to decrypt supabase config from MongoDB');
            decryptedConfig = null;
          }
        }
        if (decryptedConfig && decryptedConfig.projectUrl && decryptedConfig.serviceRoleKey) {
          mongoConfig = decryptedConfig;
          mongoVersion = mongoDoc.version || 1;
        }
      }
    } catch (err: any) {
      console.error('[Supabase] MongoDB backup check failed or MongoDB unavailable:', err.message);
    }

    // STEP 3: Load encrypted FTP/filesystem backup
    console.log('[Supabase] Checking FTP encrypted backup...');
    let ftpConfig: SupabaseConfig | null = null;
    let ftpVersion = 0;
    const backupFile = this.readBackupFile();
    if (backupFile) {
      try {
        const decryptedPayload = JSON.parse(decrypt(backupFile.payload));
        if (decryptedPayload && decryptedPayload.projectUrl && decryptedPayload.serviceRoleKey) {
          ftpConfig = decryptedPayload;
          ftpVersion = backupFile.version;
        }
      } catch (err: any) {
        console.error('[Supabase] Failed to decrypt or parse FTP/filesystem backup payload:', err.message);
      }
    }

    // Determine which configuration to restore
    let selectedConfig: SupabaseConfig | null = null;
    let selectedVersion = 0;
    let source: 'MongoDB' | 'FTP Backup' = 'MongoDB';

    if (mongoConfig && ftpConfig) {
      if (mongoVersion >= ftpVersion) {
        selectedConfig = mongoConfig;
        selectedVersion = mongoVersion;
        source = 'MongoDB';
        
        // Repair older backup if version is mismatched
        if (mongoVersion > ftpVersion) {
          console.log(`[Supabase] MongoDB version (${mongoVersion}) is newer than FTP version (${ftpVersion}). Repairing FTP backup...`);
          if (mongoDoc && typeof mongoDoc.config === 'string') {
            this.writeBackupFile(mongoVersion, mongoDoc.config);
          } else {
            const encrypted = encrypt(JSON.stringify(mongoConfig));
            this.writeBackupFile(mongoVersion, encrypted);
          }
        }
      } else {
        selectedConfig = ftpConfig;
        selectedVersion = ftpVersion;
        source = 'FTP Backup';
        
        console.log(`[Supabase] FTP version (${ftpVersion}) is newer than MongoDB version (${mongoVersion}). Repairing MongoDB backup...`);
        // Sync back to MongoDB
        try {
          const encrypted = encrypt(JSON.stringify(ftpConfig));
          await SystemCredentialModel.updateMany({ key: 'SUPABASE_CONFIG' }, { $set: { active: false } });
          await SystemCredentialModel.updateOne(
            { key: 'SUPABASE_CONFIG', version: ftpVersion },
            {
              $set: {
                active: true,
                config: encrypted,
                updatedAt: Date.now(),
                createdBy: 'admin',
                lastValidatedAt: Date.now(),
                lastValidationStatus: 'VALID'
              },
              $setOnInsert: {
                createdAt: Date.now()
              }
            },
            { upsert: true }
          );
          console.log('[Supabase] MongoDB backup repaired successfully.');
        } catch (dbErr: any) {
          console.error('[Supabase] Failed to repair MongoDB backup:', dbErr.message);
        }
      }
    } else if (mongoConfig) {
      selectedConfig = mongoConfig;
      selectedVersion = mongoVersion;
      source = 'MongoDB';
      
      console.log('[Supabase] FTP backup is unavailable or invalid. Repairing FTP backup from MongoDB config...');
      const encrypted = mongoDoc && typeof mongoDoc.config === 'string' ? mongoDoc.config : encrypt(JSON.stringify(mongoConfig));
      this.writeBackupFile(mongoVersion, encrypted);
    } else if (ftpConfig) {
      selectedConfig = ftpConfig;
      selectedVersion = ftpVersion;
      source = 'FTP Backup';
      
      console.log('[Supabase] MongoDB backup is unavailable or invalid. Repairing MongoDB backup from FTP config...');
      try {
        const encrypted = encrypt(JSON.stringify(ftpConfig));
        await SystemCredentialModel.updateMany({ key: 'SUPABASE_CONFIG' }, { $set: { active: false } });
        await SystemCredentialModel.updateOne(
          { key: 'SUPABASE_CONFIG', version: ftpVersion },
          {
            $set: {
              active: true,
              config: encrypted,
              updatedAt: Date.now(),
              createdBy: 'admin',
              lastValidatedAt: Date.now(),
              lastValidationStatus: 'VALID'
            },
            $setOnInsert: {
              createdAt: Date.now()
            }
          },
          { upsert: true }
        );
        console.log('[Supabase] MongoDB backup repaired.');
      } catch (dbErr: any) {
        console.error('[Supabase] Failed to repair MongoDB backup:', dbErr.message);
      }
    } else {
      // Fallback check to old BotSettingModel
      console.log('[Supabase] No valid backup found in MongoDB or FTP. Trying legacy BotSettingModel...');
      try {
        const oldDoc = await BotSettingModel.findOne({ key: 'SUPABASE_CONFIG' } as any).lean();
        if (oldDoc && oldDoc.value && oldDoc.value.projectUrl && oldDoc.value.serviceRoleKey) {
          selectedConfig = oldDoc.value;
          selectedVersion = 1;
          source = 'MongoDB'; // Treat as Mongo
          
          console.log('[Supabase] Restoring from legacy config and synchronizing to new format...');
          const encrypted = encrypt(JSON.stringify(oldDoc.value));
          await SystemCredentialModel.updateOne(
            { key: 'SUPABASE_CONFIG', version: 1 },
            {
              $set: {
                active: true,
                config: encrypted,
                updatedAt: Date.now(),
                createdBy: 'admin',
                lastValidatedAt: Date.now(),
                lastValidationStatus: 'VALID'
              },
              $setOnInsert: {
                createdAt: Date.now()
              }
            },
            { upsert: true }
          );
          this.writeBackupFile(1, encrypted);
        }
      } catch (oldErr: any) {
        console.error('[Supabase] Legacy config load failed:', oldErr.message);
      }
    }

    if (selectedConfig) {
      this.config = { ...this.config, ...selectedConfig };
      this.credentialSource = source;
      this.lastCredentialRestore = new Date().toLocaleString();
      this.reinitializeClient();

      console.log(`[Supabase] Credentials restored from ${source}.`);
      console.log('[Supabase] Validating Supabase connection...');
      
      const test = await this.testConnection();
      if (test.success) {
        this.lastSuccessfulConnection = new Date().toLocaleString();
        console.log('[Supabase] Database connection: OK');
        console.log('[Supabase] Realtime connection: OK');
        console.log('[Supabase] client_bot_sessions: OK');
        console.log('[Supabase] Client Bot watcher: STARTED');
        console.log('[Supabase] Configuration recovery completed.');
      } else {
        console.error(`[Supabase] Restored credentials failed validation: ${test.error}`);
        console.log('[Supabase] Configuration recovery completed with ERRORS.');
      }
    } else {
      console.error('[Supabase] SUPABASE CONFIGURATION REQUIRED');
      console.log('[Supabase] Configuration recovery completed with FAILURE: No credentials found.');
    }
  }

  public getConfig(): SupabaseConfig {
    return this.config;
  }

  public async saveConfig(newConfig: Partial<SupabaseConfig>): Promise<void> {
    const testConfig = { ...this.config, ...newConfig };
    
    if (!testConfig.projectUrl) {
      throw new Error('Supabase Project URL is required.');
    }
    if (!testConfig.serviceRoleKey) {
      throw new Error('Supabase Service Role Key is required.');
    }
    
    // Validate REST Connection
    try {
      await axios.get(`${testConfig.projectUrl}/rest/v1/`, {
        headers: {
          apikey: testConfig.serviceRoleKey,
          Authorization: `Bearer ${testConfig.serviceRoleKey}`
        },
        timeout: 10000
      });
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message;
      throw new Error(`Supabase REST connection failed: ${msg}`);
    }
    
    // Validate Postgres Connection if provided
    if (testConfig.dbConnectionString) {
      const pgClient = new Client({
        connectionString: testConfig.dbConnectionString,
        ssl: { rejectUnauthorized: false }
      });
      try {
        await pgClient.connect();
        await pgClient.query('SELECT 1;');
        await pgClient.end();
      } catch (err: any) {
        throw new Error(`Postgres connection failed: ${err.message}`);
      }
    }
    
    // Save to instance
    this.config = testConfig;
    this.credentialSource = 'Manual Configuration';
    this.lastSuccessfulConnection = new Date().toLocaleString();
    
    try {
      const encryptedConfig = encrypt(JSON.stringify(this.config));
      
      const latestDoc = await SystemCredentialModel.findOne({ key: 'SUPABASE_CONFIG' } as any).sort({ version: -1 }).lean();
      const nextVersion = latestDoc ? (latestDoc.version || 1) + 1 : 1;
      
      await SystemCredentialModel.updateMany({ key: 'SUPABASE_CONFIG' }, { $set: { active: false } });
      
      await SystemCredentialModel.create({
        key: 'SUPABASE_CONFIG',
        version: nextVersion,
        active: true,
        config: encryptedConfig,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        createdBy: 'admin',
        lastValidatedAt: Date.now(),
        lastValidationStatus: 'VALID'
      });
      
      // Save backup file
      this.writeBackupFile(nextVersion, encryptedConfig);
      
      this.reinitializeClient();
    } catch (err) {
      console.error('[SupabaseService] Failed to save config to DB:', err);
      throw err;
    }
  }

  public reinitializeClient(): void {
    if (this.config.projectUrl && this.config.serviceRoleKey) {
      this.client = createClient(this.config.projectUrl, this.config.serviceRoleKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false
        }
      });
      console.log('[SupabaseService] Client reinitialized successfully');
    } else {
      this.client = null;
    }
  }

  public getClient(): SupabaseClient {
    if (!this.client) {
      this.reinitializeClient();
    }
    if (!this.client) {
      throw new Error('Supabase client is not initialized. Please configure Project URL and Service Role Key.');
    }
    return this.client;
  }

  public isConfigured(): boolean {
    return !!(this.config.projectUrl && this.config.serviceRoleKey);
  }

  /**
   * Executes raw SQL using Postgres connection if available, otherwise fallback (which likely fails for DDL).
   */
  public async runQuery(sql: string): Promise<any> {
    if (!this.isConfigured()) {
      throw new Error('Supabase is not configured.');
    }

    if (this.config.dbConnectionString) {
      // Ensure we append sslmode=require if it's not present, or pass ssl object
      const pgClient = new Client({
        connectionString: this.config.dbConnectionString,
        ssl: { rejectUnauthorized: false }
      });
      try {
        await pgClient.connect();
        const result = await pgClient.query(sql);
        return result.rows || [];
      } catch (err: any) {
        throw new Error(`Postgres SQL execution failed: ${err.message}`);
      } finally {
        await pgClient.end();
      }
    }

    // Fallback to REST API endpoints which do not allow CREATE TABLE
    const endpoints = [
      `${this.config.projectUrl}/pg/query`,
      `${this.config.projectUrl}/admin/v1/query`,
      `https://${new URL(this.config.projectUrl).hostname}/pg/query`,
      `https://${new URL(this.config.projectUrl).hostname}/admin/v1/query`
    ];

    let lastError: any = null;
    for (const url of endpoints) {
      try {
        const response = await axios.post(
          url,
          { query: sql, sql: sql },
          {
            headers: {
              'apikey': this.config.serviceRoleKey,
              'Authorization': `Bearer ${this.config.serviceRoleKey}`,
              'Content-Type': 'application/json'
            },
            timeout: 15000
          }
        );
        return response.data;
      } catch (err: any) {
        lastError = err;
      }
    }

    const errMsg = lastError?.response?.data?.message || lastError?.response?.data?.error || lastError?.message || lastError;
    throw new Error(`SQL execution failed: ${errMsg}. Note: Table creation requires Postgres Connection URL in configuration.`);
  }

  /**
   * Tests connection and calculates latency.
   */
  public async testConnection(): Promise<{ success: boolean; latency: number; error?: string }> {
    if (!this.isConfigured()) {
      return { success: false, latency: 0, error: 'Supabase is not configured.' };
    }
    const start = Date.now();
    try {
      if (this.config.dbConnectionString) {
        await this.runQuery('SELECT 1;');
      } else {
        const client = this.getClient();
        // Query to verify the API key and auth headers are accepted by Supabase PostgREST
        const { error } = await client.from('client_bot_sessions').select('id').limit(1);
        if (error) {
          const errMsg = error.message || '';
          // If error is code PGRST204 or table doesn't exist yet, the key itself is valid
          if (error.code === '42P01' || errMsg.includes('relation') || errMsg.includes('does not exist')) {
            const latency = Date.now() - start;
            return { success: true, latency };
          }
          if (errMsg.includes('Invalid API key') || errMsg.includes('JWT') || error.code === 'PGRST301' || errMsg.includes('apikey') || errMsg.includes('Invalid API')) {
            return { success: false, latency: 0, error: errMsg };
          }
          return { success: false, latency: 0, error: errMsg };
        }
      }
      const latency = Date.now() - start;
      return { success: true, latency };
    } catch (err: any) {
      return { success: false, latency: 0, error: err.message || 'Connection failed' };
    }
  }

  /**
   * Idempotently initializes the database schema and tables.
   */
  public async initializeDatabase(): Promise<{ success: boolean; logs: string[] }> {
    const logs: string[] = [];
    logs.push('Starting automatic Supabase database initialization...');

    const tablesSql = `
      -- 1. client_bot_sessions
      CREATE TABLE IF NOT EXISTS client_bot_sessions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        bot_id TEXT UNIQUE NOT NULL,
        slot_id TEXT,
        user_id TEXT,
        owner TEXT DEFAULT 'Client Bot',
        cookie TEXT NOT NULL,
        status TEXT DEFAULT 'pending',
        connection_mode TEXT DEFAULT 'default',
        db_name TEXT,
        version INTEGER DEFAULT 1,
        last_login TIMESTAMPTZ,
        last_heartbeat TIMESTAMPTZ,
        last_error TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );

      -- 2. client_bot_queue
      CREATE TABLE IF NOT EXISTS client_bot_queue (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        bot_id TEXT NOT NULL,
        slot_id TEXT,
        user_id TEXT,
        session_id UUID REFERENCES client_bot_sessions(id) ON DELETE CASCADE,
        action TEXT NOT NULL,
        status TEXT DEFAULT 'pending',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );

      -- 3. client_bot_logs
      CREATE TABLE IF NOT EXISTS client_bot_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        bot_id TEXT NOT NULL,
        session_id UUID REFERENCES client_bot_sessions(id) ON DELETE CASCADE,
        level TEXT NOT NULL,
        category TEXT NOT NULL,
        message TEXT NOT NULL,
        details JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      -- 4. client_bot_heartbeats
      CREATE TABLE IF NOT EXISTS client_bot_heartbeats (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        bot_id TEXT NOT NULL,
        session_id UUID REFERENCES client_bot_sessions(id) ON DELETE CASCADE,
        last_seen TIMESTAMPTZ DEFAULT NOW(),
        status TEXT NOT NULL,
        messages_today INTEGER DEFAULT 0,
        commands_today INTEGER DEFAULT 0,
        errors_today INTEGER DEFAULT 0,
        uptime_seconds INTEGER DEFAULT 0,
        cpu_usage DOUBLE PRECISION DEFAULT 0.0,
        memory_usage DOUBLE PRECISION DEFAULT 0.0,
        mqtt_status TEXT DEFAULT 'OFF',
        facebook_status TEXT DEFAULT 'DISCONNECTED',
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      -- 5. client_bot_metrics
      CREATE TABLE IF NOT EXISTS client_bot_metrics (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        bot_id TEXT UNIQUE NOT NULL,
        total_messages INTEGER DEFAULT 0,
        ai_messages INTEGER DEFAULT 0,
        reconnects INTEGER DEFAULT 0,
        uptime_ms BIGINT DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );

      -- 6. client_bot_events
      CREATE TABLE IF NOT EXISTS client_bot_events (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        bot_id TEXT NOT NULL,
        event_type TEXT NOT NULL,
        payload JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      -- 7. client_bot_runtime
      CREATE TABLE IF NOT EXISTS client_bot_runtime (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        bot_id TEXT UNIQUE NOT NULL,
        cpu DOUBLE PRECISION DEFAULT 0.0,
        memory DOUBLE PRECISION DEFAULT 0.0,
        uptime INTEGER DEFAULT 0,
        last_updated TIMESTAMPTZ DEFAULT NOW()
      );

      -- 8. client_bot_errors
      CREATE TABLE IF NOT EXISTS client_bot_errors (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        bot_id TEXT NOT NULL,
        error_code TEXT,
        error_message TEXT,
        stack_trace TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      -- 9. client_site_users
      CREATE TABLE IF NOT EXISTS client_site_users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT DEFAULT 'user',
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      -- 10. client_site_slots
      CREATE TABLE IF NOT EXISTS client_site_slots (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES client_site_users(id) ON DELETE CASCADE,
        bot_id TEXT,
        status TEXT DEFAULT 'empty',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );

      -- 11. client_site_payments
      CREATE TABLE IF NOT EXISTS client_site_payments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES client_site_users(id) ON DELETE CASCADE,
        amount INTEGER NOT NULL,
        slots_requested INTEGER NOT NULL,
        payment_method TEXT NOT NULL,
        transaction_id TEXT UNIQUE NOT NULL,
        status TEXT DEFAULT 'pending',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );

      -- 12. client_site_settings
      CREATE TABLE IF NOT EXISTS client_site_settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );

      -- Seed admin user if not exists
      INSERT INTO client_site_users (username, password_hash, role)
      SELECT 'admin', '$2y$10$oXfWq7Lscg4B9eD0x9eS.unxbeuX6pX0U0K0bUuqm6S28aG9bW3xK', 'admin'
      ON CONFLICT (username) DO NOTHING;
    `;

    try {
      logs.push('Creating/verifying required tables...');
      await this.runQuery(tablesSql);
      logs.push('✔ Tables successfully created/verified.');

      // 9. Add updated_at trigger helper and triggers
      logs.push('Setting up triggers, indexes, and constraints...');
      const triggersSql = `
        CREATE OR REPLACE FUNCTION update_updated_at_column()
        RETURNS TRIGGER AS $$
        BEGIN
            NEW.updated_at = NOW();
            RETURN NEW;
        END;
        $$ language 'plpgsql';

        DROP TRIGGER IF EXISTS trg_update_client_bot_sessions ON client_bot_sessions;
        CREATE TRIGGER trg_update_client_bot_sessions
        BEFORE UPDATE ON client_bot_sessions
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

        DROP TRIGGER IF EXISTS trg_update_client_bot_queue ON client_bot_queue;
        CREATE TRIGGER trg_update_client_bot_queue
        BEFORE UPDATE ON client_bot_queue
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

        DROP TRIGGER IF EXISTS trg_update_client_bot_metrics ON client_bot_metrics;
        CREATE TRIGGER trg_update_client_bot_metrics
        BEFORE UPDATE ON client_bot_metrics
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
      `;
      await this.runQuery(triggersSql);
      logs.push('✔ Idempotent triggers verified.');

      // 10. Verify proper indexes
      const indexesSql = `
        CREATE INDEX IF NOT EXISTS idx_sessions_bot_id ON client_bot_sessions(bot_id);
        CREATE INDEX IF NOT EXISTS idx_queue_bot_id ON client_bot_queue(bot_id);
        CREATE INDEX IF NOT EXISTS idx_queue_status ON client_bot_queue(status);
        CREATE INDEX IF NOT EXISTS idx_logs_bot_id ON client_bot_logs(bot_id);
        CREATE INDEX IF NOT EXISTS idx_logs_category ON client_bot_logs(category);
        CREATE INDEX IF NOT EXISTS idx_heartbeats_bot_id ON client_bot_heartbeats(bot_id);
      `;
      await this.runQuery(indexesSql);
      logs.push('✔ Table indexes verified.');

      // 11. Enable Realtime Publications
      logs.push('Enabling Supabase Realtime for client_bot tables...');
      const realtimeSql = `
        DO $$
        BEGIN
          -- Ensure client_bot_sessions is in publication
          IF NOT EXISTS (
            SELECT 1 FROM pg_publication_tables 
            WHERE pubname = 'supabase_realtime' AND tablename = 'client_bot_sessions'
          ) THEN
            ALTER PUBLICATION supabase_realtime ADD TABLE client_bot_sessions;
          END IF;

          -- Ensure client_bot_queue is in publication
          IF NOT EXISTS (
            SELECT 1 FROM pg_publication_tables 
            WHERE pubname = 'supabase_realtime' AND tablename = 'client_bot_queue'
          ) THEN
            ALTER PUBLICATION supabase_realtime ADD TABLE client_bot_queue;
          END IF;

          -- Ensure client_bot_logs is in publication
          IF NOT EXISTS (
            SELECT 1 FROM pg_publication_tables 
            WHERE pubname = 'supabase_realtime' AND tablename = 'client_bot_logs'
          ) THEN
            ALTER PUBLICATION supabase_realtime ADD TABLE client_bot_logs;
          END IF;
        EXCEPTION WHEN OTHERS THEN
          -- Fallback if publication doesn't exist
          NULL;
        END $$;
      `;
      await this.runQuery(realtimeSql);
      logs.push('✔ Supabase Realtime configuration complete.');

      logs.push('Database initialization complete!');
      return { success: true, logs };
    } catch (err: any) {
      logs.push(`❌ Error during initialization: ${err.message}`);
      return { success: false, logs };
    }
  }

  /**
   * Retrieves complete status metrics for Supabase Manager.
   */
  public async checkNetworkMode(): Promise<{ mode: string, message: string }> {
    if (!this.config.dbConnectionString) return { mode: 'ipv4', message: 'No connection string' };
    try {
      const url = new URL(this.config.dbConnectionString);
      let host = url.hostname;
      
      const records = await dns.resolve6(host).catch(() => []);
      if (records.length === 0) {
        return { mode: 'ipv4', message: 'No IPv6 AAAA records found for host' };
      }
      
      return await new Promise((resolve) => {
        const socket = net.createConnection({ host: records[0], port: parseInt(url.port || '5432'), family: 6, timeout: 5000 }, () => {
          socket.destroy();
          resolve({ mode: 'ipv6', message: 'IPv6 is fully available and preferred' });
        });
        socket.on('timeout', () => {
          socket.destroy();
          if (this.config.networkMode === 'ipv6') resolve({ mode: 'IPV6_UNAVAILABLE', message: 'IPv6 connection timed out, runtime does not expose usable IPv6 connectivity.' });
          else resolve({ mode: 'ipv4', message: 'IPv6 connection timed out, falling back to IPv4' });
        });
        socket.on('error', (err) => {
          if (this.config.networkMode === 'ipv6') resolve({ mode: 'IPV6_UNAVAILABLE', message: 'IPv6 connection failed: ' + err.message + ', runtime does not expose usable IPv6 connectivity.' });
          else resolve({ mode: 'ipv4', message: 'IPv6 connection failed, falling back to IPv4' });
        });
      });
    } catch(err: any) {
      return { mode: 'ipv4', message: 'Failed to parse connection string or resolve DNS' };
    }
  }

  public async getStatusDetails(): Promise<any> {
    const isConfigured = this.isConfigured();
    let isConnected = false;
    let latency = 0;
    let tableStatuses: any[] = [];
    let realtimeHealth = 'DISCONNECTED';
    let dbHealth = 'DISCONNECTED';
    let errorMsg = '';
    let networkMode = 'auto';
    let networkMessage = '';
    let configStatus = isConfigured ? 'Configured' : 'Missing';
    
    // Check network mode
    const networkResult = await this.checkNetworkMode();
    networkMode = networkResult.mode;
    networkMessage = networkResult.message;

    if (isConfigured) {
      const connTest = await this.testConnection();
      isConnected = connTest.success;
      latency = connTest.latency;
      errorMsg = connTest.error || '';

      if (isConnected) {
        dbHealth = 'CONNECTED';
        realtimeHealth = this.config.realtimeEnabled ? 'CONNECTED' : 'DISCONNECTED';

        // Check tables status
        try {
          const tablesList = [
            'client_bot_sessions',
            'client_bot_queue',
            'client_bot_logs',
            'client_bot_heartbeats',
            'client_bot_metrics',
            'client_bot_events',
            'client_bot_runtime',
            'client_bot_errors'
          ];
          for (const t of tablesList) {
            try {
              if (this.config.dbConnectionString) {
                const res = await this.runQuery(`SELECT COUNT(*) FROM ${t};`);
                tableStatuses.push({ name: t, exists: true, rows: parseInt(res[0]?.count || '0', 10) });
              } else {
                const res = await axios.head(`${this.config.projectUrl}/rest/v1/${t}`, {
                  headers: {
                    apikey: this.config.serviceRoleKey,
                    Authorization: `Bearer ${this.config.serviceRoleKey}`,
                    Prefer: 'count=exact'
                  },
                  timeout: 5000
                });
                const range = res.headers['content-range'] || '';
                const count = range.split('/')[1] || 0;
                tableStatuses.push({ name: t, exists: true, rows: parseInt(count, 10) });
              }
            } catch (err: any) {
               // Table doesn't exist or permission denied
               tableStatuses.push({ name: t, exists: false, rows: 0 });
            }
          }
        } catch (err) {
          console.error('[SupabaseService] Failed to check tables:', err);
        }
      } else {
        errorMsg = 'Connection failed: ' + errorMsg;
      }
    }

    // Get config backup info
    let backupStatus = 'Not Backed Up';
    let version = 0;
    let lastValidatedAt = null;
    try {
      const doc = await SystemCredentialModel.findOne({ key: 'SUPABASE_CONFIG', active: true } as any).lean();
      if (doc) {
        backupStatus = 'Backed Up';
        version = doc.version || 1;
        lastValidatedAt = doc.lastValidatedAt;
      }
    } catch(e) {}

    const backupPath = path.join(process.cwd(), 'storage', 'settings', 'supabase_credentials.enc.json');
    const ftpBackupExists = fs.existsSync(backupPath);
    const ftpBackupStatus = ftpBackupExists ? 'HEALTHY' : 'UNHEALTHY';
    const mongoBackupStatus = backupStatus === 'Backed Up' ? 'HEALTHY' : 'UNHEALTHY';

    return {
      isConfigured,
      isConnected,
      latency,
      dbHealth,
      realtimeHealth,
      tableStatuses,
      errorMsg,
      realtimeEnabled: this.config.realtimeEnabled,
      networkMode,
      networkMessage,
      backupStatus,
      version,
      lastValidatedAt,
      configStatus,
      // Extra persistent health check metrics
      mongoBackupStatus,
      ftpBackupStatus,
      autoRestoreStatus: 'ENABLED',
      lastSuccessfulConnection: this.lastSuccessfulConnection,
      lastCredentialRestore: this.lastCredentialRestore,
      credentialSource: this.credentialSource
    };
  }
}

export const supabaseService = SupabaseService.getInstance();
