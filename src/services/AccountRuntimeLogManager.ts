import { EventEmitter } from 'events';
import { MessengerLogger } from '../adapters/messenger/MessengerLogger';

export type AccountSourceType = 'LOCAL_ADMIN' | 'CLOUD_SYNC' | 'API_IMPORT' | 'FUTURE' | string;

export interface DetailedAccountLogEntry {
  id: string;
  timestamp: string; // HH:mm:ss.SSS
  rawTime: number;
  level: 'INFO' | 'SUCCESS' | 'WARN' | 'ERROR' | 'DEBUG';
  category: string;
  message: string;
  stage?: string;
  details?: any;
  accountId: string;
  accountName: string;
  uid: string;
  provider: string;
  mqttStatus: string;
  threadID?: string;
  senderUID?: string;
  sourceModule?: string;
  executionTimeMs?: number;
  messageID?: string;
  correlationID?: string;
  sessionID: string;
}

export interface IsolatedAccountMetrics {
  accountId: string;
  accountName: string;
  uid: string;
  rawUid: string;
  creationSource: AccountSourceType;
  provider: string;
  loginStatus: 'LOGGED_IN' | 'LOGGED_OUT' | 'PENDING' | 'FAILED';
  mqttStatus: string;
  runtimeUptimeMs: number;
  lastHeartbeat: string;
  currentThreadCount: number;
  messageCount: number;
  errorCount: number;
  warningCount: number;
  aiRequestsCount: number;
  currentSessionDurationMs: number;
  connectedAt?: string;
}

export class AccountRuntimeLogManager extends EventEmitter {
  private static instance: AccountRuntimeLogManager;

  // Isolated log buffer per accountId (max 1000 logs per account)
  private logBuffers = new Map<string, DetailedAccountLogEntry[]>();
  // Active thread IDs per accountId
  private activeThreads = new Map<string, Set<string>>();
  // Error counts per accountId
  private errorCounts = new Map<string, number>();
  // Warning counts per accountId
  private warningCounts = new Map<string, number>();
  // Session IDs per accountId
  private sessionIds = new Map<string, string>();

  private maxLogsPerAccount = 1000;

  private constructor() {
    super();
    this.setMaxListeners(100);
  }

  public static getInstance(): AccountRuntimeLogManager {
    if (!AccountRuntimeLogManager.instance) {
      AccountRuntimeLogManager.instance = new AccountRuntimeLogManager();
    }
    return AccountRuntimeLogManager.instance;
  }

  public getSessionId(accountId: string): string {
    if (!this.sessionIds.has(accountId)) {
      this.sessionIds.set(accountId, `sess_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`);
    }
    return this.sessionIds.get(accountId)!;
  }

  public rotateSession(accountId: string): string {
    const newSessionId = `sess_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    this.sessionIds.set(accountId, newSessionId);
    return newSessionId;
  }

  public addLog(accountId: string, logData: Partial<DetailedAccountLogEntry>): DetailedAccountLogEntry {
    if (!accountId) return null as any;

    const now = new Date();
    const rawTime = now.getTime();
    const formattedTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}.${String(now.getMilliseconds()).padStart(3, '0')}`;

    const level = logData.level || 'INFO';
    if (level === 'ERROR') {
      this.errorCounts.set(accountId, (this.errorCounts.get(accountId) || 0) + 1);
    } else if (level === 'WARN') {
      this.warningCounts.set(accountId, (this.warningCounts.get(accountId) || 0) + 1);
    }

    if (logData.threadID) {
      if (!this.activeThreads.has(accountId)) {
        this.activeThreads.set(accountId, new Set());
      }
      this.activeThreads.get(accountId)!.add(logData.threadID);
    }

    const entry: DetailedAccountLogEntry = {
      id: `acc_log_${rawTime}_${Math.random().toString(36).substr(2, 6)}`,
      timestamp: formattedTime,
      rawTime,
      level,
      category: (logData.category || 'SYSTEM').toUpperCase(),
      stage: logData.stage,
      message: logData.message || '',
      details: MessengerLogger.sanitizeDetails(logData.details),
      accountId,
      accountName: logData.accountName || 'Unknown Account',
      uid: logData.uid || '—',
      provider: logData.provider || 'DongDev FCA',
      mqttStatus: logData.mqttStatus || 'OFF',
      threadID: logData.threadID,
      senderUID: logData.senderUID,
      sourceModule: logData.sourceModule || 'AccountConnection',
      executionTimeMs: logData.executionTimeMs,
      messageID: logData.messageID,
      correlationID: logData.correlationID || `corr_${rawTime}_${Math.random().toString(36).substr(2, 4)}`,
      sessionID: logData.sessionID || this.getSessionId(accountId)
    };

    if (!this.logBuffers.has(accountId)) {
      this.logBuffers.set(accountId, []);
    }
    const buffer = this.logBuffers.get(accountId)!;
    buffer.push(entry);
    if (buffer.length > this.maxLogsPerAccount) {
      buffer.shift();
    }

    // Emit live log strictly for this account
    this.emit(`log:${accountId}`, entry);
    this.emit('global_log', entry);

    return entry;
  }

