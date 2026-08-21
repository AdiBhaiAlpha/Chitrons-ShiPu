import { sharedAccessService } from './sharedAccessService';
import { messengerLogger } from '../adapters/messenger/MessengerLogger';

export class SharedAccessMonitor {
  private static instance: SharedAccessMonitor;
  private timer: NodeJS.Timeout | null = null;
  private intervalMs = 300000; // Every 5 minutes

  private constructor() {}

  public static getInstance(): SharedAccessMonitor {
    if (!SharedAccessMonitor.instance) {
      SharedAccessMonitor.instance = new SharedAccessMonitor();
    }
    return SharedAccessMonitor.instance;
  }

  public start(): void {
    if (this.timer) clearInterval(this.timer);
    console.log('[SharedAccessMonitor] Background membership verification monitor started (every 5 mins).');

    this.timer = setInterval(async () => {
      await this.runVerificationPass();
    }, this.intervalMs);
  }

  public stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  public async runVerificationPass(): Promise<void> {
    try {
      const users = await sharedAccessService.getAllUsersStatus();
      if (users.length === 0) return;

      messengerLogger.info('GROUP', `Running periodic verification for ${users.length} tracked shared access users...`);

      for (const user of users) {
        try {
          await sharedAccessService.verifyUserMembership(user.userID, user.userName);
        } catch (err: any) {
          messengerLogger.error('GROUP', `Failed to verify user ${user.userID} (${user.userName}): ${err?.message || err}`);
        }
      }
    } catch (err: any) {
      messengerLogger.error('GROUP', `Error in SharedAccessMonitor pass: ${err?.message || err}`);
    }
  }
}

export const sharedAccessMonitor = SharedAccessMonitor.getInstance();
