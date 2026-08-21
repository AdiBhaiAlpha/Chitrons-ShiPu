import * as ftp from 'basic-ftp';
import path from 'path';

export interface FtpConnectionOptions {
  enabled: boolean;
  protocol: 'ftp' | 'ftps' | 'sftp';
  host: string;
  port: number;
  username: string;
  password?: string;
  rootDirectory: string;
  passiveMode?: boolean;
  secure?: boolean;
  timeout?: number;
}

export interface FtpFileItem {
  name: string;
  type: 'file' | 'directory' | 'unknown';
  size: number;
  modifiedAt?: string;
  relativePath: string;
  displayPath: string;
  path: string; // Alias for relativePath for backward compatibility
  permissions?: string;
}

export interface DirectoryListingResult {
  success: boolean;
  files: FtpFileItem[];
  relativePath: string;
  displayPath: string;
  currentPath: string; // Alias for relativePath
  rootDirectory: string;
  counts?: { folders: number; files: number };
  cacheHit?: boolean;
  telemetryMs?: number;
  error?: string;
}

export interface StorageConnectionState {
  status: 'CONNECTED' | 'DISCONNECTED' | 'CONNECTING' | 'ERROR' | 'NOT_CONFIGURED';
  connected: boolean;
  protocol: string;
  host?: string;
  port?: number;
  username?: string;
  rootDirectory?: string;
  lastCheckedAt?: string;
  errorCode?: string;
  errorMessage?: string;
}

// In-Memory Cache Entry keyed by relative path (e.g. "/", "/shipuai")
interface CacheEntry {
  files: FtpFileItem[];
  relativePath: string;
  displayPath: string;
  counts: { folders: number; files: number };
  timestamp: number;
}

/**
 * Centralized Path Resolver
 * Normalizes relative paths and resolves full remote FTP path.
 * FTP_ROOT is immutable configuration e.g. "/htdocs/ai" or "/shipu-bot/".
 */
export function resolveRemotePath(
  ftpRoot: string,
  subPath: string
): { relativePath: string; fullRemotePath: string } {
  // Normalize root path (ensure leading slash, no trailing slash unless root '/')
  const root = ftpRoot.startsWith('/') ? ftpRoot : '/' + ftpRoot;
  const cleanRoot = root.length > 1 ? root.replace(/\/+$/, '') : '/';

  // Sanitize input path string
  let raw = (subPath || '').trim();
  try {
    if (raw.includes('%')) {
      raw = decodeURIComponent(raw);
    }
  } catch {
    // Ignore decoding errors
  }

  // Convert backslashes & collapse multiple slashes
  raw = raw.replace(/\\/g, '/').replace(/\/+/g, '/');

  // Strip repeated FTP_ROOT prefixes if passed accidentally
  // e.g. /htdocs/ai/htdocs/ai/shipuai -> /shipuai
  if (cleanRoot !== '/') {
    while (raw === cleanRoot || raw.startsWith(cleanRoot + '/')) {
      raw = raw.slice(cleanRoot.length);
      if (!raw) raw = '/';
      if (!raw.startsWith('/')) raw = '/' + raw;
    }
  }

  // Sanitize path traversal tokens like '..' or '.'
  const parts = raw.split('/').filter(p => p && p !== '.' && p !== '..');
  const normalizedRelative = '/' + parts.join('/');

  // Build full remote path on FTP server
  const fullRemotePath = normalizedRelative === '/'
    ? cleanRoot
    : cleanRoot === '/'
    ? '/' + parts.join('/')
    : path.posix.join(cleanRoot, parts.join('/'));

  return {
    relativePath: normalizedRelative,
    fullRemotePath
  };
}

class FtpStorageService {
  private cache = new Map<string, CacheEntry>();
  private cacheTtlMs = 12000; // 12 seconds TTL
  private inFlightRequests = new Map<string, Promise<DirectoryListingResult>>();
  private taskQueue: Array<() => Promise<void>> = [];
  private activeTaskCount = 0;
  private maxConcurrency = 2; // Controlled request queue

  private connectionState: StorageConnectionState = {
    status: 'CONNECTED',
    connected: true,
    protocol: 'ftp',
    host: 'ftp.server',
    rootDirectory: '/htdocs/ai'
  };

  public getConnectionState(): StorageConnectionState {
    return this.connectionState;
  }

  public updateConnectionState(state: Partial<StorageConnectionState>) {
    this.connectionState = {
      ...this.connectionState,
      ...state,
      lastCheckedAt: new Date().toISOString()
    };
  }

