import React, { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, RefreshCw, CheckCircle2, AlertCircle, X, Sparkles } from 'lucide-react';
import { Navbar } from './components/Navbar';
import { CommandPalette } from './components/CommandPalette';
import { LiveSimulator } from './components/LiveSimulator';
import { DashboardOverview } from './components/DashboardOverview';
import { PluginManager } from './components/PluginManager';
import { ThreadManager } from './components/ThreadManager';
import { UserDatabase } from './components/UserDatabase';
import { AIWorkbench } from './components/AIWorkbench';
import { FallbackApiManager } from './components/FallbackApiManager';
import { SchedulerManager } from './components/SchedulerManager';
import { AdapterSettings } from './components/AdapterSettings';
import { ConsoleTerminal } from './components/ConsoleTerminal';
import { SessionManager } from './components/SessionManager';
import { ClientBotsView } from './components/ClientBotsView';
import { DatabaseManager } from './components/DatabaseManager';
import { SystemManager } from './components/SystemManager';
import { SupabaseManager } from './components/SupabaseManager';
import { AuditLogView } from './components/AuditLogView';
import { ProjectFileManager } from './components/ProjectFileManager';
import { SharedAccessManager } from './components/SharedAccessManager';
import { BrainManager } from './components/BrainManager';
import { AIOSDashboard } from './components/AIOSDashboard';
import { AIProvidersDashboard } from './components/AIProvidersDashboard';
import { CryptoDashboard } from './components/CryptoDashboard';
import { PersonalAIRegistrationView } from './components/PersonalAIRegistrationView';
import { CommunicationCenter } from './components/CommunicationCenter';
import { SubscriptionManager } from './components/SubscriptionManager';
import { ClientSitePortal } from './components/ClientSitePortal';
import { SmsDashboard } from './components/SmsDashboard';
import { TelegramManager } from './components/TelegramManager';
import { safeFetchJson } from './lib/fetchUtils';

import {
  BotSystemStats,
  ShiPuThread,
  ShiPuUser,
  BotConfig,
  BotLog,
  ShiPuCommandConfig,
  ShiPuBotResponse
} from './types/shipu';

