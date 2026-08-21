export type LogLevel = 'DEBUG' | 'INFO' | 'SUCCESS' | 'WARN' | 'ERROR';

export type LogCategory =
  | 'SYSTEM'
  | 'SESSION'
  | 'COOKIE'
  | 'AUTH'
  | 'FACEBOOK'
  | 'FB'
  | 'ENGINE'
  | 'API'
  | 'MQTT'
  | 'EVENT'
  | 'MESSAGE'
  | 'COMMAND'
  | 'SEND'
  | 'REPLY'
  | 'REACTION'
  | 'SEEN'
  | 'TYPING'
  | 'GROUP'
  | 'IDENTITY'
  | 'HEARTBEAT'
  | 'DATABASE'
  | 'DB_MANAGER'
  | 'RECONNECT'
  | 'SMART'
  | 'TEST'
  | 'SAFETY'
  | 'CLOUD_SYNC'
  | 'SUPERVISOR'
  | 'SUBSCRIPTION'
  | 'ERROR';

export interface DiagnosticPipelineStage {
  stage: string;
  label: string;
  status: 'pending' | 'success' | 'failed' | 'skipped';
  timestamp?: string;
  details?: string;
}

export interface MessengerLogEntry {
  id: string;
  timestamp: string; // HH:mm:ss.SSS
  rawTime: number;
  level: LogLevel;
  category: LogCategory;
  stage?: string;
  message: string;
  details?: any;
}

export interface MessengerEngineStats {
  fbStatus: 'OFF' | 'CONNECTING' | 'AUTHENTICATING' | 'CONNECTED' | 'DISCONNECTED' | 'RECONNECTING' | 'SESSION_EXPIRED' | 'ERROR';
  mqttStatus: 'OFF' | 'CONNECTING' | 'CONNECTED' | 'LISTENING' | 'DISCONNECTED' | 'ERROR';
  eventsCount: number;
  messagesCount: number;
  messagesSentCount: number;
  errorsCount: number;
  reconnectsCount: number;
  lastEventTime?: string;
  lastMessageTime?: string;
  lastMessageBody?: string;
  lastSenderUid?: string;
  connectedSince?: string;
  uptimeSeconds: number;
  accountName: string;
  botUserID: string;
  sessionFileExists: boolean;
  sessionValid: boolean;
  cookiesCount: number;
}

type LogListener = (entry: MessengerLogEntry, stats: MessengerEngineStats, pipeline: DiagnosticPipelineStage[]) => void;

export class MessengerLogger {
  private static instance: MessengerLogger;
  private logs: MessengerLogEntry[] = [];
  private maxLogs = 2000;
  private listeners: Set<LogListener> = new Set();
  private startTime = Date.now();

  private stats: MessengerEngineStats = {
    fbStatus: 'OFF',
    mqttStatus: 'OFF',
    eventsCount: 0,
    messagesCount: 0,
    messagesSentCount: 0,
    errorsCount: 0,
    reconnectsCount: 0,
    uptimeSeconds: 0,
    accountName: '—',
    botUserID: '—',
    sessionFileExists: false,
    sessionValid: false,
    cookiesCount: 0
  };

  private diagnosticPipeline: DiagnosticPipelineStage[] = [
    { stage: 'mqtt_receive', label: 'MQTT event received', status: 'pending' },
    { stage: 'event_parse', label: 'Event parsed', status: 'pending' },
    { stage: 'sender_id', label: 'Sender identified', status: 'pending' },
    { stage: 'thread_id', label: 'Thread identified', status: 'pending' },
    { stage: 'msg_norm', label: 'Message normalized', status: 'pending' },
    { stage: 'bot_dispatch', label: 'BotEngine received event', status: 'pending' },
    { stage: 'cmd_router', label: 'Command router executed', status: 'pending' },
    { stage: 'handler_comp', label: 'Handler completed', status: 'pending' },
    { stage: 'resp_gen', label: 'Response generated', status: 'pending' },
    { stage: 'fb_api', label: 'Facebook API called', status: 'pending' },
    { stage: 'msg_sent', label: 'Response sent', status: 'pending' },
    { stage: 'seen_updated', label: 'Seen status updated', status: 'pending' }
  ];

  private constructor() {
    this.addInitialBootLog();
  }

  public static getInstance(): MessengerLogger {
    if (!MessengerLogger.instance) {
      MessengerLogger.instance = new MessengerLogger();
    }
    return MessengerLogger.instance;
  }

  private addInitialBootLog() {
    this.log(
      'INFO',
      'SYSTEM',
      'ShiPu Ai Messenger Engine booting...',
      { version: '2.5.0', env: 'Cloud Run / Node' },
      'boot'
    );
  }

  /**
   * Safely mask UIDs (e.g. 100084729104812 -> 1000••••4812)
   */
  public static maskUid(uid?: string): string {
    if (!uid || uid === '—') return '—';
    const str = String(uid).trim();
    if (str.length <= 6) return str;
    return `${str.slice(0, 4)}••••${str.slice(-4)}`;
  }

