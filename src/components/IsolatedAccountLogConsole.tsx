import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Terminal,
  Activity,
  Play,
  Pause,
  Trash2,
  Download,
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  Clock,
  ChevronDown,
  ChevronRight,
  ShieldCheck,
  Radio,
  Zap,
  MessageSquare,
  AlertOctagon,
  RefreshCw,
  Cpu,
  Layers,
  ArrowRight,
  Database,
  Key,
  Server,
  Lock,
  User,
  Hash
} from 'lucide-react';
import { DetailedAccountLogEntry, IsolatedAccountMetrics } from '../services/AccountRuntimeLogManager';

interface IsolatedAccountLogConsoleProps {
  accountId: string;
  accountName: string;
  activeCategoryTab?: string;
  token?: string;
  onMetricsUpdate?: (metrics: IsolatedAccountMetrics) => void;
}

export const IsolatedAccountLogConsole: React.FC<IsolatedAccountLogConsoleProps> = React.memo(({
  accountId,
  accountName,
  activeCategoryTab = 'ALL',
  token,
  onMetricsUpdate
}) => {
  const [logs, setLogs] = useState<DetailedAccountLogEntry[]>([]);
  const [metrics, setMetrics] = useState<IsolatedAccountMetrics | null>(null);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [autoScroll, setAutoScroll] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [levelFilter, setLevelFilter] = useState<string>('ALL');
  const [expandedLogIds, setExpandedLogIds] = useState<Set<string>>(new Set());
  const [sseConnected, setSseConnected] = useState<boolean>(false);

  const terminalEndRef = useRef<HTMLDivElement>(null);
  const sseRef = useRef<EventSource | null>(null);

  // Initialize SSE connection for the specific selected accountId
  useEffect(() => {
    if (!accountId) return;

    // Clean up any existing SSE connection immediately when account changes
    if (sseRef.current) {
      sseRef.current.close();
      sseRef.current = null;
    }

    setLogs([]);
    setSseConnected(false);

    let eventSource: EventSource | null = null;

    const connectSSE = () => {
      try {
        const queryCategory = activeCategoryTab !== 'Overview' && activeCategoryTab !== 'Runtime Logs' ? activeCategoryTab : 'ALL';
        const url = `/api/messenger/accounts/${encodeURIComponent(accountId)}/live-logs?category=${encodeURIComponent(queryCategory)}`;
        
        eventSource = new EventSource(url);
        sseRef.current = eventSource;

        eventSource.onopen = () => {
          setSseConnected(true);
        };

        eventSource.onmessage = (event) => {
          if (isPaused) return;

          try {
            const data = JSON.parse(event.data);
            if (data.type === 'init') {
              setLogs(data.logs || []);
              if (data.metrics) {
                setMetrics(data.metrics);
                if (onMetricsUpdate) onMetricsUpdate(data.metrics);
              }
            } else if (data.type === 'log') {
              if (data.log) {
                setLogs((prev) => {
                  const updated = [...prev, data.log];
                  if (updated.length > 1500) return updated.slice(-1500);
                  return updated;
                });
              }
              if (data.metrics) {
                setMetrics(data.metrics);
                if (onMetricsUpdate) onMetricsUpdate(data.metrics);
              }
            }
          } catch (err) {
            console.error('[IsolatedAccountLogConsole] Failed to parse SSE payload:', err);
          }
        };

        eventSource.onerror = () => {
          setSseConnected(false);
          if (eventSource) eventSource.close();
        };
      } catch (err) {
        console.error('[IsolatedAccountLogConsole] SSE initialization error:', err);
        setSseConnected(false);
      }
    };

    connectSSE();

    return () => {
      if (sseRef.current) {
        sseRef.current.close();
        sseRef.current = null;
      }
    };
  }, [accountId, activeCategoryTab, isPaused]);

  // Auto-scroll to bottom on new logs
  useEffect(() => {
    if (autoScroll && terminalEndRef.current && !isPaused) {
      terminalEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, autoScroll, isPaused]);

  const handleClearLogs = useCallback(async () => {
    setLogs([]);
    try {
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;
      await fetch(`/api/messenger/accounts/${encodeURIComponent(accountId)}/logs`, {
        method: 'DELETE',
        headers
      });
    } catch (err) {
      console.error('Failed to clear logs on server:', err);
    }
  }, [accountId, token]);

  const toggleExpand = useCallback((id: string) => {
    setExpandedLogIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleExportLogs = useCallback(() => {
    const formattedText = logs
      .map(
        (l) =>
          `[${l.timestamp}] [${l.level}] [${l.category}] [Account: ${l.accountName} (${l.uid})] [Session: ${l.sessionID}] ${l.message} ${
            l.details ? JSON.stringify(l.details) : ''
          }`
      )
      .join('\n');

    const blob = new Blob([formattedText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `messenger_logs_${accountId}_${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }, [logs, accountId]);

  // Filter logs by level & search term
  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      if (levelFilter !== 'ALL' && log.level !== levelFilter) return false;
      if (searchTerm.trim() !== '') {
        const term = searchTerm.toLowerCase();
        const msgMatch = log.message.toLowerCase().includes(term);
        const catMatch = log.category.toLowerCase().includes(term);
        const modMatch = (log.sourceModule || '').toLowerCase().includes(term);
        const threadMatch = (log.threadID || '').toLowerCase().includes(term);
        const senderMatch = (log.senderUID || '').toLowerCase().includes(term);
        const sessionMatch = (log.sessionID || '').toLowerCase().includes(term);
        const corrMatch = (log.correlationID || '').toLowerCase().includes(term);
        return msgMatch || catMatch || modMatch || threadMatch || senderMatch || sessionMatch || corrMatch;
      }
      return true;
    });
  }, [logs, levelFilter, searchTerm]);

  const getLevelBadge = (level: string) => {
    switch (level) {
      case 'SUCCESS':
        return <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">SUCCESS</span>;
      case 'WARN':
        return <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-amber-500/20 text-amber-400 border border-amber-500/30">WARN</span>;
      case 'ERROR':
        return <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-rose-500/20 text-rose-400 border border-rose-500/30">ERROR</span>;
      case 'DEBUG':
        return <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-purple-500/20 text-purple-400 border border-purple-500/30">DEBUG</span>;
      default:
        return <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-sky-500/20 text-sky-400 border border-sky-500/30">INFO</span>;
    }
  };

  return (
    <div className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden shadow-2xl flex flex-col font-sans">
      {/* Console Header Bar */}
      <div className="bg-slate-900 border-b border-slate-800 px-4 py-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Terminal className="w-5 h-5 text-indigo-400" />
            <h3 className="text-sm font-bold text-white tracking-wide">
              Isolated Runtime Logs — <span className="text-indigo-400">{accountName}</span>
            </h3>
          </div>

          <div className="flex items-center gap-2">
            <span
              className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                sseConnected
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                  : 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
              }`}
            >
              <Radio className={`w-3 h-3 ${sseConnected ? 'animate-pulse text-emerald-400' : 'text-rose-400'}`} />
              {sseConnected ? 'STREAM ACTIVE' : 'RECONNECTING'}
            </span>

            <span className="text-xs text-slate-500 font-mono">
              Account ID: <code className="bg-slate-800 px-1.5 py-0.5 rounded text-slate-300">{accountId}</code>
            </span>
          </div>
        </div>

        {/* Toolbar controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsPaused(!isPaused)}
            className={`px-2.5 py-1 text-xs font-medium rounded-lg border transition flex items-center gap-1.5 ${
              isPaused
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/30 hover:bg-amber-500/30'
                : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
            }`}
          >
            {isPaused ? <Play className="w-3.5 h-3.5 text-amber-400" /> : <Pause className="w-3.5 h-3.5" />}
            {isPaused ? 'Resume Stream' : 'Pause'}
          </button>

          <button
            onClick={() => setAutoScroll(!autoScroll)}
            className={`px-2.5 py-1 text-xs font-medium rounded-lg border transition flex items-center gap-1.5 ${
              autoScroll
                ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30 hover:bg-indigo-500/30'
                : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            Auto-scroll: {autoScroll ? 'ON' : 'OFF'}
          </button>

          <button
            onClick={handleExportLogs}
            className="p-1.5 text-slate-400 hover:text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition"
            title="Export Logs (.txt)"
          >
            <Download className="w-4 h-4" />
          </button>

          <button
            onClick={handleClearLogs}
            className="p-1.5 text-slate-400 hover:text-rose-400 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition"
            title="Clear Isolated Logs"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-slate-900/60 border-b border-slate-800/80 px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-3 flex-1 min-w-[240px]">
          <div className="relative flex-1 max-w-md">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search logs by thread, sender, message, module or session..."
              className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-8 pr-3 py-1 text-slate-300 focus:outline-none focus:border-indigo-500 placeholder-slate-600 font-mono text-[11px]"
            />
          </div>

          <div className="flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5 text-slate-500" />
            <span className="text-slate-400 font-medium">Level:</span>
            <select
              value={levelFilter}
              onChange={(e) => setLevelFilter(e.target.value)}
              className="bg-slate-950 border border-slate-800 text-slate-300 rounded-lg px-2 py-1 text-[11px] focus:outline-none focus:border-indigo-500"
            >
              <option value="ALL">ALL LEVELS</option>
              <option value="INFO">INFO</option>
              <option value="SUCCESS">SUCCESS</option>
              <option value="WARN">WARN</option>
              <option value="ERROR">ERROR</option>
              <option value="DEBUG">DEBUG</option>
            </select>
          </div>
        </div>

        <div className="text-slate-500 text-[11px] font-mono">
          Showing <span className="text-indigo-400 font-semibold">{filteredLogs.length}</span> / {logs.length} entries
        </div>
      </div>

      {/* Terminal Output Area */}
      <div className="bg-slate-950 p-4 font-mono text-xs overflow-y-auto max-h-[550px] min-h-[350px] space-y-1.5 select-text">
        {filteredLogs.length === 0 ? (
          <div className="py-16 text-center text-slate-600">
            <Terminal className="w-8 h-8 mx-auto mb-2 opacity-40" />
            <p className="font-medium text-sm text-slate-500">No runtime logs captured for account [{accountName}]</p>
            <p className="text-xs text-slate-600 mt-1">Logs will stream live in real time as events occur on this account.</p>
          </div>
        ) : (
          filteredLogs.map((log) => {
            const isExpanded = expandedLogIds.has(log.id);
            return (
              <div
                key={log.id}
                className={`group border rounded-lg p-2.5 transition ${
                  log.level === 'ERROR'
                    ? 'bg-rose-950/20 border-rose-500/20 hover:border-rose-500/40'
                    : log.level === 'WARN'
                    ? 'bg-amber-950/15 border-amber-500/20 hover:border-amber-500/40'
                    : log.level === 'SUCCESS'
                    ? 'bg-emerald-950/15 border-emerald-500/20 hover:border-emerald-500/40'
                    : 'bg-slate-900/40 border-slate-800/60 hover:border-slate-700'
                }`}
              >
                <div className="flex items-start justify-between gap-2 cursor-pointer" onClick={() => toggleExpand(log.id)}>
                  <div className="flex items-start gap-2 flex-1 min-w-0 flex-wrap">
                    <span className="text-slate-500 text-[11px] font-semibold shrink-0">{log.timestamp}</span>
                    {getLevelBadge(log.level)}

                    <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-slate-800 text-indigo-300 rounded border border-slate-700 shrink-0 uppercase">
                      {log.category}
                    </span>

                    {log.sourceModule && (
                      <span className="px-1.5 py-0.5 text-[10px] bg-slate-800/80 text-slate-400 rounded border border-slate-700/60 shrink-0">
                        {log.sourceModule}
                      </span>
                    )}

                    <span className="text-slate-200 font-medium break-all flex-1">{log.message}</span>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 text-[11px]">
                    {log.executionTimeMs !== undefined && (
                      <span className="text-cyan-400 font-medium bg-cyan-950/50 px-1.5 py-0.5 rounded border border-cyan-500/20">
                        {log.executionTimeMs}ms
                      </span>
                    )}

                    {log.details && (
                      <button className="text-slate-500 group-hover:text-slate-300 transition">
                        {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                      </button>
                    )}
                  </div>
                </div>

                {/* Extended Details View */}
                {isExpanded && log.details && (
                  <div className="mt-2.5 pt-2 border-t border-slate-800/80 space-y-2 text-[11px] text-slate-300 bg-slate-950 p-2.5 rounded">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-[10px] font-mono text-slate-400 border-b border-slate-800 pb-2">
                      <div>
                        <span className="text-slate-500 block">Thread ID:</span>
                        <code className="text-indigo-300">{log.threadID || '—'}</code>
                      </div>
                      <div>
                        <span className="text-slate-500 block">Sender UID:</span>
                        <code className="text-indigo-300">{log.senderUID || '—'}</code>
                      </div>
                      <div>
                        <span className="text-slate-500 block">Session ID:</span>
                        <code className="text-emerald-400">{log.sessionID || '—'}</code>
                      </div>
                      <div>
                        <span className="text-slate-500 block">Correlation ID:</span>
                        <code className="text-slate-400">{log.correlationID || '—'}</code>
                      </div>
                    </div>

                    <pre className="text-[11px] text-indigo-200 overflow-x-auto whitespace-pre-wrap font-mono bg-slate-900/80 p-2 rounded border border-slate-800">
                      {JSON.stringify(log.details, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            );
          })
        )}
        <div ref={terminalEndRef} />
      </div>
    </div>
  );
});
