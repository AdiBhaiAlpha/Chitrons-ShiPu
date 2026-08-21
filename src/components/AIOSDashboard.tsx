import React, { useState, useEffect, useCallback } from 'react';
import {
  Sparkles,
  Cpu,
  Coins,
  Brain,
  Trash2,
  History,
  User,
  RefreshCw,
  AlertTriangle,
  Activity,
  Eye,
  BookOpen,
  Search,
  MessageSquare,
  Flame,
  CheckCircle2,
  Clock
} from 'lucide-react';
import { safeFetchJson } from '../lib/fetchUtils';

interface AIOSDashboardProps {
  token: string;
}

interface AIOSAnalytics {
  totalSessions: number;
  brainHits: number;
  llmCalls: number;
  totalMessages: number;
  coinsSpent: number;
  premiumResets: number;
  activeSessionsCount: number;
  expiredSessionsCount: number;
  brainHitRate: number;
  usages: any[];
}

interface AIOSSession {
  _id: string;
  userID: string;
  threadID: string;
  activatedAt: string;
  expiresAt: string;
  status: 'active' | 'expired';
}

interface AIOSMemory {
  _id: string;
  userID: string;
  facts: { [key: string]: string };
  conversationContext: any[];
  selectedPersonality: string;
  mood: string;
  cooldownUntil: string | null;
  updatedAt: string;
}

