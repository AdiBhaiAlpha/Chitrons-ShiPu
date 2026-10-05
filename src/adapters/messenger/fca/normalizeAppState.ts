/**
 * Canonical appstate normalization shared by every FCA provider.
 *
 * Background / why this file exists:
 * The provider adapters used to map cookies inline with
 *   expires: c.expires || c.expirationDate || 2147483647
 * FCA (`setJarCookies`) interprets `c.expires` as a value in MILLISECONDS, so
 * 2147483647 resolves to `new Date(2147483647)` = 25 Jan 1970. Every session
 * cookie (c_user, datr, fr, sb, ...) was therefore written already-expired and
 * silently dropped from the cookie jar, leaving Facebook with an anonymous
 * request: login fails and `getSeqID` returns `login_blocked`, so MQTT never
 * connects.
 *
 * This module is the single place where an appstate array is built, so the
 * expiry semantics can only be correct once.
 */

/** Cookies FCA cannot work without. */
export const ESSENTIAL_FB_COOKIE_KEYS = ['c_user', 'xs'];

/** Cookies that carry the session fingerprint; missing them means a dead export. */
export const RECOMMENDED_FB_COOKIE_KEYS = ['datr', 'fr', 'sb'];

/**
 * Sentinel meaning "session cookie, never expire it".
 * Deliberately large in MILLISECONDS so the date lands in the year 2100.
 */
const SESSION_COOKIE_EXPIRES_MS = 4102444800000;

function isPlainObject(value: any): boolean {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Coerce any accepted appstate shape (array, `{name: value}` object, JSON
 * string, raw `Cookie:` header) into an array of cookie records.
 * Returns an empty array when nothing usable was found.
 */
export function coerceAppState(input: any): any[] {
  if (!input) return [];

  let source = input;

  if (typeof source === 'string') {
    const trimmed = source.trim();
    if (!trimmed) return [];

    // JSON array / object export
    if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
      try {
        source = JSON.parse(trimmed);
      } catch {
        return [];
      }
    } else {
      // Raw `Cookie: a=1; b=2` header (or a single `a=1` pair)
      return trimmed
        .split(';')
        .map((pair) => {
          const idx = pair.indexOf('=');
          if (idx < 0) return null;
          const key = pair.slice(0, idx).trim();
          const value = pair.slice(idx + 1).trim();
          if (!key) return null;
          return { key, name: key, value };
        })
        .filter(Boolean);
    }
  }

  if (Array.isArray(source)) return source.filter(isPlainObject);

  if (isPlainObject(source)) {
    // `{ "c_user": "123", "xs": "abc" }` shape used by several exporters
    const values = Object.values(source);
    if (values.every(isPlainObject)) return values as any[];

    return Object.entries(source)
      .map(([key, value]) =>
        typeof value === 'string' ? { key, name: key, value } : null
      )
      .filter(Boolean) as any[];
  }

  return [];
}

function normalizeDomain(rawDomain: any): string {
  const domain = typeof rawDomain === 'string' ? rawDomain.trim() : '';
  if (!domain) return '.facebook.com';
  return domain.startsWith('.') ? domain : `.${domain}`;
}

function normalizePath(rawPath: any): string {
  const p = typeof rawPath === 'string' ? rawPath.trim() : '';
  if (!p || !p.startsWith('/')) return '/';
  return p;
}

/**
 * Interpret an exporter expiry into a value FCA's `setJarCookies` will read
 * correctly.
 *
 * FCA reads `expirationDate` first and `expires` second, treating BOTH as
 * milliseconds when they are "large". Browser extensions emit `expirationDate`
 * in SECONDS, which is why FCA guesses. To remove the guesswork we always
 * express the result as a `Date` instance in `expires`, which FCA converts via
 * `new Date(c.expires)` — unambiguous regardless of magnitude.
 */
