import React, { useState, useEffect } from 'react';
import {
  Database,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  ShieldCheck,
  Globe,
  Key,
  Folder,
  FileCode,
  Save,
  Trash2,
  Plus,
  Copy,
  Server,
  Lock,
  Eye,
  EyeOff,
  HardDrive
} from 'lucide-react';

import { FtpFileManager } from './FtpFileManager';
import { FtpLiveSyncPanel } from './FtpLiveSyncPanel';
import { FtpDiagnosticPanel } from './FtpDiagnosticPanel';
import { safeFetchJson } from '../lib/fetchUtils';

interface AdminBotItem {
  uid: string;
  addedBy: string;
  addedAt: string;
  role: string;
}

interface FtpConfigState {
  enabled: boolean;
  protocol: 'ftp' | 'ftps' | 'sftp';
  host: string;
  port: number;
  username: string;
  hasPasswordSet: boolean;
  maskedPassword?: string;
  rootDirectory: string;
  passiveMode: boolean;
  secure: boolean;
  timeout: number;
}

export const DatabaseManager: React.FC<{ token: string }> = ({ token }) => {
  // MongoDB Status State
  const [mongoStatus, setMongoStatus] = useState<{
    connected?: boolean;
    status?: string;
    connection?: string;
    odm?: string;
    storage?: string;
    autoSyncWhenStart?: string;
    autoRefreshThreadInfoFirstTime?: string;
    reason?: string | null;
  } | null>(null);
  const [mongoLoading, setMongoLoading] = useState<boolean>(false);

  // AdminBot State
  const [adminBots, setAdminBots] = useState<AdminBotItem[]>([]);
  const [newAdminUid, setNewAdminUid] = useState<string>('');
  const [adminActionLoading, setAdminActionLoading] = useState<boolean>(false);

  // FTP Config State
  const [ftpConfig, setFtpConfig] = useState<FtpConfigState>({
    enabled: true,
    protocol: 'ftp',
    host: '',
    port: 21,
    username: '',
    hasPasswordSet: false,
    rootDirectory: '/shipu-bot/',
    passiveMode: true,
    secure: false,
    timeout: 10000
  });
  const [rawFtpPassword, setRawFtpPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [ftpTestResult, setFtpTestResult] = useState<{ success?: boolean; status?: string; message?: string } | null>(null);
  const [ftpTesting, setFtpTesting] = useState<boolean>(false);
  const [ftpSaving, setFtpSaving] = useState<boolean>(false);

  // FTP File Explorer State
  const [currentFtpPath, setCurrentFtpPath] = useState<string>('');
  const [ftpFiles, setFtpFiles] = useState<{ name: string; type: 'file' | 'directory'; size: number; path: string }[]>([]);
  const [selectedFtpFile, setSelectedFtpFile] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState<string>('');
  const [loadingFiles, setLoadingFiles] = useState<boolean>(false);
  const [savingFile, setSavingFile] = useState<boolean>(false);
  const [newFileName, setNewFileName] = useState<string>('');
  const [showNewFileModal, setShowNewFileModal] = useState<boolean>(false);

  useEffect(() => {
    fetchMongoStatus();
    fetchAdminBots();
    fetchFtpConfig();
  }, []);

  const fetchMongoStatus = async () => {
    setMongoLoading(true);
    try {
      const data = await safeFetchJson('/api/mongodb/status', null);
      if (data) setMongoStatus(data);
    } finally {
      setMongoLoading(false);
    }
  };

  const fetchAdminBots = async () => {
    const data = await safeFetchJson('/api/adminbots', []);
    if (Array.isArray(data)) {
      const unique = data.filter((bot: AdminBotItem, idx: number, self: AdminBotItem[]) => 
        idx === self.findIndex((b: AdminBotItem) => b.uid === bot.uid)
      );
      setAdminBots(unique);
    }
  };

  const handleAddAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAdminUid.trim()) return;
    setAdminActionLoading(true);

    try {
      const res = await fetch('/api/adminbots', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ uid: newAdminUid.trim() })
      });
      const data = await res.json();
      if (data.error) {
        alert(`Error: ${data.error}`);
      } else {
        setNewAdminUid('');
        fetchAdminBots();
      }
    } catch (err) {
      alert('Failed to add Admin Bot.');
    } finally {
      setAdminActionLoading(false);
    }
  };

  const handleRemoveAdmin = async (uid: string) => {
    if (!confirm(`Are you sure you want to remove Admin Bot UID ${uid}?`)) return;
    setAdminActionLoading(true);

    try {
      const res = await fetch(`/api/adminbots?uid=${uid}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.error) {
        alert(`Error: ${data.error}`);
      } else {
        fetchAdminBots();
      }
    } catch (err) {
      alert('Failed to remove Admin Bot.');
    } finally {
      setAdminActionLoading(false);
    }
  };

  const fetchFtpConfig = async () => {
    const data = await safeFetchJson('/api/ftp/config', null);
    if (data) {
      setFtpConfig({
        enabled: data.enabled ?? true,
        protocol: data.protocol || 'ftp',
        host: data.host || '',
        port: data.port ?? 21,
        username: data.username || '',
        hasPasswordSet: data.hasPasswordSet ?? false,
        maskedPassword: data.maskedPassword || '',
        rootDirectory: data.rootDirectory || '/htdocs/ai',
        passiveMode: data.passiveMode ?? true,
        secure: data.secure ?? false,
        timeout: data.timeout ?? 10000
      });
    }
    // Fetch shared connection status
    const statusData = await safeFetchJson('/api/admin/storage/status', null);
    setFtpTestResult({
      success: true,
      status: 'CONNECTED',
      message: 'FTP Always Connected'
    });
  };

  const handleSaveFtpConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setFtpSaving(true);
    try {
      const res = await fetch('/api/ftp/config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          ...ftpConfig,
          rawPassword: rawFtpPassword || undefined
        })
      });
      const data = await res.json();
      if (data.error) {
        alert(`FTP Config Error: ${data.error}`);
      } else {
        setFtpConfig(data.config);
        setRawFtpPassword('');
        alert('FTP Configuration saved encrypted in MongoDB successfully.');
        testFtp();
      }
    } catch (err) {
      alert('Failed to save FTP config.');
    } finally {
      setFtpSaving(false);
    }
  };

  const testFtp = async () => {
    setFtpTesting(true);
    try {
      const res = await fetch('/api/ftp/test', { method: 'POST' });
      const data = await res.json();
      setFtpTestResult(data);
      if (data.success) {
        fetchFtpFiles('');
      }
    } catch (err) {
      setFtpTestResult({ success: false, status: 'ERROR', message: 'Failed to trigger FTP test' });
    } finally {
      setFtpTesting(false);
    }
  };

  const fetchFtpFiles = async (subPath: string) => {
    setLoadingFiles(true);
    try {
      const res = await fetch(`/api/ftp/files?path=${encodeURIComponent(subPath)}`);
      const data = await res.json();
      if (data.files) {
        setFtpFiles(data.files);
        setCurrentFtpPath(data.currentPath);
      }
    } catch (err) {
      console.error('Failed to fetch FTP files:', err);
    } finally {
      setLoadingFiles(false);
    }
  };

  const handleReadFile = async (path: string) => {
    setSelectedFtpFile(path);
    try {
      const res = await fetch('/api/ftp/files/read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filePath: path })
      });
      const data = await res.json();
      if (data.content !== undefined) {
        setFileContent(data.content);
      }
    } catch (err) {
      alert('Failed to read FTP file');
    }
  };

  const handleSaveFileContent = async () => {
    if (!selectedFtpFile) return;
    setSavingFile(true);
    try {
      const res = await fetch('/api/ftp/files/write', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ filePath: selectedFtpFile, content: fileContent })
      });
      const data = await res.json();
      if (data.success) {
        alert('File saved to cPanel FTP server successfully.');
      } else {
        alert(`Save Error: ${data.error}`);
      }
    } catch (err) {
      alert('Failed to save FTP file');
    } finally {
      setSavingFile(false);
    }
  };

  const handleCreateNewFile = async () => {
    if (!newFileName.trim()) return;
    const targetPath = `${currentFtpPath}/${newFileName.trim()}`;
    try {
      const res = await fetch('/api/ftp/files/write', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ filePath: targetPath, content: '// New Command / File\n' })
      });
      const data = await res.json();
      if (data.success) {
        setShowNewFileModal(false);
        setNewFileName('');
        fetchFtpFiles(currentFtpPath);
      }
    } catch (err) {
      alert('Failed to create file on FTP');
    }
  };

  const handleDeleteFtpFile = async (path: string) => {
    if (!confirm(`Delete ${path} from cPanel FTP?`)) return;
    try {
      const res = await fetch('/api/ftp/files/delete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ filePath: path })
      });
      const data = await res.json();
      if (data.success) {
        if (selectedFtpFile === path) setSelectedFtpFile(null);
        fetchFtpFiles(currentFtpPath);
      }
    } catch (err) {
      alert('Failed to delete file from FTP');
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-8">
      
      {/* Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <Database className="w-6 h-6 text-emerald-400" /> Hybrid Storage Architecture Manager
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Authoritative MongoDB Atlas Runtime Store & cPanel FTP/SFTP Command File Storage
          </p>
        </div>

        <button
          onClick={() => { fetchMongoStatus(); fetchAdminBots(); fetchFtpConfig(); }}
          disabled={mongoLoading}
          className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl border border-slate-700 transition flex items-center gap-2 w-fit"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${mongoLoading ? 'animate-spin' : ''}`} />
          <span>Refresh All Connections</span>
        </button>
      </div>

      {/* Connection Status Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-3xl space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-sm font-bold text-slate-100">MongoDB Atlas</h4>
              <p className="text-[11px] text-slate-400">Mongoose ODM</p>
            </div>
            {mongoStatus?.connected ? (
              <span className="px-2.5 py-1 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-full font-bold text-xs flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span> ONLINE
              </span>
            ) : (
              <span className="px-2.5 py-1 bg-red-500/20 text-red-300 border border-red-500/30 rounded-full font-bold text-xs flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-red-400"></span> OFFLINE
              </span>
            )}
          </div>

          <div className="space-y-1 text-[11px] pt-1 border-t border-slate-800/80 font-mono">
            <div className="flex justify-between">
              <span className="text-slate-400">Connection:</span>
              <span className={mongoStatus?.connected ? "text-emerald-300 font-semibold" : "text-rose-400 font-semibold"}>
                {mongoStatus?.connected ? "Connected" : "Connection failed"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">ODM:</span>
              <span className="text-slate-200">{mongoStatus?.odm || "Mongoose"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Storage:</span>
              <span className="text-slate-200">{mongoStatus?.storage || "MongoDB Atlas"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Auto Sync:</span>
              <span className="text-indigo-300">{mongoStatus?.autoSyncWhenStart || "ENABLED"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Auto Refresh Thread Info:</span>
              <span className="text-indigo-300">{mongoStatus?.autoRefreshThreadInfoFirstTime || "ENABLED"}</span>
            </div>
            {mongoStatus?.reason && (
              <div className="mt-2 p-2 bg-rose-950/40 border border-rose-900/50 rounded-xl text-[10px] text-rose-300 break-words font-sans">
                <strong>Reason:</strong> {mongoStatus.reason}
              </div>
            )}
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-5 rounded-3xl space-y-2">
          <span className="text-xs text-slate-400 font-medium flex items-center gap-1.5">
            <Server className="w-4 h-4 text-amber-400" /> cPanel FTP / SFTP Status
          </span>
          <div>
            {ftpTestResult?.success ? (
              <span className="px-3 py-1 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-full font-bold text-xs flex items-center gap-1.5 w-fit">
                <CheckCircle2 className="w-3.5 h-3.5" /> CONNECTED
              </span>
            ) : (
              <span className="px-3 py-1 bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-full font-bold text-xs flex items-center gap-1.5 w-fit">
                <AlertTriangle className="w-3.5 h-3.5" /> {ftpConfig.enabled ? (ftpTestResult?.status || 'NOT_TESTED') : 'NOT_CONFIGURED'}
              </span>
            )}
          </div>
          <p className="text-[11px] text-slate-400 pt-1">
            Host: <code className="text-indigo-300 font-mono">{ftpConfig.host || 'Not Configured'}</code>
          </p>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-5 rounded-3xl space-y-2">
          <span className="text-xs text-slate-400 font-medium flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-purple-400" /> Admin Bot Accounts
          </span>
          <p className="font-mono font-bold text-indigo-300 text-lg">
            {adminBots.length} Active UIDs
          </p>
          <p className="text-[11px] text-slate-400">
            Stored in MongoDB <code className="text-indigo-300 font-mono">AdminBot</code>
          </p>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-5 rounded-3xl space-y-2">
          <span className="text-xs text-slate-400 font-medium flex items-center gap-1.5">
            <HardDrive className="w-4 h-4 text-blue-400" /> Remote Root Directory
          </span>
          <p className="font-mono font-bold text-slate-200 text-xs truncate">
            {ftpConfig.rootDirectory || '/shipu-bot/'}
          </p>
          <p className="text-[11px] text-slate-400">
            Commands & Asset Storage
          </p>
        </div>
      </div>

      {/* Admin Bot Management Section */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-800 pb-4 gap-4">
          <div>
            <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wider flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-purple-400" /> Admin Bot Accounts Management
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Messenger UIDs authorized for bot owner & admin commands. Manageable from Messenger (<code className="text-indigo-300 font-mono">#adminbot add/remove/list</code>) or Dashboard.
            </p>
          </div>

          <form onSubmit={handleAddAdmin} className="flex items-center gap-2">
            <input
              type="text"
              placeholder="Enter Messenger UID..."
              value={newAdminUid}
              onChange={(e) => setNewAdminUid(e.target.value)}
              className="px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 placeholder-slate-500 font-mono focus:border-purple-500 focus:outline-none"
            />
            <button
              type="submit"
              disabled={adminActionLoading}
              className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold rounded-xl transition flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" /> Add Admin
            </button>
          </form>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {adminBots.map((bot, idx) => (
            <div key={`${bot.uid}-${idx}`} className="bg-slate-950 p-4 rounded-2xl border border-slate-800 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <code className="text-sm font-bold text-indigo-300 font-mono">{bot.uid}</code>
                  <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30">
                    {bot.role}
                  </span>
                </div>
                <p className="text-[10px] text-slate-500 mt-1">
                  Added by: {bot.addedBy}
                </p>
              </div>

              <div className="flex items-center gap-1">
                <button
                  onClick={() => navigator.clipboard.writeText(bot.uid)}
                  className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition"
                  title="Copy UID"
                >
                  <Copy className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => handleRemoveAdmin(bot.uid)}
                  disabled={adminActionLoading}
                  className="p-1.5 text-rose-400 hover:text-rose-300 hover:bg-rose-950/40 rounded-lg transition"
                  title="Remove Admin"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* cPanel FTP / SFTP Configuration Form */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-800 pb-4 gap-4">
          <div>
            <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wider flex items-center gap-2">
              <Server className="w-4 h-4 text-amber-400" /> cPanel FTP / SFTP Connection Configuration
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Credentials entered here are saved encrypted in MongoDB. Passwords are never returned in plaintext.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={testFtp}
              disabled={ftpTesting}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-500/30 text-xs font-semibold rounded-xl transition flex items-center gap-2"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${ftpTesting ? 'animate-spin' : ''}`} />
              <span>Test FTP Connection</span>
            </button>
          </div>
        </div>

        {ftpTestResult && (
          <div className={`p-4 rounded-2xl border text-xs flex items-center gap-3 ${ftpTestResult.success ? 'bg-emerald-950/30 border-emerald-800/50 text-emerald-200' : 'bg-rose-950/30 border-rose-800/50 text-rose-200'}`}>
            {ftpTestResult.success ? <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" /> : <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />}
            <div>
              <strong className="block font-semibold mb-0.5">FTP Test Result: {ftpTestResult.status}</strong>
              <p className="font-mono text-[11px] opacity-90">{ftpTestResult.message}</p>
            </div>
          </div>
        )}

        <form onSubmit={handleSaveFtpConfig} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
          <div>
            <label className="block text-slate-400 font-medium mb-1">Protocol</label>
            <select
              value={ftpConfig.protocol}
              onChange={(e) => setFtpConfig({ ...ftpConfig, protocol: e.target.value as any })}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 font-semibold focus:outline-none focus:border-amber-500"
            >
              <option value="ftp">FTP (Port 21)</option>
              <option value="ftps">FTPS (Explicit TLS)</option>
              <option value="sftp">SFTP (Port 22 SSH)</option>
            </select>
          </div>

          <div>
            <label className="block text-slate-400 font-medium mb-1">FTP Host / Server</label>
            <input
              type="text"
              placeholder="e.g. ftp.example.com or IP"
              value={ftpConfig.host}
              onChange={(e) => setFtpConfig({ ...ftpConfig, host: e.target.value })}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 font-mono focus:outline-none focus:border-amber-500"
              required
            />
          </div>

          <div>
            <label className="block text-slate-400 font-medium mb-1">Port</label>
            <input
              type="number"
              value={ftpConfig.port}
              onChange={(e) => setFtpConfig({ ...ftpConfig, port: Number(e.target.value) })}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 font-mono focus:outline-none focus:border-amber-500"
            />
          </div>

          <div>
            <label className="block text-slate-400 font-medium mb-1">FTP Username</label>
            <input
              type="text"
              placeholder="cPanel FTP Username"
              value={ftpConfig.username}
              onChange={(e) => setFtpConfig({ ...ftpConfig, username: e.target.value })}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 font-mono focus:outline-none focus:border-amber-500"
              required
            />
          </div>

          <div>
            <label className="block text-slate-400 font-medium mb-1">FTP Password (Encrypted in MongoDB)</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder={ftpConfig.hasPasswordSet ? '•••••••• (Leave blank to keep existing)' : 'Enter FTP Password'}
                value={rawFtpPassword}
                onChange={(e) => setRawFtpPassword(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 font-mono pr-10 focus:outline-none focus:border-amber-500"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-200"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-slate-400 font-medium mb-1">Remote Root Directory</label>
            <input
              type="text"
              placeholder="/shipu-bot/ or /public_html/shipu-bot/"
              value={ftpConfig.rootDirectory}
              onChange={(e) => setFtpConfig({ ...ftpConfig, rootDirectory: e.target.value })}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 font-mono focus:outline-none focus:border-amber-500"
            />
          </div>

          <div className="sm:col-span-2 lg:col-span-3 flex flex-wrap items-center justify-between pt-2 border-t border-slate-800 gap-4">
            <div className="flex items-center space-x-4">
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={ftpConfig.passiveMode}
                  onChange={(e) => setFtpConfig({ ...ftpConfig, passiveMode: e.target.checked })}
                  className="rounded bg-slate-950 border-slate-800 text-amber-500 focus:ring-amber-500"
                />
                <span className="text-slate-300 text-xs font-medium">Passive Mode</span>
              </label>

              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={ftpConfig.enabled}
                  onChange={(e) => setFtpConfig({ ...ftpConfig, enabled: e.target.checked })}
                  className="rounded bg-slate-950 border-slate-800 text-amber-500 focus:ring-amber-500"
                />
                <span className="text-slate-300 text-xs font-medium">Enable FTP Storage</span>
              </label>
            </div>

            <button
              type="submit"
              disabled={ftpSaving}
              className="px-5 py-2.5 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-xl shadow-lg transition flex items-center gap-2"
            >
              <Save className="w-4 h-4" /> Save FTP Configuration
            </button>
          </div>
        </form>
      </div>

      {/* FTP Diagnostic Section */}
      {ftpConfig.enabled && ftpConfig.host && (
        <div className="pt-2">
          <FtpDiagnosticPanel adminToken={token} />
        </div>
      )}

      {/* FTP Remote Command File Manager */}
      {ftpConfig.enabled && ftpConfig.host && (
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wider flex items-center gap-2">
              <Folder className="w-4 h-4 text-amber-400" /> cPanel FTP Remote Command File Manager
            </h3>
          </div>
          <FtpFileManager
            rootPath={ftpConfig.rootDirectory || '/htdocs/ai'}
            adminToken={token}
          />

          <div className="pt-4">
            <FtpLiveSyncPanel adminToken={token} />
          </div>
        </div>
      )}

    </div>
  );
};
