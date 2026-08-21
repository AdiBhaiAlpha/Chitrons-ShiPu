import React, { useState } from 'react';
import {
  Terminal,
  Trash2,
  Copy,
  Check,
  Search,
  Filter,
  Activity,
  AlertTriangle,
  Info,
  CheckCircle2,
  Zap
} from 'lucide-react';
import { BotLog } from '../types/shipu';

interface ConsoleTerminalProps {
  logs: BotLog[];
  onClearLogs: () => void;
}

export const ConsoleTerminal: React.FC<ConsoleTerminalProps> = React.memo(({
  logs,
  onClearLogs
}) => {
  const [filterLevel, setFilterLevel] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);

  const filteredLogs = logs.filter(log => {
    const matchesLevel = filterLevel === 'all' || log.level === filterLevel;
    const matchesSearch =
      log.message.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.source.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesLevel && matchesSearch;
  });

  const handleCopy = () => {
    const text = filteredLogs
      .map(l => `[${l.timestamp}] [${l.level.toUpperCase()}] [${l.source}] ${l.message}`)
      .join('\n');
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getLevelBadge = (level: BotLog['level']) => {
    switch (level) {
      case 'command':
        return <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold text-[10px]">CMD</span>;
      case 'event':
        return <span className="px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 font-bold text-[10px]">EVENT</span>;
      case 'error':
        return <span className="px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 font-bold text-[10px]">ERROR</span>;
      case 'warn':
        return <span className="px-2 py-0.5 rounded bg-yellow-500/20 text-yellow-300 font-bold text-[10px]">WARN</span>;
      default:
        return <span className="px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 font-bold text-[10px]">INFO</span>;
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      
      {/* Header & Controls */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <Terminal className="w-6 h-6 text-indigo-400" /> Live Console & Engine Terminal
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Real-time stdout, command execution logs, dispatcher events, and exception traces for ShiPu Ai.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={handleCopy}
            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-medium border border-slate-700 transition flex items-center gap-1.5"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Copied!' : 'Copy Logs'}</span>
          </button>

          <button
            onClick={onClearLogs}
            className="px-3.5 py-2 bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 rounded-xl text-xs font-medium border border-rose-500/30 transition flex items-center gap-1.5"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Clear Logs</span>
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between bg-slate-900 p-4 rounded-2xl border border-slate-800">
        
        <div className="flex items-center space-x-1.5 overflow-x-auto w-full sm:w-auto no-scrollbar">
          {['all', 'command', 'event', 'info', 'warn', 'error'].map(lvl => (
            <button
              key={lvl}
              onClick={() => setFilterLevel(lvl)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold uppercase transition whitespace-nowrap ${
                filterLevel === lvl
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                  : 'bg-slate-800/80 text-slate-400 hover:text-slate-200'
              }`}
            >
              {lvl}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Filter log messages..."
            className="w-full bg-slate-950 text-slate-100 placeholder-slate-500 text-xs pl-9 pr-3 py-2 rounded-xl border border-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
      </div>

      {/* Terminal Display */}
      <div className="bg-slate-950 border border-slate-800 rounded-3xl p-6 shadow-2xl font-mono text-xs text-slate-300 h-[500px] overflow-y-auto space-y-2">
        {filteredLogs.length === 0 ? (
          <div className="text-slate-600 text-center py-20">No logs found matching your filter criteria.</div>
        ) : (
          filteredLogs.map(log => (
            <div key={log.id} className="flex items-start space-x-3 hover:bg-slate-900/60 p-1.5 rounded-lg transition">
              <span className="text-slate-500 shrink-0 font-sans text-[11px]">{log.timestamp}</span>
              <div className="shrink-0">{getLevelBadge(log.level)}</div>
              <span className="text-indigo-400 font-bold shrink-0">[{log.source}]</span>
              <span className="text-slate-200 break-all">{log.message}</span>
            </div>
          ))
        )}
      </div>

    </div>
  );
});