// Map path/hash aliases to activeTab keys
function resolveTabFromLocation(): string {
  if (typeof window === 'undefined') return 'dashboard';
  const path = window.location.pathname.toLowerCase().replace(/^\/+/, '');
  const hash = window.location.hash.toLowerCase().replace(/^#\/*/, '');
  const target = hash || path;

  switch (target) {
    case 'messenger':
    case 'simulator':
      return 'simulator';
    case 'session':
      return 'session';
    case 'threads':
      return 'threads';
    case 'users':
      return 'users';
    case 'crypto':
    case 'banking':
    case 'wallet':
      return 'crypto';
    case 'shared_access':
    case 'sharedaccess':
      return 'shared_access';
    case 'personal_ai':
    case 'personalai':
      return 'personal_ai';
    case 'client_site':
    case 'clientsite':
    case 'client':
      return 'client_site';
    case 'bot_inbox':
    case 'inbox':
    case 'requests':
    case 'spam':
      return 'bot_inbox';
    case 'commands':
    case 'plugins':
      return 'plugins';
    case 'files':
    case 'project_files':
    case 'projectfiles':
      return 'project_files';
    case 'aios':
    case 'aios_dashboard':
    case 'aiosdashboard':
      return 'aios_dashboard';
    case 'telegram':
    case 'telegram_bot':
    case 'telegrambot':
    case 'tg':
    case 'tgbot':
      return 'telegram';
    case 'sms':
    case 'sms_dashboard':
    case 'smsdashboard':
    case 'smsmonitor':
    case 'smssim':
    case 'smstest':
      return 'sms_dashboard';
    case 'ai_providers':
    case 'aiproviders':
    case 'ai_provider':
      return 'ai_providers';
    case 'ai':
      return 'ai';
    case 'brain':
    case 'brain_manager':
    case 'brainmanager':
      return 'brain_manager';
    case 'scheduler':
      return 'scheduler';
    case 'database':
    case 'mongodb':
    case 'ftp':
    case 'firebase':
      return 'database';
    case 'logs':
    case 'audit_logs':
      return 'audit_logs';
    case 'supabase':
    case 'supabase_manager':
      return 'supabase_manager';
    case 'terminal':
      return 'terminal';
    case 'system':
      return 'system';
    case 'settings':
    case 'adapter':
      return 'adapter';
    case 'dashboard':
    default:
      return 'dashboard';
  }
}

export default function App() {
  const [activeTab, setActiveTabState] = useState<string>(resolveTabFromLocation);
  const [adminToken, setAdminToken] = useState<string>('default_admin_session');
  const [isReloading, setIsReloading] = useState<boolean>(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState<boolean>(false);
  const [toast, setToast] = useState<{
    id: string;
    type: 'success' | 'error' | 'info';
    message: string;
    subtext?: string;
  } | null>(null);

  // Global Ctrl+K / Cmd+K listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsCommandPaletteOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const [stats, setStats] = useState<BotSystemStats>({
    uptimeSeconds: 0,
    totalCommandsExecuted: 0,
    totalEventsHandled: 0,
    activeThreadsCount: 0,
    registeredUsersCount: 0,
    memoryUsageMB: 0,
    cpuLoadPercent: 0,
    status: 'ONLINE'
  });

  const [plugins, setPlugins] = useState<{ config: ShiPuCommandConfig; hasCode?: boolean }[]>([]);
  const [threads, setThreads] = useState<ShiPuThread[]>([]);
  const [users, setUsers] = useState<ShiPuUser[]>([]);
  const [config, setConfig] = useState<BotConfig>({
    botName: 'ShiPu Ai🤖',
    globalPrefix: '#',
    botAdminIDs: [],
    autoRestart: true,
    webhookUrl: '',
    facebookAppState: '[]',
    enableAI: true,
    maintenanceMode: false
  });
  const [logs, setLogs] = useState<BotLog[]>([]);

  const setActiveTab = (tab: string) => {
    setActiveTabState(tab);
    if (typeof window !== 'undefined') {
      window.location.hash = `#/${tab}`;
    }
  };

  const showToast = useCallback((type: 'success' | 'error' | 'info', message: string, subtext?: string) => {
    const id = Date.now().toString();
    setToast({ id, type, message, subtext });
    if (type !== 'info') {
      setTimeout(() => {
        setToast(current => (current?.id === id ? null : current));
      }, 4000);
    }
  }, []);

  const fetchInitialData = useCallback(async () => {
    try {
      const data = await safeFetchJson<any>('/api/dashboard/bootstrap', null);
      if (data) {
        if (data.stats) setStats(data.stats);
        if (data.commands) setPlugins(data.commands);
        if (data.threads && Array.isArray(data.threads) && data.threads.length > 0) setThreads(data.threads);
        if (data.users && Array.isArray(data.users) && data.users.length > 0) setUsers(data.users);
        if (data.config) setConfig(data.config);
        if (data.logs) setLogs(data.logs);
      } else {
        // Fallback if bootstrap endpoint is unavailable
        const [resStats, resCmds, resThreads, resUsers, resConfig, resLogs] = await Promise.all([
          safeFetchJson('/api/bot/stats', null),
          safeFetchJson('/api/bot/commands', []),
          safeFetchJson('/api/bot/threads', []),
          safeFetchJson('/api/bot/users', []),
          safeFetchJson('/api/bot/settings', null),
          safeFetchJson('/api/bot/logs', [])
        ]);

        if (resStats) setStats(resStats);
        if (resCmds) setPlugins(resCmds);
        if (resThreads && Array.isArray(resThreads) && resThreads.length > 0) setThreads(resThreads);
        if (resUsers && Array.isArray(resUsers) && resUsers.length > 0) setUsers(resUsers);
        if (resConfig) setConfig(resConfig);
        if (resLogs) setLogs(resLogs);
      }
    } catch (err) {
      console.error('Failed to fetch initial ShiPu Ai data:', err);
    }
  }, []);

  const handleHotReload = useCallback(async () => {
    if (isReloading) return;
    setIsReloading(true);
    showToast('info', 'Reloading ShiPu Ai Engine...', 'Refreshing commands, plugins & active session state');

    try {
      const res = await fetch('/api/bot/reload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`
        }
      });
      const data = await res.json();

      if (res.ok && data.success) {
        // Refresh all app data via API without page reload
        await fetchInitialData();
        showToast(
          'success',
          'Engine reloaded successfully.',
          `${data.reloadedCommands || 0} commands & runtime state synchronized live`
        );
      } else {
        showToast('error', 'Hot reload failed', data.error || 'Server error occurred during reload');
      }
    } catch (err: any) {
      showToast('error', 'Hot reload network error', err.message || 'Failed to reach server');
    } finally {
      setIsReloading(false);
    }
  }, [adminToken, isReloading, showToast, fetchInitialData]);

  useEffect(() => {
    const handleHashChange = () => {
      setActiveTabState(resolveTabFromLocation());
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const activeTabRef = React.useRef(activeTab);
  useEffect(() => {
    activeTabRef.current = activeTab;
  }, [activeTab]);

  const fetchLiveStats = useCallback(async () => {
    try {
      const s = await safeFetchJson('/api/bot/stats', null);
      if (s) {
        setStats(prev => (
          prev.uptimeSeconds === s.uptimeSeconds &&
          prev.totalCommandsExecuted === s.totalCommandsExecuted &&
          prev.totalEventsHandled === s.totalEventsHandled &&
          prev.memoryUsageMB === s.memoryUsageMB &&
          prev.cpuLoadPercent === s.cpuLoadPercent &&
          prev.status === s.status
            ? prev
            : s
        ));
      }

      if (['terminal', 'dashboard'].includes(activeTabRef.current)) {
        const l = await safeFetchJson('/api/bot/logs', []);
        if (l && Array.isArray(l)) {
          setLogs(prev => (prev.length === l.length && prev[0]?.timestamp === l[0]?.timestamp ? prev : l));
        }
      }
    } catch (err) {
      // ignore
    }
  }, []);

  // Initial Fetch Data
  useEffect(() => {
    fetchInitialData();
    
    // Regular statistics fetch when visible
    const statsInterval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        fetchLiveStats();
      }
    }, 20000);

    // Unconditional background keep-alive self-ping every 60 seconds (even when tab is hidden or backgrounded)
    const keepAliveInterval = setInterval(() => {
      fetch('/api/health').catch(() => {
        // ignore errors
      });
    }, 60000);

    return () => {
      clearInterval(statsInterval);
      clearInterval(keepAliveInterval);
    };
  }, []);

  // Handlers
  const handleSendMessage = useCallback(async (threadID: string, senderID: string, message: string): Promise<ShiPuBotResponse | null> => {
    const res = await fetch('/api/bot/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ threadID, senderID, message })
    });
    const data = await res.json();
    fetchLiveStats();
    return data.response;
  }, [fetchLiveStats]);

  const handleTogglePlugin = useCallback(async (name: string, enabled: boolean) => {
    await fetch('/api/bot/plugins/toggle', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({ name, enabled })
    });
    setPlugins(prev =>
      prev.map(p => (p.config.name === name ? { ...p, config: { ...p.config, enabled } } : p))
    );
  }, [adminToken]);

  const handleAddCustomPlugin = useCallback(async (pluginData: {
    name: string;
    description: string;
    category: string;
    role: number;
    code: string;
  }) => {
    const res = await fetch('/api/bot/plugins/custom', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify(pluginData)
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error);

    const cmds = await fetch('/api/bot/commands').then(r => r.json());
    setPlugins(cmds);
  }, [adminToken]);

  const handleCreateThread = useCallback(async (name: string, prefix: string) => {
    const res = await fetch('/api/bot/threads', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({ name, prefix })
    });
    const newThread = await res.json();
    setThreads(prev => [...prev, newThread]);
  }, [adminToken]);

  const handleUpdateThread = useCallback((threadID: string, data: Partial<ShiPuThread>) => {
    setThreads(prev =>
      prev.map(t => (t.threadID === threadID ? { ...t, ...data } : t))
    );
  }, []);

  const handleUpdateUser = useCallback(async (userID: string, data: Partial<ShiPuUser>) => {
    await fetch('/api/bot/users/update', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({ userID, ...data })
    });
    setUsers(prev =>
      prev.map(u => (u.userID === userID ? { ...u, ...data } : u))
    );
  }, [adminToken]);

  const handleUpdateConfig = useCallback(async (newConfig: Partial<BotConfig>) => {
    await fetch('/api/bot/settings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify(newConfig)
    });
    setConfig(prev => ({ ...prev, ...newConfig }));
  }, [adminToken]);

  const handleClearLogs = useCallback(async () => {
    await fetch('/api/bot/logs', {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    setLogs([]);
  }, [adminToken]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans flex flex-col md:flex-row antialiased selection:bg-indigo-500 selection:text-white gpu-accelerated smooth-scroll">
      
      {/* Navigation Sidebar (Desktop) & Mobile Top Bar / Drawer */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        stats={stats}
        onRestart={fetchInitialData}
        onClearLogs={handleClearLogs}
        isReloading={isReloading}
        onHotReload={handleHotReload}
        onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
        messengerStatus={(stats as any).messengerStatus}
        mongoStatus={(stats as any).mongoStatus}
        ftpStatus={(stats as any).ftpStatus}
      />

      {/* Main Workspace Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-x-hidden">
        
        {/* Desktop Header */}
        <header className="hidden md:flex items-center justify-between px-6 py-3 bg-slate-900/80 border-b border-slate-800 sticky top-0 z-30 backdrop-blur-sm">
          <div className="flex items-center space-x-3">
            {activeTab !== 'dashboard' && (
              <button
                onClick={() => setActiveTab('dashboard')}
                className="flex items-center space-x-1.5 px-3 py-1.5 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 hover:text-white rounded-xl border border-indigo-500/30 transition-all duration-200 transform hover:-translate-x-0.5 active:scale-95 group shadow-sm shrink-0"
                title="Return to Dashboard"
              >
                <ArrowLeft className="w-4 h-4 text-indigo-400 group-hover:text-white transition-transform group-hover:-translate-x-0.5" />
                <span className="text-xs font-semibold">Back to Dashboard</span>
              </button>
            )}
            <span className="font-bold text-sm text-slate-200">ShiPu Ai Control Panel</span>
            <span className="text-slate-600">/</span>
            <span className="text-xs font-semibold text-indigo-400 uppercase tracking-wide">
              {activeTab.replace('_', ' ')}
            </span>
          </div>

          <div className="flex items-center space-x-3 text-xs">
            <div className="flex items-center space-x-2 font-mono text-[11px] text-slate-400 bg-slate-950 px-3 py-1 rounded-lg border border-slate-800">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                <span className="text-emerald-400 font-semibold">ENGINE ONLINE</span>
              </span>
            </div>

            <button
              onClick={handleHotReload}
              disabled={isReloading}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-300 hover:text-white text-xs font-medium rounded-lg border border-slate-700 transition flex items-center gap-1.5"
              title={isReloading ? "Reloading ShiPu Ai Engine..." : "Hot Reload Engine"}
            >
              <RefreshCw className={`w-3.5 h-3.5 text-indigo-400 ${isReloading ? 'animate-spin' : ''}`} />
              <span>{isReloading ? 'Reloading...' : 'Reload'}</span>
            </button>
          </div>
        </header>

        {/* Tab View Content */}
        <main className={`flex-1 ${activeTab === 'simulator' ? 'p-0 max-w-none w-full mx-0' : 'p-3 sm:p-5 lg:p-6 max-w-7xl w-full mx-auto pb-12'}`}>
          {activeTab === 'dashboard' && (
            <DashboardOverview
              stats={stats}
              totalPlugins={plugins.length}
              onNavigate={setActiveTab}
            />
          )}

          {activeTab === 'simulator' && (
            <LiveSimulator
              threads={threads}
              users={users}
              onSendMessage={handleSendMessage}
              onCreateThread={handleCreateThread}
            />
          )}

          {activeTab === 'session' && (
            <SessionManager token={adminToken} />
          )}

          {activeTab === 'client_bots' && (
            <ClientBotsView token={adminToken} />
          )}

          {activeTab === 'plugins' && (
            <PluginManager
              plugins={plugins}
              adminToken={adminToken}
              onTogglePlugin={handleTogglePlugin}
              onAddCustomPlugin={handleAddCustomPlugin}
            />
          )}

          {activeTab === 'project_files' && (
            <ProjectFileManager adminToken={adminToken} />
          )}

          {activeTab === 'threads' && (
            <ThreadManager
              threads={threads}
              onUpdateThread={handleUpdateThread}
              onCreateThread={handleCreateThread}
            />
          )}

          {activeTab === 'users' && (
            <UserDatabase users={users} onUpdateUser={handleUpdateUser} />
          )}

          {activeTab === 'crypto' && (
            <CryptoDashboard adminToken={adminToken} />
          )}

          {activeTab === 'subscription' && (
            <SubscriptionManager />
          )}

          {activeTab === 'client_site' && (
            <ClientSitePortal />
          )}

          {activeTab === 'shared_access' && (
            <SharedAccessManager />
          )}

          {activeTab === 'personal_ai' && (
            <PersonalAIRegistrationView token={adminToken} />
          )}

          {activeTab === 'bot_inbox' && (
            <CommunicationCenter />
          )}

          {activeTab === 'telegram' && (
            <TelegramManager
              adminToken={adminToken}
              showToast={(title, msg, type) => showToast(type || 'info', title, msg)}
            />
          )}

          {activeTab === 'sms_dashboard' && (
            <SmsDashboard
              token={adminToken}
              onNavigateToSimulator={(prefilledCmd) => {
                setActiveTab('simulator');
              }}
            />
          )}

          {activeTab === 'ai_providers' && (
            <AIProvidersDashboard token={adminToken} />
          )}

          {activeTab === 'aios_dashboard' && (
            <AIOSDashboard token={adminToken} />
          )}

          {activeTab === 'ai' && (
            <AIWorkbench />
          )}

          {activeTab === 'fallback_apis' && (
            <FallbackApiManager token={adminToken} />
          )}

          {activeTab === 'brain_manager' && (
            <BrainManager />
          )}

          {activeTab === 'scheduler' && (
            <SchedulerManager />
          )}

          {activeTab === 'database' && (
            <DatabaseManager token={adminToken} />
          )}

          {activeTab === 'supabase_manager' && (
            <SupabaseManager token={adminToken} />
          )}

          {activeTab === 'audit_logs' && (
            <AuditLogView token={adminToken} />
          )}

          {activeTab === 'system' && (
            <SystemManager token={adminToken} />
          )}

          {activeTab === 'adapter' && (
            <AdapterSettings config={config} onUpdateConfig={handleUpdateConfig} />
          )}

          {activeTab === 'terminal' && (
            <ConsoleTerminal logs={logs} onClearLogs={handleClearLogs} />
          )}
        </main>
      </div>

      {/* Global Command Palette (Ctrl+K / Cmd+K) */}
      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        onNavigate={setActiveTab}
        onHotReload={handleHotReload}
        onClearLogs={handleClearLogs}
        activeTab={activeTab}
        stats={stats}
      />

      {/* Floating Toast Notification */}
      {toast && (
        <div className="fixed bottom-5 right-5 z-50 max-w-sm w-full bg-slate-900 border border-slate-700 rounded-2xl p-4 shadow-2xl backdrop-blur-md flex items-start space-x-3 animate-in fade-in slide-in-from-bottom-5 duration-200">
          <div className="shrink-0 mt-0.5">
            {toast.type === 'info' && <RefreshCw className="w-5 h-5 text-indigo-400 animate-spin" />}
            {toast.type === 'success' && <CheckCircle2 className="w-5 h-5 text-emerald-400" />}
            {toast.type === 'error' && <AlertCircle className="w-5 h-5 text-rose-400" />}
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="text-xs font-bold text-slate-100">{toast.message}</h4>
            {toast.subtext && <p className="text-[11px] text-slate-400 mt-0.5">{toast.subtext}</p>}
          </div>
          <button
            onClick={() => setToast(null)}
            className="p-1 text-slate-400 hover:text-slate-200 rounded-lg shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

    </div>
  );
}
