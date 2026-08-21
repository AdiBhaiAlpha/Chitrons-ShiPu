import { CookieLoader, CookieValidationResult } from './CookieLoader';
import { messengerLogger, MessengerLogger } from './MessengerLogger';
import { multiAccountManager } from './MultiAccountManager';
import { SafeAccountMeta } from './AccountConnection';

export type SessionConnectionStatus =
  | 'NOT_CONFIGURED'
  | 'VALIDATING'
  | 'CONNECTING'
  | 'CONNECTED'
  | 'DISCONNECTED'
  | 'RECONNECTING'
  | 'INVALID_SESSION'
  | 'AUTH_BLOCKED'
  | 'ERROR'
  | 'OFFLINE';

export type SessionMqttStatus =
  | 'OFF'
  | 'CONNECTING'
  | 'CONNECTED'
  | 'LISTENING'
  | 'WAITING_FOR_FIRST_EVENT'
  | 'EVENT_STREAM_ACTIVE'
  | 'DISCONNECTED'
  | 'ERROR';

export interface SafeSessionMeta {
  status: SessionConnectionStatus;
  mqttStatus?: SessionMqttStatus;
  accountName: string;
  botUserID: string;
  connectedAt?: string;
  lastError?: string;
  reconnectAttempts: number;
  sessionFileExists: boolean;
  sessionValid: boolean;
  cookiesCount?: number;
  hasReceivedFirstEvent?: boolean;
  activeProviderName?: string;
}

export class FacebookSession {
  private onIncomingMessageCallbacks: ((event: any) => void)[] = [];
  private isListenerRegistered = false;

  public get selfUserId(): string {
    const defaultMeta = multiAccountManager.getDefaultAccountMeta();
    const uid = defaultMeta.botUserID || defaultMeta.uid || '';
    return uid !== '—' ? uid : '';
  }

  private ensureListenerRegistered() {
    if (this.isListenerRegistered) return;
    this.isListenerRegistered = true;
    multiAccountManager.registerGlobalEventListener((event: any) => {
      for (const cb of this.onIncomingMessageCallbacks) {
        try {
          cb(event);
        } catch {}
      }
    });
  }

  public registerIncomingMessageHandler(cb: (event: any) => void) {
    this.ensureListenerRegistered();
    this.onIncomingMessageCallbacks.push(cb);
  }

  public getFcaApi(): any {
    const defaultConn = multiAccountManager.getAccountConnection();
    return defaultConn ? defaultConn.getFcaApi() : null;
  }

  public getActiveProviderName(): string {
    const defaultConn = multiAccountManager.getAccountConnection();
    return defaultConn ? defaultConn.provider : 'DongDev FCA';
  }

  public handleIncomingTestEvent(message: string): void {
    const testEvent = {
      type: 'message',
      threadID: '100000000000001',
      senderID: '100081330372098',
      messageID: `test_msg_${Date.now()}`,
      body: message,
      timestamp: Date.now()
    };
    for (const cb of this.onIncomingMessageCallbacks) {
      try {
        cb(testEvent);
      } catch {}
    }
  }

  public checkInitialSession(): SafeSessionMeta {
    return this.getSafeMetadata();
  }

  public async connect(): Promise<boolean> {
    await multiAccountManager.initializeAllAccountsFromDB();
    const defaultConn = multiAccountManager.getAccountConnection();
    if (defaultConn) {
      if ((defaultConn.status === 'CONNECTED' || defaultConn.status === 'MQTT_LISTENING') && defaultConn.getFcaApi() !== null) {
        return true;
      }
      return defaultConn.connect();
    }
    return false;
  }

  public async disconnect(): Promise<void> {
    const accounts = multiAccountManager.getAllAccountsMeta();
    for (const acc of accounts) {
      await multiAccountManager.disconnectAccount(acc.accountId);
    }
  }

  public getSafeMetadata(): SafeSessionMeta {
    const defaultMeta = multiAccountManager.getDefaultAccountMeta();
    const exists = CookieLoader.exists() || multiAccountManager.getAccountCount() > 0;

    return {
      status: (defaultMeta.status as SessionConnectionStatus) || 'NOT_CONFIGURED',
      mqttStatus: (defaultMeta.mqttStatus as SessionMqttStatus) || 'OFF',
      accountName: defaultMeta.accountName || '—',
      botUserID: defaultMeta.botUserID || '—',
      connectedAt: defaultMeta.connectedAt,
      lastError: undefined,
      reconnectAttempts: defaultMeta.reconnectAttempts || 0,
      sessionFileExists: exists,
      sessionValid: exists,
      cookiesCount: 10,
      hasReceivedFirstEvent: defaultMeta.status === 'CONNECTED',
      activeProviderName: defaultMeta.activeProviderName || 'DongDev FCA'
    };
  }
}

export const facebookSession = new FacebookSession();
