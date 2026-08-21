/**
 * Robust fetch wrapper that handles non-JSON responses and platform rate limiting gracefully with auto-retry.
 */
export async function safeFetchJson<T>(url: string, fallback: T, options?: RequestInit, retries = 2): Promise<T> {
  try {
    const res = await fetch(url, options);
    
    // Handle platform rate limits (often returned as plain text "Rate exceeded.")
    if (res.status === 429) {
      if (retries > 0) {
        await new Promise(r => setTimeout(r, 600));
        return safeFetchJson(url, fallback, options, retries - 1);
      }
      console.warn(`[safeFetchJson] Rate limit exceeded for ${url}`);
      return fallback;
    }

    if (!res.ok) {
      console.warn(`[safeFetchJson] HTTP ${res.status} error from ${url}`);
      return fallback;
    }

    const contentType = res.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      const text = await res.text();
      if (text && text.includes('Rate exceeded')) {
        if (retries > 0) {
          await new Promise(r => setTimeout(r, 600));
          return safeFetchJson(url, fallback, options, retries - 1);
        }
        console.warn(`[safeFetchJson] Rate limit string detected from ${url}`);
      } else {
        console.warn(`[safeFetchJson] non-JSON response from ${url}:`, text ? text.substring(0, 100) : '');
      }
      return fallback;
    }

    return await res.json();
  } catch (err) {
    if (retries > 0) {
      await new Promise(r => setTimeout(r, 400));
      return safeFetchJson(url, fallback, options, retries - 1);
    }
    console.warn(`[safeFetchJson] Fetch fallback applied for ${url}`);
    return fallback;
  }
}

export async function safeFetchResponse(url: string, options?: RequestInit, retries = 2): Promise<{
  ok: boolean;
  status: number;
  data: any;
  text?: string;
  isRateLimited?: boolean;
}> {
  try {
    const res = await fetch(url, options);
    if (res.status === 429) {
      if (retries > 0) {
        await new Promise(r => setTimeout(r, 600));
        return safeFetchResponse(url, options, retries - 1);
      }
      return { ok: false, status: 429, data: null, isRateLimited: true, text: 'Rate limit exceeded' };
    }
    const contentType = res.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      const text = await res.text();
      const isRateLimited = Boolean(text && text.includes('Rate exceeded'));
      if (isRateLimited && retries > 0) {
        await new Promise(r => setTimeout(r, 600));
        return safeFetchResponse(url, options, retries - 1);
      }
      return { ok: false, status: res.status, data: null, isRateLimited, text };
    }
    const data = await res.json();
    return { ok: res.ok, status: res.status, data };
  } catch (err: any) {
    if (retries > 0) {
      await new Promise(r => setTimeout(r, 400));
      return safeFetchResponse(url, options, retries - 1);
    }
    return { ok: false, status: 0, data: null, text: err.message };
  }
}


