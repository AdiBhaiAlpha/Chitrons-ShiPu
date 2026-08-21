import React, { useState, useEffect } from 'react';
import {
  Server,
  RefreshCw,
  Play,
  Square,
  HardDrive,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Shield,
  Activity,
  RotateCcw,
  Download,
  Upload,
  FileText
} from 'lucide-react';

interface FtpLiveSyncPanelProps {
  adminToken: string;
}

export const FtpLiveSyncPanel: React.FC<FtpLiveSyncPanelProps> = ({ adminToken }) => {
  const [syncStatus, setSyncStatus] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const fetchStatus = async () => {
    try {
      const res = await fetch('/api/ftp/sync/status', {
        headers: { Authorization: `Bearer ${adminToken}` }
      });
      if (res.ok) {
        const data = await res.json();
        setSyncStatus(data);
      }
    } catch {}
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        fetchStatus();
      }
    }, 20000);
    return () => clearInterval(interval);
  }, []);

  const handleStart = async () => {
    setLoading(true);
    setActionMessage(null);
    try {
      const res = await fetch('/api/ftp/sync/start', {
        method: 'POST',
        headers: { Authorization: `Bearer ${adminToken}` }
      });
      const data = await res.json();
      setActionMessage(data.message);
      fetchStatus();
    } catch (err: any) {
      setActionMessage(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleStop = async () => {
    setLoading(true);
    setActionMessage(null);
    try {
      const res = await fetch('/api/ftp/sync/stop', {
        method: 'POST',
        headers: { Authorization: `Bearer ${adminToken}` }
      });
      const data = await res.json();
      setActionMessage(data.message);
      fetchStatus();
    } catch (err: any) {
      setActionMessage(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleForceSync = async () => {
    setLoading(true);
    setActionMessage(null);
    try {
      const res = await fetch('/api/ftp/sync/force', {
        method: 'POST',
        headers: { Authorization: `Bearer ${adminToken}` }
      });
      const data = await res.json();
      setActionMessage(data.message);
      fetchStatus();
    } catch (err: any) {
      setActionMessage(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleRebuild = async () => {
    setLoading(true);
    setActionMessage(null);
    try {
      const res = await fetch('/api/ftp/sync/rebuild', {
        method: 'POST',
        headers: { Authorization: `Bearer ${adminToken}` }
      });
      const data = await res.json();
      setActionMessage(data.message);
      fetchStatus();
    } catch (err: any) {
      setActionMessage(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = async (backupPath: string, originalPath: string) => {
    if (!confirm(`Restore ${originalPath} from backup ${backupPath}?`)) return;
    setLoading(true);
    try {
      const res = await fetch('/api/ftp/sync/restore', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`
        },
        body: JSON.stringify({ backupPath, originalPath })
      });
      const data = await res.json();
      setActionMessage(data.message);
      fetchStatus();
    } catch (err: any) {
      setActionMessage(`Restore error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const isRunning = syncStatus?.isRunning || false;

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wider flex items-center gap-2">
            <Activity className="w-4 h-4 text-amber-400" /> Bi-Directional Live FTP Synchronization
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            Real-time two-way synchronization between bot project files and connected FTP server with instant hot reload.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {isRunning ? (
            <button
              onClick={handleStop}
              disabled={loading}
              className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs rounded-xl shadow-lg transition flex items-center gap-2"
            >
              <Square className="w-3.5 h-3.5" /> Stop Live Sync
            </button>
          ) : (
            <button
              onClick={handleStart}
              disabled={loading}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-lg transition flex items-center gap-2"
            >
              <Play className="w-3.5 h-3.5" /> Start Live Sync
            </button>
          )}

          <button
            onClick={handleForceSync}
            disabled={loading}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-500/30 font-semibold text-xs rounded-xl transition flex items-center gap-2"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Force Sync
          </button>

          <button
            onClick={handleRebuild}
            disabled={loading}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-semibold text-xs rounded-xl transition flex items-center gap-2"
          >
            <HardDrive className="w-3.5 h-3.5 text-cyan-400" /> Rebuild Index
          </button>
        </div>
      </div>

      {actionMessage && (
        <div className="p-3 bg-slate-800 border border-slate-700 rounded-xl text-xs text-amber-200 font-mono">
          {actionMessage}
        </div>
      )}

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl">
          <span className="text-slate-400 text-[11px] font-semibold uppercase tracking-wider block mb-1">Live Sync Status</span>
          <div className="flex items-center gap-2">
            <span className={`w-2.5 h-2.5 rounded-full ${isRunning ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`} />
            <span className="text-xs font-bold text-slate-100">{isRunning ? 'ACTIVE' : 'STOPPED'}</span>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl">
          <span className="text-slate-400 text-[11px] font-semibold uppercase tracking-wider block mb-1">Last Sync Time</span>
          <span className="text-xs font-bold text-slate-100 font-mono truncate block">
            {syncStatus?.lastSyncTime ? new Date(syncStatus.lastSyncTime).toLocaleTimeString() : 'Never'}
          </span>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl">
          <span className="text-slate-400 text-[11px] font-semibold uppercase tracking-wider block mb-1">Upload Queue</span>
          <span className="text-xs font-bold text-cyan-400 font-mono">{syncStatus?.uploadQueueCount || 0}</span>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl">
          <span className="text-slate-400 text-[11px] font-semibold uppercase tracking-wider block mb-1">Download Queue</span>
          <span className="text-xs font-bold text-amber-400 font-mono">{syncStatus?.downloadQueueCount || 0}</span>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl">
          <span className="text-slate-400 text-[11px] font-semibold uppercase tracking-wider block mb-1">Total Uploaded</span>
          <span className="text-xs font-bold text-emerald-400 font-mono">{syncStatus?.totalUploaded || 0} files</span>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl">
          <span className="text-slate-400 text-[11px] font-semibold uppercase tracking-wider block mb-1">Total Downloaded</span>
          <span className="text-xs font-bold text-purple-400 font-mono">{syncStatus?.totalDownloaded || 0} files</span>
        </div>
      </div>

      {/* Logs & Backups Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Sync Audit Logs */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col h-[350px]">
          <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider mb-3 flex items-center gap-2">
            <FileText className="w-4 h-4 text-amber-400" /> Live Sync Audit Logs
          </h4>
          <div className="flex-1 overflow-y-auto space-y-2 pr-1 font-mono text-[11px]">
            {(!syncStatus?.logs || syncStatus.logs.length === 0) ? (
              <p className="text-slate-500 italic py-4 text-center">No sync activity recorded yet.</p>
            ) : (
              syncStatus.logs.map((log: any) => (
                <div key={log.id} className="p-2 bg-slate-950/70 border border-slate-800/80 rounded-xl flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                        log.type === 'UPLOADED' ? 'bg-cyan-950 text-cyan-300' :
                        log.type === 'DOWNLOADED' ? 'bg-purple-950 text-purple-300' :
                        log.type === 'RELOADED' ? 'bg-emerald-950 text-emerald-300' :
                        log.type === 'FAILED' ? 'bg-rose-950 text-rose-300' :
                        log.type === 'BACKUP' ? 'bg-amber-950 text-amber-300' : 'bg-slate-800 text-slate-300'
                      }`}>
                        {log.type}
                      </span>
                      {log.file && <span className="text-amber-400 truncate">{log.file}</span>}
                    </div>
                    <p className="text-slate-300 text-[11px]">{log.message}</p>
                  </div>
                  <span className="text-slate-500 text-[10px] shrink-0">
                    {new Date(log.timestamp).toLocaleTimeString()}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Versioned Backups & Recovery */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col h-[350px]">
          <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider mb-3 flex items-center gap-2">
            <Shield className="w-4 h-4 text-emerald-400" /> Auto Backups & Version Recovery
          </h4>
          <div className="flex-1 overflow-y-auto space-y-2 pr-1 font-mono text-[11px]">
            {(!syncStatus?.backups || syncStatus.backups.length === 0) ? (
              <p className="text-slate-500 italic py-4 text-center">No versioned backups available.</p>
            ) : (
              syncStatus.backups.map((b: any, idx: number) => (
                <div key={idx} className="p-2.5 bg-slate-950/70 border border-slate-800/80 rounded-xl flex items-center justify-between gap-3">
                  <div className="truncate">
                    <strong className="text-slate-200 block truncate">{b.originalPath}</strong>
                    <span className="text-slate-400 text-[10px] block truncate">{b.filename}</span>
                  </div>
                  <button
                    onClick={() => handleRestore(b.backupPath, b.originalPath)}
                    disabled={loading}
                    className="px-3 py-1.5 bg-amber-600/20 hover:bg-amber-600 text-amber-300 hover:text-white rounded-lg text-xs font-semibold transition flex items-center gap-1 shrink-0"
                  >
                    <RotateCcw className="w-3 h-3" /> Restore
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
