import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
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
  ArrowDownCircle,
  MessageSquare,
  AlertOctagon,
  RefreshCw,
  Cpu
} from 'lucide-react';
import {
  MessengerLogEntry,
  MessengerEngineStats,
  DiagnosticPipelineStage,
  LogLevel,
  LogCategory
} from '../adapters/messenger/MessengerLogger';

interface LiveMessengerLogConsoleProps {
  token?: string;
}

export const LiveMessengerLogConsole: React.FC<LiveMessengerLogConsoleProps> = React.memo(({ token }) => {
  const [logs, setLogs] = useState<MessengerLogEntry[]>([]);
  const [stats, setStats] = useState<MessengerEngineStats | null>(null);
  const [pipeline, setPipeline] = useState<DiagnosticPipelineStage[]>([]);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [autoScroll, setAutoScroll] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [levelFilter, setLevelFilter] = useState<string>('ALL');
  const [showPipeline, setShowPipeline] = useState<boolean>(true);
  const [expandedLogIds, setExpandedLogIds] = useState<Set<string>>(new Set());
  const [sseConnected, setSseConnected] = useState<boolean>(false);

  const terminalEndRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const sseRef = useRef<EventSource | null>(null);

  // Initialize SSE connection
  useEffect(() => {
    let eventSource: EventSource | null = null;

    const connectSSE = () => {
      try {
        eventSource = new EventSource('/api/messenger/live-logs');
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
              if (data.stats) setStats(data.stats);
              if (data.pipeline) setPipeline(data.pipeline);
            } else if (data.type === 'log') {
              if (data.log) {
                setLogs((prev) => {
                  const updated = [...prev, data.log];
                  if (updated.length > 2000) return updated.slice(-2000);
                  return updated;
                });
              }
              if (data.stats) setStats(data.stats);
              if (data.pipeline) setPipeline(data.pipeline);
            }
          } catch (err) {
            console.error('Failed to parse SSE payload:', err);
          }
        };

        eventSource.onerror = () => {
          setSseConnected(false);
          eventSource?.close();
          // Retry SSE after 3s
          setTimeout(connectSSE, 3000);
        };
      } catch (err) {
        console.error('SSE initialization error:', err);
        setSseConnected(false);
      }
    };

    connectSSE();

    return () => {
      if (sseRef.current) {
        sseRef.current.close();
      }
    };
  }, [isPaused]);

  // Auto-scroll logic
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
      await fetch('/api/messenger/logs', { method: 'DELETE', headers });
    } catch (err) {
      console.error('Failed to clear logs on server:', err);
    }
  }, [token]);

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
          `[${l.timestamp}] [${l.level}] [${l.category}] ${l.message} ${
            l.details ? JSON.stringify(l.details) : ''
          }`
      )
      .join('\n');

    const blob = new Blob([formattedText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `shipu_messenger_live_logs_${Date.now()}.log`;
    a.click();
    URL.revokeObjectURL(url);
  }, [logs]);

  // Filtered logs optimization
  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      // Category filter
      if (categoryFilter !== 'ALL' && log.category !== categoryFilter) return false;
      // Level filter
      if (levelFilter !== 'ALL' && log.level !== levelFilter) return false;
      // Search term
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        const msgMatch = log.message.toLowerCase().includes(term);
        const catMatch = log.category.toLowerCase().includes(term);
        const detailsMatch = log.details ? JSON.stringify(log.details).toLowerCase().includes(term) : false;
        return msgMatch || catMatch || detailsMatch;
      }
      return true;
    });
  }, [logs, categoryFilter, levelFilter, searchTerm]);

  const getLevelBadgeClass = (level: LogLevel) => {
    switch (level) {
      case 'SUCCESS':
        return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40';
      case 'ERROR':
        return 'bg-rose-500/20 text-rose-400 border-rose-500/40';
      case 'WARN':
        return 'bg-amber-500/20 text-amber-300 border-amber-500/40';
      case 'DEBUG':
        return 'bg-cyan-500/20 text-cyan-400 border-cyan-500/40';
      case 'INFO':
      default:
        return 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40';
    }
  };

  const getCategoryBadgeClass = (cat: LogCategory) => {
    switch (cat) {
      case 'AUTH':
      case 'COOKIE':
        return 'text-amber-300 bg-amber-950/60 border-amber-800/60';
      case 'MQTT':
        return 'text-cyan-300 bg-cyan-950/60 border-cyan-800/60';
      case 'MESSAGE':
      case 'EVENT':
        return 'text-emerald-300 bg-emerald-950/60 border-emerald-800/60';
      case 'COMMAND':
        return 'text-purple-300 bg-purple-950/60 border-purple-800/60';
      case 'SEND':
      case 'REPLY':
        return 'text-indigo-300 bg-indigo-950/60 border-indigo-800/60';
      case 'SEEN':
      case 'TYPING':
      case 'REACTION':
        return 'text-blue-300 bg-blue-950/60 border-blue-800/60';
      case 'ERROR':
        return 'text-rose-300 bg-rose-950/60 border-rose-800/60';
      default:
        return 'text-slate-300 bg-slate-900 border-slate-700';
    }
  };

  return (
    <div className="bg-slate-950 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden space-y-0">
      
      {/* Header bar */}
      <div className="bg-slate-900 border-b border-slate-800 p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        
        {/* Title and Live status */}
        <div className="flex items-center space-x-3">
          <div className="p-2.5 bg-indigo-900/40 border border-indigo-700/50 rounded-2xl">
            <Terminal className="w-5 h-5 text-indigo-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-slate-100 tracking-wider uppercase font-mono">
                LIVE MESSENGER ENGINE LOG
              </h3>
              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border flex items-center gap-1 ${
                sseConnected ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
              }`}>
                <span className={`w-2 h-2 rounded-full ${sseConnected ? 'bg-emerald-400 animate-ping' : 'bg-amber-400'}`}></span>
                {sseConnected ? '● LIVE' : 'CONNECTING SSE...'}
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Real-time Facebook Messenger MQTT event stream & diagnostic pipeline
            </p>
          </div>
        </div>

        {/* Counter Pills */}
        <div className="flex items-center flex-wrap gap-2 text-xs font-mono">
          <div className="px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl flex items-center gap-1.5 text-slate-300">
            <Activity className="w-3.5 h-3.5 text-indigo-400" />
            <span>Events:</span>
            <strong className="text-indigo-300">{stats?.eventsCount || 0}</strong>
          </div>

          <div className="px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl flex items-center gap-1.5 text-slate-300">
            <MessageSquare className="w-3.5 h-3.5 text-emerald-400" />
            <span>Messages:</span>
            <strong className="text-emerald-300">{stats?.messagesCount || 0}</strong>
          </div>

          <div className="px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl flex items-center gap-1.5 text-slate-300">
            <AlertOctagon className="w-3.5 h-3.5 text-rose-400" />
            <span>Errors:</span>
            <strong className="text-rose-400">{stats?.errorsCount || 0}</strong>
          </div>

          <div className="px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl flex items-center gap-1.5 text-slate-300">
            <RefreshCw className="w-3.5 h-3.5 text-amber-400" />
            <span>Reconnects:</span>
            <strong className="text-amber-300">{stats?.reconnectsCount || 0}</strong>
          </div>
        </div>

      </div>

      {/* Listening Status Test Bar */}
      <div className="bg-slate-900/60 border-b border-slate-800 px-5 py-2.5 flex flex-wrap items-center justify-between text-xs font-mono text-slate-300 gap-2">
        <div className="flex items-center gap-2">
          <Radio className="w-4 h-4 text-emerald-400 animate-pulse" />
          <span className="text-slate-400">Listener Test:</span>
          <span className="text-emerald-300 font-bold">
            {stats?.mqttStatus === 'EVENT_STREAM_ACTIVE'
              ? '● EVENT STREAM ACTIVE (Real Facebook Events Received)'
              : stats?.mqttStatus === 'WAITING_FOR_FIRST_EVENT'
              ? '⚡ WAITING FOR FIRST REAL EVENT (Send message on FB Messenger)'
              : stats?.fbStatus === 'AUTH_BLOCKED'
              ? '🛑 AUTH BLOCKED (Checkpoint / Security Action Required)'
              : `STATE: ${stats?.mqttStatus || 'OFF'}`}
          </span>
        </div>

        <div className="flex items-center gap-4 text-[11px] text-slate-400">
          <span>FB Status: <strong className="text-slate-200">{stats?.fbStatus || 'OFF'}</strong></span>
          <span>Last Event: <strong className="text-slate-200">{stats?.lastEventTime || 'None'}</strong></span>
          <span>Uptime: <strong className="text-indigo-300">{stats?.uptimeSeconds || 0}s</strong></span>
        </div>
      </div>

      {/* Diagnostic Pipeline Visualization Accordion Header */}
      <div className="bg-slate-900/40 border-b border-slate-800/80 px-4 py-2 flex items-center justify-between">
        <button
          onClick={() => setShowPipeline(!showPipeline)}
          className="text-xs font-bold text-slate-300 hover:text-indigo-400 flex items-center gap-2 font-mono transition"
        >
          {showPipeline ? <ChevronDown className="w-4 h-4 text-indigo-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
          <Zap className="w-3.5 h-3.5 text-amber-400" />
          <span>FIRST MESSAGE DIAGNOSTIC PIPELINE TRACE</span>
        </button>
        <span className="text-[10px] text-slate-500 font-mono">12 Automated Checkpoints</span>
      </div>

      {/* Diagnostic Pipeline Cards Grid */}
      {showPipeline && pipeline.length > 0 && (
        <div className="p-4 bg-slate-950/80 border-b border-slate-800 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2 font-mono text-[11px]">
          {pipeline.map((stage, i) => (
            <div
              key={stage.stage}
              className={`p-2.5 rounded-xl border flex flex-col justify-between space-y-1 transition ${
                stage.status === 'success'
                  ? 'bg-emerald-950/30 border-emerald-800/60 text-emerald-300'
                  : stage.status === 'failed'
                  ? 'bg-rose-950/30 border-rose-800/60 text-rose-300'
                  : stage.status === 'skipped'
                  ? 'bg-slate-900 border-slate-800 text-slate-400'
                  : 'bg-slate-900/50 border-slate-800 text-slate-500'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] opacity-60">#{i + 1}</span>
                {stage.status === 'success' && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />}
                {stage.status === 'failed' && <XCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />}
                {stage.status === 'pending' && <Clock className="w-3.5 h-3.5 text-slate-600 shrink-0" />}
              </div>
              <span className="font-semibold line-clamp-1">{stage.label}</span>
              <span className="text-[9px] opacity-75 truncate">{stage.details || (stage.status === 'success' ? 'PASSED' : 'WAITING')}</span>
            </div>
          ))}
        </div>
      )}

      {/* Toolbar / Search & Filter Controls */}
      <div className="p-3 bg-slate-900/80 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
        
        {/* Search input */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search log messages, sender UIDs, threads..."
            className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-1.5 text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-xs font-mono"
          />
        </div>

        {/* Filter selects */}
        <div className="flex items-center gap-2">
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-slate-300 font-mono text-xs focus:outline-none"
          >
            <option value="ALL">Category: ALL</option>
            <option value="AUTH">AUTH</option>
            <option value="MQTT">MQTT</option>
            <option value="MESSAGE">MESSAGE</option>
            <option value="COMMAND">COMMAND</option>
            <option value="SEND">SEND</option>
            <option value="SEEN">SEEN</option>
            <option value="EVENT">EVENT</option>
            <option value="COOKIE">COOKIE</option>
            <option value="SYSTEM">SYSTEM</option>
          </select>

          <select
            value={levelFilter}
            onChange={(e) => setLevelFilter(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-slate-300 font-mono text-xs focus:outline-none"
          >
            <option value="ALL">Level: ALL</option>
            <option value="INFO">INFO</option>
            <option value="SUCCESS">SUCCESS</option>
            <option value="WARN">WARN</option>
            <option value="ERROR">ERROR</option>
            <option value="DEBUG">DEBUG</option>
          </select>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsPaused(!isPaused)}
            className={`px-3 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition ${
              isPaused
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
            }`}
          >
            {isPaused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
            <span>{isPaused ? 'Resume' : 'Pause'}</span>
          </button>

          <button
            onClick={() => setAutoScroll(!autoScroll)}
            className={`px-3 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition ${
              autoScroll
                ? 'bg-indigo-600/30 text-indigo-300 border-indigo-500/40'
                : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700'
            }`}
          >
            <ArrowDownCircle className="w-3.5 h-3.5" />
            <span>Scroll</span>
          </button>

          <button
            onClick={handleExportLogs}
            className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl border border-slate-700 transition"
            title="Export Logs TXT"
          >
            <Download className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={handleClearLogs}
            className="p-1.5 bg-rose-950/40 hover:bg-rose-900/50 text-rose-300 border border-rose-800/60 rounded-xl transition"
            title="Clear Log Buffer"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>

      </div>

      {/* Terminal Log Output List */}
      <div
        ref={containerRef}
        className="p-4 bg-slate-950 font-mono text-[12px] leading-relaxed max-h-[500px] overflow-y-auto space-y-2 select-text"
      >
        {filteredLogs.length === 0 ? (
          <div className="py-12 text-center text-slate-600 space-y-2">
            <Terminal className="w-8 h-8 text-slate-700 mx-auto" />
            <p className="text-xs">No live log entries match your filter criteria.</p>
          </div>
        ) : (
          filteredLogs.map((entry) => {
            const isExpanded = expandedLogIds.has(entry.id);
            const hasDetails = !!entry.details && Object.keys(entry.details).length > 0;

            return (
              <div key={entry.id} className="group border-b border-slate-900/60 pb-1 hover:bg-slate-900/30 rounded px-1 transition">
                <div className="flex flex-wrap items-baseline gap-2">
                  
                  {/* Expand toggle */}
                  {hasDetails ? (
                    <button
                      onClick={() => toggleExpand(entry.id)}
                      className="text-slate-500 hover:text-indigo-400"
                    >
                      {isExpanded ? <ChevronDown className="w-3 h-3 inline" /> : <ChevronRight className="w-3 h-3 inline" />}
                    </button>
                  ) : (
                    <span className="w-3 inline-block"></span>
                  )}

                  {/* Timestamp */}
                  <span className="text-slate-500 text-[11px]">[{entry.timestamp}]</span>

                  {/* Level Badge */}
                  <span
                    className={`px-1.5 py-0.2 rounded text-[10px] font-bold border uppercase tracking-wider ${getLevelBadgeClass(
                      entry.level
                    )}`}
                  >
                    {entry.level}
                  </span>

                  {/* Category Badge */}
                  <span
                    className={`px-1.5 py-0.2 rounded text-[10px] font-semibold border ${getCategoryBadgeClass(
                      entry.category
                    )}`}
                  >
                    [{entry.category}]
                  </span>

                  {/* Message Body */}
                  <span className="text-slate-200 font-sans sm:font-mono font-medium flex-1">
                    {entry.message}
                  </span>

                </div>

                {/* Collapsible Details Inspector */}
                {isExpanded && hasDetails && (
                  <div className="mt-2 ml-6 p-3 bg-slate-900 border border-slate-800 rounded-xl text-[11px] text-indigo-200 overflow-x-auto space-y-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      Metadata / Diagnostics
                    </span>
                    <pre className="text-emerald-300 font-mono whitespace-pre-wrap">
                      {JSON.stringify(entry.details, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            );
          })
        )}
        <div ref={terminalEndRef} />
      </div>

      {/* Terminal Footer Info */}
      <div className="bg-slate-900 px-4 py-2 border-t border-slate-800 flex items-center justify-between text-[11px] font-mono text-slate-500">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />
          <span>Zero Cookie Leakage Active</span>
        </div>
        <div>
          <span>Showing <strong>{filteredLogs.length}</strong> / <strong>{logs.length}</strong> buffered logs</span>
        </div>
      </div>

    </div>
  );
});
