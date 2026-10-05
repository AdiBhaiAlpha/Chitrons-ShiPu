import { normalizeAppState } from './normalizeAppState';

/**
 * Facebook's Chat UI as of 2025/2026. FCA compares the User-Agent against
 * known-good Chrome signatures, so a desktop Chrome UA is required.
 */
export const FCA_CHROME_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

/**
 * The realtime (MQTT) stream needs `listenEvents`, otherwise `listenMqtt`
 * never subscribes to the message topics.
 *
 * Every key here MUST be in FCA's `Boolean_Option` list
 * (online, selfListen, listenEvents, updatePresence, forceLogin, autoMarkRead,
 *  listenTyping, autoReconnect, emitReady, selfListenEvent) plus userAgent.
 * Anything else makes FCA log `setOptions Unrecognized option`.
 *
 * `autoReconnect: false` is deliberate: AccountConnection owns the reconnect
 * policy (exponential backoff + terminal-state detection). Letting FCA also
 * auto-reconnect produces two competing reconnect loops.
 */
export function buildFcaLoginOptions(overrides: Record<string, any> = {}): Record<string, any> {
  return {
    listenEvents: true,
    selfListen: true,
    selfListenEvent: false,
    listenTyping: true,
    autoMarkRead: true,
    forceLogin: false,
    autoReconnect: false,
    updatePresence: false,
    online: true,
    emitReady: false,
    userAgent: FCA_CHROME_USER_AGENT,
    ...overrides
  };
}

/**
 * `login()` never invokes its callback on some Facebook/FCA failure paths, so
 * an unguarded call hangs the HTTP request forever and the dashboard shows a
 * permanent spinner. Fail fast instead so the fallback chain can proceed.
 */
export const DEFAULT_FCA_LOGIN_TIMEOUT_MS = Number(process.env.FCA_LOGIN_TIMEOUT_MS) || 90_000;

/**
 * Wrap a callback-style `login()` invocation with a hard timeout.
 * Rejects with a recognizable error so FCAAuthErrorClassifier can categorize it
 * as a technical (retryable) failure rather than a hard auth rejection.
 */
export function invokeFcaLoginWithTimeout<T>(
  loginFn: (credentials: any, options: any, cb: (err: any, api: T) => void) => any,
  credentials: any,
  options: any,
  timeoutMs: number = DEFAULT_FCA_LOGIN_TIMEOUT_MS
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    let settled = false;

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      reject(new Error(`FCA login timed out after ${timeoutMs}ms (no callback from Facebook)`));
    }, timeoutMs);

    // Do not hold the event loop open just for this timer.
    if (typeof timer.unref === 'function') timer.unref();

    try {
      loginFn(credentials, options, (err: any, api: T) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        if (err) return reject(err instanceof Error ? err : new Error(String(err?.message ?? err)));
        if (!api) return reject(new Error('API object returned null from login'));
        resolve(api);
      });
    } catch (err: any) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(err instanceof Error ? err : new Error(String(err?.message ?? err)));
    }
  });
}

export { normalizeAppState };