function normalizeExpiryMs(cookie: any): number {
  const candidates = [cookie.expires, cookie.expirationDate, cookie.expirationDate === null ? undefined : undefined];
  const raw = candidates.find((v) => v !== undefined && v !== null && v !== '');

  if (raw === undefined) return SESSION_COOKIE_EXPIRES_MS;

  if (raw instanceof Date) {
    const ms = raw.getTime();
    return Number.isFinite(ms) ? ms : SESSION_COOKIE_EXPIRES_MS;
  }

  if (typeof raw === 'number' && Number.isFinite(raw)) {
    // Browser extensions use seconds; values below ~1e11 cannot be plausible
    // millisecond timestamps for a session cookie (1e11 ms = 1973).
    return raw < 1e11 ? raw * 1000 : raw;
  }

  const parsed = Date.parse(String(raw));
  return Number.isNaN(parsed) ? SESSION_COOKIE_EXPIRES_MS : parsed;
}

/**
 * Build the appstate array handed to FCA's `login()`.
 *
 * Guarantees:
 *  - always an array (never an object, so `.map()` in the providers is safe)
 *  - both `key` and `name` populated (exporters disagree on which they emit)
 *  - `domain` / `path` defaults applied
 *  - `expires` always a millisecond timestamp FCA can read correctly
 *  - `expirationDate` REMOVED so FCA cannot reinterpret seconds as milliseconds
 */
export function normalizeAppState(input: any): any[] {
  return coerceAppState(input).map((cookie) => {
    const key = cookie.key || cookie.name;
    const value = cookie.value === undefined || cookie.value === null ? '' : String(cookie.value);

    const normalized: any = {
      ...cookie,
      key,
      name: key,
      value,
      domain: normalizeDomain(cookie.domain),
      path: normalizePath(cookie.path),
      expires: normalizeExpiryMs(cookie)
    };

    // FCA prefers `expirationDate` over `expires`; deleting it guarantees the
    // normalized millisecond `expires` is the one that wins.
    delete normalized.expirationDate;

    if (cookie.hostOnly === true) normalized.hostOnly = true;
    if (typeof cookie.secure === 'boolean') normalized.secure = cookie.secure;
    if (typeof cookie.httpOnly === 'boolean') normalized.httpOnly = cookie.httpOnly;
    if (cookie.sameSite) normalized.sameSite = cookie.sameSite;

    return normalized;
  });
}

/**
 * Keys present in a normalized/raw appstate, for diagnostics and validation.
 */
export function extractCookieKeys(input: any): string[] {
  return coerceAppState(input)
    .map((c) => c?.key || c?.name)
    .filter((k): k is string => typeof k === 'string' && k.length > 0);
}

/**
 * Best-effort Facebook UID (c_user, else i_user) from any appstate shape.
 */
export function extractAppStateUid(input: any): string {
  const cookies = coerceAppState(input);
  const match = cookies.find((c) => {
    const key = c?.key || c?.name;
    return key === 'c_user' || key === 'i_user';
  });
  const value = match?.value === undefined || match?.value === null ? '' : String(match.value);
  return value.replace(/[^0-9]/g, '');
}

/**
 * Validate that an appstate can plausibly authenticate.
 * Mirrors the server-side rule the dashboard UI enforces (c_user + xs present).
 */
export function isUsableAppState(input: any): {
  usable: boolean;
  reason?: string;
  uid?: string;
  keys: string[];
} {
  const keys = extractCookieKeys(input);
  const uid = extractAppStateUid(input);
  const present = new Set(keys);

  if (keys.length === 0) {
    return { usable: false, reason: 'AppState contains no cookies.', keys };
  }

  const missing = ESSENTIAL_FB_COOKIE_KEYS.filter((k) => !present.has(k));
  if (missing.length > 0) {
    return {
      usable: false,
      reason: `AppState is missing essential Facebook cookie(s): ${missing.join(', ')}. Export it again from a logged-in facebook.com tab using Cookie-Editor → "Export" → JSON.`,
      uid: uid || undefined,
      keys
    };
  }

  if (!uid) {
    return { usable: false, reason: 'Could not read a numeric Facebook UID from c_user.', keys };
  }

  return { usable: true, uid, keys };
}
