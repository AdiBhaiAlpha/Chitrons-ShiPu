/**
 * Correct lifecycle handling for the FCA realtime (MQTT) listener.
 *
 * Why this module exists:
 * `api.listenMqtt(callback)` does NOT return a stop function. It returns a
 * MessageEmitter-ish object exposing `stopListening(cb)` / `stopListeningAsync()`,
 * and it also assigns `api.stopListening` / `api.stopListeningAsync`.
 *
 * AccountConnection used to store that return value in `stopListenerFunc` and
 * later call it as a function. Every call threw `TypeError: ... is not a
 * function` inside an empty `catch {}`, so the previous stream was never torn
 * down. Each reconnect therefore stacked another MQTT subscription on the same
 * session: duplicate message dispatch, duplicated mark-as-read, and a socket
 * leak. This helper normalizes all three shapes FCA surfaces use across
 * providers (stop function / emitter object / api-attached stop method).
 */

export interface FcaListenerHandle {
  /** Idempotent teardown. Safe to call multiple times, never throws. */
  stop: () => Promise<void> | void;
  /** True when the transport actually reported a live connection. */
  readonly isStreamActive: boolean;
}

/** Auth/terminal event shapes FCA emits through `emitAuth`. */
const TERMINAL_EVENT_TYPES = new Set([
  'account_inactive',
  'auth_error',
  'login_blocked',
  'stop_listen',
  'session_expired'
]);

export function isTerminalRealtimeEvent(event: any): boolean {
  if (!event || typeof event !== 'object') return false;
  if (TERMINAL_EVENT_TYPES.has(event.type)) return true;
  // FCA routes auth failures through `{ type: 'account_inactive', reason, error }`
  // and sometimes attaches `.error` to an otherwise ordinary-looking event.
  if (typeof event.reason === 'string' && TERMINAL_EVENT_TYPES.has(event.reason)) return true;
  return Boolean(event.error) && !event.messageID;
}

/**
 * Normalize whatever `listenMqtt` returned into a callable teardown.
 */
function buildStopper(api: any, listenReturnValue: any): () => Promise<void> | void {
  let done = false;

  const stop = () => {
    if (done) return;
    done = true;

    // 1. api-attached stop methods (most reliable across FCA forks)
    const asyncStop = api?.stopListeningAsync;
    if (typeof asyncStop === 'function') {
      try {
        const p = asyncStop.call(api);
        if (p && typeof p.then === 'function') p.catch(() => {});
      } catch {}
      return;
    }

    const syncStop = api?.stopListening;
    if (typeof syncStop === 'function') {
      try {
        syncStop.call(api, () => {});
      } catch {}
      return;
    }

    // 2. Emitter object returned by listenMqtt
    const ret = listenReturnValue;
    if (ret && typeof ret === 'object') {
      if (typeof ret.stopListeningAsync === 'function') {
        try {
          const p = ret.stopListeningAsync();
          if (p && typeof p.then === 'function') p.catch(() => {});
        } catch {}
        return;
      }
      if (typeof ret.stopListening === 'function') {
        try {
          ret.stopListening(() => {});
        } catch {}
        return;
      }
    }

    // 3. Provider that genuinely returned a stop function
    if (typeof ret === 'function') {
      try {
        ret();
      } catch {}
    }
  };

  return stop;
}

/**
 * Start the realtime listener and resolve with a real teardown handle.
 *
 * `onAuthEvent` fires for anything that invalidates the session, so the caller
 * can transition to a terminal state instead of silently going deaf.
 * `onDeadStream` fires when the transport reports neither an event nor an
 * error — the "connected but deaf" state that otherwise looks healthy forever.
 */
export function startFcaRealtimeListener(params: {
  api: any;
  providerName: string;
  log?: (msg: string) => void;
  warn?: (msg: string) => void;
  onEvent: (event: any) => void;
  onAuthEvent: (err: any) => void;
  onDeadStream?: () => void;
  silentDeadStream?: boolean;
}): FcaListenerHandle {
  const { api, providerName, onEvent, onAuthEvent, onDeadStream } = params;
  const log = params.log ?? (() => {});
  const warn = params.warn ?? (() => {});

  const listenFn =
    typeof api?.listenMqtt === 'function'
      ? api.listenMqtt.bind(api)
      : typeof api?.listen === 'function'
        ? api.listen.bind(api)
        : null;

  if (!listenFn) {
    throw new Error('FCA api exposes neither listenMqtt nor listen');
  }

  let stopped = false;
  let streamActive = false;

  const ret = listenFn((first: any, second: any) => {
    if (stopped) return;

    // FCA calls back as (error, event), but its `emitAuth` path calls back as
    // (eventWithError, null). Normalize by inspecting both positions.
    const candidate = first ?? second;
    if (candidate && typeof candidate === 'object' && isTerminalRealtimeEvent(candidate)) {
      stopped = true;
      const detail = candidate.error || candidate.reason || candidate.type;
      warn(`[${providerName}] Terminal realtime event: ${detail}`);
      onAuthEvent(candidate);
      return;
    }

    if (first instanceof Error || (first && typeof first === 'object' && !first.type && first.message)) {
      const err = first;
      warn(`[${providerName}] Listener error: ${err.message || err}`);
      onAuthEvent(err);
      return;
    }

    const event = second ?? first;

    if (!event) {
      // getSeqID failed and FCA surfaced neither an error nor an event.
      warn(`[${providerName}] Empty realtime callback (transport is up but not authenticated)`);
      onAuthEvent(new Error('MQTT transport produced no event: getSeqID handshake rejected (session expired or blocked)'));
      return;
    }

    streamActive = true;
    onEvent(event);
  });

  const stop = buildStopper(api, ret);

  return {
    stop,
    get isStreamActive() {
      return streamActive;
    }
  };
}
