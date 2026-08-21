import { FCAProvider, FCAConnection } from './FCAProvider';
import { DongDevFCAProvider } from './providers/DongDevFCAProvider';
import { XnilFCAProvider } from './providers/XnilFCAProvider';
import { XaviabotFCAProvider } from './providers/XaviabotFCAProvider';
import { messengerLogger } from '../MessengerLogger';

export interface FCAAuthenticationResult {
  connection: FCAConnection | null;
  activeProviderName?: string;
  isHardFailure: boolean;
  failureCategory?: string;
  failureReason?: string;
  userActionRequired?: string;
}

export class FCAFallbackManager {
  private providers: FCAProvider[];

  constructor() {
    this.providers = [
      new DongDevFCAProvider(),
      new XnilFCAProvider(),
      new XaviabotFCAProvider()
    ];
  }

  public async authenticate(appState: any[]): Promise<FCAAuthenticationResult> {
    messengerLogger.info('AUTH', 'Starting Multi-FCA Authentication Sequence (Primary Adapter: @dongdev/fca-unofficial)...');
    messengerLogger.info('AUTH', `Providers registered in fallback priority order: ${this.providers.map(p => p.name).join(' → ')}`);

    let lastCategory = 'UNKNOWN_AUTH_ERROR';
    let lastReason = 'All FCA providers authentication failed';
    let lastUserAction = 'Export a fresh AppState JSON from active browser session and upload to dashboard.';

    for (let i = 0; i < this.providers.length; i++) {
      const provider = this.providers[i];
      const providerNum = i + 1;

      messengerLogger.info('AUTH', `[Provider ${providerNum}/${this.providers.length}] Inspecting ${provider.name} (${provider.packageName})...`);

      const available = await provider.isAvailable();
      if (!available) {
        messengerLogger.warn('AUTH', `[Provider ${providerNum}/${this.providers.length}] ${provider.name} package is not installed/available. Skipping.`);
        continue;
      }

      messengerLogger.info('AUTH', `[Provider ${providerNum}/${this.providers.length}] Requesting login via ${provider.name}...`);
      const { connection, error } = await provider.login(appState);

      if (connection) {
        messengerLogger.success('AUTH', `SUCCESS! Authenticated via Provider ${providerNum}: ${provider.name}`, undefined, 'auth_success');
        return {
          connection,
          activeProviderName: provider.name,
          isHardFailure: false
        };
      }

      if (error) {
        lastCategory = error.category;
        lastReason = error.sanitizedReason;
        lastUserAction = error.userActionRequired;

        if (error.isHardFailure) {
          messengerLogger.error('AUTH', `[AUTH_BLOCKED] [Category: ${error.category}] ${error.sanitizedReason}`, undefined, 'auth_failed');
          messengerLogger.warn('AUTH', `[ACTION REQUIRED] ${error.userActionRequired}`);
          messengerLogger.error('AUTH', 'Upstream Facebook hard rejection detected. Stopping fallback chain to avoid brute-forcing or locking account.', undefined, 'auth_failed');
          
          return {
            connection: null,
            activeProviderName: provider.name,
            isHardFailure: true,
            failureCategory: error.category,
            failureReason: error.sanitizedReason,
            userActionRequired: error.userActionRequired
          };
        } else {
          messengerLogger.warn('AUTH', `[TECHNICAL_FAILURE] Provider ${provider.name} failed technically (${error.sanitizedReason}). Continuing to fallback provider...`);
        }
      }
    }

    messengerLogger.error('AUTH', 'All FCA providers returned authentication failures.', undefined, 'auth_failed');
    return {
      connection: null,
      isHardFailure: true,
      failureCategory: lastCategory,
      failureReason: lastReason,
      userActionRequired: lastUserAction
    };
  }
}
