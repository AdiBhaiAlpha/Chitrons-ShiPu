import { messengerLogger } from '../adapters/messenger/MessengerLogger';
import { multiAccountManager } from '../adapters/messenger/MultiAccountManager';
import { facebookSession } from '../adapters/messenger/FacebookSession';

export interface ThreadSafetyState {
  threadID: string;
  accountId?: string;
  outgoingTimestamps: number[];
  recentMessageIds: string[];
  recentResponseHashes: { hash: string; timestamp: number }[];
  loopDetected: boolean;
  emergencyTriggeredAt: number | null;
  leaveAttempted: boolean;
  leaveSucceeded: boolean;
  riskScore: number;
  reasons: string[];
}

export class EmergencyAntiSpamGuardService {
  private static instance: EmergencyAntiSpamGuardService;
  private threadStates: Map<string, ThreadSafetyState> = new Map();

  // Sliding window settings:
  // Trigger if >= 3 messages in 3 seconds OR >= 4 messages in 5 seconds
  private readonly WINDOW_3S_MS = 3000;
  private readonly THRESHOLD_3S = 3;
  private readonly WINDOW_5S_MS = 5000;
  private readonly THRESHOLD_5S = 4;
  private readonly RESPONSE_HASH_TTL_MS = 15000;

  private constructor() {}

  public static getInstance(): EmergencyAntiSpamGuardService {
    if (!EmergencyAntiSpamGuardService.instance) {
      EmergencyAntiSpamGuardService.instance = new EmergencyAntiSpamGuardService();
    }
    return EmergencyAntiSpamGuardService.instance;
  }

  private getKey(threadID: string, accountId?: string): string {
    return accountId ? `${accountId}:${threadID}` : threadID;
  }

  public getOrCreateState(threadID: string, accountId?: string): ThreadSafetyState {
    const key = this.getKey(threadID, accountId);
    let state = this.threadStates.get(key);
    if (!state) {
      state = {
        threadID,
        accountId,
        outgoingTimestamps: [],
        recentMessageIds: [],
        recentResponseHashes: [],
        loopDetected: false,
        emergencyTriggeredAt: null,
        leaveAttempted: false,
        leaveSucceeded: false,
        riskScore: 0,
        reasons: []
      };
      this.threadStates.set(key, state);
    }
    return state;
  }

  public isThreadInEmergency(threadID: string, accountId?: string): boolean {
    const key = this.getKey(threadID, accountId);
    const state = this.threadStates.get(key);
    return !!(state && state.loopDetected);
  }

  public canSendSafely(threadID: string, accountId?: string, text?: string): boolean {
    const state = this.getOrCreateState(threadID, accountId);
    if (state.loopDetected) {
      messengerLogger.warn('SAFETY', `[SAFETY] Blocking further outgoing messages for this thread (${threadID})`);
      return false;
    }
    return true;
  }

  public registerRiskIndicator(threadID: string, reason: string, accountId?: string, api?: any) {
    const state = this.getOrCreateState(threadID, accountId);
    if (state.loopDetected) return;

    if (!state.reasons.includes(reason)) {
      state.reasons.push(reason);
    }
    state.riskScore += 1;
    messengerLogger.warn('SAFETY', `[SAFETY] Monitoring thread: ${threadID}`);
    messengerLogger.warn('SAFETY', `[SAFETY] Loop risk increased (${reason})`);

    if (state.riskScore >= 2) {
      this.triggerEmergency(threadID, accountId, `RUNAWAY_BOT_LOOP: ${state.reasons.join(', ')}`, api);
    }
  }