  public getAccountLogs(accountId: string, categoryFilter?: string): DetailedAccountLogEntry[] {
    const buffer = this.logBuffers.get(accountId) || [];
    if (!categoryFilter || categoryFilter === 'ALL' || categoryFilter === 'Overview' || categoryFilter === 'Runtime Logs') {
      return [...buffer];
    }

    const catUpper = categoryFilter.toUpperCase();
    return buffer.filter(item => {
      const itemCat = item.category.toUpperCase();
      if (catUpper === 'AUTHENTICATION' || catUpper === 'AUTH') {
        return ['AUTH', 'SESSION', 'COOKIE', 'LOGIN', 'REAUTH', 'IDENTITY', 'TOKEN'].includes(itemCat);
      }
      if (catUpper === 'MQTT') {
        return ['MQTT', 'CONNECT', 'LISTENER', 'DISCONNECT', 'HEARTBEAT', 'MQTT_LISTENING'].includes(itemCat);
      }
      if (catUpper === 'MESSENGER EVENTS' || catUpper === 'EVENTS') {
        return ['EVENT', 'MESSAGE', 'REACTION', 'SEEN', 'TYPING', 'GROUP', 'INBOX'].includes(itemCat);
      }
      if (catUpper === 'COMMANDS') {
        return ['COMMAND', 'CMD', 'PLUGIN', 'ROUTER'].includes(itemCat);
      }
      if (catUpper === 'AI ENGINE' || catUpper === 'AI') {
        return ['AI', 'GEMINI', 'REPLY', 'SMART', 'BRAIN'].includes(itemCat);
      }
      if (catUpper === 'ERRORS') {
        return item.level === 'ERROR' || itemCat === 'ERROR' || itemCat === 'FAIL';
      }
      if (catUpper === 'PERFORMANCE') {
        return item.executionTimeMs !== undefined || itemCat === 'PERFORMANCE' || itemCat === 'HEARTBEAT' || itemCat === 'STATS';
      }
      if (catUpper === 'NETWORK') {
        return ['NETWORK', 'API', 'HTTP', 'MQTT', 'FACEBOOK', 'FB', 'FETCH'].includes(itemCat);
      }
      return itemCat.includes(catUpper);
    });
  }

  public getAccountMetrics(accMeta: any): IsolatedAccountMetrics {
    const accId = accMeta.accountId || 'unknown';
    const errorCount = this.errorCounts.get(accId) || 0;
    const warningCount = this.warningCounts.get(accId) || 0;
    const threadSet = this.activeThreads.get(accId) || new Set();

    return {
      accountId: accId,
      accountName: accMeta.displayName || 'Messenger Account',
      uid: accMeta.uid || '—',
      rawUid: accMeta.rawUid || accMeta.uid || '—',
      creationSource: accMeta.creationSource || 'ADMIN_DASHBOARD',
      provider: accMeta.activeProviderName || accMeta.provider || 'DongDev FCA',
      loginStatus: accMeta.loginStatus || (accMeta.status === 'CONNECTED' || accMeta.status === 'ONLINE' ? 'LOGGED_IN' : 'LOGGED_OUT'),
      mqttStatus: accMeta.mqttStatus || 'OFF',
      runtimeUptimeMs: accMeta.sessionDurationMs || 0,
      lastHeartbeat: accMeta.lastHeartbeat || new Date().toISOString(),
      currentThreadCount: threadSet.size,
      messageCount: accMeta.stats?.totalMessages || 0,
      errorCount,
      warningCount,
      aiRequestsCount: accMeta.stats?.aiMessages || 0,
      currentSessionDurationMs: accMeta.sessionDurationMs || 0,
      connectedAt: accMeta.connectedAt
    };
  }

  public clearAccountLogs(accountId: string) {
    this.logBuffers.set(accountId, []);
    this.errorCounts.set(accountId, 0);
    this.warningCounts.set(accountId, 0);
    this.activeThreads.set(accountId, new Set());
  }
}

export const accountRuntimeLogManager = AccountRuntimeLogManager.getInstance();
