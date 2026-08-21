import { createRequire } from 'node:module';

if (!(globalThis as any).__fca_stderr_filtered) {
  (globalThis as any).__fca_stderr_filtered = true;
  const originalStderrWrite = process.stderr.write.bind(process.stderr);
  process.stderr.write = function (chunk: any, encoding?: any, callback?: any): boolean {
    const str = String(chunk || '');
    if (str.includes('mqtt message parse error') || str.includes('IRIS_CURSOR_LIMIT') || str.includes('/notify_disconnect')) {
      if (typeof callback === 'function') callback();
      return true;
    }
    return originalStderrWrite(chunk, encoding, callback);
  };
}

export function getCustomRequire(): NodeRequire {
  if (typeof require !== 'undefined') {
    return require;
  }
  try {
    return createRequire(import.meta.url);
  } catch {
    return createRequire(process.cwd() + '/');
  }
}

export async function loadFCAModule(packageName: string): Promise<any> {
  let mod: any = null;

  // Attempt 1: Node createRequire
  try {
    const req = getCustomRequire();
    mod = req(packageName);
  } catch (reqError: any) {
    // Attempt 2: Dynamic import
    try {
      const imported = await import(packageName);
      mod = imported;
    } catch (impError: any) {
      throw new Error(`Failed to load module ${packageName}: ${reqError?.message || impError?.message}`);
    }
  }

  // CommonJS / ESM Interop Resolution
  if (mod && typeof mod === 'object' && 'default' in mod && typeof mod.default === 'function') {
    return mod.default;
  }

  return mod;
}