  public recordOutgoingMessage(
    threadID: string,
    text: string,
    messageID?: string,
    accountId?: string,
    api?: any
  ): boolean {
    const state = this.getOrCreateState(threadID, accountId);

    if (state.loopDetected) {
      messengerLogger.warn('SAFETY', '[SAFETY] Blocking further outgoing messages for this thread');
      return false;
    }

    const now = Date.now();
    state.outgoingTimestamps.push(now);
    if (messageID) {
      state.recentMessageIds.push(messageID);
      if (state.recentMessageIds.length > 20) state.recentMessageIds.shift();
    }

    // Retain timestamps within 10s window
    state.outgoingTimestamps = state.outgoingTimestamps.filter(t => now - t <= 10000);

    const count3s = state.outgoingTimestamps.filter(t => now - t <= this.WINDOW_3S_MS).length;
    const count5s = state.outgoingTimestamps.filter(t => now - t <= this.WINDOW_5S_MS).length;

    messengerLogger.info('SAFETY', `[SAFETY] Monitoring thread: ${threadID}`);
    messengerLogger.info('SAFETY', `[SAFETY] Bot outgoing rate: ${count3s} messages / 3 seconds`);

    // Duplicate response detection
    const normalizedText = (text || '').trim().toLowerCase().replace(/\s+/g, ' ');
    const hash = normalizedText.slice(0, 100);

    state.recentResponseHashes = state.recentResponseHashes.filter(h => now - h.timestamp <= this.RESPONSE_HASH_TTL_MS);
    const duplicateCount = state.recentResponseHashes.filter(h => h.hash === hash).length;
    state.recentResponseHashes.push({ hash, timestamp: now });

    let shouldTrigger = false;
    let triggerReason = '';

    if (count3s >= this.THRESHOLD_3S) {
      shouldTrigger = true;
      triggerReason = `HIGH_OUTGOING_RATE: ${count3s} messages in 3 seconds`;
    } else if (count5s >= this.THRESHOLD_5S) {
      shouldTrigger = true;
      triggerReason = `HIGH_OUTGOING_RATE: ${count5s} messages in 5 seconds`;
    } else if (duplicateCount >= 2 && normalizedText.length > 5) {
      shouldTrigger = true;
      triggerReason = `REPEATED_RESPONSE: Identical response generated ${duplicateCount + 1} times`;
      messengerLogger.warn('SAFETY', '[SAFETY] Repeated bot-generated response detected');
    }

    if (shouldTrigger) {
      this.triggerEmergency(threadID, accountId, triggerReason, api);
      return false;
    }

    return true;
  }

  public triggerEmergency(
    threadID: string,
    accountId?: string,
    reason: string = 'Runaway loop detected',
    api?: any
  ) {
    const state = this.getOrCreateState(threadID, accountId);
    if (state.loopDetected) return;

    state.loopDetected = true;
    state.emergencyTriggeredAt = Date.now();

    messengerLogger.error('SAFETY', `[SAFETY] Possible self-triggered runaway loop detected (${reason})`);
    messengerLogger.error('SAFETY', '[SAFETY] EMERGENCY CIRCUIT BREAKER ACTIVATED');
    messengerLogger.warn('SAFETY', '[SAFETY] Blocking further outgoing messages for this thread');
    messengerLogger.info('SAFETY', '[SAFETY] Cancelling pending response jobs');

    this.attemptEmergencyGroupLeave(threadID, accountId, api);
  }

  public async attemptEmergencyGroupLeave(threadID: string, accountId?: string, apiOverride?: any) {
    const state = this.getOrCreateState(threadID, accountId);
    if (state.leaveAttempted) return;

    state.leaveAttempted = true;
    messengerLogger.info('SAFETY', '[SAFETY] Attempting emergency group leave...');

    let api = apiOverride;
    let botUid = '';

    if (!api && accountId) {
      const conn = multiAccountManager.getAccountConnection(accountId);
      if (conn) {
        api = conn.getFcaApi();
        botUid = conn.uid;
      }
    }

    if (!api) {
      api = facebookSession.getFcaApi();
      botUid = facebookSession.selfUserId;
    }

    if (!botUid && accountId) {
      const meta = multiAccountManager.getAccountMeta(accountId);
      botUid = meta?.uid || '';
    }

    if (api && typeof api.removeUserFromGroup === 'function' && botUid) {
      try {
        await new Promise<void>((resolve) => {
          api.removeUserFromGroup(botUid, threadID, (err: any) => {
            if (!err) {
              state.leaveSucceeded = true;
              messengerLogger.success('SAFETY', '[SAFETY] Group leave successful');
            } else {
              messengerLogger.warn('SAFETY', `[SAFETY] Group leave failed: ${err.message || err}`);
            }
            resolve();
          });
        });
      } catch (err: any) {
        messengerLogger.warn('SAFETY', `[SAFETY] Group leave exception: ${err.message || err}`);
      }
    } else {
      messengerLogger.warn('SAFETY', '[SAFETY] Group leave API not available or bot UID unknown');
    }

    messengerLogger.info('SAFETY', '[SAFETY] Thread permanently blocked for current runtime session');
  }

  public resetThreadState(threadID: string, accountId?: string) {
    const key = this.getKey(threadID, accountId);
    this.threadStates.delete(key);
  }

  public clearAll() {
    this.threadStates.clear();
  }
}

export const emergencyAntiSpamGuard = EmergencyAntiSpamGuardService.getInstance();
