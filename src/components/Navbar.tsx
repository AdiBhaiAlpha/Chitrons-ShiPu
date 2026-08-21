import React, { useState } from 'react';
import {
  BarChart3,
  MessageSquare,
  Key,
  Users2,
  Wallet,
  Landmark,
  Puzzle,
  FileCode,
  Sparkles,
  Calendar,
  Database,
  ShieldAlert,
  Server,
  Settings,
  Terminal,
  RefreshCw,
  Trash2,
  Bot,
  Menu,
  X,
  ChevronRight,
  ArrowLeft,
  ShieldCheck,
  Brain,
  Cpu,
  Command,
  Inbox,
  CreditCard,
  Globe,
  Smartphone,
  Send
} from 'lucide-react';
import { BotSystemStats } from '../types/shipu';

interface NavbarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  stats: BotSystemStats;
  onRestart: () => void;
  onClearLogs: () => void;
  isReloading?: boolean;
  onHotReload?: () => void;
  onOpenCommandPalette?: () => void;
  messengerStatus?: string;
  mongoStatus?: string;
  ftpStatus?: string;
}

export const Navbar: React.FC<NavbarProps> = React.memo(({
  activeTab,
  setActiveTab,
  stats,
  onRestart,
  onClearLogs,
  isReloading = false,
  onHotReload,
  onOpenCommandPalette,
  messengerStatus = 'DISCONNECTED',
  mongoStatus = 'DISCONNECTED',
  ftpStatus = 'NOT_CONFIGURED'
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);

  const handleReload = onHotReload || onRestart;

  const sections = [
    {
      group: 'Overview',
      items: [
        { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
        { id: 'personal_ai', label: 'Personal AI', icon: Bot },
        { id: 'bot_inbox', label: 'Communication Center', icon: Inbox },
        { id: 'simulator', label: 'Live Simulator', icon: MessageSquare },
        { id: 'session', label: 'Session Manager', icon: Key },
        { id: 'client_bots', label: 'Client Bots', icon: Sparkles },
        { id: 'client_site', label: 'Client Site Portal', icon: Globe }
      ]
    },
    {
      group: 'Management',
      items: [
        { id: 'threads', label: 'Groups & Threads', icon: Users2 },
        { id: 'users', label: 'Users & Roles', icon: Wallet },
        { id: 'crypto', label: 'Crypto & Banking', icon: Landmark },
        { id: 'subscription', label: 'Bot Subscription', icon: CreditCard },
        { id: 'shared_access', label: 'Shared Access', icon: ShieldCheck },
        { id: 'plugins', label: 'Commands', icon: Puzzle },
        { id: 'project_files', label: 'Project Files', icon: FileCode }
      ]
    },
    {
      group: 'Services',
      items: [
        { id: 'telegram', label: 'Telegram Bot', icon: Send },
        { id: 'sms_dashboard', label: 'SMS Gateway Monitor', icon: Smartphone },
        { id: 'ai_providers', label: 'AI Providers', icon: Sparkles },
        { id: 'aios_dashboard', label: 'SHIPU AIOS', icon: Cpu },
        { id: 'ai', label: 'AI Workbench', icon: Sparkles },
        { id: 'fallback_apis', label: 'Fallback APIs', icon: RefreshCw },
        { id: 'brain_manager', label: 'Brain Manager', icon: Brain },
        { id: 'scheduler', label: 'Scheduler', icon: Calendar },
        { id: 'database', label: 'MongoDB & FTP', icon: Database }
      ]
    },
    {
      group: 'System',
      items: [
        { id: 'audit_logs', label: 'Audit Trail', icon: ShieldAlert },
        { id: 'system', label: 'Runtime Inspector', icon: Server },
        { id: 'adapter', label: 'Adapter Config', icon: Settings },
        { id: 'terminal', label: 'Console Logs', icon: Terminal },
        { id: 'supabase_manager', label: 'Supabase Cloud', icon: Database }
      ]
    }
  ];

  const formatUptime = (secs: number) => {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m ${s}s`;
  };

  const handleSelectTab = (tabId: string) => {
    setActiveTab(tabId);
    setMobileMenuOpen(false);
  };

  return (
    <>
      {/* MOBILE TOP BAR (visible on md:hidden) */}
      <div className="md:hidden bg-slate-900 border-b border-slate-800 text-slate-100 sticky top-0 z-40">
        <div className="px-4 py-3 flex items-center justify-between">
          {/* Brand & Mobile Back Button */}
          <div className="flex items-center space-x-2.5">
            {activeTab !== 'dashboard' && (
              <button
                onClick={() => setActiveTab('dashboard')}
                className="p-1.5 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 rounded-lg border border-indigo-500/30 transition flex items-center gap-1 text-xs font-semibold"
                title="Back to Dashboard"
              >
                <ArrowLeft className="w-4 h-4 text-indigo-400" />
                <span className="hidden sm:inline">Dashboard</span>
              </button>
            )}
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center shrink-0">
              <Bot className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center space-x-1.5">
                <span className="font-bold text-sm tracking-tight text-white">ShiPu Ai</span>
                <span className="text-[10px] text-slate-400 font-mono">v2.5</span>
              </div>
              <p className="text-[11px] text-slate-400">Control Panel</p>
            </div>
          </div>

          {/* Quick Actions & Menu Toggle */}
          <div className="flex items-center space-x-2">
            {onOpenCommandPalette && (
              <button
                onClick={onOpenCommandPalette}
                className="p-1.5 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 rounded-lg border border-indigo-500/30 transition flex items-center gap-1"
                title="Quick Command Palette (Ctrl+K)"
              >
                <Command className="w-4 h-4 text-indigo-400" />
              </button>
            )}
            <button
              onClick={handleReload}
              disabled={isReloading}
              className="p-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-300 rounded-lg border border-slate-700 transition"
              title={isReloading ? "Reloading ShiPu Ai Engine..." : "Hot Reload Engine"}
            >
              <RefreshCw className={`w-4 h-4 text-indigo-400 ${isReloading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg border border-slate-700 transition"
              aria-label="Toggle navigation"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Subheader status bar on mobile */}
        <div className="px-4 py-1.5 bg-slate-950 border-t border-slate-800/80 flex items-center justify-between text-[11px] font-mono text-slate-400">
          <div className="flex items-center space-x-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0"></span>
            <span className="text-slate-200 font-medium">Engine Online</span>
            <span>·</span>
            <span>{formatUptime(stats.uptimeSeconds)}</span>
          </div>

          <div className="flex items-center space-x-2 text-[10px]">
            <span className={messengerStatus === 'CONNECTED' ? 'text-emerald-400' : 'text-slate-500'}>
              FB: {messengerStatus === 'CONNECTED' ? 'ON' : 'OFF'}
            </span>
            <span className={mongoStatus === 'CONNECTED' ? 'text-emerald-400' : 'text-slate-500'}>
              DB: {mongoStatus === 'CONNECTED' ? 'ON' : 'OFF'}
            </span>
            <span className={ftpStatus === 'CONFIGURED' ? 'text-amber-400' : 'text-slate-500'}>
              FTP: {ftpStatus === 'CONFIGURED' ? 'ON' : 'OFF'}
            </span>
          </div>
        </div>
      </div>

      {/* MOBILE DRAWER OVERLAY */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex flex-col bg-slate-950/95 backdrop-blur-md">
          <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-900">
            <div className="flex items-center space-x-2">
              <Bot className="w-5 h-5 text-indigo-400" />
              <span className="font-bold text-sm text-white">ShiPu Ai Navigation</span>
            </div>
            <button
              onClick={() => setMobileMenuOpen(false)}
              className="p-1.5 text-slate-400 hover:text-slate-100 rounded-lg bg-slate-800"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-5">
            {sections.map(section => (
              <div key={section.group} className="space-y-1">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 px-2 py-1">
                  {section.group}
                </div>
                <div className="grid grid-cols-1 gap-1">
                  {section.items.map(item => {
                    const Icon = item.icon;
                    const isActive = activeTab === item.id;
                    return (
                      <button
                        key={item.id}
                        onClick={() => handleSelectTab(item.id)}
                        className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs transition ${
                          isActive
                            ? 'bg-indigo-600 text-white font-semibold shadow-md shadow-indigo-600/20'
                            : 'text-slate-300 hover:bg-slate-900 hover:text-white'
                        }`}
                      >
                        <div className="flex items-center space-x-2.5">
                          <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                          <span>{item.label}</span>
                        </div>
                        {isActive && <ChevronRight className="w-3.5 h-3.5 text-indigo-200" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          <div className="p-4 border-t border-slate-800 bg-slate-900 flex items-center justify-between text-xs">
            <button
              onClick={() => { handleReload(); setMobileMenuOpen(false); }}
              disabled={isReloading}
              className="px-3 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 rounded-xl border border-slate-700 flex items-center gap-1.5 transition"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-indigo-400 ${isReloading ? 'animate-spin' : ''}`} />
              <span>{isReloading ? 'Reloading...' : 'Reload Engine'}</span>
            </button>
            <button
              onClick={() => { onClearLogs(); setMobileMenuOpen(false); }}
              className="px-3 py-2 bg-slate-800 text-slate-200 rounded-xl border border-slate-700 flex items-center gap-1.5"
            >
              <Trash2 className="w-3.5 h-3.5 text-rose-400" />
              <span>Clear Logs</span>
            </button>
          </div>
        </div>
      )}

      {/* DESKTOP SIDEBAR (visible on md:flex) */}
      <aside className="hidden md:flex md:w-60 lg:w-64 flex-col bg-slate-900 border-r border-slate-800 shrink-0 min-h-screen sticky top-0 h-screen overflow-y-auto">
        {/* Brand Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-xl bg-indigo-600 flex items-center justify-center shrink-0 shadow-md shadow-indigo-600/30">
              <Bot className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center space-x-1.5">
                <span className="font-bold text-sm tracking-tight text-white">ShiPu Ai</span>
                <span className="px-1.5 py-0.2 text-[10px] font-mono bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded">v2.5</span>
              </div>
              <p className="text-[11px] text-slate-400">Control Panel</p>
            </div>
          </div>
        </div>

        {/* Command Palette Quick Search Button */}
        {onOpenCommandPalette && (
          <div className="px-3 pt-3">
            <button
              onClick={onOpenCommandPalette}
              className="w-full flex items-center justify-between px-3 py-2 bg-slate-950 hover:bg-slate-800 text-slate-300 hover:text-white rounded-xl border border-slate-800/80 transition text-xs font-medium group"
              title="Open Command Palette (Ctrl+K)"
            >
              <div className="flex items-center space-x-2">
                <Command className="w-3.5 h-3.5 text-indigo-400 group-hover:scale-110 transition-transform" />
                <span>Quick Command</span>
              </div>
              <kbd className="px-1.5 py-0.5 text-[10px] font-mono bg-slate-900 border border-slate-700 rounded text-slate-400">
                ⌘K
              </kbd>
            </button>
          </div>
        )}

        {/* Navigation Section Groups */}
        <div className="flex-1 p-3 space-y-4">
          {sections.map(section => (
            <div key={section.group} className="space-y-1">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 px-2 py-0.5">
                {section.group}
              </div>
              <div className="space-y-0.5">
                {section.items.map(item => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => setActiveTab(item.id)}
                      className={`w-full flex items-center space-x-2.5 px-2.5 py-2 rounded-lg text-xs transition ${
                        isActive
                          ? 'bg-slate-800 text-white font-semibold border-l-2 border-indigo-500'
                          : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                      }`}
                    >
                      <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-indigo-400' : 'text-slate-500'}`} />
                      <span className="truncate">{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Desktop Sidebar Footer */}
        <div className="p-3 border-t border-slate-800 bg-slate-950/60 space-y-2 text-xs">
          <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
            <div className="flex items-center space-x-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span className="text-emerald-400 font-medium">ENGINE ONLINE</span>
            </div>
            <span>{formatUptime(stats.uptimeSeconds)}</span>
          </div>

          <div className="flex items-center space-x-1 pt-1">
            <button
              onClick={handleReload}
              disabled={isReloading}
              className="flex-1 px-2 py-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-300 text-[11px] font-medium rounded-md border border-slate-700 transition flex items-center justify-center gap-1"
              title={isReloading ? "Reloading ShiPu Ai Engine..." : "Reload Engine"}
            >
              <RefreshCw className={`w-3 h-3 text-indigo-400 ${isReloading ? 'animate-spin' : ''}`} />
              <span>{isReloading ? 'Reloading...' : 'Reload'}</span>
            </button>
            <button
              onClick={onClearLogs}
              className="px-2 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-medium rounded-md border border-slate-700 transition flex items-center justify-center gap-1"
              title="Clear Logs"
            >
              <Trash2 className="w-3 h-3 text-rose-400" />
              <span>Clear</span>
            </button>
          </div>
        </div>
      </aside>
    </>
  );
});
