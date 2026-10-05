import { FCAConnection } from './FCAProvider';
import { messengerLogger, MessengerLogger } from '../MessengerLogger';
import { normalizeFcaApi } from './normalizeFcaApi';
import { startFcaRealtimeListener, FcaListenerHandle } from './fcaRealtimeListener';
import { buildFcaLoginOptions, invokeFcaLoginWithTimeout, FCA_CHROME_USER_AGENT } from './fcaLoginOptions';
import { normalizeAppState } from './normalizeAppState';
import { loadFCAModule } from './loadFCAModule';
import { FCAAuthErrorClassifier, FCAAuthErrorDetails } from './FCAAuthErrorClassifier';

export interface FcaProviderLoginResult {
  connection?: FCAConnection;
  error?: FCAAuthErrorDetails;
}

/**
 * One implementation shared by every FCA provider adapter.
 *
 * Previously each of the three providers carried its own ~120-line copy of the
 * login + listener logic. That is how the `expires: 2147483647` jar-destroying
 * bug came to exist identically in all three and stayed in sync. Keeping the
 * logic here means a cookie-format or listener-lifecycle fix lands once.
 */
export class BaseFcaProvider {
  constructor(
    public readonly name: string,
    public readonly packageName: string
  ) {}

  public async isAvailable(): Promise<boolean> {
    try {
      messengerLogger.info('AUTH', `[${this.name}] Package check: ${this.packageName}`);
      const loginFn = await loadFCAModule(this.packageName);
      messengerLogger.info('AUTH', `[${this.name}] Installed: YES | Module loaded: YES | Export type: ${typeof loginFn}`);
      return typeof loginFn === 'function';
    } catch (err: any) {
      messengerLogger.warn('AUTH', `[${this.name}] Installed: NO / Load Failed | Reason: ${err?.message || 'MODULE_LOAD_ERROR'}`);
      return false;
    }
  }

  public async login(rawAppState: any): Promise<FcaProviderLoginResult> {
    messengerLogger.info('AUTH', `[${this.name}] Starting REAL authentication attempt with ${this.packageName}...`);

    let loginFn: any;
    try {
      loginFn = await loadFCAModule(this.packageName);
      if (typeof loginFn !== 'function') {
        return {
          error: {
            category: 'PROVIDER_ERROR',
            isHardFailure: false,
            sanitizedReason: `[${this.name}] Loaded module export is not callable (type: ${typeof loginFn})`,
            providerName: this.name,
            userActionRequired: 'Check provider export structure'
          }
        };
      }
      messengerLogger.info('AUTH', `[${this.name}] Module loaded successfully. Login export: READY.`);
    } catch (loadErr: any) {
      return { error: FCAAuthErrorClassifier.classify(loadErr, this.name) };
    }

    // Expiry semantics live in normalizeAppState; getting these wrong silently
    // empties the cookie jar, so normalize here and nowhere else.
    const appState = normalizeAppState(rawAppState);
    if (appState.length === 0) {
      return {
        error: {
          category: 'INVALID_APPSTATE',
          isHardFailure: false,
          sanitizedReason: `[${this.name}] No usable cookies found in the supplied appstate`,
          providerName: this.name,
          userActionRequired: 'Re-export the appstate JSON from a logged-in facebook.com tab'
        }
      };
    }

    const options = buildFcaLoginOptions();
    messengerLogger.info('AUTH', `[${this.name}] Executing login() with ${appState.length} cookies...`);

    let api: any;
    try {
      api = await invokeFcaLoginWithTimeout(loginFn, { appState }, options);
    } catch (err: any) {
      const authErr = FCAAuthErrorClassifier.classify(err, this.name);
      messengerLogger.error('AUTH', `[${this.name}] Auth Failed [${authErr.category}]: ${authErr.sanitizedReason}`);
      return { error: authErr };
    }

    if (typeof api.listenMqtt !== 'function' && typeof api.listen !== 'function') {
      messengerLogger.error('AUTH', `[${this.name}] API object missing listenMqtt/listen`);
      return {
        error: {
          category: 'PROVIDER_ERROR',
          isHardFailure: false,
          sanitizedReason: `[${this.name}] API object missing listenMqtt or sendMessage functions`,
          providerName: this.name,
          userActionRequired: 'Try secondary fallback provider'
        }
      };
    }

    try {
      if (typeof api.setOptions === 'function') {
        api.setOptions(buildFcaLoginOptions());
      }
    } catch {}

    const normalizedApi = normalizeFcaApi(api, this.name);
    const botUserId = (normalizedApi.getCurrentUserID && normalizedApi.getCurrentUserID()) || 'FB_USER';
    messengerLogger.success('AUTH', `[${this.name}] Authenticated! UID: ${MessengerLogger.maskUid(botUserId)}`);

    let handle: FcaListenerHandle | null = null;

    const connection: FCAConnection = {
      providerName: this.name,
      api: normalizedApi,
      botUserId,
      listen: async (onEvent, onError) => {
        messengerLogger.info('MQTT', `[${this.name}] Registering listenMqtt listener...`);

        const started = startFcaRealtimeListener({
          api,
          providerName: this.name,
          log: (m) => messengerLogger.info('MQTT', m),
          warn: (m) => messengerLogger.warn('MQTT', m),
          onEvent: (event) => {
            messengerLogger.info('MQTT', `[${this.name}] Event received! Type: ${event?.type || 'unknown'}`);
            onEvent(event);
          },
          onAuthEvent: (err) => {
            try {
              handle?.stop();
            } catch {}
            onError(err);
          }
        });

        handle = started;
        return () => {
          handle = null;
          started.stop();
        };
      },
      disconnect: async () => {
        // Only tear down the transport. Calling api.logout() here would revoke
        // the session on Facebook's servers and invalidate the stored cookies,
        // so a plain disconnect must never reach it.
        handle?.stop();
        handle = null;
      },
      logout: async () => {
        handle?.stop();
        handle = null;
        if (typeof api.logout === 'function') {
          try {
            const p = api.logout();
            if (p && typeof p.catch === 'function') p.catch(() => {});
          } catch {}
        }
      }
    };

    return { connection };
  }
}

export { FCA_CHROME_USER_AGENT };
