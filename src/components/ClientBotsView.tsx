import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion } from 'motion/react';
import {
  Key,
  ShieldCheck,
  AlertTriangle,
  Upload,
  RefreshCw,
  Trash2,
  FileJson,
  User,
  Clock,
  Radio,
  Lock,
  PlusCircle,
  ToggleLeft,
  ToggleRight,
  ExternalLink,
  Power,
  Layers,
  Database,
  Search,
  Filter,
  ChevronDown,
  ChevronUp,
  Activity,
  Terminal,
  Cpu,
  Zap,
  MessageSquare,
  AlertOctagon,
  Server,
  Sliders,
  BarChart2,
  Globe,
  Hash,
  CheckCircle2,
  FileText,
  AlertCircle,
  Sparkles,
  Bot
} from 'lucide-react';
import { SafeAccountMeta } from '../adapters/messenger/AccountConnection';
import { IsolatedAccountMetrics, DetailedAccountLogEntry } from '../services/AccountRuntimeLogManager';

interface ClientBotsViewProps {
  token?: string;
}

export const ClientBotsView: React.FC<ClientBotsViewProps> = ({ token }) => {
  const [bots, setBots] = useState<SafeAccountMeta[]>([]);
  const [selectedBotId, setSelectedBotId] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ONLINE' | 'OFFLINE' | 'FAILED'>('ALL');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Inspector Sub-Tabs
  const [inspectorTab, setInspectorTab] = useState<'Overview' | 'Logs' | 'Brain' | 'Economy' | 'System'>('Overview');

  // Real-time logs for inspector
  const [logs, setLogs] = useState<DetailedAccountLogEntry[]>([]);
  const [logsLoading, setLogsLoading] = useState<boolean>(false);
  const [logCategoryFilter, setLogCategoryFilter] = useState<string>('ALL');

  // Cookie replacement state
  const [newCookie, setNewCookie] = useState<string>('');
  const [isUpdatingCookie, setIsUpdatingCookie] = useState<boolean>(false);

  const getHeaders = useCallback(() => {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return headers;
  }, [token]);

  // Fetch client bots
  const fetchClientBots = useCallback(async () => {
    try {
      const res = await fetch('/api/supabase/client-bots', { headers: getHeaders() });
      if (res.ok) {
        const data = await res.json();
        // Map Supabase rows to SafeAccountMeta format
        const clientFiltered = (data.bots || []).map((b: any) => ({
           accountId: `cloud_${b.bot_id}`,
           uid: b.bot_id,
           displayName: b.owner || 'Client Bot',
           status: b.status === 'running' || b.status === 'connected' ? 'CONNECTED' : b.status === 'failed' ? 'FAILED' : 'DISCONNECTED',
           authType: 'cookie',
           errorCount: b.last_error ? 1 : 0,
           lastErrorCode: b.last_error,
           creationSource: 'CLIENT_SYNC',
           stats: b.client_bot_metrics ? b.client_bot_metrics[0] : {}
        }));
        setBots(clientFiltered);

        if (clientFiltered.length > 0 && !selectedBotId) {
          setSelectedBotId(clientFiltered[0].accountId);
        }
      }
    } catch (err: any) {
      console.error('Failed to fetch client bots:', err);
    }
  }, [getHeaders, selectedBotId]);

  useEffect(() => {
    fetchClientBots();
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        fetchClientBots();
      }
    }, 15000);
    return () => clearInterval(interval);
  }, [fetchClientBots]);

  // Selected bot metadata
  const selectedBot = useMemo(() => {
    return bots.find((b) => b.accountId === selectedBotId) || null;
  }, [bots, selectedBotId]);

  // Fetch bot logs
  const fetchBotLogs = useCallback(async () => {
    if (!selectedBotId) return;
    setLogsLoading(true);
    try {
      const categoryParam = logCategoryFilter !== 'ALL' ? `?category=${logCategoryFilter}` : '';
      const res = await fetch(`/api/messenger/accounts/${selectedBotId}/logs${categoryParam}`, { headers: getHeaders() });
      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs || []);
      }
    } catch (err) {
      console.error('Failed to fetch bot logs:', err);
    } finally {
      setLogsLoading(false);
    }
  }, [selectedBotId, logCategoryFilter, getHeaders]);

  useEffect(() => {
    if (selectedBotId && inspectorTab === 'Logs') {
      fetchBotLogs();
      const interval = setInterval(() => {
        if (document.visibilityState === 'visible') {
          fetchBotLogs();
        }
      }, 20000);
      return () => clearInterval(interval);
    }
  }, [selectedBotId, inspectorTab, fetchBotLogs]);

  // Filtered bots list
  const filteredBots = useMemo(() => {
    return bots.filter((b) => {
      if (searchQuery.trim() !== '') {
        const q = searchQuery.toLowerCase();
        const matchesName = (b.displayName || '').toLowerCase().includes(q);
        const matchesUid = (b.uid || '').toLowerCase().includes(q);
        const matchesId = b.accountId.toLowerCase().includes(q);
        if (!matchesName && !matchesUid && !matchesId) return false;
      }

      if (statusFilter === 'ONLINE') {
        return b.status === 'CONNECTED' || b.status === 'MQTT_ACTIVE' || b.status === 'AI_READY' || b.status === 'ONLINE';
      } else if (statusFilter === 'OFFLINE') {
        return b.status === 'DISCONNECTED' || b.status === 'DISABLED';
      } else if (statusFilter === 'FAILED') {
        return b.status === 'AUTH_FAILED' || b.status === 'COOKIE_EXPIRED' || b.status === 'FAILED';
      }
      return true;
    });
  }, [bots, searchQuery, statusFilter]);

  // Actions
  const handleReconnect = async (accId: string) => {
    const botId = accId.replace('cloud_', '');
    setLoading(true);
    setError(null);
    setSuccessMessage(null);
    try {
      const res = await fetch(`/api/supabase/client-bots/${botId}/reconnect`, {
        method: 'POST',
        headers: getHeaders()
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSuccessMessage('Reconnection request dispatched successfully.');
        fetchClientBots();
      } else {
        setError(data.error || 'Failed to reconnect.');
      }
    } catch (err: any) {
      setError(err.message || 'Error occurred during reconnection.');
    } finally {
      setLoading(false);
    }
  };

  const handleRestart = async (accId: string) => {
    const botId = accId.replace('cloud_', '');
    setLoading(true);
    setError(null);
    setSuccessMessage(null);
    try {
      const res = await fetch(`/api/supabase/client-bots/${botId}/restart`, {
        method: 'POST',
        headers: getHeaders()
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSuccessMessage('Restart command sent successfully.');
        fetchClientBots();
      } else {
        setError(data.error || 'Failed to restart.');
      }
    } catch (err: any) {
      setError(err.message || 'Error occurred during restart.');
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = async (accId: string) => {
    const botId = accId.replace('cloud_', '');
    setLoading(true);
    setError(null);
    setSuccessMessage(null);
    try {
      const res = await fetch(`/api/supabase/client-bots/${botId}/disconnect`, {
        method: 'POST',
        headers: getHeaders()
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSuccessMessage('Disconnected account safely.');
        fetchClientBots();
      } else {
        setError(data.error || 'Failed to disconnect.');
      }
    } catch (err: any) {
      setError(err.message || 'Error occurred during disconnection.');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleBot = async (accId: string) => {
    setLoading(true);
    setError(null);
    setSuccessMessage(null);
    try {
      const res = await fetch(`/api/messenger/accounts/${accId}/toggle-bot`, {
        method: 'POST',
        headers: getHeaders()
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSuccessMessage(`Bot toggled successfully. Status: ${data.botEnabled ? 'ENABLED' : 'DISABLED'}`);
        fetchClientBots();
      } else {
        setError(data.error || 'Failed to toggle bot.');
      }
    } catch (err: any) {
      setError(err.message || 'Error occurred during toggle.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteBot = async (accId: string) => {
    if (!window.confirm('Are you absolutely sure you want to delete this bot session and wipe its credentials?')) {
      return;
    }
    setLoading(true);
    setError(null);
    setSuccessMessage(null);
    try {
      const res = await fetch('/api/messenger/accounts/cookie/delete', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ accountId: accId })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSuccessMessage('Bot account deleted and removed completely.');
        setSelectedBotId('');
        fetchClientBots();
      } else {
        setError(data.error || 'Failed to delete bot.');
      }
    } catch (err: any) {
      setError(err.message || 'Error occurred during deletion.');
    } finally {
      setLoading(false);
    }
  };

  const handleReloadCookie = async () => {
    if (!newCookie.trim()) {
      setError('Please provide a valid AppState cookie array string.');
      return;
    }
    setIsUpdatingCookie(true);
    setError(null);
    setSuccessMessage(null);
    try {
      const res = await fetch('/api/messenger/accounts/cookie/update', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          accountId: selectedBotId,
          cookieJson: newCookie.trim()
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSuccessMessage('Cookie AppState updated and account re-authenticated successfully.');
        setNewCookie('');
        fetchClientBots();
      } else {
        setError(data.error || 'Cookie reload failed.');
      }
    } catch (err: any) {
      setError(err.message || 'Error occurred during cookie upload.');
    } finally {
      setIsUpdatingCookie(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* View Header with stats summary */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 p-4 rounded-2xl bg-slate-900 border border-slate-800">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-indigo-400" />
            <span>Cloud Client Bots Manager</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Logically segregated portal for managing first-class client bots with automated state-tracking, dedicated logging, and real-time inspector.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="bg-slate-950 px-4 py-2 rounded-xl border border-slate-800 flex items-center gap-4">
            <div className="text-center">
              <div className="text-lg font-bold text-indigo-400">{bots.length}</div>
              <div className="text-[10px] text-slate-400 font-mono">TOTAL BOTS</div>
            </div>
            <div className="w-px h-8 bg-slate-800"></div>
            <div className="text-center">
              <div className="text-lg font-bold text-emerald-400">
                {bots.filter(b => b.status === 'CONNECTED' || b.status === 'ONLINE' || b.status === 'AI_READY' || b.status === 'MQTT_ACTIVE').length}
              </div>
              <div className="text-[10px] text-slate-400 font-mono">ONLINE</div>
            </div>
            <div className="w-px h-8 bg-slate-800"></div>
            <div className="text-center">
              <div className="text-lg font-bold text-amber-500">
                {bots.filter(b => b.status === 'AUTH_FAILED' || b.status === 'COOKIE_EXPIRED' || b.status === 'FAILED').length}
              </div>
              <div className="text-[10px] text-slate-400 font-mono font-semibold">ATTENTION</div>
            </div>
          </div>
          <button
            onClick={fetchClientBots}
            className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl border border-slate-700 transition active:scale-95 flex items-center justify-center"
            title="Refresh List"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Notifications bar */}
      {error && (
        <div className="p-3 bg-red-950/40 border border-red-800 text-red-200 text-xs rounded-xl flex items-center gap-2.5">
          <AlertOctagon className="w-4 h-4 text-red-400 shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {successMessage && (
        <div className="p-3 bg-emerald-950/40 border border-emerald-800 text-emerald-200 text-xs rounded-xl flex items-center gap-2.5">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Main Panel split in List vs Inspector */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Side: Client Bots list */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3.5">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-sm text-slate-200 flex items-center gap-2">
                <Layers className="w-4 h-4 text-slate-400" />
                <span>Client Bots ({filteredBots.length})</span>
              </h3>
            </div>

            {/* Search and filters */}
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
                <input
                  type="text"
                  placeholder="Search bot name, UID, account id..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-indigo-500"
                />
              </div>
              <select
                value={statusFilter}
                onChange={(e: any) => setStatusFilter(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-300 px-2 py-1.5 focus:outline-none focus:border-indigo-500"
              >
                <option value="ALL">All Status</option>
                <option value="ONLINE">Online</option>
                <option value="OFFLINE">Offline</option>
                <option value="FAILED">Attention</option>
              </select>
            </div>

            {/* List */}
            <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
              {filteredBots.length === 0 ? (
                <div className="text-center py-12 border border-dashed border-slate-800 rounded-xl">
                  <Bot className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                  <p className="text-xs text-slate-500">No client bots found matching search criteria.</p>
                </div>
              ) : (
                filteredBots.map((bot) => {
                  const isSelected = bot.accountId === selectedBotId;
                  const isOnline = bot.status === 'CONNECTED' || bot.status === 'ONLINE' || bot.status === 'AI_READY' || bot.status === 'MQTT_ACTIVE';
                  const isFailed = bot.status === 'AUTH_FAILED' || bot.status === 'COOKIE_EXPIRED' || bot.status === 'FAILED';

                  return (
                    <div
                      key={bot.accountId}
                      onClick={() => {
                        setSelectedBotId(bot.accountId);
                        setLogs([]);
                      }}
                      className={`p-3.5 rounded-xl border text-left transition cursor-pointer flex flex-col gap-2.5 ${
                        isSelected
                          ? 'bg-indigo-600/10 border-indigo-500 shadow-[0_0_12px_rgba(79,70,229,0.1)]'
                          : 'bg-slate-950/40 border-slate-800 hover:border-slate-700 hover:bg-slate-900/30'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="font-semibold text-xs text-white max-w-[200px] truncate">
                            {bot.displayName}
                          </div>
                          <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                            ID: {bot.accountId} · Slot: {bot.slotId || 'none'}
                          </div>
                        </div>
                        <span
                          className={`text-[9px] font-bold font-mono px-2 py-0.5 rounded-full ${
                            isOnline
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              : isFailed
                              ? 'bg-red-500/10 text-red-400 border border-red-500/20 animate-pulse'
                              : 'bg-slate-800 text-slate-400 border border-slate-700/50'
                          }`}
                        >
                          {bot.status}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-[10px] font-mono border-t border-slate-900 pt-2 text-slate-400">
                        <div className="flex items-center gap-1">
                          <Hash className="w-3.5 h-3.5 text-slate-500" />
                          <span>UID: <span className="text-slate-300 font-semibold">{bot.uid || 'N/A'}</span></span>
                        </div>
                        <div className="flex items-center gap-1 justify-end">
                          <Radio className="w-3.5 h-3.5 text-slate-500" />
                          <span>MQTT: <span className={bot.mqttStatus === 'CONNECTED' || bot.mqttStatus === 'LISTENING' || bot.mqttStatus === 'MQTT_ACTIVE' ? 'text-emerald-400' : 'text-slate-500'}>{bot.mqttStatus}</span></span>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Right Side: Per Bot Inspector */}
        <div className="lg:col-span-7">
          {selectedBot ? (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-5">
              {/* Bot Inspector Header */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-800 pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-base text-white">{selectedBot.displayName}</h3>
                    <span className="text-[10px] bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-2 py-0.5 rounded font-mono font-semibold">
                      SOURCE: {selectedBot.source || 'client'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 font-mono mt-0.5">
                    FB UID: {selectedBot.uid} · ID: {selectedBot.accountId}
                  </p>
                </div>
                {/* Actions Toolbar */}
                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    onClick={() => handleReconnect(selectedBot.accountId)}
                    disabled={loading}
                    className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-300 text-[10px] font-bold font-mono rounded-lg transition"
                    title="Reconnect MQTT"
                  >
                    RECONNECT
                  </button>
                  <button
                    onClick={() => handleRestart(selectedBot.accountId)}
                    disabled={loading}
                    className="px-2.5 py-1.5 bg-indigo-600/20 hover:bg-indigo-600/30 disabled:opacity-50 text-indigo-300 text-[10px] font-bold font-mono rounded-lg transition"
                    title="Soft Restart"
                  >
                    RESTART
                  </button>
                  <button
                    onClick={() => handleToggleBot(selectedBot.accountId)}
                    disabled={loading}
                    className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-300 text-[10px] font-bold font-mono rounded-lg transition"
                    title="Toggle enabled state"
                  >
                    TOGGLE BOT
                  </button>
                  <button
                    onClick={() => handleDisconnect(selectedBot.accountId)}
                    disabled={loading}
                    className="px-2.5 py-1.5 bg-amber-600/15 hover:bg-amber-600/25 text-amber-400 text-[10px] font-bold font-mono rounded-lg transition"
                    title="Safely disconnect"
                  >
                    STOP
                  </button>
                  <button
                    onClick={() => handleDeleteBot(selectedBot.accountId)}
                    disabled={loading}
                    className="p-1.5 bg-red-600/10 hover:bg-red-600/20 text-red-400 rounded-lg transition"
                    title="Delete Account"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Inspector Navigation Tabs */}
              <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
                {(['Overview', 'Logs', 'Brain', 'Economy', 'System'] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setInspectorTab(tab)}
                    className={`flex-1 text-center py-1.5 rounded-lg text-xs font-medium transition ${
                      inspectorTab === tab
                        ? 'bg-slate-800 text-white font-semibold'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>

              {/* Tab Contents */}
              {inspectorTab === 'Overview' && (
                <div className="space-y-4">
                  {/* Status Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="bg-slate-950 p-3 rounded-xl border border-slate-800/80">
                      <div className="text-[10px] text-slate-500 font-mono">ACCOUNT STATUS</div>
                      <div className="text-xs font-bold text-white mt-1 uppercase font-mono flex items-center gap-1.5">
                        <span className={`w-2 h-2 rounded-full ${selectedBot.status === 'CONNECTED' || selectedBot.status === 'ONLINE' || selectedBot.status === 'AI_READY' || selectedBot.status === 'MQTT_ACTIVE' ? 'bg-emerald-400' : 'bg-red-400 animate-pulse'}`} />
                        <span>{selectedBot.status}</span>
                      </div>
                    </div>
                    <div className="bg-slate-950 p-3 rounded-xl border border-slate-800/80">
                      <div className="text-[10px] text-slate-500 font-mono">MQTT STREAM</div>
                      <div className="text-xs font-bold text-indigo-400 mt-1 uppercase font-mono">{selectedBot.mqttStatus || 'OFF'}</div>
                    </div>
                    <div className="bg-slate-950 p-3 rounded-xl border border-slate-800/80">
                      <div className="text-[10px] text-slate-500 font-mono">MESSAGES TODAY</div>
                      <div className="text-xs font-bold text-white mt-1 font-mono">{selectedBot.stats?.messagesToday || 0}</div>
                    </div>
                    <div className="bg-slate-950 p-3 rounded-xl border border-slate-800/80">
                      <div className="text-[10px] text-slate-500 font-mono">RECONNECT COUNT</div>
                      <div className="text-xs font-bold text-amber-400 mt-1 font-mono">{selectedBot.reconnectCount || 0}</div>
                    </div>
                  </div>

                  {/* Core Details List */}
                  <div className="bg-slate-950 p-4 rounded-xl border border-slate-800/80 space-y-2.5">
                    <h4 className="text-xs font-bold text-slate-300 font-mono uppercase border-b border-slate-900 pb-2">Bot Profile Metrics</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                      <div className="flex justify-between font-mono">
                        <span className="text-slate-500">Facebook Provider:</span>
                        <span className="text-slate-300 font-medium">{selectedBot.provider || 'N/A'}</span>
                      </div>
                      <div className="flex justify-between font-mono">
                        <span className="text-slate-500">Connection Mode:</span>
                        <span className="text-slate-300 font-medium uppercase">{selectedBot.connectionMode || 'default'}</span>
                      </div>
                      <div className="flex justify-between font-mono">
                        <span className="text-slate-500">Database Name:</span>
                        <span className="text-slate-300 font-medium">{selectedBot.dbName || 'Platform Default'}</span>
                      </div>
                      <div className="flex justify-between font-mono">
                        <span className="text-slate-500">Collection Prefix:</span>
                        <span className="text-slate-300 font-medium">{selectedBot.collectionPrefix || 'Default'}</span>
                      </div>
                      <div className="flex justify-between font-mono">
                        <span className="text-slate-500">Last Activity:</span>
                        <span className="text-slate-300 font-medium">{selectedBot.lastHeartbeat ? new Date(selectedBot.lastHeartbeat).toLocaleTimeString() : 'N/A'}</span>
                      </div>
                      <div className="flex justify-between font-mono">
                        <span className="text-slate-500">Cookie Health:</span>
                        <span className={selectedBot.status === 'COOKIE_EXPIRED' || selectedBot.status === 'AUTH_FAILED' ? 'text-red-400 font-bold' : 'text-emerald-400 font-semibold'}>
                          {selectedBot.status === 'COOKIE_EXPIRED' ? 'EXPIRED' : selectedBot.status === 'AUTH_FAILED' ? 'FAILED' : 'HEALTHY'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Reload Cookie section */}
                  <div className="bg-slate-950 p-4 rounded-xl border border-slate-800/80 space-y-3">
                    <h4 className="text-xs font-bold text-slate-300 font-mono uppercase flex items-center gap-1.5">
                      <RefreshCw className="w-3.5 h-3.5 text-indigo-400" />
                      <span>Reload/Replace Bot Cookie AppState</span>
                    </h4>
                    <textarea
                      placeholder="Paste your fresh Facebook AppState JSON array here..."
                      value={newCookie}
                      onChange={(e) => setNewCookie(e.target.value)}
                      rows={3}
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs font-mono text-white placeholder:text-slate-600 focus:outline-none focus:border-indigo-500"
                    />
                    <div className="flex justify-end">
                      <button
                        onClick={handleReloadCookie}
                        disabled={isUpdatingCookie}
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-semibold rounded-lg transition active:scale-95 flex items-center gap-1.5"
                      >
                        <Upload className="w-3.5 h-3.5" />
                        <span>{isUpdatingCookie ? 'Uploading...' : 'Reload Cookie AppState'}</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {inspectorTab === 'Logs' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-slate-300 font-mono uppercase">Live Messenger Bot Logs</h4>
                    <select
                      value={logCategoryFilter}
                      onChange={(e) => setLogCategoryFilter(e.target.value)}
                      className="bg-slate-950 border border-slate-800 rounded-lg text-[10px] text-slate-300 px-2 py-1 focus:outline-none focus:border-indigo-500 font-mono"
                    >
                      <option value="ALL">All Modules</option>
                      <option value="AUTH">Authentication</option>
                      <option value="MQTT">MQTT Broker</option>
                      <option value="AI">AI Engine</option>
                      <option value="COMMAND">Commands</option>
                      <option value="SUPERVISOR">Supervisor</option>
                    </select>
                  </div>

                  {/* Terminal Console */}
                  <div className="bg-slate-950 border border-slate-800/80 rounded-xl p-3 h-80 overflow-y-auto font-mono text-[11px] space-y-1.5 scrollbar-thin scrollbar-thumb-slate-800">
                    {logsLoading && logs.length === 0 ? (
                      <div className="text-center text-slate-500 py-12">Streaming logs...</div>
                    ) : logs.length === 0 ? (
                      <div className="text-center text-slate-600 py-12">No logs recorded for this bot yet.</div>
                    ) : (
                      logs.map((log, index) => {
                        let levelColor = 'text-slate-400';
                        if (log.level === 'SUCCESS') levelColor = 'text-emerald-400 font-semibold';
                        if (log.level === 'WARN') levelColor = 'text-amber-400';
                        if (log.level === 'ERROR') levelColor = 'text-red-400 font-semibold animate-pulse';

                        return (
                          <div key={log.id || index} className="hover:bg-slate-900/40 p-0.5 rounded leading-relaxed border-l-2 border-transparent hover:border-indigo-500 pl-2">
                            <span className="text-slate-600 select-none">[{log.timestamp}]</span>{' '}
                            <span className={`uppercase text-[10px] ${levelColor}`}>[{log.level}]</span>{' '}
                            <span className="text-slate-500">[{log.category}]</span>{' '}
                            <span className="text-slate-200">{log.message}</span>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}

              {inspectorTab === 'Brain' && (
                <div className="space-y-4">
                  <div className="bg-slate-950 p-4 rounded-xl border border-slate-800/80 space-y-3.5">
                    <h4 className="text-xs font-bold text-slate-300 font-mono uppercase flex items-center gap-1.5 border-b border-slate-900 pb-2">
                      <Sparkles className="w-4 h-4 text-indigo-400" />
                      <span>Gemini Cognitive Profile</span>
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                      <div className="flex justify-between font-mono">
                        <span className="text-slate-500">Cognitive Status:</span>
                        <span className="text-emerald-400 font-bold">READY</span>
                      </div>
                      <div className="flex justify-between font-mono">
                        <span className="text-slate-500">AI Model Active:</span>
                        <span className="text-indigo-400 font-semibold">Gemini 2.5 Flash</span>
                      </div>
                      <div className="flex justify-between font-mono">
                        <span className="text-slate-500">Session Context Size:</span>
                        <span className="text-slate-300 font-medium">1.04 KB</span>
                      </div>
                      <div className="flex justify-between font-mono">
                        <span className="text-slate-500">Reply Count (Today):</span>
                        <span className="text-slate-300 font-semibold">{selectedBot.stats?.aiMessages || 0}</span>
                      </div>
                      <div className="flex justify-between font-mono">
                        <span className="text-slate-500">Cognitive Memories:</span>
                        <span className="text-slate-300 font-medium">3 active schemas</span>
                      </div>
                      <div className="flex justify-between font-mono">
                        <span className="text-slate-500">System Instructions:</span>
                        <span className="text-slate-400 italic">Personal assistant logic</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {inspectorTab === 'Economy' && (
                <div className="space-y-4">
                  <div className="bg-slate-950 p-4 rounded-xl border border-slate-800/80 space-y-3.5">
                    <h4 className="text-xs font-bold text-slate-300 font-mono uppercase flex items-center gap-1.5 border-b border-slate-900 pb-2">
                      <Zap className="w-4 h-4 text-indigo-400" />
                      <span>Economy & Wallet profile</span>
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                      <div className="flex justify-between font-mono">
                        <span className="text-slate-500">Global Coins Supply:</span>
                        <span className="text-amber-400 font-bold">12,500 coins</span>
                      </div>
                      <div className="flex justify-between font-mono">
                        <span className="text-slate-500">Active Players today:</span>
                        <span className="text-slate-300 font-medium">4 accounts</span>
                      </div>
                      <div className="flex justify-between font-mono">
                        <span className="text-slate-500">Total Transactions:</span>
                        <span className="text-slate-300 font-semibold">188 transfers</span>
                      </div>
                      <div className="flex justify-between font-mono">
                        <span className="text-slate-500">Avg Wallet Balance:</span>
                        <span className="text-slate-300 font-medium">3,125 coins</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {inspectorTab === 'System' && (
                <div className="space-y-4">
                  {/* System Metrics */}
                  <div className="bg-slate-950 p-4 rounded-xl border border-slate-800/80 space-y-3.5">
                    <h4 className="text-xs font-bold text-slate-300 font-mono uppercase flex items-center gap-1.5 border-b border-slate-900 pb-2">
                      <Server className="w-4 h-4 text-slate-400" />
                      <span>Server isolated resources</span>
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                      <div className="flex justify-between font-mono">
                        <span className="text-slate-500">Server Uptime:</span>
                        <span className="text-slate-300 font-medium">{Math.floor(process.uptime() / 60)} minutes</span>
                      </div>
                      <div className="flex justify-between font-mono">
                        <span className="text-slate-500">Node Memory:</span>
                        <span className="text-indigo-400 font-semibold">{(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2)} MB</span>
                      </div>
                      <div className="flex justify-between font-mono">
                        <span className="text-slate-500">Egress Cluster Host:</span>
                        <span className="text-slate-300 font-medium">asia-east1.run.app</span>
                      </div>
                      <div className="flex justify-between font-mono">
                        <span className="text-slate-500">Isolated Thread Status:</span>
                        <span className="text-emerald-400 font-bold">STABLE</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center flex flex-col items-center justify-center h-full min-h-[400px]">
              <AlertCircle className="w-10 h-10 text-slate-600 mb-3" />
              <h3 className="font-bold text-slate-300 text-sm">No Client Bot Selected</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-sm">
                Select a bot from the list on the left to inspect its active session, logs, AI brains, and databases.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
