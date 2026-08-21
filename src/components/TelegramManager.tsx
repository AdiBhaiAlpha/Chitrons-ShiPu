import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Send,
  Bot,
  ShieldCheck,
  Activity,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Power,
  Key,
  Users,
  Copy,
  Check,
  Eye,
  EyeOff,
  Terminal,
  Trash2,
  HelpCircle,
  ExternalLink,
  MessageSquare,
  Zap,
  ArrowUpRight
} from 'lucide-react';
import {
  TelegramStatusResponse,
  TelegramLogEntry,
  TelegramLogCategory
} from '../types/telegram';

interface TelegramManagerProps {
  adminToken?: string;
  showToast?: (title: string, message: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
}

export const TelegramManager: React.FC<TelegramManagerProps> = ({
  adminToken = 'default_admin_session',
  showToast = (_title: string, _message: string, _type?: 'success' | 'error' | 'warning' | 'info') => {}
}) => {
  // State
  const [status, setStatus] = useState<TelegramStatusResponse | null>(null);
  const [logs, setLogs] = useState<TelegramLogEntry[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Form Inputs
  const [tokenInput, setTokenInput] = useState<string>('');
  const [showToken, setShowToken] = useState<boolean>(false);
  const [adminIdsInput, setAdminIdsInput] = useState<string>('');
  const [newAdminId, setNewAdminId] = useState<string>('');
  const [adminIdsList, setAdminIdsList] = useState<string[]>([]);
  const [autoConnect, setAutoConnect] = useState<boolean>(true);

  // Filter & Search
  const [logFilter, setLogFilter] = useState<string>('ALL');
  const [logSearch, setLogSearch] = useState<string>('');
  const [autoRefreshLogs, setAutoRefreshLogs] = useState<boolean>(true);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const getHeaders = useCallback(() => {
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${adminToken || 'default_admin_session'}`
    };
  }, [adminToken]);

  // Fetch status
  const fetchStatus = useCallback(async (isInitial = false) => {
    try {
      if (isInitial) setLoading(true);
      const res = await fetch('/api/telegram/status', {
        headers: getHeaders()
      });
      const data = await res.json();
      if (data.success) {
        setStatus(data);
        if (isInitial) {
          setAdminIdsList(data.adminUserIds || []);
          setAutoConnect(data.autoConnect !== false);
        }
      }
    } catch (err: any) {
      console.warn('[TelegramManager] Failed to fetch status:', err);
    } finally {
      if (isInitial) setLoading(false);
    }
  }, [getHeaders]);

  // Fetch logs
  const fetchLogs = useCallback(async () => {
    try {
      const url = logFilter !== 'ALL'
        ? `/api/telegram/logs?limit=150&category=${encodeURIComponent(logFilter)}`
        : `/api/telegram/logs?limit=150`;
      const res = await fetch(url, { headers: getHeaders() });
      const data = await res.json();
      if (data.success && Array.isArray(data.logs)) {
        setLogs(data.logs);
      }
    } catch (err: any) {
      console.warn('[TelegramManager] Failed to fetch logs:', err);
    }
  }, [getHeaders, logFilter]);

  // Initial load
  useEffect(() => {
    fetchStatus(true);
    fetchLogs();
  }, [fetchStatus, fetchLogs]);

  // Real-time polling
  useEffect(() => {
    if (!autoRefreshLogs) return;
    const timer = setInterval(() => {
      fetchStatus(false);
      fetchLogs();
    }, 3000);
    return () => clearInterval(timer);
  }, [autoRefreshLogs, fetchStatus, fetchLogs]);

  // Handle Copy
  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    showToast('Copied to Clipboard', text, 'info');
    setTimeout(() => setCopiedKey(null), 2000);
  };

  // Add Admin ID
  const handleAddAdminId = () => {
    const trimmed = newAdminId.trim();
    if (!trimmed) return;
    if (adminIdsList.includes(trimmed)) {
      showToast('Notice', 'Admin ID already added', 'warning');
      return;
    }
    const updated = [...adminIdsList, trimmed];
    setAdminIdsList(updated);
    setNewAdminId('');
  };

  // Remove Admin ID
  const handleRemoveAdminId = (idToRemove: string) => {
    const updated = adminIdsList.filter(id => id !== idToRemove);
    setAdminIdsList(updated);
  };

  // Test Connection
  const handleTestConnection = async () => {
    setActionLoading('test');
    try {
      const res = await fetch('/api/telegram/test', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ token: tokenInput || undefined })
      });
      const data = await res.json();
      if (data.success && data.bot) {
        showToast(
          'Token Verified Successfully',
          `Connected to @${data.bot.username} (${data.bot.first_name})`,
          'success'
        );
      } else {
        showToast('Token Verification Failed', data.error || 'Invalid Bot Token', 'error');
      }
    } catch (err: any) {
      showToast('Test Connection Error', err?.message || 'Network request failed', 'error');
    } finally {
      setActionLoading(null);
      fetchStatus(false);
      fetchLogs();
    }
  };

  // Connect Bot
  const handleConnect = async () => {
    setActionLoading('connect');
    try {
      const res = await fetch('/api/telegram/connect', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          token: tokenInput || undefined,
          adminUserIds: adminIdsList,
          autoConnect
        })
      });
      const data = await res.json();
      if (data.success) {
        showToast(
          'Telegram Bot Connected',
          `Online as @${data.bot?.username || 'bot'}. Receiver active.`,
          'success'
        );
        setTokenInput('');
      } else {
        showToast('Connection Failed', data.error || 'Failed to connect Telegram bot', 'error');
      }
    } catch (err: any) {
      showToast('Error', err?.message || 'Connection error', 'error');
    } finally {
      setActionLoading(null);
      fetchStatus(false);
      fetchLogs();
    }
  };

  // Disconnect Bot
  const handleDisconnect = async () => {
    setActionLoading('disconnect');
    try {
      const res = await fetch('/api/telegram/disconnect', {
        method: 'POST',
        headers: getHeaders()
      });
      const data = await res.json();
      if (data.success) {
        showToast('Telegram Bot Disconnected', 'Receiver stopped safely', 'info');
      } else {
        showToast('Disconnect Failed', data.message || 'Error stopping receiver', 'error');
      }
    } catch (err: any) {
      showToast('Error', err?.message || 'Disconnect error', 'error');
    } finally {
      setActionLoading(null);
      fetchStatus(false);
      fetchLogs();
    }
  };

  // Reconnect Bot
  const handleReconnect = async () => {
    setActionLoading('reconnect');
    try {
      const res = await fetch('/api/telegram/reconnect', {
        method: 'POST',
        headers: getHeaders()
      });
      const data = await res.json();
      if (data.success) {
        showToast('Telegram Bot Reconnected', `Online as @${data.bot?.username || 'bot'}`, 'success');
      } else {
        showToast('Reconnect Failed', data.error || 'Failed to restart connection', 'error');
      }
    } catch (err: any) {
      showToast('Error', err?.message || 'Reconnect error', 'error');
    } finally {
      setActionLoading(null);
      fetchStatus(false);
      fetchLogs();
    }
  };

  // Save Config
  const handleSaveConfig = async () => {
    setActionLoading('save');
    try {
      const res = await fetch('/api/telegram/config', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          token: tokenInput || undefined,
          adminUserIds: adminIdsList,
          autoConnect
        })
      });
      const data = await res.json();
      if (data.success) {
        showToast('Configuration Saved', 'Telegram configuration persisted securely', 'success');
        setTokenInput('');
      } else {
        showToast('Save Failed', data.error || 'Failed to save configuration', 'error');
      }
    } catch (err: any) {
      showToast('Error', err?.message || 'Save error', 'error');
    } finally {
      setActionLoading(null);
      fetchStatus(false);
    }
  };

  // Filtered Logs
  const filteredLogs = useMemo(() => {
    return logs.filter(l => {
      if (logFilter !== 'ALL' && l.category !== logFilter) return false;
      if (logSearch.trim()) {
        const query = logSearch.toLowerCase();
        const msg = (l.message || '').toLowerCase();
        const cat = (l.category || '').toLowerCase();
        return msg.includes(query) || cat.includes(query);
      }
      return true;
    });
  }, [logs, logFilter, logSearch]);

  const formatUptime = (secs: number) => {
    if (!secs || secs <= 0) return '0s';
    const d = Math.floor(secs / 86400);
    const h = Math.floor((secs % 86400) / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    if (d > 0) return `${d}d ${h}h ${m}m`;
    if (h > 0) return `${h}h ${m}m ${s}s`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
  };

  const getStatusBadge = (st?: string) => {
    switch (st) {
      case 'ONLINE':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            ONLINE
          </span>
        );
      case 'CONNECTING':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <RefreshCw className="w-3 h-3 animate-spin" />
            CONNECTING
          </span>
        );
      case 'AUTH_FAILED':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
            <XCircle className="w-3 h-3" />
            AUTH FAILED
          </span>
        );
      case 'ERROR':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
            <AlertTriangle className="w-3 h-3" />
            ERROR
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-zinc-500/10 text-zinc-400 border border-zinc-500/20">
            <Power className="w-3 h-3" />
            OFFLINE
          </span>
        );
    }
  };

  const getReceiverBadge = (st?: string) => {
    switch (st) {
      case 'RUNNING':
        return (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-400">
            <CheckCircle2 className="w-3.5 h-3.5" /> Polling Active
          </span>
        );
      case 'STARTING':
        return (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-400">
            <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Initializing
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-zinc-500">
            <Power className="w-3.5 h-3.5" /> Inactive
          </span>
        );
    }
  };

  const isOnline = status?.status === 'ONLINE';

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-sky-950/40 via-zinc-900/80 to-zinc-950/80 border border-sky-500/20 rounded-2xl p-6 shadow-xl backdrop-blur-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-sky-500 to-blue-600 flex items-center justify-center shadow-lg shadow-sky-500/20 border border-sky-400/30">
              <Send className="w-7 h-7 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold text-white tracking-tight">Telegram Bot Integration</h1>
                {getStatusBadge(status?.status)}
              </div>
              <p className="text-sm text-zinc-400 mt-1">
                Independent official Telegram Bot API transport & message dispatcher with unified ShiPu AI command execution.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              onClick={() => {
                fetchStatus(false);
                fetchLogs();
              }}
              disabled={loading}
              className="inline-flex items-center gap-2 px-3.5 py-2 bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 rounded-xl text-xs font-medium border border-zinc-700/60 transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>

            {isOnline ? (
              <>
                <button
                  onClick={handleReconnect}
                  disabled={actionLoading === 'reconnect'}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-xl text-xs font-medium transition-all"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${actionLoading === 'reconnect' ? 'animate-spin' : ''}`} />
                  Reconnect
                </button>
                <button
                  onClick={handleDisconnect}
                  disabled={actionLoading === 'disconnect'}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded-xl text-xs font-medium transition-all"
                >
                  <Power className="w-3.5 h-3.5" />
                  Disconnect
                </button>
              </>
            ) : (
              <button
                onClick={handleConnect}
                disabled={actionLoading === 'connect'}
                className="inline-flex items-center gap-2 px-5 py-2 bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white font-medium rounded-xl text-xs shadow-lg shadow-sky-500/25 transition-all"
              >
                <Zap className="w-3.5 h-3.5" />
                Connect Bot
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Bot Identity */}
        <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-2xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-zinc-400 mb-2">
            <span className="flex items-center gap-1.5 font-medium">
              <Bot className="w-4 h-4 text-sky-400" />
              Bot Identity
            </span>
            {getReceiverBadge(status?.receiverStatus)}
          </div>
          <div className="mt-1">
            <div className="text-lg font-bold text-white truncate">
              {status?.botUsername ? `@${status.botUsername}` : 'Not Connected'}
            </div>
            <div className="text-xs text-zinc-400 truncate mt-0.5">
              {status?.botFirstName || 'No active Telegram bot identity'}
            </div>
          </div>
          <div className="mt-3 pt-2 border-t border-zinc-800/60 flex items-center justify-between text-xs">
            <span className="text-zinc-500">Bot ID:</span>
            <span className="font-mono text-zinc-300">
              {status?.botId || '—'}
            </span>
          </div>
        </div>

        {/* Card 2: Messages Received */}
        <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-2xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-zinc-400 mb-2">
            <span className="flex items-center gap-1.5 font-medium">
              <MessageSquare className="w-4 h-4 text-emerald-400" />
              Traffic Ingestion
            </span>
            <span className="text-[10px] text-zinc-500 uppercase">Realtime</span>
          </div>
          <div className="mt-1">
            <div className="text-2xl font-black text-white">
              {status?.stats?.messagesReceived?.toLocaleString() || 0}
            </div>
            <div className="text-xs text-zinc-400 mt-0.5">
              Processed: <span className="text-emerald-400 font-semibold">{status?.stats?.messagesProcessed?.toLocaleString() || 0}</span>
            </div>
          </div>
          <div className="mt-3 pt-2 border-t border-zinc-800/60 flex items-center justify-between text-xs">
            <span className="text-zinc-500">Failed Updates:</span>
            <span className={`font-mono ${status?.stats?.messagesFailed ? 'text-rose-400' : 'text-zinc-400'}`}>
              {status?.stats?.messagesFailed || 0}
            </span>
          </div>
        </div>

        {/* Card 3: Commands Executed */}
        <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-2xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-zinc-400 mb-2">
            <span className="flex items-center gap-1.5 font-medium">
              <Zap className="w-4 h-4 text-amber-400" />
              Command Execution
            </span>
            <span className="text-[10px] text-zinc-500 uppercase">ShiPu Engine</span>
          </div>
          <div className="mt-1">
            <div className="text-2xl font-black text-white">
              {status?.stats?.commandsExecuted?.toLocaleString() || 0}
            </div>
            <div className="text-xs text-zinc-400 mt-0.5">
              Unified Plugins & AI
            </div>
          </div>
          <div className="mt-3 pt-2 border-t border-zinc-800/60 flex items-center justify-between text-xs">
            <span className="text-zinc-500">Telegram Admins:</span>
            <span className="font-mono text-zinc-300 font-semibold">
              {status?.adminUserIds?.length || adminIdsList.length || 0} configured
            </span>
          </div>
        </div>

        {/* Card 4: Uptime & State */}
        <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-2xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-zinc-400 mb-2">
            <span className="flex items-center gap-1.5 font-medium">
              <Activity className="w-4 h-4 text-purple-400" />
              Receiver Runtime
            </span>
            <span className="text-[10px] text-zinc-500 uppercase">Status</span>
          </div>
          <div className="mt-1">
            <div className="text-2xl font-black text-white font-mono">
              {formatUptime(status?.uptimeSeconds || 0)}
            </div>
            <div className="text-xs text-zinc-400 mt-0.5">
              {status?.lastError ? (
                <span className="text-rose-400 truncate block" title={status.lastError}>
                  {status.lastError}
                </span>
              ) : (
                <span className="text-emerald-400">All systems normal</span>
              )}
            </div>
          </div>
          <div className="mt-3 pt-2 border-t border-zinc-800/60 flex items-center justify-between text-xs">
            <span className="text-zinc-500">Last Event:</span>
            <span className="text-zinc-400">
              {status?.lastUpdateAt ? new Date(status.lastUpdateAt).toLocaleTimeString() : '—'}
            </span>
          </div>
        </div>
      </div>

      {/* Main Content Grid: Config Form & Quick Help */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Configuration Card (2 cols) */}
        <div className="lg:col-span-2 bg-zinc-900/60 border border-zinc-800/80 rounded-2xl p-6 space-y-6">
          <div className="flex items-center justify-between pb-4 border-b border-zinc-800/80">
            <div className="flex items-center gap-2.5">
              <Key className="w-5 h-5 text-sky-400" />
              <h2 className="text-base font-semibold text-white">Bot Credentials & Administrator Access</h2>
            </div>
            <span className="text-xs text-zinc-400">
              Encrypted storage in MongoDB
            </span>
          </div>

          {/* Token Input */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
                Telegram Bot API Token
                <span className="text-rose-400">*</span>
              </label>
              {status?.hasToken && (
                <span className="text-xs text-zinc-500 flex items-center gap-1">
                  Active: <span className="font-mono text-zinc-300">{status.maskedToken}</span>
                </span>
              )}
            </div>
            <div className="relative">
              <input
                type={showToken ? 'text' : 'password'}
                value={tokenInput}
                onChange={e => setTokenInput(e.target.value)}
                placeholder={status?.hasToken ? 'Enter new token to replace existing token...' : 'e.g. 123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ'}
                className="w-full bg-zinc-950/80 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-sky-500/60 pr-20 font-mono"
              />
              <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setShowToken(!showToken)}
                  className="p-1.5 text-zinc-400 hover:text-zinc-200 transition-colors"
                  title={showToken ? 'Hide token' : 'Show token'}
                >
                  {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <p className="text-[11px] text-zinc-500">
              Obtained from <a href="https://t.me/BotFather" target="_blank" rel="noreferrer" className="text-sky-400 hover:underline inline-flex items-center gap-0.5">@BotFather <ArrowUpRight className="w-3 h-3" /></a> by typing <code className="text-zinc-300">/newbot</code>.
            </p>
          </div>

          {/* Admin User IDs Input */}
          <div className="space-y-3">
            <label className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              Telegram Administrator User IDs
            </label>
            <p className="text-[11px] text-zinc-400">
              Users with these Telegram IDs will be granted full ShiPu AI administrative privileges (<code className="text-emerald-400">Role 2 / 3</code>). Get your numeric ID from <a href="https://t.me/userinfobot" target="_blank" rel="noreferrer" className="text-sky-400 hover:underline inline-flex items-center gap-0.5">@userinfobot <ArrowUpRight className="w-3 h-3" /></a>.
            </p>

            <div className="flex gap-2">
              <input
                type="text"
                value={newAdminId}
                onChange={e => setNewAdminId(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddAdminId();
                  }
                }}
                placeholder="Enter Telegram numeric ID (e.g. 583920194)..."
                className="flex-1 bg-zinc-950/80 border border-zinc-800 rounded-xl px-4 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-sky-500/60 font-mono"
              />
              <button
                type="button"
                onClick={handleAddAdminId}
                className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl text-xs font-medium border border-zinc-700 transition-colors"
              >
                Add Admin ID
              </button>
            </div>

            {/* Admin Chips List */}
            <div className="flex flex-wrap gap-2 pt-1 min-h-[38px] p-2 bg-zinc-950/40 rounded-xl border border-zinc-800/60">
              {adminIdsList.length === 0 ? (
                <span className="text-xs text-zinc-600 italic self-center">No administrator user IDs configured yet.</span>
              ) : (
                adminIdsList.map(id => (
                  <span
                    key={id}
                    className="inline-flex items-center gap-1.5 px-3 py-1 bg-sky-500/10 border border-sky-500/30 text-sky-300 rounded-lg text-xs font-mono"
                  >
                    <ShieldCheck className="w-3 h-3 text-sky-400" />
                    {id}
                    <button
                      type="button"
                      onClick={() => handleRemoveAdminId(id)}
                      className="text-zinc-500 hover:text-rose-400 ml-1 transition-colors"
                      title="Remove ID"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                    </button>
                  </span>
                ))
              )}
            </div>
          </div>

          {/* Auto Connect Toggle */}
          <div className="flex items-center justify-between pt-2">
            <div>
              <div className="text-xs font-semibold text-white">Auto-Connect on Server Boot</div>
              <div className="text-[11px] text-zinc-400">
                Automatically restore Telegram Bot long-polling when the server boots.
              </div>
            </div>
            <button
              type="button"
              onClick={() => setAutoConnect(!autoConnect)}
              className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors ${
                autoConnect ? 'bg-sky-500' : 'bg-zinc-700'
              }`}
            >
              <div
                className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                  autoConnect ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Action Buttons */}
          <div className="pt-4 border-t border-zinc-800/80 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleTestConnection}
                disabled={actionLoading !== null}
                className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-xl text-xs font-medium border border-zinc-700 transition-colors flex items-center gap-1.5"
              >
                {actionLoading === 'test' ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}
                Test Connection
              </button>

              <button
                type="button"
                onClick={handleSaveConfig}
                disabled={actionLoading !== null}
                className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-xl text-xs font-medium border border-zinc-700 transition-colors flex items-center gap-1.5"
              >
                {actionLoading === 'save' ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5 text-sky-400" />}
                Save Configuration
              </button>
            </div>

            <div className="flex items-center gap-2">
              {isOnline ? (
                <button
                  type="button"
                  onClick={handleDisconnect}
                  disabled={actionLoading !== null}
                  className="px-5 py-2 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5"
                >
                  <Power className="w-3.5 h-3.5" />
                  Disconnect
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleConnect}
                  disabled={actionLoading !== null}
                  className="px-6 py-2 bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-sky-500/25 transition-all flex items-center gap-1.5"
                >
                  {actionLoading === 'connect' ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
                  Connect & Start Bot
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Quick Instructions & Help Card (1 col) */}
        <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-2xl p-6 space-y-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 pb-3 border-b border-zinc-800/80">
              <HelpCircle className="w-4 h-4 text-sky-400" />
              <h3 className="text-sm font-semibold text-white">Setup Quick Guide</h3>
            </div>

            <div className="mt-4 space-y-3.5 text-xs text-zinc-400">
              <div className="flex gap-2.5">
                <span className="w-5 h-5 rounded-full bg-sky-500/20 text-sky-400 font-bold flex items-center justify-center shrink-0 text-[11px]">
                  1
                </span>
                <div>
                  <strong className="text-zinc-200">Create Bot Token:</strong> Open <a href="https://t.me/BotFather" target="_blank" rel="noreferrer" className="text-sky-400 underline">@BotFather</a> in Telegram, send <code className="text-zinc-300">/newbot</code>, choose a name and username, then copy the API token.
                </div>
              </div>

              <div className="flex gap-2.5">
                <span className="w-5 h-5 rounded-full bg-sky-500/20 text-sky-400 font-bold flex items-center justify-center shrink-0 text-[11px]">
                  2
                </span>
                <div>
                  <strong className="text-zinc-200">Get Admin User ID:</strong> Message <a href="https://t.me/userinfobot" target="_blank" rel="noreferrer" className="text-sky-400 underline">@userinfobot</a> to find your numeric Telegram ID and paste it in the Admin IDs field.
                </div>
              </div>

              <div className="flex gap-2.5">
                <span className="w-5 h-5 rounded-full bg-sky-500/20 text-sky-400 font-bold flex items-center justify-center shrink-0 text-[11px]">
                  3
                </span>
                <div>
                  <strong className="text-zinc-200">Connect & Chat:</strong> Click <strong className="text-sky-400">Connect Bot</strong>. Start a direct chat with your bot or invite it to any group. Send <code className="text-zinc-300">#help</code> or <code className="text-zinc-300">#ping</code> to test!
                </div>
              </div>
            </div>
          </div>

          <div className="p-3 bg-sky-950/30 border border-sky-500/20 rounded-xl mt-4">
            <div className="flex items-center gap-2 text-sky-400 font-semibold text-xs mb-1">
              <ShieldCheck className="w-3.5 h-3.5" />
              Isolated Provider Architecture
            </div>
            <p className="text-[11px] text-zinc-400 leading-relaxed">
              Telegram runs as an independent transport provider alongside Messenger without sharing session cookies, MQTT connections, or auth state.
            </p>
          </div>
        </div>
      </div>

      {/* Structured Real-Time Runtime Logs Viewer */}
      <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-2xl p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-zinc-800/80">
          <div className="flex items-center gap-2.5">
            <Terminal className="w-5 h-5 text-sky-400" />
            <h2 className="text-base font-semibold text-white">Telegram Runtime Activity Logs</h2>
            <span className="text-xs bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded-full font-mono">
              {filteredLogs.length} events
            </span>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Category Filter */}
            <select
              value={logFilter}
              onChange={e => setLogFilter(e.target.value)}
              className="bg-zinc-950 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-zinc-300 focus:outline-none focus:border-sky-500/60"
            >
              <option value="ALL">All Categories</option>
              <option value="TOKEN_VALIDATION">Token Validation</option>
              <option value="BOT_CONNECTED">Bot Connected</option>
              <option value="RECEIVER_STARTED">Receiver Started</option>
              <option value="UPDATE_RECEIVED">Update Received</option>
              <option value="MESSAGE_PROCESSED">Message Processed</option>
              <option value="COMMAND_EXECUTED">Command Executed</option>
              <option value="MESSAGE_SENT">Message Sent</option>
              <option value="NETWORK_RETRY">Network Retry</option>
              <option value="AUTH_FAILED">Auth Failed</option>
              <option value="API_ERROR">API Error</option>
              <option value="RUNTIME_ERROR">Runtime Error</option>
            </select>

            {/* Search */}
            <input
              type="text"
              value={logSearch}
              onChange={e => setLogSearch(e.target.value)}
              placeholder="Search logs..."
              className="bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-1.5 text-xs text-zinc-300 placeholder-zinc-600 focus:outline-none focus:border-sky-500/60 w-36 sm:w-48"
            />

            {/* Auto Refresh Toggle */}
            <button
              onClick={() => setAutoRefreshLogs(!autoRefreshLogs)}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                autoRefreshLogs
                  ? 'bg-sky-500/10 border-sky-500/30 text-sky-400'
                  : 'bg-zinc-800 border-zinc-700 text-zinc-400'
              }`}
              title="Toggle Live Log Polling"
            >
              {autoRefreshLogs ? '● Live' : '○ Paused'}
            </button>
          </div>
        </div>

        {/* Logs Console Container */}
        <div className="bg-zinc-950 rounded-xl border border-zinc-800/80 p-3 h-80 overflow-y-auto font-mono text-xs space-y-1.5 select-text">
          {filteredLogs.length === 0 ? (
            <div className="h-full flex items-center justify-center text-zinc-600">
              No Telegram runtime logs matching current filter.
            </div>
          ) : (
            filteredLogs.map(log => {
              let badgeColor = 'bg-zinc-800 text-zinc-400 border-zinc-700';
              if (log.level === 'SUCCESS') badgeColor = 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
              if (log.level === 'WARN') badgeColor = 'bg-amber-500/10 text-amber-400 border-amber-500/20';
              if (log.level === 'ERROR') badgeColor = 'bg-rose-500/10 text-rose-400 border-rose-500/20';

              return (
                <div
                  key={log.id}
                  className="flex items-start gap-2.5 py-1 px-2 rounded hover:bg-zinc-900/80 transition-colors leading-relaxed"
                >
                  <span className="text-zinc-600 shrink-0 select-none text-[11px]">
                    {new Date(log.timestamp).toLocaleTimeString()}
                  </span>
                  <span className={`px-1.5 py-0.5 rounded text-[10px] uppercase font-bold border shrink-0 ${badgeColor}`}>
                    {log.category}
                  </span>
                  <span className="text-zinc-300 break-all flex-1">
                    {log.message}
                  </span>
                  {log.details && (
                    <span className="text-[10px] text-zinc-500 truncate max-w-xs shrink-0" title={JSON.stringify(log.details)}>
                      {typeof log.details === 'string' ? log.details : JSON.stringify(log.details)}
                    </span>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