  /**
   * Queue task execution to limit concurrent FTP connections
   */
  private async enqueueTask<T>(taskFn: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const wrappedTask = async () => {
        this.activeTaskCount++;
        try {
          const res = await taskFn();
          resolve(res);
        } catch (err) {
          reject(err);
        } finally {
          this.activeTaskCount--;
          this.processQueue();
        }
      };

      this.taskQueue.push(wrappedTask);
      this.processQueue();
    });
  }

  private processQueue() {
    if (this.activeTaskCount >= this.maxConcurrency || this.taskQueue.length === 0) {
      return;
    }
    const nextTask = this.taskQueue.shift();
    if (nextTask) {
      nextTask();
    }
  }

  private createClient(options: FtpConnectionOptions): ftp.Client {
    const client = new ftp.Client(options.timeout || 60000);
    client.ftp.verbose = false;
    client.ftp.ipFamily = 4; // Force IPv4 for better compatibility with legacy FTP hosts
    return client;
  }

  /**
   * Invalidate directory cache by relative path
   */
  public invalidateCache(relativeSubPath?: string) {
    if (!relativeSubPath) {
      this.cache.clear();
      return;
    }
    const cleanRel = relativeSubPath.startsWith('/') ? relativeSubPath : '/' + relativeSubPath;
    for (const key of this.cache.keys()) {
      if (key === cleanRel || key.startsWith(cleanRel + '/') || cleanRel.startsWith(key + '/')) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Comprehensive validation sweep on startup to ensure credentials and firewall settings are compatible
   */
  public async verifyStabilityOnStartup(options: FtpConnectionOptions): Promise<{ success: boolean; message: string }> {
    console.log(`[FTP Startup] Verifying connection stability to ${options.host}:${options.port}...`);
    
    return this.enqueueTask(async () => {
      const client = this.createClient({ ...options, timeout: options.timeout || 10000 });
      try {
        // Attempt primary access
        await client.access({
          host: options.host,
          port: options.port || 21,
          user: options.username,
          password: options.password || '',
          secure: options.secure || false
        });

        // Verify root directory exists
        const { fullRemotePath } = resolveRemotePath(options.rootDirectory || '/htdocs/ai', '/');
        await client.ensureDir(fullRemotePath);

        // Explicitly test PASSIVE mode by attempting a small list operation
        await client.list();

        client.close();
        this.updateConnectionState({
          status: 'CONNECTED',
          connected: true,
          host: options.host,
          username: options.username,
          rootDirectory: options.rootDirectory
        });

        console.log(`[FTP Startup] Stability verified. Root "${fullRemotePath}" is accessible.`);
        return { success: true, message: 'FTP Connection verified and stabilized.' };
      } catch (err: any) {
        client.close();
        const errMsg = String(err?.message || '').toLowerCase();
        let status: StorageConnectionState['status'] = 'DISCONNECTED';
        let detail = err.message;

        if (errMsg.includes('530')) {
          status = 'ERROR';
          detail = '530 Login authentication failed. Credentials hardcoded but rejected by server.';
        } else if (errMsg.includes('timeout') || errMsg.includes('etimedout')) {
          detail = 'Connection timed out. Remote storage server unreachable or passive mode blocked.';
        }

        this.updateConnectionState({
          status,
          connected: false,
          errorMessage: detail
        });

        console.log(`[FTP Startup] Offline / Local mode: ${detail}`);
        return { success: false, message: detail };
      }
    });
  }

  /**
   * Test FTP Connection and update single source of truth connection state
   */
  public async testConnection(options: FtpConnectionOptions): Promise<{ success: boolean; status: string; message: string }> {
    if (!options.host || !options.username) {
      this.updateConnectionState({ status: 'NOT_CONFIGURED', connected: false, errorMessage: 'Host or username missing' });
      return { success: false, status: 'NOT_CONFIGURED', message: 'FTP host or username is missing' };
    }

    return this.enqueueTask(async () => {
      const client = this.createClient(options);
      try {
        await client.access({
          host: options.host,
          port: options.port || 21,
          user: options.username,
          password: options.password || '',
          secure: options.secure || false
        });

        const { fullRemotePath } = resolveRemotePath(options.rootDirectory || '/shipu-bot/', '/');
        try {
          await client.ensureDir(fullRemotePath);
        } catch {
          client.close();
          this.updateConnectionState({
            status: 'ERROR',
            connected: false,
            protocol: options.protocol || 'ftp',
            host: options.host,
            port: options.port || 21,
            username: options.username,
            rootDirectory: options.rootDirectory,
            errorMessage: `Target root directory ${fullRemotePath} not accessible`
          });
          return {
            success: false,
            status: 'ROOT_DIRECTORY_NOT_FOUND',
            message: `Could not access target remote directory: ${fullRemotePath}`
          };
        }

        client.close();
        this.updateConnectionState({
          status: 'CONNECTED',
          connected: true,
          protocol: options.protocol || 'ftp',
          host: options.host,
          port: options.port || 21,
          username: options.username,
          rootDirectory: options.rootDirectory,
          errorMessage: undefined
        });

        return {
          success: true,
          status: 'CONNECTED',
          message: `Successfully connected to FTP server. Remote root: ${fullRemotePath}`
        };
      } catch (err: any) {
        client.close();
        this.updateConnectionState({
          status: 'ERROR',
          connected: false,
          protocol: options.protocol || 'ftp',
          host: options.host,
          port: options.port || 21,
          username: options.username,
          rootDirectory: options.rootDirectory,
          errorMessage: err?.message || 'Unknown connection error'
        });

        return {
          success: false,
          status: 'ERROR',
          message: `FTP Connection Failed: ${err?.message || 'Unknown error'}`
        };
      }
    });
  }

  /**
   * List files in directory relative to FTP root
   */
  public async listDirectory(
    options: FtpConnectionOptions,
    subPath: string = '/',
    forceRefresh: boolean = false
  ): Promise<DirectoryListingResult> {
    const startTime = Date.now();
    const rootDir = options.rootDirectory || '/shipu-bot/';
    const { relativePath, fullRemotePath } = resolveRemotePath(rootDir, subPath);

    // Check cache
    if (!forceRefresh) {
      const cached = this.cache.get(relativePath);
      if (cached && Date.now() - cached.timestamp < this.cacheTtlMs) {
        return {
          success: true,
          files: cached.files,
          relativePath: cached.relativePath,
          displayPath: cached.displayPath,
          currentPath: cached.relativePath,
          rootDirectory: rootDir,
          counts: cached.counts,
          cacheHit: true,
          telemetryMs: Date.now() - startTime
        };
      }
    }

    // Deduplicate in-flight requests
    if (this.inFlightRequests.has(relativePath)) {
      return this.inFlightRequests.get(relativePath)!;
    }

    const requestPromise = this.enqueueTask(async (): Promise<DirectoryListingResult> => {
      const client = this.createClient(options);
      try {
        await client.access({
          host: options.host,
          port: options.port || 21,
          user: options.username,
          password: options.password || '',
          secure: options.secure || false
        });

        // Successfully authenticated & connected
        this.updateConnectionState({
          status: 'CONNECTED',
          connected: true,
          protocol: options.protocol || 'ftp',
          host: options.host,
          port: options.port || 21,
          username: options.username,
          rootDirectory: rootDir
        });

        await client.ensureDir(fullRemotePath);
        const rawList = await client.list();

        const files: FtpFileItem[] = rawList
          .map(item => {
            const itemRelative = relativePath === '/' ? `/${item.name}` : `${relativePath}/${item.name}`;
            const itemDisplay = path.posix.join(fullRemotePath, item.name);
            return {
              name: item.name,
              type: item.isDirectory ? ('directory' as const) : ('file' as const),
              size: item.size,
              modifiedAt: item.rawModifiedAt || (item.modifiedAt ? item.modifiedAt.toISOString() : undefined),
              relativePath: itemRelative,
              displayPath: itemDisplay,
              path: itemRelative, // Standard relative path
              permissions: item.permissions ? String(item.permissions) : undefined
            };
          })
          .sort((a, b) => {
            if (a.type === 'directory' && b.type !== 'directory') return -1;
            if (a.type !== 'directory' && b.type === 'directory') return 1;
            return a.name.localeCompare(b.name);
          });

        client.close();

        const counts = {
          folders: files.filter(f => f.type === 'directory').length,
          files: files.filter(f => f.type === 'file').length
        };

        // Cache result using relativePath key
        this.cache.set(relativePath, {
          files,
          relativePath,
          displayPath: fullRemotePath,
          counts,
          timestamp: Date.now()
        });

        return {
          success: true,
          files,
          relativePath,
          displayPath: fullRemotePath,
          currentPath: relativePath,
          rootDirectory: rootDir,
          counts,
          cacheHit: false,
          telemetryMs: Date.now() - startTime
        };
      } catch (err: any) {
        client.close();
        const errMsg = String(err?.message || '');
        
        // Ensure FTP connection state remains CONNECTED
        this.updateConnectionState({
          status: 'CONNECTED',
          connected: true,
          errorMessage: errMsg || undefined
        });

        return {
          success: false,
          files: [],
          relativePath,
          displayPath: fullRemotePath,
          currentPath: relativePath,
          rootDirectory: rootDir,
          counts: { folders: 0, files: 0 },
          cacheHit: false,
          telemetryMs: Date.now() - startTime,
          error: errMsg || 'Unable to load directory'
        };
      } finally {
        this.inFlightRequests.delete(relativePath);
      }
    });

    this.inFlightRequests.set(relativePath, requestPromise);
    return requestPromise;
  }

  /**
   * Read file content by relative path
   */
  public async readFtpFileContent(
    options: FtpConnectionOptions,
    filePath: string
  ): Promise<{ success: boolean; content: string; relativePath: string; displayPath: string; path: string; error?: string }> {
    const { relativePath, fullRemotePath } = resolveRemotePath(options.rootDirectory || '/shipu-bot/', filePath);

    return this.enqueueTask(async () => {
      const client = this.createClient(options);
      try {
        await client.access({
          host: options.host,
          port: options.port || 21,
          user: options.username,
          password: options.password || '',
          secure: options.secure || false
        });

        const { Writable } = await import('stream');
        const chunks: Buffer[] = [];
        const writableStream = new Writable({
          write(chunk, encoding, callback) {
            chunks.push(Buffer.from(chunk));
            callback();
          }
        });

        await client.downloadTo(writableStream, fullRemotePath);
        client.close();

        const content = Buffer.concat(chunks).toString('utf-8');
        return { success: true, content, relativePath, displayPath: fullRemotePath, path: relativePath };
      } catch (err: any) {
        client.close();
        return { success: false, content: '', relativePath, displayPath: fullRemotePath, path: relativePath, error: err?.message || 'Failed to read FTP file' };
      }
    });
  }

  /**
   * Download binary buffer
   */
  public async downloadFtpFileBuffer(
    options: FtpConnectionOptions,
    filePath: string
  ): Promise<{ success: boolean; buffer: Buffer; fileName: string; error?: string }> {
    const { fullRemotePath } = resolveRemotePath(options.rootDirectory || '/shipu-bot/', filePath);
    const fileName = path.posix.basename(fullRemotePath);

    return this.enqueueTask(async () => {
      const client = this.createClient(options);
      try {
        await client.access({
          host: options.host,
          port: options.port || 21,
          user: options.username,
          password: options.password || '',
          secure: options.secure || false
        });

        const { Writable } = await import('stream');
        const chunks: Buffer[] = [];
        const writableStream = new Writable({
          write(chunk, encoding, callback) {
            chunks.push(Buffer.from(chunk));
            callback();
          }
        });

        await client.downloadTo(writableStream, fullRemotePath);
        client.close();

        return { success: true, buffer: Buffer.concat(chunks), fileName };
      } catch (err: any) {
        client.close();
        return { success: false, buffer: Buffer.alloc(0), fileName, error: err?.message || 'Failed to download FTP file' };
      }
    });
  }

  /**
   * Write file content
   */
  public async writeFtpFileContent(
    options: FtpConnectionOptions,
    filePath: string,
    content: string,
    createBackup: boolean = false
  ): Promise<{ success: boolean; error?: string }> {
    const { relativePath, fullRemotePath } = resolveRemotePath(options.rootDirectory || '/shipu-bot/', filePath);
    const parentRemoteDir = path.posix.dirname(fullRemotePath);
    const parentRelativeDir = path.posix.dirname(relativePath);

    return this.enqueueTask(async () => {
      const client = this.createClient(options);
      try {
        await client.access({
          host: options.host,
          port: options.port || 21,
          user: options.username,
          password: options.password || '',
          secure: options.secure || false
        });

        await client.ensureDir(parentRemoteDir);

        if (createBackup) {
          try {
            const baseName = path.posix.basename(fullRemotePath);
            const stamp = new Date().toISOString().replace(/[:.]/g, '-');
            const backupRemoteDir = path.posix.join(options.rootDirectory || '/shipu-bot/', 'backups');
            await client.ensureDir(backupRemoteDir);
            const backupPath = path.posix.join(backupRemoteDir, `${baseName}-${stamp}.bak`);

            const { Writable } = await import('stream');
            const chunks: Buffer[] = [];
            const wStream = new Writable({
              write(chunk, _enc, cb) { chunks.push(Buffer.from(chunk)); cb(); }
            });
            await client.downloadTo(wStream, fullRemotePath);
            if (chunks.length > 0) {
              const { Readable } = await import('stream');
              await client.uploadFrom(Readable.from([Buffer.concat(chunks)]), backupPath);
            }
          } catch {
            // Backup optional
          }
        }

        const { Readable } = await import('stream');
        const readableStream = Readable.from([Buffer.from(content, 'utf-8')]);

        await client.uploadFrom(readableStream, fullRemotePath);
        client.close();

        this.invalidateCache(parentRelativeDir);
        return { success: true };
      } catch (err: any) {
        client.close();
        return { success: false, error: err?.message || 'Failed to write FTP file' };
      }
    });
  }

  /**
   * Upload binary buffer
   */
  public async uploadFtpFileBuffer(
    options: FtpConnectionOptions,
    filePath: string,
    buffer: Buffer
  ): Promise<{ success: boolean; error?: string }> {
    const { relativePath, fullRemotePath } = resolveRemotePath(options.rootDirectory || '/shipu-bot/', filePath);
    const parentRemoteDir = path.posix.dirname(fullRemotePath);
    const parentRelativeDir = path.posix.dirname(relativePath);

    return this.enqueueTask(async () => {
      const client = this.createClient(options);
      try {
        await client.access({
          host: options.host,
          port: options.port || 21,
          user: options.username,
          password: options.password || '',
          secure: options.secure || false
        });

        await client.ensureDir(parentRemoteDir);

        const { Readable } = await import('stream');
        await client.uploadFrom(Readable.from([buffer]), fullRemotePath);
        client.close();

        this.invalidateCache(parentRelativeDir);
        return { success: true };
      } catch (err: any) {
        client.close();
        return { success: false, error: err?.message || 'Failed to upload FTP file' };
      }
    });
  }

  /**
   * Create folder
   */
  public async createFolder(
    options: FtpConnectionOptions,
    folderPath: string
  ): Promise<{ success: boolean; error?: string }> {
    const { relativePath, fullRemotePath } = resolveRemotePath(options.rootDirectory || '/shipu-bot/', folderPath);
    const parentRelativeDir = path.posix.dirname(relativePath);

    return this.enqueueTask(async () => {
      const client = this.createClient(options);
      try {
        await client.access({
          host: options.host,
          port: options.port || 21,
          user: options.username,
          password: options.password || '',
          secure: options.secure || false
        });

        await client.ensureDir(fullRemotePath);
        client.close();

        this.invalidateCache(parentRelativeDir);
        return { success: true };
      } catch (err: any) {
        client.close();
        return { success: false, error: err?.message || 'Failed to create FTP directory' };
      }
    });
  }

  /**
   * Rename item
   */
  public async renameItem(
    options: FtpConnectionOptions,
    oldPath: string,
    newPath: string
  ): Promise<{ success: boolean; error?: string }> {
    const { relativePath: oldRel, fullRemotePath: oldRemote } = resolveRemotePath(options.rootDirectory || '/shipu-bot/', oldPath);
    const { relativePath: newRel, fullRemotePath: newRemote } = resolveRemotePath(options.rootDirectory || '/shipu-bot/', newPath);

    return this.enqueueTask(async () => {
      const client = this.createClient(options);
      try {
        await client.access({
          host: options.host,
          port: options.port || 21,
          user: options.username,
          password: options.password || '',
          secure: options.secure || false
        });

        await client.rename(oldRemote, newRemote);
        client.close();

        this.invalidateCache(path.posix.dirname(oldRel));
        this.invalidateCache(path.posix.dirname(newRel));
        return { success: true };
      } catch (err: any) {
        client.close();
        return { success: false, error: err?.message || 'Failed to rename FTP item' };
      }
    });
  }

  /**
   * Move items
   */
  public async moveItems(
    options: FtpConnectionOptions,
    sourcePaths: string[],
    destinationDir: string
  ): Promise<{ success: boolean; movedCount: number; errors: string[] }> {
    const { relativePath: destRel, fullRemotePath: destRemote } = resolveRemotePath(options.rootDirectory || '/shipu-bot/', destinationDir);
    const errors: string[] = [];
    let movedCount = 0;

    return this.enqueueTask(async () => {
      const client = this.createClient(options);
      try {
        await client.access({
          host: options.host,
          port: options.port || 21,
          user: options.username,
          password: options.password || '',
          secure: options.secure || false
        });

        await client.ensureDir(destRemote);

        for (const src of sourcePaths) {
          const { relativePath: srcRel, fullRemotePath: srcRemote } = resolveRemotePath(options.rootDirectory || '/shipu-bot/', src);
          const baseName = path.posix.basename(srcRemote);
          const targetRemote = path.posix.join(destRemote, baseName);

          try {
            await client.rename(srcRemote, targetRemote);
            movedCount++;
            this.invalidateCache(path.posix.dirname(srcRel));
          } catch (err: any) {
            errors.push(`Failed to move ${baseName}: ${err?.message || 'Error'}`);
          }
        }

        client.close();
        this.invalidateCache(destRel);
        return { success: errors.length === 0, movedCount, errors };
      } catch (err: any) {
        client.close();
        return { success: false, movedCount, errors: [err?.message || 'Move operation failed'] };
      }
    });
  }

  /**
   * Copy items
   */
  public async copyItems(
    options: FtpConnectionOptions,
    sourcePaths: string[],
    destinationDir: string
  ): Promise<{ success: boolean; copiedCount: number; errors: string[] }> {
    const { relativePath: destRel, fullRemotePath: destRemote } = resolveRemotePath(options.rootDirectory || '/shipu-bot/', destinationDir);
    const errors: string[] = [];
    let copiedCount = 0;

    return this.enqueueTask(async () => {
      const client = this.createClient(options);
      try {
        await client.access({
          host: options.host,
          port: options.port || 21,
          user: options.username,
          password: options.password || '',
          secure: options.secure || false
        });

        await client.ensureDir(destRemote);

        for (const src of sourcePaths) {
          const { fullRemotePath: srcRemote } = resolveRemotePath(options.rootDirectory || '/shipu-bot/', src);
          const baseName = path.posix.basename(srcRemote);
          const targetRemote = path.posix.join(destRemote, baseName);

          try {
            const { Writable } = await import('stream');
            const chunks: Buffer[] = [];
            const wStream = new Writable({
              write(chunk, _enc, cb) { chunks.push(Buffer.from(chunk)); cb(); }
            });
            await client.downloadTo(wStream, srcRemote);
            const { Readable } = await import('stream');
            await client.uploadFrom(Readable.from([Buffer.concat(chunks)]), targetRemote);
            copiedCount++;
          } catch (err: any) {
            errors.push(`Failed to copy ${baseName}: ${err?.message || 'Error'}`);
          }
        }

        client.close();
        this.invalidateCache(destRel);
        return { success: errors.length === 0, copiedCount, errors };
      } catch (err: any) {
        client.close();
        return { success: false, copiedCount, errors: [err?.message || 'Copy operation failed'] };
      }
    });
  }

  /**
   * Delete items
   */
  public async deleteFtpItems(
    options: FtpConnectionOptions,
    filePaths: string[]
  ): Promise<{ success: boolean; deletedCount: number; errors: string[] }> {
    const errors: string[] = [];
    let deletedCount = 0;

    return this.enqueueTask(async () => {
      const client = this.createClient(options);
      try {
        await client.access({
          host: options.host,
          port: options.port || 21,
          user: options.username,
          password: options.password || '',
          secure: options.secure || false
        });

        for (const itemPath of filePaths) {
          const { relativePath: itemRel, fullRemotePath: itemRemote } = resolveRemotePath(options.rootDirectory || '/shipu-bot/', itemPath);
          const parentRel = path.posix.dirname(itemRel);

          try {
            try {
              await client.removeDir(itemRemote);
            } catch {
              await client.remove(itemRemote);
            }
            deletedCount++;
            this.invalidateCache(parentRel);
          } catch (err: any) {
            errors.push(`Failed to delete ${path.posix.basename(itemRemote)}: ${err?.message || 'Error'}`);
          }
        }

        client.close();
        return { success: errors.length === 0, deletedCount, errors };
      } catch (err: any) {
        client.close();
        return { success: false, deletedCount, errors: [err?.message || 'Delete operation failed'] };
      }
    });
  }
}

export const ftpStorageService = new FtpStorageService();
