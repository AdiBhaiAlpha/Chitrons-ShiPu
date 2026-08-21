import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  RefreshCw,
  Clock,
  User,
  CheckCircle2,
  AlertTriangle,
  Trash2,
  Filter,
  Search,
  Terminal,
  Info,
  AlertCircle,
  Zap,
  Activity,
  Layers
} from 'lucide-react';
import { BotLog } from '../types/shipu';

interface AuditLogItem {
  id: string;
  admin: string;
  action: string;
  timestamp: string;
  target?: string;
  result: string;
}

interface AuditLogViewProps {
  token?: string;
}

export const AuditLogView: React.FC<AuditLogViewProps> = ({ token }) => {
  const [activeTab, setActiveTab] = useState<'system' | 'audit'>('system');
  const [systemLogs, setSystemLogs] = useState<BotLog[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [clearing, setClearing] = useState<boolean>(false);
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Filter States
  const [selectedLevel, setSelectedLevel] = useState<string>('ALL');
  const [selectedService, setSelectedService] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  useEffect(() => {
    fetchAllLogs();
  }, [token]);

  const fetchAllLogs = async () => {
    setLoading(true);
    setActionMessage(null);
    try {
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const [sysRes, auditRes] = await Promise.all([
        fetch('/api/bot/logs'),
        fetch('/api/audit-logs', { headers })
      ]);

      if (sysRes.ok) {
        const sysData = await sysRes.json();
        if (Array.isArray(sysData)) setSystemLogs(sysData);
      }

      if (auditRes.ok) {
        const auditData = await auditRes.json();
        if (Array.isArray(auditData)) setAuditLogs(auditData);
      }
    } catch (err) {
      console.error('Failed to fetch logs:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleClearLogs = async () => {
    if (!confirm('Are you sure you want to clear all system logs?')) return;

    setClearing(true);
    setActionMessage(null);
    try {
      const authToken = token || 'default_admin_session';
      const res = await fetch('/api/bot/logs', {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setActionMessage({ type: 'success', text: 'System logs cleared successfully.' });
        await fetchAllLogs();
      } else {
        setActionMessage({ type: 'error', text: data.error || 'Failed to clear system logs.' });
      }
    } catch (err: any) {
      setActionMessage({ type: 'error', text: `Error clearing logs: ${err.message}` });
    } finally {
      setClearing(false);
    }
  };

  // Derive unique service/source names dynamically from real system logs
  const availableServices = Array.from(
    new Set(systemLogs.map(log => log.source).filter(Boolean))
  ).sort();

  // Filter system logs dynamically
  const filteredSystemLogs = systemLogs.filter(log => {
    // Level match
    if (selectedLevel !== 'ALL' && log.level.toLowerCase() !== selectedLevel.toLowerCase()) {
      return false;
    }
    // Service match
    if (selectedService !== 'ALL' && log.source !== selectedService) {
      return false;
    }
    // Search query match
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchMsg = log.message.toLowerCase().includes(q);
      const matchSource = log.source.toLowerCase().includes(q);
      const matchLevel = log.level.toLowerCase().includes(q);
      if (!matchMsg && !matchSource && !matchLevel) return false;
    }
    return true;
  });

  const getLevelBadge = (level: BotLog['level']) => {
    const lvl = level.toLowerCase();
    switch (lvl) {
      case 'error':
        return (
          <span className="px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 font-bold text-[10px] border border-rose-500/30 flex items-center gap-1 inline-flex">
            <AlertCircle className="w-3 h-3" /> ERROR
          </span>
        );
      case 'warn':
      case 'warning':
        return (
          <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold text-[10px] border border-amber-500/30 flex items-center gap-1 inline-flex">
            <AlertTriangle className="w-3 h-3" /> WARN
          </span>
        );
      case 'command':
        return (
          <span className="px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 font-bold text-[10px] border border-purple-500/30 flex items-center gap-1 inline-flex">
            <Zap className="w-3 h-3" /> CMD
          </span>
        );
      case 'event':
        return (
          <span className="px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 font-bold text-[10px] border border-cyan-500/30 flex items-center gap-1 inline-flex">
            <Activity className="w-3 h-3" /> EVENT
          </span>
        );
      default: // info
        return (
          <span className="px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 font-bold text-[10px] border border-blue-500/30 flex items-center gap-1 inline-flex">
            <Info className="w-3 h-3" /> INFO
          </span>
        );
    }
  };

  // Calculate live counts from real logs
  const totalCount = systemLogs.length;
  const infoCount = systemLogs.filter(l => l.level.toLowerCase() === 'info').length;
  const warnCount = systemLogs.filter(l => l.level.toLowerCase() === 'warn' || l.level.toLowerCase() === 'warning').length;
  const errorCount = systemLogs.filter(l => l.level.toLowerCase() === 'error').length;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      
      {/* Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <Terminal className="w-6 h-6 text-indigo-400" /> System Logs & Audit Trail
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Real-time engine logs, error diagnostics, service traces, and administrative audit records.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={fetchAllLogs}
            disabled={loading}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl border border-slate-700 transition flex items-center gap-2"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh Logs</span>
          </button>

          <button
            onClick={handleClearLogs}
            disabled={clearing || systemLogs.length === 0}
            className="px-4 py-2 bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 disabled:opacity-50 text-xs font-semibold rounded-xl border border-rose-500/30 transition flex items-center gap-2"
          >
            <Trash2 className={`w-3.5 h-3.5 ${clearing ? 'animate-spin' : ''}`} />
            <span>Clear Logs</span>
          </button>
        </div>
      </div>

      {/* Action Notification Message */}
      {actionMessage && (
        <div className={`p-4 rounded-2xl border text-xs font-semibold flex items-center justify-between ${
          actionMessage.type === 'success'
            ? 'bg-emerald-950/40 border-emerald-800/60 text-emerald-300'
            : 'bg-rose-950/40 border-rose-800/60 text-rose-300'
        }`}>
          <div className="flex items-center gap-2">
            {actionMessage.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <AlertCircle className="w-4 h-4 text-rose-400" />}
            <span>{actionMessage.text}</span>
          </div>
          <button onClick={() => setActionMessage(null)} className="text-slate-400 hover:text-slate-200">✕</button>
        </div>
      )}

      {/* Navigation Tabs (System Logs vs Audit Trail) */}
      <div className="flex border-b border-slate-800 gap-4">
        <button
          onClick={() => setActiveTab('system')}
          className={`pb-3 text-xs font-bold transition flex items-center gap-2 border-b-2 ${
            activeTab === 'system'
              ? 'border-indigo-500 text-indigo-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Terminal className="w-4 h-4" /> System & Engine Logs ({systemLogs.length})
        </button>

        <button
          onClick={() => setActiveTab('audit')}
          className={`pb-3 text-xs font-bold transition flex items-center gap-2 border-b-2 ${
            activeTab === 'audit'
              ? 'border-indigo-500 text-indigo-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <ShieldAlert className="w-4 h-4" /> Admin Action Audit Trail ({auditLogs.length})
        </button>
      </div>

      {activeTab === 'system' && (
        <>
          {/* Summary Badges derived from real logs */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-slate-900 border border-slate-800 p-3.5 rounded-2xl flex items-center justify-between">
              <span className="text-xs text-slate-400 font-medium">Total Captured Logs</span>
              <span className="text-sm font-bold text-slate-100 font-mono">{totalCount}</span>
            </div>
            <div className="bg-slate-900 border border-slate-800 p-3.5 rounded-2xl flex items-center justify-between">
              <span className="text-xs text-slate-400 font-medium flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5 text-blue-400" /> INFO Logs
              </span>
              <span className="text-sm font-bold text-blue-400 font-mono">{infoCount}</span>
            </div>
            <div className="bg-slate-900 border border-slate-800 p-3.5 rounded-2xl flex items-center justify-between">
              <span className="text-xs text-slate-400 font-medium flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-400" /> WARN Logs
              </span>
              <span className="text-sm font-bold text-amber-400 font-mono">{warnCount}</span>
            </div>
            <div className="bg-slate-900 border border-slate-800 p-3.5 rounded-2xl flex items-center justify-between">
              <span className="text-xs text-slate-400 font-medium flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 text-rose-400" /> ERROR Logs
              </span>
              <span className="text-sm font-bold text-rose-400 font-mono">{errorCount}</span>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl flex flex-col md:flex-row gap-4 items-stretch md:items-center justify-between">
            
            {/* Level Filter Buttons */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 no-scrollbar">
              <span className="text-xs text-slate-400 font-semibold mr-1 flex items-center gap-1">
                <Filter className="w-3.5 h-3.5 text-indigo-400" /> Level:
              </span>
              {['ALL', 'INFO', 'WARN', 'ERROR', 'COMMAND', 'EVENT'].map(lvl => (
                <button
                  key={lvl}
                  onClick={() => setSelectedLevel(lvl)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold uppercase transition whitespace-nowrap ${
                    selectedLevel === lvl
                      ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                      : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {lvl}
                </button>
              ))}
            </div>

            {/* Service & Search Filters */}
            <div className="flex flex-col sm:flex-row items-center gap-3">
              {/* Service Dropdown */}
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <label className="text-xs text-slate-400 font-semibold flex items-center gap-1 whitespace-nowrap">
                  <Layers className="w-3.5 h-3.5 text-indigo-400" /> Service:
                </label>
                <select
                  value={selectedService}
                  onChange={e => setSelectedService(e.target.value)}
                  className="bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 w-full sm:w-44"
                >
                  <option value="ALL">All Services ({availableServices.length})</option>
                  {availableServices.map(svc => (
                    <option key={svc} value={svc}>
                      {svc}
                    </option>
                  ))}
                </select>
              </div>

              {/* Search Field */}
              <div className="relative w-full sm:w-56">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search logs..."
                  className="w-full bg-slate-950 text-slate-100 placeholder-slate-500 text-xs pl-9 pr-3 py-2 rounded-xl border border-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

          </div>

          {/* System Logs Table */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-950/80 border-b border-slate-800 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                    <th className="p-4 pl-6 w-32">Timestamp</th>
                    <th className="p-4 w-28">Level</th>
                    <th className="p-4 w-36">Service</th>
                    <th className="p-4 pr-6">Log Message</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80 text-slate-200 font-mono">
                  {filteredSystemLogs.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="p-8 text-center text-slate-500 font-sans">
                        {systemLogs.length === 0
                          ? 'No system logs recorded in memory.'
                          : 'No logs match your filter criteria.'}
                      </td>
                    </tr>
                  ) : (
                    filteredSystemLogs.map(log => (
                      <tr key={log.id} className="hover:bg-slate-800/50 transition">
                        <td className="p-4 pl-6 text-slate-400 font-sans text-[11px] whitespace-nowrap">
                          {log.timestamp}
                        </td>
                        <td className="p-4 whitespace-nowrap">{getLevelBadge(log.level)}</td>
                        <td className="p-4 font-bold text-indigo-300 font-sans whitespace-nowrap">
                          <span className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-[11px]">
                            {log.source || 'Engine'}
                          </span>
                        </td>
                        <td className="p-4 pr-6 text-slate-200 font-sans break-words">{log.message}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {activeTab === 'audit' && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-950/80 border-b border-slate-800 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  <th className="p-4 pl-6">Timestamp</th>
                  <th className="p-4">Admin User</th>
                  <th className="p-4">Action Description</th>
                  <th className="p-4">Target Resource</th>
                  <th className="p-4 pr-6 text-right">Result</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-slate-200 font-mono">
                {auditLogs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-slate-500 font-sans">
                      No admin audit actions recorded yet.
                    </td>
                  </tr>
                ) : (
                  auditLogs.map(log => (
                    <tr key={log.id} className="hover:bg-slate-800/50 transition">
                      <td className="p-4 pl-6 text-slate-400 font-sans text-[11px]">
                        {log.timestamp ? new Date(log.timestamp).toLocaleString() : 'N/A'}
                      </td>
                      <td className="p-4 font-bold text-indigo-300 font-sans flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-indigo-400" /> {log.admin}
                      </td>
                      <td className="p-4 font-sans font-semibold text-slate-100">{log.action}</td>
                      <td className="p-4 text-slate-400">{log.target || 'System Global'}</td>
                      <td className="p-4 pr-6 text-right font-sans">
                        <span className={`px-2.5 py-0.5 rounded text-[10px] font-bold ${
                          log.result === 'SUCCESS' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'
                        }`}>
                          {log.result}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

    </div>
  );
};
