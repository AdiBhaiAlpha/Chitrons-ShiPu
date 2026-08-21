import fs from 'fs-extra';
import path from 'path';
import { ftpSyncEngine, SyncLog } from './ftpSyncEngine';

export interface SyncLogEntry {
  id: string;
  timestamp: string;
  type: 'CREATED' | 'MODIFIED' | 'DELETED' | 'UPLOADED' | 'DOWNLOADED' | 'RELOADED' | 'FAILED' | 'CONFLICT' | 'DEPENDENCY' | 'BACKUP' | 'RESTORE';
  message: string;
  file?: string;
}

export interface SyncConflict {
  id: string;
  file: string;
  localModified: string;
  remoteModified: string;
  localSize: number;
  remoteSize: number;
  localHash: string;
  remoteHash: string;
  status: 'pending' | 'resolved';
}

export interface BackupRecord {
  filename: string;
  originalPath: string;
  backupPath: string;
  timestamp: string;
  size: number;
}

export class FtpSyncService {
  private static instance: FtpSyncService;

  private constructor() {}

  public static getInstance(): FtpSyncService {
    if (!FtpSyncService.instance) {
      FtpSyncService.instance = new FtpSyncService();
    }
    return FtpSyncService.instance;
  }

  public async startSync(): Promise<{ success: boolean; message: string }> {
    return ftpSyncEngine.start();
  }

  public stopSync(): { success: boolean; message: string } {
    return ftpSyncEngine.stop();
  }

  public async forceSyncNow(): Promise<{ success: boolean; message: string }> {
    const res = await ftpSyncEngine.performValidationSweep();
    return {
      success: res.success,
      message: res.success 
        ? `Bi-directional validation completed. Repaired ${res.repaired} skews.`
        : 'Bi-directional validation sweep failed.'
    };
  }

  public async rebuildIndex(): Promise<{ success: boolean; message: string }> {
    const count = await ftpSyncEngine.rebuildLocalIndex();
    return {
      success: true,
      message: `Successfully rebuilt local cache index. ${count} files indexed.`
    };
  }

  public getStatus() {
    const engineStatus = ftpSyncEngine.getStatus();
    const rawLogs = ftpSyncEngine.getLogs();

    // Transform logs into dashboard format
    const transformedLogs: SyncLogEntry[] = rawLogs.map(log => {
      let type: SyncLogEntry['type'] = 'RELOADED';
      if (log.action.includes('UPLOAD')) type = 'UPLOADED';
      else if (log.action.includes('DOWNLOAD')) type = 'DOWNLOADED';
      else if (log.action.includes('DELETE')) type = 'DELETED';
      else if (log.action.includes('AUTO_INSTALL')) type = 'DEPENDENCY';
      else if (log.action.includes('SYNTAX_CHECK')) type = 'FAILED';
      else if (log.action.includes('BACKUP')) type = 'BACKUP';

      return {
        id: Math.random().toString(36).substring(2, 9),
        timestamp: log.timestamp,
        type,
        message: `${log.action}: ${log.result} (${log.durationMs}ms) ${log.error || ''}`,
        file: log.file
      };
    });

    // Scan for local backups to populate backups array
    const backups: BackupRecord[] = [];
    try {
      const backupDir = path.join(process.cwd(), 'backups');
      if (fs.existsSync(backupDir)) {
        const files = fs.readdirSync(backupDir);
        for (const file of files) {
          if (file.endsWith('.bak')) {
            const stat = fs.statSync(path.join(backupDir, file));
            // e.g., command.2026-07-30T16-47-37-07-00.js.bak
            // Reconstruct original path from filename if possible
            const parts = file.split('.');
            let originalPath = 'commands/' + parts[0] + '.' + parts[parts.length - 2];
            if (parts.length < 3) originalPath = 'unknown';

            backups.push({
              filename: file,
              originalPath,
              backupPath: path.join('backups', file),
              timestamp: stat.mtime.toISOString(),
              size: stat.size
            });
          }
        }
      }
    } catch {}

    // Sort backups descending
    backups.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return {
      isRunning: engineStatus.isRunning,
      lastSyncTime: engineStatus.lastSyncTime,
      uploadQueueCount: engineStatus.uploadQueueSize,
      downloadQueueCount: engineStatus.downloadQueueSize,
      pendingChangesCount: engineStatus.uploadQueueSize + engineStatus.downloadQueueSize,
      totalUploaded: rawLogs.filter(l => l.action.includes('UPLOAD') && l.result === 'SUCCESS').length,
      totalDownloaded: rawLogs.filter(l => l.action.includes('DOWNLOAD') && l.result === 'SUCCESS').length,
      errors: rawLogs.filter(l => l.result === 'FAILED').map(l => ({
        timestamp: l.timestamp,
        message: l.error || 'Unknown error occurred during sync',
        file: l.file
      })),
      logs: transformedLogs,
      conflicts: [],
      backups: backups.slice(0, 30)
    };
  }
}

export const ftpSyncService = FtpSyncService.getInstance();
(globalThis as any).ftpSyncService = ftpSyncService;