  /**
   * Recursively redacts sensitive keys from objects before logging
   */
  public static sanitizeDetails(obj: any): any {
    if (!obj || typeof obj !== 'object') return obj;
    if (Array.isArray(obj)) {
      return obj.map(item => MessengerLogger.sanitizeDetails(item));
    }

    const sensitiveKeys = ['xs', 'c_user', 'datr', 'sb', 'fr', 'cookie', 'cookies', 'appstate', 'password', 'token', 'secret', 'authorization'];
    const sanitized: Record<string, any> = {};

    for (const [key, value] of Object.entries(obj)) {
      const lowerKey = key.toLowerCase();
      if (sensitiveKeys.some(sk => lowerKey.includes(sk))) {
        sanitized[key] = '[REDACTED_FOR_SECURITY]';
      } else if (value && typeof value === 'object') {
        sanitized[key] = MessengerLogger.sanitizeDetails(value);
      } else if (typeof value === 'string' && (key.toLowerCase().includes('uid') || key.toLowerCase().includes('user'))) {
        sanitized[key] = MessengerLogger.maskUid(value);
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }

  private formatTime(date: Date): string {
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    const ms = String(date.getMilliseconds()).padStart(3, '0');
    return `${hours}:${minutes}:${seconds}.${ms}`;
  }

  public log(
    level: LogLevel,
    category: LogCategory,
    message: string,
    details?: any,
    stage?: string
  ): MessengerLogEntry {
    const now = new Date();
    const entry: MessengerLogEntry = {
      id: `m_log_${now.getTime()}_${Math.random().toString(36).substr(2, 6)}`,
      timestamp: this.formatTime(now),
      rawTime: now.getTime(),
      level,
      category,
      stage,
      message,
      details: MessengerLogger.sanitizeDetails(details)
    };

    // Update stats counters based on level & category
    if (level === 'ERROR') {
      this.stats.errorsCount++;
    }
    if (category === 'EVENT') {
      this.stats.eventsCount++;
      this.stats.lastEventTime = entry.timestamp;
    }
    if (category === 'MESSAGE') {
      this.stats.messagesCount++;
      this.stats.lastMessageTime = entry.timestamp;
      if (details?.body) {
        this.stats.lastMessageBody = details.body;
      }
      if (details?.senderID) {
        this.stats.lastSenderUid = MessengerLogger.maskUid(details.senderID);
      }
    }
    if (category === 'SEND' && level === 'SUCCESS') {
      this.stats.messagesSentCount++;
    }
    if (category === 'RECONNECT') {
      this.stats.reconnectsCount++;
    }

    this.logs.push(entry);
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }

    this.notifyListeners(entry);
    return entry;
  }

  public info(category: LogCategory, message: string, details?: any, stage?: string) {
    return this.log('INFO', category, message, details, stage);
  }

  public success(category: LogCategory, message: string, details?: any, stage?: string) {
    return this.log('SUCCESS', category, message, details, stage);
  }

  public warn(category: LogCategory, message: string, details?: any, stage?: string) {
    return this.log('WARN', category, message, details, stage);
  }

  public error(category: LogCategory, message: string, details?: any, stage?: string) {
    return this.log('ERROR', category, message, details, stage);
  }

  public debug(category: LogCategory, message: string, details?: any, stage?: string) {
    return this.log('DEBUG', category, message, details, stage);
  }

  public updateEngineStats(partial: Partial<MessengerEngineStats>) {
    this.stats = { ...this.stats, ...partial };
  }

  public updatePipelineStage(stageKey: string, status: 'pending' | 'success' | 'failed' | 'skipped', details?: string) {
    const stage = this.diagnosticPipeline.find(p => p.stage === stageKey);
    if (stage) {
      stage.status = status;
      stage.timestamp = this.formatTime(new Date());
      if (details) stage.details = details;
    }
  }

  public resetPipeline() {
    const now = this.formatTime(new Date());
    this.diagnosticPipeline = [
      { stage: 'mqtt_receive', label: 'MQTT event received', status: 'pending' },
      { stage: 'event_parse', label: 'Event parsed', status: 'pending' },
      { stage: 'sender_id', label: 'Sender identified', status: 'pending' },
      { stage: 'thread_id', label: 'Thread identified', status: 'pending' },
      { stage: 'msg_norm', label: 'Message normalized', status: 'pending' },
      { stage: 'bot_dispatch', label: 'BotEngine received event', status: 'pending' },
      { stage: 'cmd_router', label: 'Command router executed', status: 'pending' },
      { stage: 'handler_comp', label: 'Handler completed', status: 'pending' },
      { stage: 'resp_gen', label: 'Response generated', status: 'pending' },
      { stage: 'fb_api', label: 'Facebook API called', status: 'pending' },
      { stage: 'msg_sent', label: 'Response sent', status: 'pending' },
      { stage: 'seen_updated', label: 'Seen status updated', status: 'pending' }
    ];
  }

  public incrementEvents() {
    this.stats.eventsCount++;
    this.stats.lastEventTime = this.formatTime(new Date());
  }

  public incrementMessages() {
    this.stats.messagesCount++;
    this.stats.lastMessageTime = this.formatTime(new Date());
  }

  public getLogs(): MessengerLogEntry[] {
    return [...this.logs];
  }

  public getStats(): MessengerEngineStats {
    return {
      ...this.stats,
      uptimeSeconds: Math.floor((Date.now() - this.startTime) / 1000)
    };
  }

  public getPipeline(): DiagnosticPipelineStage[] {
    return [...this.diagnosticPipeline];
  }

  public clearLogs() {
    this.logs = [];
    this.stats.eventsCount = 0;
    this.stats.messagesCount = 0;
    this.stats.errorsCount = 0;
    this.stats.reconnectsCount = 0;
    this.stats.messagesSentCount = 0;
    this.info('SYSTEM', 'Cleared Messenger Engine log buffer');
  }

  public subscribe(listener: LogListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyListeners(entry: MessengerLogEntry) {
    const stats = this.getStats();
    const pipeline = this.getPipeline();
    for (const listener of this.listeners) {
      try {
        listener(entry, stats, pipeline);
      } catch (err) {
        console.error('Error notifying MessengerLogger listener:', err);
      }
    }
  }
}

export const messengerLogger = MessengerLogger.getInstance();