export const AIOSDashboard: React.FC<AIOSDashboardProps> = React.memo(({ token }) => {
  const [analytics, setAnalytics] = useState<AIOSAnalytics | null>(null);
  const [sessions, setSessions] = useState<AIOSSession[]>([]);
  const [memories, setMemories] = useState<AIOSMemory[]>([]);
  const [aiLogs, setAiLogs] = useState<any[]>([]);
  const [aiMetrics, setAiMetrics] = useState<any | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedMemory, setSelectedMemory] = useState<AIOSMemory | null>(null);

  // Toast feedback state
  const [actionFeedback, setActionFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const showFeedback = (type: 'success' | 'error', message: string) => {
    setActionFeedback({ type, message });
    setTimeout(() => {
      setActionFeedback(null);
    }, 4000);
  };

  const fetchData = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    else setRefreshing(true);
    setError(null);

    try {
      const [resAnalytics, resSessions, resMemories, resLogs] = await Promise.all([
        safeFetchJson('/api/aios/analytics', null),
        safeFetchJson('/api/aios/sessions', []),
        safeFetchJson('/api/aios/memories', []),
        safeFetchJson('/api/aios/logs', { logs: [], metrics: null })
      ]);

      if (resAnalytics && !resAnalytics.error) setAnalytics(resAnalytics);
      if (resSessions && Array.isArray(resSessions)) setSessions(resSessions);
      if (resMemories && Array.isArray(resMemories)) setMemories(resMemories);
      if (resLogs) {
        setAiLogs(resLogs.logs || []);
        setAiMetrics(resLogs.metrics || null);
      }

    } catch (err: any) {
      console.error('Error fetching AIOS data:', err);
      setError('Failed to sync state from AIOS models. Ensure MongoDB is connected and running.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(() => fetchData(true), 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  // Action handlers
  const handleTerminateSession = async (sessionId: string) => {
    try {
      const res = await fetch(`/api/aios/sessions/${sessionId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showFeedback('success', 'Active AIOS session terminated and cooldown cleared.');
        fetchData(true);
      } else {
        showFeedback('error', data.error || 'Failed to terminate session.');
      }
    } catch (err: any) {
      showFeedback('error', err.message);
    }
  };

  const handleResetCooldown = async (memoryId: string, userID: string) => {
    try {
      const res = await fetch(`/api/aios/memories/${memoryId}/reset-cooldown`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showFeedback('success', `Cooldown successfully reset for user ${userID}.`);
        fetchData(true);
      } else {
        showFeedback('error', data.error || 'Failed to reset cooldown.');
      }
    } catch (err: any) {
      showFeedback('error', err.message);
    }
  };

  const handleClearContext = async (memoryId: string, userID: string) => {
    try {
      const res = await fetch(`/api/aios/memories/${memoryId}/clear-context`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showFeedback('success', `Gemini conversation context cleared for user ${userID}.`);
        fetchData(true);
      } else {
        showFeedback('error', data.error || 'Failed to clear context.');
      }
    } catch (err: any) {
      showFeedback('error', err.message);
    }
  };

  const handleDeleteMemoryProfile = async (memoryId: string, userID: string) => {
    if (!window.confirm(`Are you sure you want to permanently delete all AIOS memories and settings for user ${userID}?`)) return;
    try {
      const res = await fetch(`/api/aios/memories/${memoryId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showFeedback('success', `Memory profile for user ${userID} has been deleted.`);
        if (selectedMemory?._id === memoryId) setSelectedMemory(null);
        fetchData(true);
      } else {
        showFeedback('error', data.error || 'Failed to delete memory.');
      }
    } catch (err: any) {
      showFeedback('error', err.message);
    }
  };

  const isCooldownActive = (cooldownUntil: string | null) => {
    if (!cooldownUntil) return false;
    return new Date(cooldownUntil) > new Date();
  };

  const formatTimeRemaining = (cooldownUntil: string | null) => {
    if (!cooldownUntil) return '';
    const diff = new Date(cooldownUntil).getTime() - Date.now();
    if (diff <= 0) return '';
    const mins = Math.ceil(diff / 60000);
    return `${mins}m left`;
  };

  // Filtered memory list
  const filteredMemories = memories.filter(m => {
    const query = searchQuery.toLowerCase().trim();
    if (!query) return true;
    return (
      m.userID.toLowerCase().includes(query) ||
      m.selectedPersonality.toLowerCase().includes(query) ||
      m.mood.toLowerCase().includes(query) ||
      Object.keys(m.facts).some(k => k.toLowerCase().includes(query)) ||
      Object.values(m.facts).some(v => String(v).toLowerCase().includes(query))
    );
  });

  return (
    <div className="space-y-6">
      
      {/* Action Toast Feedback */}
      {actionFeedback && (
        <div className={`fixed bottom-6 right-6 z-50 px-5 py-3 rounded-xl shadow-2xl flex items-center gap-3 border transition-all animate-in fade-in slide-in-from-bottom-5 duration-200 ${
          actionFeedback.type === 'success' 
            ? 'bg-emerald-950 border-emerald-500/30 text-emerald-300' 
            : 'bg-rose-950 border-rose-500/30 text-rose-300'
        }`}>
          {actionFeedback.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          ) : (
            <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
          )}
          <span className="text-xs font-semibold">{actionFeedback.message}</span>
        </div>
      )}

      {/* Header Panel */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-indigo-600/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
            <Cpu className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-100 flex items-center gap-2">
              SHIPU AIOS Operating System
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Autonomous Tool-Using AI Agent with Runtime Tool Indexing, Intent Planning, and Silent Execution.
            </p>
            <div className="flex items-center gap-2 mt-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <Sparkles className="w-3 h-3" /> Tool Discovery Engine Active
              </span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-medium bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                <Brain className="w-3 h-3" /> Multi-Tool Intent Planner
              </span>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-2 self-stretch sm:self-auto">
          <button
            onClick={() => fetchData()}
            disabled={loading || refreshing}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-300 hover:text-white rounded-lg border border-slate-700 text-xs font-semibold transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing || loading ? 'animate-spin' : ''}`} />
            <span>Sync OS State</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 p-4 rounded-xl text-xs flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Analytics Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Core Engine Hits */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Cognitive Load</span>
            <Activity className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold tracking-tight text-white">
              {analytics ? analytics.totalMessages : 0}
            </span>
            <span className="text-[10px] text-slate-400">processed</span>
          </div>
          <div className="text-[10px] text-indigo-300 flex items-center gap-1">
            <span>LLM Fallback: {analytics ? analytics.llmCalls : 0} calls</span>
          </div>
        </div>

        {/* Brain Hit Rate (Memory efficiency) */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Brain Hit Rate</span>
            <Brain className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold tracking-tight text-white">
              {analytics ? analytics.brainHitRate : 0}%
            </span>
            <span className="text-[10px] text-emerald-400 font-semibold">Cost Saved</span>
          </div>
          <div className="text-[10px] text-emerald-300">
            Fuzzy matching bypassed LLM {analytics ? analytics.brainHits : 0} times
          </div>
        </div>

        {/* Active Session Lifecycle */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Active AI Sessions</span>
            <Sparkles className="w-4 h-4 text-amber-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold tracking-tight text-white">
              {analytics ? analytics.activeSessionsCount : 0}
            </span>
            <span className="text-[10px] text-slate-400">threads</span>
          </div>
          <div className="text-[10px] text-amber-300">
            Cumulative sessions: {analytics ? analytics.totalSessions : 0}
          </div>
        </div>

        {/* Economy Spent */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Economy Sync</span>
            <Coins className="w-4 h-4 text-yellow-500" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold tracking-tight text-white">
              {analytics ? analytics.coinsSpent : 0}
            </span>
            <span className="text-[10px] text-slate-400">Coins</span>
          </div>
          <div className="text-[10px] text-yellow-400">
            Paid cooldown bypasses: {analytics ? analytics.premiumResets : 0}
          </div>
        </div>

      </div>

      {/* Main Grid: Live Sessions & User Memories */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Active / Recent Sessions (Col 1) */}
        <div className="lg:col-span-1 flex flex-col bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex items-center gap-2">
            <History className="w-4.5 h-4.5 text-indigo-400" />
            <h2 className="font-bold text-slate-100 text-sm">Active AIOS Sessions</h2>
          </div>

          <div className="flex-1 space-y-3 max-h-[480px] overflow-y-auto pr-1">
            {sessions.filter(s => s.status === 'active').length === 0 ? (
              <div className="h-40 flex flex-col items-center justify-center text-center text-slate-500 border border-dashed border-slate-800 rounded-xl p-4">
                <MessageSquare className="w-7 h-7 text-slate-600 mb-2" />
                <span className="text-xs font-semibold text-slate-400">No Active AI Sessions</span>
                <span className="text-[10px] text-slate-500 mt-1">Users can trigger #shipu on in Messenger to activate AI.</span>
              </div>
            ) : (
              sessions.filter(s => s.status === 'active').map(s => {
                const elapsedMs = Date.now() - new Date(s.activatedAt).getTime();
                const totalMs = 10 * 60 * 1000;
                const percent = Math.min(100, Math.max(0, (elapsedMs / totalMs) * 100));
                
                return (
                  <div key={s._id} className="bg-slate-950 border border-slate-800/80 rounded-xl p-3.5 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-mono font-bold text-slate-300">User: {s.userID}</span>
                      <span className="px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 text-[9px] font-bold border border-indigo-500/20 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-pulse"></span>
                        <span>ACTIVE</span>
                      </span>
                    </div>

                    <div className="text-[11px] text-slate-400 space-y-0.5 font-sans">
                      <div>Thread ID: <span className="font-mono text-slate-300">{s.threadID}</span></div>
                      <div>Activated: <span className="text-slate-300">{new Date(s.activatedAt).toLocaleTimeString()}</span></div>
                    </div>

                    {/* Progress Bar */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-[9px] text-slate-500">
                        <span>Session Timer (10m)</span>
                        <span>{Math.max(0, Math.ceil((totalMs - elapsedMs) / 60000))}m left</span>
                      </div>
                      <div className="w-full bg-slate-900 rounded-full h-1 overflow-hidden">
                        <div 
                          className="bg-indigo-500 h-full transition-all duration-1000" 
                          style={{ width: `${percent}%` }}
                        ></div>
                      </div>
                    </div>

                    <div className="pt-1">
                      <button
                        onClick={() => handleTerminateSession(s._id)}
                        className="w-full py-1.5 px-3 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 rounded-lg text-[10px] font-bold border border-rose-500/20 transition flex items-center justify-center gap-1.5"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Force Terminate</span>
                      </button>
                    </div>
                  </div>
                );
              })
            )}

            {/* Recent Expired Sessions Header */}
            {sessions.filter(s => s.status === 'expired').length > 0 && (
              <div className="pt-2">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 px-1 mb-2">
                  Recent Expired Sessions
                </div>
                <div className="space-y-2 max-h-[180px] overflow-y-auto">
                  {sessions.filter(s => s.status === 'expired').slice(0, 5).map(s => (
                    <div key={s._id} className="bg-slate-950/40 border border-slate-800/50 rounded-lg p-2.5 flex items-center justify-between text-[11px]">
                      <div>
                        <div className="font-mono text-slate-400 text-[10px]">User: {s.userID}</div>
                        <div className="text-slate-500 text-[9px]">{new Date(s.activatedAt).toLocaleDateString()} {new Date(s.activatedAt).toLocaleTimeString()}</div>
                      </div>
                      <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-500 text-[9px] font-mono uppercase">
                        Expired
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* User Memory Profiles Database (Col 2 & 3) */}
        <div className="lg:col-span-2 flex flex-col bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <BookOpen className="w-4.5 h-4.5 text-emerald-400" />
              <h2 className="font-bold text-slate-100 text-sm">Long-Term Memory Profiles</h2>
            </div>
            
            {/* Search Input */}
            <div className="relative w-full sm:w-60">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search memories or facts..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-indigo-500 transition-colors"
              />
            </div>
          </div>

          <div className="flex-1 overflow-x-auto">
            {filteredMemories.length === 0 ? (
              <div className="h-60 flex flex-col items-center justify-center text-center text-slate-500 p-4">
                <Brain className="w-8 h-8 text-slate-700 mb-2" />
                <span className="text-xs font-semibold text-slate-400">No Learned Memories Match</span>
                <span className="text-[10px] text-slate-500 mt-1">Try another search or allow users to save facts with #remember</span>
              </div>
            ) : (
              <table className="w-full text-left border-collapse min-w-[500px]">
                <thead>
                  <tr className="border-b border-slate-800 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    <th className="pb-3 pl-1">User ID</th>
                    <th className="pb-3">Learned Facts</th>
                    <th className="pb-3">Personality</th>
                    <th className="pb-3">Mood</th>
                    <th className="pb-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 text-xs">
                  {filteredMemories.map(m => {
                    const cooldown = isCooldownActive(m.cooldownUntil);
                    const factsCount = Object.keys(m.facts || {}).length;

                    return (
                      <tr key={m._id} className="hover:bg-slate-950/40 group transition-colors">
                        <td className="py-3.5 pl-1 font-mono font-semibold text-slate-300">
                          {m.userID}
                        </td>
                        <td className="py-3.5">
                          <button
                            onClick={() => setSelectedMemory(m)}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-500/10 text-indigo-400 text-[10px] font-bold border border-indigo-500/20 hover:bg-indigo-500/20 transition"
                          >
                            <Brain className="w-3 h-3 text-indigo-400" />
                            <span>{factsCount} {factsCount === 1 ? 'Fact' : 'Facts'}</span>
                          </button>
                        </td>
                        <td className="py-3.5">
                          <span className="text-slate-300 capitalize">{m.selectedPersonality || 'normal'}</span>
                        </td>
                        <td className="py-3.5 text-slate-400 capitalize">
                          {m.mood || 'neutral'}
                        </td>
                        <td className="py-3.5 text-right space-x-1.5">
                          {cooldown ? (
                            <button
                              onClick={() => handleResetCooldown(m._id, m.userID)}
                              className="px-2 py-1 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 text-[10px] font-bold border border-amber-500/20 rounded-md transition"
                              title={`Cooldown Active: ${formatTimeRemaining(m.cooldownUntil)}`}
                            >
                              Reset Cooldown
                            </button>
                          ) : (
                            <span className="px-1.5 py-0.5 rounded bg-slate-950 text-slate-500 text-[9px] font-mono">
                              READY
                            </span>
                          )}

                          <button
                            onClick={() => handleClearContext(m._id, m.userID)}
                            className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-bold rounded-md border border-slate-700 transition"
                            title="Reset ChatGPT/Gemini context/history"
                          >
                            Clear Context
                          </button>

                          <button
                            onClick={() => handleDeleteMemoryProfile(m._id, m.userID)}
                            className="opacity-40 group-hover:opacity-100 p-1 text-slate-500 hover:text-rose-400 rounded transition"
                            title="Delete user memory"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>

      </div>

      {/* AI Provider Telemetry & Call Logs */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-bold text-slate-100 text-sm">AI Provider Telemetry & Call Logs</h2>
              <p className="text-[10px] text-slate-400">Real-time latency metrics, success rates, token usage, and API response histories.</p>
            </div>
          </div>

          {aiMetrics && (
            <div className="flex flex-wrap items-center gap-3 text-xs">
              <div className="px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg flex items-center gap-2">
                <span className="text-slate-400">Success Rate:</span>
                <span className={`font-bold ${aiMetrics.successRate >= 95 ? 'text-emerald-400' : aiMetrics.successRate >= 80 ? 'text-amber-400' : 'text-rose-400'}`}>
                  {aiMetrics.successRate}%
                </span>
              </div>
              <div className="px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg flex items-center gap-2">
                <span className="text-slate-400">Avg Latency:</span>
                <span className="font-bold text-indigo-400">{aiMetrics.avgLatency}ms</span>
              </div>
              <div className="px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg flex items-center gap-2">
                <span className="text-slate-400">Total Tokens:</span>
                <span className="font-bold text-amber-400">{(aiMetrics.tokens?.total || 0).toLocaleString()}</span>
              </div>
            </div>
          )}
        </div>

        <div className="overflow-x-auto">
          {aiLogs.length === 0 ? (
            <div className="h-40 flex flex-col items-center justify-center text-center text-slate-500 border border-dashed border-slate-800 rounded-xl p-4">
              <Clock className="w-7 h-7 text-slate-600 mb-2" />
              <span className="text-xs font-semibold text-slate-400">No API Call Logs Recorded Yet</span>
              <span className="text-[10px] text-slate-500 mt-1">Logs will appear here once the chatbot processes AI requests.</span>
            </div>
          ) : (
            <table className="w-full text-left border-collapse min-w-[700px]">
              <thead>
                <tr className="border-b border-slate-800 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  <th className="pb-3 pl-1">Timestamp</th>
                  <th className="pb-3">Model</th>
                  <th className="pb-3">Status</th>
                  <th className="pb-3">Latency</th>
                  <th className="pb-3">Tokens</th>
                  <th className="pb-3">Prompt Segment</th>
                  <th className="pb-3 text-right">Retries</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-xs">
                {aiLogs.map((log) => {
                  let promptPreview = '';
                  try {
                    if (log.prompt) {
                      const pObj = JSON.parse(log.prompt);
                      promptPreview = pObj.parts?.[0]?.text || log.prompt;
                    }
                  } catch {
                    promptPreview = log.prompt || '';
                  }
                  if (promptPreview.length > 50) {
                    promptPreview = promptPreview.substring(0, 50) + '...';
                  }

                  return (
                    <tr key={log._id} className="hover:bg-slate-950/40 transition-colors">
                      <td className="py-3 pl-1 text-slate-400 font-mono text-[10px]">
                        {new Date(log.timestamp || log.createdAt).toLocaleTimeString()}
                      </td>
                      <td className="py-3 font-mono text-[11px] text-slate-300 font-semibold">
                        {log.model}
                      </td>
                      <td className="py-3">
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold border ${
                          log.success
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                            : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                        }`}>
                          {log.success ? 'SUCCESS' : log.quotaFailure ? 'QUOTA_EXHAUSTED' : 'ERROR'}
                        </span>
                      </td>
                      <td className="py-3 font-mono text-[11px] text-indigo-400">
                        {log.responseTimeMs} ms
                      </td>
                      <td className="py-3 text-slate-300">
                        <div className="text-[10px] text-slate-400">
                          Total: <span className="font-mono text-slate-200">{log.tokenUsage?.totalTokens || 0}</span>
                        </div>
                        <div className="text-[9px] text-slate-500 flex gap-2">
                          <span>P: {log.tokenUsage?.promptTokens || 0}</span>
                          <span>C: {log.tokenUsage?.candidatesTokens || 0}</span>
                        </div>
                      </td>
                      <td className="py-3 text-slate-400 font-sans italic max-w-xs truncate" title={log.prompt}>
                        {promptPreview || '-'}
                        {log.errorMessage && (
                          <div className="text-[10px] text-rose-400 mt-0.5 not-italic font-mono">{log.errorMessage}</div>
                        )}
                      </td>
                      <td className="py-3 text-right font-mono text-slate-400">
                        {log.retries || 0}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Memory Viewer Modal / Detail Panel */}
      {selectedMemory && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col animate-in fade-in zoom-in-95 duration-200">
            
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-900">
              <div className="flex items-center gap-2.5">
                <Brain className="w-5 h-5 text-indigo-400" />
                <div>
                  <h3 className="font-bold text-slate-100 text-sm">Learned Facts: User {selectedMemory.userID}</h3>
                  <p className="text-[10px] text-slate-400 mt-0.5">Facts extracted or requested to remember by the AIOS agent.</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedMemory(null)}
                className="text-slate-400 hover:text-white px-2.5 py-1 rounded-lg bg-slate-800 text-xs font-semibold"
              >
                Close
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 overflow-y-auto max-h-[450px] space-y-4 bg-slate-950/40">
              {Object.keys(selectedMemory.facts || {}).length === 0 ? (
                <div className="h-40 flex flex-col items-center justify-center text-slate-500">
                  <BookOpen className="w-6 h-6 text-slate-700 mb-2" />
                  <span className="text-xs">No facts registered for this profile yet.</span>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {Object.entries(selectedMemory.facts).map(([key, val]) => (
                    <div key={key} className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-1">
                      <div className="text-[10px] uppercase font-bold tracking-wider text-indigo-400">{key}</div>
                      <div className="text-xs text-slate-200 leading-relaxed font-sans">{val}</div>
                    </div>
                  ))}
                </div>
              )}

              {/* Chat History Length Metric */}
              <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-purple-400" />
                  <span className="text-slate-400">Gemini History Context Buffer</span>
                </div>
                <span className="font-mono font-bold text-slate-200">
                  {selectedMemory.conversationContext?.length || 0} items
                </span>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-800 bg-slate-900/80 flex items-center justify-between">
              <button
                onClick={() => handleDeleteMemoryProfile(selectedMemory._id, selectedMemory.userID)}
                className="px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 rounded-lg text-xs font-semibold border border-rose-500/20 transition flex items-center gap-1"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete Profile</span>
              </button>

              <button
                onClick={() => setSelectedMemory(null)}
                className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold transition"
              >
                Done
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
});
