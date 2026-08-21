import { TelegramLogEntry, TelegramLogCategory } from '../../types/telegram';

class TelegramLoggerService {
  private logs: TelegramLogEntry[] = [];
  private readonly maxLogs = 300;

  public maskToken(token: string): string {
    if (!token || typeof token !== 'string') return '—';
    const trimmed = token.trim();
    if (trimmed.length < 10) return '••••••';
    const colonIdx = trimmed.indexOf(':');
    if (colonIdx !== -1) {
      const idPart = trimmed.slice(0, colonIdx);
      const secretPart = trimmed.slice(colonIdx + 1);
      const maskedSecret = secretPart.length > 8
        ? `${secretPart.slice(0, 3)}••••${secretPart.slice(-3)}`
        : '••••••••';
      return `${idPart}:${maskedSecret}`;
    }
    return `${trimmed.slice(0, 4)}••••${trimmed.slice(-4)}`;
  }

  public maskId(id: string | number): string {
    const str = String(id || '');
    if (str.length <= 4) return str;
    return `${str.slice(0, 2)}•••${str.slice(-2)}`;
  }

  public log(
    level: 'INFO' | 'SUCCESS' | 'WARN' | 'ERROR',
    category: TelegramLogCategory,
    message: string,
    details?: any
  ): TelegramLogEntry {
    const entry: TelegramLogEntry = {
      id: `tg_log_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      timestamp: new Date().toISOString(),
      level,
      category,
      message,
      details: details ? (typeof details === 'object' ? JSON.parse(JSON.stringify(details)) : details) : undefined
    };

    this.logs.unshift(entry);
    if (this.logs.length > this.maxLogs) {
      this.logs.pop();
    }

    const prefix = `[TELEGRAM][${category}][${level}]`;
    if (level === 'ERROR') {
      console.error(`${prefix} ${message}`, details || '');
    } else if (level === 'WARN') {
      console.warn(`${prefix} ${message}`, details || '');
    } else {
      console.log(`${prefix} ${message}`);
    }

    return entry;
  }

  public info(category: TelegramLogCategory, message: string, details?: any) {
    return this.log('INFO', category, message, details);
  }

  public success(category: TelegramLogCategory, message: string, details?: any) {
    return this.log('SUCCESS', category, message, details);
  }

  public warn(category: TelegramLogCategory, message: string, details?: any) {
    return this.log('WARN', category, message, details);
  }

  public error(category: TelegramLogCategory, message: string, details?: any) {
    return this.log('ERROR', category, message, details);
  }

  public getLogs(limit: number = 100, category?: string): TelegramLogEntry[] {
    let filtered = this.logs;
    if (category && category !== 'ALL') {
      filtered = filtered.filter(l => l.category === category);
    }
    return filtered.slice(0, limit);
  }

  public clearLogs(): void {
    this.logs = [];
    this.info('RECEIVER_STARTED', 'Telegram runtime log buffer cleared');
  }
}

export const telegramLogger = new TelegramLoggerService();
