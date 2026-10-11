import { FCAProvider, FCAConnection } from '../FCAProvider';
import { FCAAuthErrorClassifier, FCAAuthErrorDetails } from '../FCAAuthErrorClassifier';
import { loadFCAModule } from '../loadFCAModule';
import { messengerLogger, MessengerLogger } from '../../MessengerLogger';
import { normalizeFcaApi } from '../normalizeFcaApi';

export class XnilFCAProvider implements FCAProvider {
  public name = 'Xnil FCA';
  public packageName = '@xnil6x/fca-unofficial';

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

  public async login(appState: any[]): Promise<{ connection?: FCAConnection; error?: FCAAuthErrorDetails }> {
    messengerLogger.info('AUTH', `[${this.name}] Starting REAL fallback authentication attempt with ${this.packageName}...`);

    let loginFn: any;
    try {
      loginFn = await loadFCAModule(this.packageName);
      if (typeof loginFn !== 'function') {
        const authErr: FCAAuthErrorDetails = {
          category: 'PROVIDER_ERROR',
          isHardFailure: false,
          sanitizedReason: `[${this.name}] Loaded module export is not callable (type: ${typeof loginFn})`,
          providerName: this.name,
          userActionRequired: 'Check provider export structure'
        };
        return { error: authErr };
      }
      messengerLogger.info('AUTH', `[${this.name}] Module loaded successfully. Login export: READY.`);
    } catch (loadErr: any) {
      const authErr = FCAAuthErrorClassifier.classify(loadErr, this.name);
      return { error: authErr };
    }

    return new Promise((resolve) => {
      try {
        const formattedAppState = (Array.isArray(appState) ? appState : Object.values(appState || {}))
          .map((c: any) => {
            const key = c.key || c.name;
            if (!key) return null;
            let domain = c.domain || '.facebook.com';
            if (domain.includes('facebook.com')) {
              domain = '.facebook.com';
            } else if (!domain.startsWith('.')) {
              domain = `.${domain}`;
            }
            return {
              key,
              name: key,
              value: c.value != null ? String(c.value) : '',
              domain,
              path: c.path || '/',
              expires: c.expires || c.expirationDate || 2147483647
            };
          })
          .filter(Boolean);

        const options = {
          listenEvents: true,
          selfListen: true,
          autoMarkRead: true,
          forceLogin: false,
          autoReconnect: true,
          online: true,
          userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'
        };

        messengerLogger.info('AUTH', `[${this.name}] Executing login() with ${formattedAppState.length} cookies...`);

        loginFn({ appState: formattedAppState }, options, (err: any, api: any) => {
          if (err) {
            const authErr = FCAAuthErrorClassifier.classify(err, this.name);
            messengerLogger.error('AUTH', `[${this.name}] Auth Failed [${authErr.category}]: ${authErr.sanitizedReason}`);
            return resolve({ error: authErr });
          }

          if (!api) {
            const authErr = FCAAuthErrorClassifier.classify('API object returned null from login', this.name);
            messengerLogger.error('AUTH', `[${this.name}] API object is null or undefined`);
            return resolve({ error: authErr });
          }

          if (typeof api.listenMqtt !== 'function' || typeof api.sendMessage !== 'function') {
            const authErr: FCAAuthErrorDetails = {
              category: 'PROVIDER_ERROR',
              isHardFailure: false,
              sanitizedReason: `[${this.name}] API object missing listenMqtt or sendMessage functions`,
              providerName: this.name,
              userActionRequired: 'Try secondary fallback provider'
            };
            messengerLogger.error('AUTH', `[${this.name}] API object missing required methods`);
            return resolve({ error: authErr });
          }

          try {
            if (typeof api.setOptions === 'function') {
              api.setOptions({
                listenEvents: true,
                selfListen: true,
                autoMarkRead: true,
                logLevel: 'silent',
                autoReconnect: false,
                autoLogin: false,
                userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
              });
            }
          } catch {}

          const normalizedApi = normalizeFcaApi(api, this.name);
          const botUserId = (normalizedApi.getCurrentUserID && normalizedApi.getCurrentUserID()) || 'FB_USER';
          messengerLogger.success('AUTH', `[${this.name}] Authenticated! UID: ${MessengerLogger.maskUid(botUserId)}`);

          const connection: FCAConnection = {
            providerName: this.name,
            api: normalizedApi,
            botUserId,
            listen: async (onEvent, onError) => {
              messengerLogger.info('MQTT', `[${this.name}] Registering listenMqtt listener...`);
              let stopped = false;
              let stopFunc: any = null;
              const safeStop = () => {
                if (stopped) return;
                stopped = true;
                if (typeof stopFunc === 'function') {
                  try { stopFunc(); } catch {}
                }
              };

              stopFunc = api.listenMqtt((lErr: any, event: any) => {
                if (stopped) return;
                if (lErr) {
                  messengerLogger.error('MQTT', `[${this.name}] ListenMqtt Error: ${lErr.message || lErr}`);
                  safeStop();
                  onError(lErr);
                  return;
                }
                if (event) {
                  if (event.type === 'account_inactive' || event.type === 'auth_error' || event.type === 'login_blocked' || event.type === 'stop_listen' || event.error) {
                    messengerLogger.warn('MQTT', `[${this.name}] Listener inactive/auth event: ${event.reason || event.error || event.type}`);
                    safeStop();
                    onError(event.error || event.reason || event);
                    return;
                  }
                  onEvent(event);
                }
              });
              return safeStop;
            },
            disconnect: async () => {
              if (api.logout && typeof api.logout === 'function') {
                try {
                  const p = api.logout();
                  if (p && typeof p.catch === 'function') {
                    p.catch(() => {});
                  }
                } catch {}
              }
            }
          };

          return resolve({ connection });
        });
      } catch (fatalErr: any) {
        const authErr = FCAAuthErrorClassifier.classify(fatalErr, this.name);
        messengerLogger.error('AUTH', `[${this.name}] Fatal invocation exception: ${fatalErr.message}`);
        return resolve({ error: authErr });
      }
    });
  }
}
