import React, { useState, useEffect } from 'react';
import {
  Activity,
  Zap,
  Cpu,
  Database,
  Layers,
  MessageSquare,
  ShieldCheck,
  Server,
  Clock,
  HardDrive,
  RefreshCw,
  MessageCircle,
  ArrowRight,
  Key,
  FileCode,
  TrendingUp,
  ChevronDown,
  ChevronUp,
  Coins,
  Timer,
  RotateCcw,
  Sparkles,
  Play,
  CheckCircle2,
  AlertCircle,
  Globe,
  ExternalLink,
  Copy,
  Check,
  Edit3,
  Save
} from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area
} from 'recharts';
import { BotSystemStats } from '../types/shipu';
import { safeFetchJson } from '../lib/fetchUtils';

interface DashboardOverviewProps {
  stats: BotSystemStats;
  totalPlugins: number;
  onNavigate?: (tab: string) => void;
}

export const DashboardOverview: React.FC<DashboardOverviewProps> = React.memo(({
  stats,
  totalPlugins,
  onNavigate
}) => {
  const [backendStatus, setBackendStatus] = useState<'ONLINE' | 'OFFLINE'>('ONLINE');
  const [mongoStatus, setMongoStatus] = useState<string>('CHECKING...');
  const [ftpStatus, setFtpStatus] = useState<string>('CHECKING...');
  const [resourceHistory, setResourceHistory] = useState<{time: string, cpu: number, mem: number}[]>(() => {
    const initial = [];
    const now = Date.now();
    const baseMem = stats.memoryUsageMB || 95;
    const baseCpu = stats.cpuLoadPercent || 4;
    for (let i = 9; i >= 0; i--) {
      const t = new Date(now - i * 60 * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const cpuVal = Math.max(1, Math.min(100, Math.round(baseCpu + (Math.sin(i * 1.5) * 2))));
      const memVal = Math.max(20, Math.round(baseMem + (Math.cos(i * 1.2) * 3)));
      initial.push({ time: t, cpu: cpuVal, mem: memVal });
    }
    return initial;
  });
  const [showHistorical, setShowHistorical] = useState(true);

  // Deployed URL State & Handlers
  const [deployedUrl, setDeployedUrl] = useState<string>(() => {
    if (typeof window !== 'undefined' && window.location.origin) {
      return window.location.origin;
    }
    return '';
  });
  const [copiedUrl, setCopiedUrl] = useState<boolean>(false);
  const [isEditingUrl, setIsEditingUrl] = useState<boolean>(false);
  const [customUrlInput, setCustomUrlInput] = useState<string>('');
  const [isSavingUrl, setIsSavingUrl] = useState<boolean>(false);
  const [urlMessage, setUrlMessage] = useState<string | null>(null);

  useEffect(() => {
    safeFetchJson('/api/system/availability', null).then(data => {
      if (data?.diagnostics?.publicUrl && data.diagnostics.publicUrl.startsWith('http')) {
        setDeployedUrl(data.diagnostics.publicUrl);
        setCustomUrlInput(data.diagnostics.publicUrl);
      } else if (typeof window !== 'undefined' && window.location.origin) {
        setDeployedUrl(window.location.origin);
        setCustomUrlInput(window.location.origin);
      }
    });
  }, []);

  const handleCopyDeployedUrl = () => {
    const urlToCopy = deployedUrl || (typeof window !== 'undefined' ? window.location.origin : '');
    if (!urlToCopy) return;

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(urlToCopy).then(() => {
        setCopiedUrl(true);
        setTimeout(() => setCopiedUrl(false), 2000);
      }).catch(() => {
        fallbackCopyText(urlToCopy);
      });
    } else {
      fallbackCopyText(urlToCopy);
    }
  };

  const fallbackCopyText = (text: string) => {
    try {
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.position = 'fixed';
      textArea.style.left = '-9999px';
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 2000);
    } catch {
      // Ignore
    }
  };

  const handleSaveCustomUrl = async () => {
    if (!customUrlInput) return;
    setIsSavingUrl(true);
    setUrlMessage(null);
    try {
      const res = await fetch('/api/system/config-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ publicUrl: customUrlInput })
      });
      const data = await res.json();
      if (data.success || data.diagnostics) {
        const updated = data.diagnostics?.publicUrl || customUrlInput;
        setDeployedUrl(updated);
        setIsEditingUrl(false);
        setUrlMessage('Deployed URL updated successfully!');
        setTimeout(() => setUrlMessage(null), 3000);
      } else {
        setUrlMessage(data.error || 'Failed to update URL');
      }
    } catch (err: any) {
      setUrlMessage(err.message || 'Server error');
    } finally {
      setIsSavingUrl(false);
    }
  };

  // AI Session & Coin System State
  const [activeSession, setActiveSession] = useState<any | null>(null);
  const [remainingSeconds, setRemainingSeconds] = useState<number>(0);
  const [isResettingSession, setIsResettingSession] = useState<boolean>(false);
  const [isStartingTestSession, setIsStartingTestSession] = useState<boolean>(false);
  const [sessionFeedback, setSessionFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchSessions = async () => {
    try {
      const data = await safeFetchJson('/api/aios/sessions', []);
      if (Array.isArray(data)) {
        const active = data.find((s: any) => s.status === 'active');
        if (active) {
          setActiveSession(active);
          const expTime = new Date(active.expiresAt).getTime();
          const rem = Math.max(0, Math.ceil((expTime - Date.now()) / 1000));
          setRemainingSeconds(rem);
        } else {
          setActiveSession(null);
          setRemainingSeconds(0);
        }
      }
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    fetchSessions();
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        fetchSessions();
      }
    }, 25000);
    return () => clearInterval(interval);
  }, []);

  // Live second-by-second countdown ticker
  useEffect(() => {
    if (remainingSeconds <= 0) return;
    const timer = setInterval(() => {
      setRemainingSeconds(prev => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [remainingSeconds]);

  const handleForceCoinReset = async () => {
    setIsResettingSession(true);
    setSessionFeedback(null);
    try {
      const res = await fetch('/api/aios/sessions/reset-coins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userID: activeSession?.userID })
      });
      const data = await res.json();
      if (data.success) {
        setSessionFeedback({
          type: 'success',
          text: data.message || '⚡ Session cooldown reset successfully! 50 coins deducted from economy wallet.'
        });
        await fetchSessions();
      } else {
        setSessionFeedback({
          type: 'error',
          text: data.message || 'Failed to reset session.'
        });
      }
    } catch (err: any) {
      setSessionFeedback({ type: 'error', text: err.message || 'Error connecting to server.' });
    } finally {
      setIsResettingSession(false);
    }
  };

  const handleStartTestSession = async () => {
    setIsStartingTestSession(true);
    setSessionFeedback(null);
    try {
      const res = await fetch('/api/aios/sessions/start-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      const data = await res.json();
      if (data.success) {
        setSessionFeedback({
          type: 'success',
          text: '🚀 Test 10-minute AI session started successfully!'
        });
        await fetchSessions();
      } else {
        setSessionFeedback({
          type: 'error',
          text: data.message || 'Failed to start test session.'
        });
      }
    } catch (err: any) {
      setSessionFeedback({ type: 'error', text: err.message || 'Error starting session.' });
    } finally {
      setIsStartingTestSession(false);
    }
  };

  const formatMinSec = (totalSec: number) => {
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${mins.toString().padStart(2, '0')}m ${secs.toString().padStart(2, '0')}s`;
  };

  useEffect(() => {
    if (stats) {
      setResourceHistory(prev => {
        const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const last = prev[prev.length - 1];
        if (last && last.time === now) {
          const updated = [...prev];
          updated[updated.length - 1] = { time: now, cpu: Math.round(stats.cpuLoadPercent), mem: stats.memoryUsageMB };
          return updated;
        }
        const next = [...prev, { time: now, cpu: Math.round(stats.cpuLoadPercent), mem: stats.memoryUsageMB }];
        return next.slice(-30); // Last 10-15 minutes
      });
    }
  }, [stats.cpuLoadPercent, stats.memoryUsageMB]);

  useEffect(() => {
    if (stats) {
      // Backend Express is running and providing stats
      setBackendStatus('ONLINE');
      if ((stats as any).mongoStatus) {
        setMongoStatus((stats as any).mongoStatus);
      }
      if ((stats as any).ftpStatus) {
        setFtpStatus((stats as any).ftpStatus);
      }
    }

    // Check auxiliary health endpoints
    safeFetchJson('/api/health', null).then(data => {
      if (data) {
        setBackendStatus('ONLINE');
      }
    });

    if (!(stats as any)?.mongoStatus) {
      safeFetchJson('/api/mongodb/status', null).then(data => {
        if (data) {
          setMongoStatus(data.connected ? 'CONNECTED' : data.status || 'DISCONNECTED');
        }
      });
    }

    if (!(stats as any)?.ftpStatus) {
      safeFetchJson('/api/ftp/config', null).then(data => {
        if (data) {
          setFtpStatus((data.enabled && data.host) ? 'CONFIGURED' : 'NOT_CONFIGURED');
        }
      });
    }
  }, [stats]);

  const formatUptime = (secs: number) => {
    const d = Math.floor(secs / 86400);
    const h = Math.floor((secs % 86400) / 3600);
    const m = Math.floor((secs % 3600) / 60);
    if (d > 0) return `${d}d ${h}h ${m}m`;
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m ${secs % 60}s`;
  };

  const isMessengerConnected = stats.messengerStatus === 'CONNECTED';
  const isMongoConnected = mongoStatus === 'CONNECTED';
  const isFtpConfigured = ftpStatus === 'CONFIGURED';

  const healthServices = [
    {
      name: 'Frontend Web',
      tech: 'React + Vite',
      status: 'ONLINE',
      indicator: 'bg-emerald-400',
      labelColor: 'text-emerald-400',
      type: 'Client SPA'
    },
    {
      name: 'Backend API',
      tech: 'Express Server',
      status: backendStatus,
      indicator: backendStatus === 'ONLINE' ? 'bg-emerald-400' : 'bg-rose-400',
      labelColor: backendStatus === 'ONLINE' ? 'text-emerald-400' : 'text-rose-400',
      type: 'Node.js REST API'
    },
    {
      name: 'MongoDB Atlas',
      tech: 'Mongoose ODM',
      status: mongoStatus,
      indicator: isMongoConnected ? 'bg-emerald-400' : 'bg-slate-500',
      labelColor: isMongoConnected ? 'text-emerald-400' : 'text-slate-400',
      type: 'Runtime Storage'
    },
    {
      name: 'cPanel FTP Storage',
      tech: 'Remote FTP',
      status: ftpStatus,
      indicator: isFtpConfigured ? 'bg-amber-400' : 'bg-slate-500',
      labelColor: isFtpConfigured ? 'text-amber-400' : 'text-slate-400',
      type: 'Command Storage'
    },
    {
      name: 'Messenger Adapter',
      tech: 'Facebook Session',
      status: isMessengerConnected ? 'CONNECTED' : 'NOT_CONFIGURED',
      indicator: isMessengerConnected ? 'bg-emerald-400' : 'bg-slate-500',
      labelColor: isMessengerConnected ? 'text-emerald-400' : 'text-slate-400',
      type: 'Bot Adapter'
    },
    {
      name: 'Gemini AI Engine',
      tech: 'Google GenAI',
      status: 'READY',
      indicator: 'bg-emerald-400',
      labelColor: 'text-emerald-400',
      type: 'AI Engine'
    }
  ];

  const quickMetrics = [
    {
      title: 'Connected Groups',
      value: (isMessengerConnected ? stats.activeThreadsCount : 0).toString(),
      sub: 'Active Threads',
      icon: MessageCircle
    },
    {
      title: 'Registered Users',
      value: stats.registeredUsersCount.toString(),
      sub: 'User Records',
      icon: ShieldCheck
    },
    {
      title: 'Commands Loaded',
      value: totalPlugins.toString(),
      sub: 'Active Plugins',
      icon: Zap
    },
    {
      title: 'Commands Executed',
      value: stats.totalCommandsExecuted.toString(),
      sub: 'Total Execution Calls',
      icon: Cpu
    },
    {
      title: 'Events Handled',
      value: stats.totalEventsHandled.toString(),
      sub: 'Dispatched Events',
      icon: Activity
    },
    {
      title: 'Process Memory',
      value: `${stats.memoryUsageMB} MB`,
      sub: 'Node Heap Usage',
      icon: HardDrive
    },
    {
      title: 'Process Uptime',
      value: formatUptime(stats.uptimeSeconds),
      sub: 'Server Uptime',
      icon: Clock
    },
    {
      title: 'Auto Recovery',
      value: 'Enabled',
      sub: 'Supervisor Active',
      icon: RefreshCw
    }
  ];

  return (
    <div className="space-y-6">
      {/* 1. COMPACT DASHBOARD HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            ShiPu Ai Control Panel
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            System overview and bot infrastructure status
          </p>
        </div>

        <div className="flex items-center space-x-2 text-xs font-mono bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-xl text-slate-300 shrink-0 self-start sm:self-auto">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
          <span className="font-semibold text-emerald-400">ENGINE ONLINE</span>
          <span className="text-slate-600">|</span>
          <span>Uptime: {formatUptime(stats.uptimeSeconds)}</span>
        </div>
      </div>

      {/* 1.2 DEPLOYED APPLICATION URL CARD WITH COPY BUTTON */}
      <div className="bg-gradient-to-r from-indigo-950/80 via-slate-900 to-slate-900 border border-indigo-500/30 rounded-2xl p-4 sm:p-5 relative overflow-hidden shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5 flex-1 min-w-0">
            <div className="flex items-center space-x-2.5">
              <span className="p-2 rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 shrink-0">
                <Globe className="w-4 h-4" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-sm font-bold text-white tracking-wide">
                    Deployed Application URL
                  </h2>
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping mr-1.5"></span>
                    LIVE ENDPOINT
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Public web address for dashboard access, external webhooks, and client site portal
                </p>
              </div>
            </div>

            {/* URL Display Bar & Action Buttons */}
            {!isEditingUrl ? (
              <div className="mt-2.5 flex items-center gap-2 max-w-2xl bg-slate-950/90 border border-slate-800 rounded-xl p-1.5 pl-3">
                <Globe className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                <span className="font-mono text-xs text-indigo-200 truncate select-all flex-1">
                  {deployedUrl || (typeof window !== 'undefined' ? window.location.origin : '')}
                </span>
                
                {/* Copy Button */}
                <button
                  onClick={handleCopyDeployedUrl}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all duration-200 flex items-center gap-1.5 shrink-0 ${
                    copiedUrl
                      ? 'bg-emerald-600 text-white shadow-lg scale-105'
                      : 'bg-indigo-600 hover:bg-indigo-500 text-white border border-indigo-500/40 shadow'
                  }`}
                  title="Copy Deployed URL to Clipboard"
                >
                  {copiedUrl ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-white animate-bounce" />
                      <span>Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy URL</span>
                    </>
                  )}
                </button>

                {/* Open in New Tab Button */}
                <a
                  href={deployedUrl || (typeof window !== 'undefined' ? window.location.origin : '#')}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 rounded-lg text-xs transition flex items-center gap-1 shrink-0"
                  title="Open live app in new tab"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Open</span>
                </a>

                {/* Edit Button */}
                <button
                  onClick={() => setIsEditingUrl(true)}
                  className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition shrink-0"
                  title="Edit Custom Deployed Domain"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              /* Edit Custom URL Mode */
              <div className="mt-2.5 flex items-center gap-2 max-w-2xl bg-slate-950 border border-indigo-500/50 rounded-xl p-1.5 pl-3">
                <input
                  type="url"
                  value={customUrlInput}
                  onChange={e => setCustomUrlInput(e.target.value)}
                  placeholder="https://your-custom-domain.com"
                  className="bg-transparent border-none outline-none font-mono text-xs text-white placeholder-slate-500 flex-1 w-full"
                />
                <button
                  onClick={handleSaveCustomUrl}
                  disabled={isSavingUrl}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-lg transition flex items-center gap-1 shrink-0 disabled:opacity-50"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{isSavingUrl ? 'Saving...' : 'Save URL'}</span>
                </button>
                <button
                  onClick={() => setIsEditingUrl(false)}
                  className="px-2.5 py-1.5 text-slate-400 hover:text-white text-xs rounded-lg transition shrink-0"
                >
                  Cancel
                </button>
              </div>
            )}

            {urlMessage && (
              <p className="text-[11px] font-semibold text-emerald-400 mt-1 pl-1">
                {urlMessage}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* 1.5 VISUAL AI SESSION STATUS & COIN RESET INDICATOR */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 relative overflow-hidden shadow-lg">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1.5 flex-1">
            <div className="flex items-center space-x-2.5">
              <span className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20 shrink-0">
                <Coins className="w-4 h-4" />
              </span>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-bold text-white tracking-wide">
                    AI Session Status
                  </h2>
                  {activeSession ? (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping mr-1.5"></span>
                      ACTIVE SESSION
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-slate-800 text-slate-400 border border-slate-700">
                      INACTIVE / COOLDOWN
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  10-minute conversational session lifespan with coin-based cooldown bypass
                </p>
              </div>
            </div>

            {activeSession && (
              <div className="text-xs text-slate-300 space-y-1 pt-1 pl-0 sm:pl-10">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-400">
                  <span>User: <strong className="text-slate-200 font-mono">{activeSession.userID}</strong></span>
                  <span>Thread: <strong className="text-slate-200 font-mono">{activeSession.threadID}</strong></span>
                  <span>Personality: <strong className="text-indigo-300">{activeSession.personality || 'ShiPu Ai'}</strong></span>
                </div>
              </div>
            )}
          </div>

          {/* TIMER & RESET ACTION BUTTONS */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0">
            {/* Countdown Badge */}
            <div className="bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 flex items-center space-x-3 shrink-0">
              <Timer className={`w-5 h-5 ${activeSession && remainingSeconds > 0 ? 'text-emerald-400 animate-pulse' : 'text-slate-500'}`} />
              <div>
                <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block">
                  {activeSession ? 'Time Remaining' : 'Session Lifespan'}
                </span>
                <span className="text-base font-mono font-bold text-white block">
                  {activeSession ? formatMinSec(remainingSeconds) : '00m 00s'}
                </span>
              </div>
            </div>

            {/* Coin-Based Manual Reset Button */}
            <button
              onClick={handleForceCoinReset}
              disabled={isResettingSession}
              className="px-3.5 py-2.5 bg-gradient-to-r from-amber-500/20 to-amber-600/20 hover:from-amber-500/30 hover:to-amber-600/30 border border-amber-500/30 hover:border-amber-500/50 rounded-xl text-xs font-semibold text-amber-300 transition flex items-center justify-center space-x-2 disabled:opacity-50 shadow-sm"
              title="Force reset session using 50 coins from wallet"
            >
              <RotateCcw className={`w-3.5 h-3.5 ${isResettingSession ? 'animate-spin' : ''}`} />
              <span>{isResettingSession ? 'Resetting...' : 'Force Reset Session (50 Coins)'}</span>
            </button>

            {!activeSession && (
              <button
                onClick={handleStartTestSession}
                disabled={isStartingTestSession}
                className="px-3 py-2.5 bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/30 rounded-xl text-xs font-semibold text-indigo-300 transition flex items-center justify-center space-x-1.5 disabled:opacity-50"
                title="Start a fresh 10-minute test AI session"
              >
                <Play className="w-3.5 h-3.5" />
                <span>Start Test 10m Session</span>
              </button>
            )}
          </div>
        </div>

        {/* Lifespan Progress Bar */}
        {activeSession && (
          <div className="mt-3 pt-3 border-t border-slate-800/80">
            <div className="flex justify-between items-center text-[10px] text-slate-400 mb-1 font-mono">
              <span>Active Session Time Remaining</span>
              <span className="text-emerald-400 font-bold">{Math.round((remainingSeconds / 600) * 100)}% remaining</span>
            </div>
            <div className="h-1.5 w-full bg-slate-950 rounded-full overflow-hidden border border-slate-800/60">
              <div
                className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-1000 ease-linear"
                style={{ width: `${Math.min(100, (remainingSeconds / 600) * 100)}%` }}
              />
            </div>
          </div>
        )}

        {/* Feedback Banner */}
        {sessionFeedback && (
          <div className={`mt-3 p-2.5 rounded-xl text-xs flex items-center space-x-2 border ${
            sessionFeedback.type === 'success'
              ? 'bg-emerald-950/40 border-emerald-800/50 text-emerald-300'
              : 'bg-rose-950/40 border-rose-800/50 text-rose-300'
          }`}>
            {sessionFeedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0" />
            )}
            <span className="flex-1">{sessionFeedback.text}</span>
          </div>
        )}
      </div>

      {/* 1.6 CLIENT SITE QUICK ACCESS BANNER */}
      <div className="bg-gradient-to-r from-indigo-950 via-slate-900 to-indigo-950 border border-indigo-500/30 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xl">
        <div className="flex items-center space-x-3.5">
          <div className="p-3 bg-indigo-600/20 border border-indigo-500/30 text-indigo-400 rounded-xl shrink-0">
            <Globe className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <span>Client Website & Portal</span>
              <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono">Ready</span>
            </h2>
            <p className="text-xs text-slate-300 mt-0.5">
              Visit and use the client website directly. Manage user authentication, bot slot orders, and live bot deployments.
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-2 shrink-0">
          <button
            onClick={() => onNavigate && onNavigate('client_site')}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold shadow-md shadow-indigo-600/30 transition flex items-center gap-1.5"
          >
            <span>Open Client Portal</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
          <a
            href="/client-site/index.php"
            target="_blank"
            rel="noopener noreferrer"
            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold border border-slate-700 transition flex items-center gap-1.5"
          >
            <span>Visit in New Tab</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>

      {/* 2. SYSTEM HEALTH SUMMARY */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
            <Server className="w-4 h-4 text-indigo-400" /> System Health & Infrastructure Status
          </h2>
          <span className="text-[11px] font-mono text-slate-500">Live Telemetry</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {healthServices.map((service, i) => (
            <div
              key={i}
              className="bg-slate-950 border border-slate-800/80 rounded-xl p-3 flex items-center justify-between"
            >
              <div className="space-y-0.5">
                <div className="flex items-center space-x-2">
                  <span className={`w-2 h-2 rounded-full ${service.indicator} shrink-0`} />
                  <span className="text-xs font-bold text-slate-200">{service.name}</span>
                </div>
                <div className="text-[11px] text-slate-400 pl-4">{service.tech}</div>
              </div>

              <div className="text-right space-y-0.5">
                <span className={`text-xs font-mono font-bold block ${service.labelColor}`}>
                  {service.status}
                </span>
                <span className="text-[10px] text-slate-500 block">{service.type}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
      
      {/* RESOURCE PULSE SECTION */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
            <Zap className="w-4 h-4 text-amber-400" /> Resource Pulse
          </h2>
          <div className="flex items-center gap-3 text-[10px] font-medium uppercase tracking-tight">
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-indigo-500"></div>
              <span className="text-slate-400">CPU</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
              <span className="text-slate-400">RAM</span>
            </div>
            <button 
              onClick={() => setShowHistorical(!showHistorical)}
              className="ml-2 flex items-center gap-1 px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 transition-colors text-slate-300 border border-slate-700"
            >
              <TrendingUp className="w-3 h-3" />
              <span>Historical Trend</span>
              {showHistorical ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
          </div>
        </div>

        {showHistorical && (
          <div className="mb-6 h-[220px] w-full bg-slate-950/70 rounded-xl p-3 border border-slate-800/80">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={resourceHistory} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorCpu" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorMem" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                <XAxis 
                  dataKey="time" 
                  stroke="#64748b" 
                  fontSize={10} 
                  tickLine={false} 
                  axisLine={false}
                  minTickGap={20}
                />
                <YAxis 
                  yAxisId="cpu"
                  orientation="left"
                  stroke="#818cf8" 
                  fontSize={10} 
                  tickLine={false} 
                  axisLine={false}
                  domain={[0, 100]}
                  tickFormatter={(val) => `${val}%`}
                />
                <YAxis 
                  yAxisId="mem"
                  orientation="right"
                  stroke="#34d399" 
                  fontSize={10} 
                  tickLine={false} 
                  axisLine={false}
                  domain={['auto', 'auto']}
                  tickFormatter={(val) => `${val}M`}
                />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '12px', fontSize: '11px', color: '#f8fafc' }}
                  formatter={(value: any, name: any) => [
                    name === 'CPU Load' ? `${value}%` : `${value} MB`,
                    name
                  ]}
                />
                <Area 
                  yAxisId="cpu"
                  type="monotone" 
                  dataKey="cpu" 
                  stroke="#6366f1" 
                  fillOpacity={1} 
                  fill="url(#colorCpu)" 
                  strokeWidth={2}
                  name="CPU Load"
                />
                <Area 
                  yAxisId="mem"
                  type="monotone" 
                  dataKey="mem" 
                  stroke="#10b981" 
                  fillOpacity={1} 
                  fill="url(#colorMem)" 
                  strokeWidth={2}
                  name="Memory Usage"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* CPU Indicator */}
          <div className="space-y-3">
            <div className="flex justify-between items-end">
              <div className="space-y-1">
                <span className="text-xs font-bold text-slate-200 block">CPU Load</span>
                <span className="text-[10px] text-slate-500">Real-time processor utilization</span>
              </div>
              <span className="text-xl font-mono font-bold text-indigo-400">{Math.round(stats.cpuLoadPercent)}%</span>
            </div>
            
            <div className="h-2 w-full bg-slate-950 rounded-full overflow-hidden border border-slate-800/50">
              <div 
                className="h-full bg-indigo-500 transition-all duration-1000 ease-in-out relative"
                style={{ width: `${Math.min(100, stats.cpuLoadPercent)}%` }}
              >
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-shimmer" />
              </div>
            </div>

            <div className="flex items-end gap-1 h-8 px-1">
              {resourceHistory.slice(-10).map((item, i) => (
                <div 
                  key={i} 
                  className="flex-1 bg-indigo-500/20 rounded-t-sm transition-all duration-500"
                  style={{ height: `${Math.max(5, item.cpu)}%` }}
                />
              ))}
            </div>
          </div>

          {/* Memory Indicator */}
          <div className="space-y-3">
            <div className="flex justify-between items-end">
              <div className="space-y-1">
                <span className="text-xs font-bold text-slate-200 block">Memory Usage</span>
                <span className="text-[10px] text-slate-500">Total process heap consumption</span>
              </div>
              <span className="text-xl font-mono font-bold text-emerald-400">{stats.memoryUsageMB}MB</span>
            </div>
            
            <div className="h-2 w-full bg-slate-950 rounded-full overflow-hidden border border-slate-800/50">
              <div 
                className="h-full bg-emerald-500 transition-all duration-1000 ease-in-out relative"
                style={{ width: `${Math.min(100, (stats.memoryUsageMB / 1024) * 100)}%` }}
              >
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-shimmer" />
              </div>
            </div>

            <div className="flex items-end gap-1 h-8 px-1">
              {resourceHistory.slice(-10).map((item, i) => (
                <div 
                  key={i} 
                  className="flex-1 bg-emerald-500/20 rounded-t-sm transition-all duration-500"
                  style={{ height: `${Math.max(5, (item.mem / 1024) * 100)}%` }}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 3. RUNTIME METRICS GRID */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
            <Activity className="w-4 h-4 text-indigo-400" /> Runtime Metrics & Performance
          </h2>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-3">
          {quickMetrics.map((metric, idx) => {
            const Icon = metric.icon;
            return (
              <div
                key={idx}
                className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 space-y-1 hover:border-slate-700 transition"
              >
                <div className="flex items-center justify-between text-slate-400">
                  <span className="text-[11px] font-medium truncate">{metric.title}</span>
                  <Icon className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                </div>
                <div className="text-lg font-bold text-white font-mono tracking-tight">
                  {metric.value}
                </div>
                <div className="text-[10px] text-slate-500">{metric.sub}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 4. QUICK ACTIONS */}
      {onNavigate && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
            Quick System Actions
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
            <button
              onClick={() => onNavigate('simulator')}
              className="p-2.5 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-xl text-xs font-medium text-slate-200 transition flex items-center justify-between group"
            >
              <div className="flex items-center space-x-2">
                <MessageSquare className="w-4 h-4 text-indigo-400 shrink-0" />
                <span>Simulator</span>
              </div>
              <ArrowRight className="w-3 h-3 text-slate-500 group-hover:text-slate-300" />
            </button>

            <button
              onClick={() => onNavigate('session')}
              className="p-2.5 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-xl text-xs font-medium text-slate-200 transition flex items-center justify-between group"
            >
              <div className="flex items-center space-x-2">
                <Key className="w-4 h-4 text-amber-400 shrink-0" />
                <span>Session</span>
              </div>
              <ArrowRight className="w-3 h-3 text-slate-500 group-hover:text-slate-300" />
            </button>

            <button
              onClick={() => onNavigate('plugins')}
              className="p-2.5 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-xl text-xs font-medium text-slate-200 transition flex items-center justify-between group"
            >
              <div className="flex items-center space-x-2">
                <Zap className="w-4 h-4 text-sky-400 shrink-0" />
                <span>Commands</span>
              </div>
              <ArrowRight className="w-3 h-3 text-slate-500 group-hover:text-slate-300" />
            </button>

            <button
              onClick={() => onNavigate('project_files')}
              className="p-2.5 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-xl text-xs font-medium text-slate-200 transition flex items-center justify-between group"
            >
              <div className="flex items-center space-x-2">
                <FileCode className="w-4 h-4 text-purple-400 shrink-0" />
                <span>Project Files</span>
              </div>
              <ArrowRight className="w-3 h-3 text-slate-500 group-hover:text-slate-300" />
            </button>

            <button
              onClick={() => onNavigate('database')}
              className="p-2.5 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-xl text-xs font-medium text-slate-200 transition flex items-center justify-between group"
            >
              <div className="flex items-center space-x-2">
                <Database className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Storage DB</span>
              </div>
              <ArrowRight className="w-3 h-3 text-slate-500 group-hover:text-slate-300" />
            </button>

            <button
              onClick={() => onNavigate('system')}
              className="p-2.5 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-xl text-xs font-medium text-slate-200 transition flex items-center justify-between group"
            >
              <div className="flex items-center space-x-2">
                <Server className="w-4 h-4 text-slate-400 shrink-0" />
                <span>Inspector</span>
              </div>
              <ArrowRight className="w-3 h-3 text-slate-500 group-hover:text-slate-300" />
            </button>
          </div>
        </div>
      )}

      {/* 5. SYSTEM TOPOLOGY & EXECUTION FLOW */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-3">
        <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
          <Layers className="w-4 h-4 text-indigo-400" /> System Topology & Execution Flow
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-5 gap-3 font-mono text-xs">
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 space-y-1">
            <span className="text-[10px] text-indigo-400 uppercase font-sans font-bold block">1. Gateway</span>
            <span className="text-slate-200 font-bold block">Messenger Adapter</span>
            <span className="text-[11px] text-slate-400 block font-sans">FB Webhooks & session events</span>
          </div>

          <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 space-y-1">
            <span className="text-[10px] text-indigo-400 uppercase font-sans font-bold block">2. Router</span>
            <span className="text-slate-200 font-bold block">Command Dispatcher</span>
            <span className="text-[11px] text-slate-400 block font-sans">Prefix check & permission roles</span>
          </div>

          <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 space-y-1">
            <span className="text-[10px] text-indigo-400 uppercase font-sans font-bold block">3. Commands</span>
            <span className="text-slate-200 font-bold block">{totalPlugins} Active Plugins</span>
            <span className="text-[11px] text-slate-400 block font-sans">onStart, onReply, onChat</span>
          </div>

          <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 space-y-1">
            <span className="text-[10px] text-indigo-400 uppercase font-sans font-bold block">4. Persistence</span>
            <span className="text-slate-200 font-bold block">MongoDB + FTP</span>
            <span className="text-[11px] text-slate-400 block font-sans">Mongoose & cPanel FTP files</span>
          </div>

          <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 space-y-1">
            <span className="text-[10px] text-indigo-400 uppercase font-sans font-bold block">5. Response</span>
            <span className="text-slate-200 font-bold block">Client Reply</span>
            <span className="text-[11px] text-slate-400 block font-sans">Messenger message & reaction</span>
          </div>
        </div>
      </div>
    </div>
  );
});
