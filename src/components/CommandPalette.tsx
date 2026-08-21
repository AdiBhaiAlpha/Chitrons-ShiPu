import React, { useState, useEffect, useRef } from 'react';
import {
  Search,
  Command,
  BarChart3,
  MessageSquare,
  Key,
  Users2,
  Wallet,
  ShieldCheck,
  Puzzle,
  FileCode,
  Cpu,
  Sparkles,
  Brain,
  Calendar,
  Database,
  ShieldAlert,
  Server,
  Settings,
  Terminal,
  RefreshCw,
  Trash2,
  X,
  ArrowRight,
  Smartphone
} from 'lucide-react';
import { BotSystemStats } from '../types/shipu';

export interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (tab: string) => void;
  onHotReload: () => void;
  onClearLogs: () => void;
  activeTab?: string;
  stats?: BotSystemStats;
}

interface CommandItem {
  id: string;
  label: string;
  description: string;
  category: 'Navigation' | 'System Action';
  icon: React.ElementType;
  action: () => void;
  shortcut?: string;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  onNavigate,
  onHotReload,
  onClearLogs,
  activeTab
}) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const commandItems: CommandItem[] = [
    // Navigation items
    {
      id: 'nav-dashboard',
      label: 'Dashboard Overview',
      description: 'System health, real-time memory & CPU charts, quick telemetry',
      category: 'Navigation',
      icon: BarChart3,
      action: () => onNavigate('dashboard')
    },
    {
      id: 'nav-simulator',
      label: 'Live Simulator',
      description: 'Interactive chat sandbox to test ShiPu bot commands live',
      category: 'Navigation',
      icon: MessageSquare,
      action: () => onNavigate('simulator')
    },
    {
      id: 'nav-session',
      label: 'Session Manager',
      description: 'Manage Facebook appState cookies, tokens & multi-account sessions',
      category: 'Navigation',
      icon: Key,
      action: () => onNavigate('session')
    },
    {
      id: 'nav-threads',
      label: 'Groups & Threads',
      description: 'Connected Facebook group threads, prefixes & permissions',
      category: 'Navigation',
      icon: Users2,
      action: () => onNavigate('threads')
    },
    {
      id: 'nav-users',
      label: 'Users & Economy',
      description: 'Registered bot users, exp, coins, ranks & user management',
      category: 'Navigation',
      icon: Wallet,
      action: () => onNavigate('users')
    },
    {
      id: 'nav-shared_access',
      label: 'Shared Access Manager',
      description: 'Temporary admin tokens, access expiration & security rules',
      category: 'Navigation',
      icon: ShieldCheck,
      action: () => onNavigate('shared_access')
    },
    {
      id: 'nav-sms_dashboard',
      label: 'SMS Gateway Monitor',
      description: 'Monitor active virtual SMS simulations, round logs, and gateway routes',
      category: 'Navigation',
      icon: Smartphone,
      action: () => onNavigate('sms_dashboard')
    },
    {
      id: 'nav-plugins',
      label: 'Commands & Plugins',
      description: 'View, toggle, upload or edit custom Javascript bot plugins',
      category: 'Navigation',
      icon: Puzzle,
      action: () => onNavigate('plugins')
    },
    {
      id: 'nav-project_files',
      label: 'Project Files',
      description: 'Browse, inspect & edit project source files and commands',
      category: 'Navigation',
      icon: FileCode,
      action: () => onNavigate('project_files')
    },
    {
      id: 'nav-aios_dashboard',
      label: 'SHIPU AIOS Dashboard',
      description: 'Advanced AI Operating System pipeline & stage telemetry',
      category: 'Navigation',
      icon: Cpu,
      action: () => onNavigate('aios_dashboard')
    },
    {
      id: 'nav-ai',
      label: 'AI Workbench',
      description: 'Test Gemini AI models, prompt tuning & token parameters',
      category: 'Navigation',
      icon: Sparkles,
      action: () => onNavigate('ai')
    },
    {
      id: 'nav-brain',
      label: 'Brain Manager',
      description: 'Smart conversation brain settings, memory & auto-replies',
      category: 'Navigation',
      icon: Brain,
      action: () => onNavigate('brain_manager')
    },
    {
      id: 'nav-scheduler',
      label: 'Scheduler',
      description: 'Cron jobs, automated announcements & scheduled tasks',
      category: 'Navigation',
      icon: Calendar,
      action: () => onNavigate('scheduler')
    },
    {
      id: 'nav-database',
      label: 'MongoDB & FTP Storage',
      description: 'Database connections, collections & remote FTP synchronization',
      category: 'Navigation',
      icon: Database,
      action: () => onNavigate('database')
    },
    {
      id: 'nav-audit_logs',
      label: 'Audit Trail',
      description: 'Security logs, access audit events & system action history',
      category: 'Navigation',
      icon: ShieldAlert,
      action: () => onNavigate('audit_logs')
    },
    {
      id: 'nav-system',
      label: 'Runtime Inspector',
      description: 'Node process memory, garbage collection & performance metrics',
      category: 'Navigation',
      icon: Server,
      action: () => onNavigate('system')
    },
    {
      id: 'nav-adapter',
      label: 'Adapter Config',
      description: 'Facebook FCA providers (Xnil, DongDev, Xaviabot) settings',
      category: 'Navigation',
      icon: Settings,
      action: () => onNavigate('adapter')
    },
    {
      id: 'nav-terminal',
      label: 'Console Logs',
      description: 'Real-time terminal output, debug logs & error traces',
      category: 'Navigation',
      icon: Terminal,
      action: () => onNavigate('terminal')
    },

    // System Actions
    {
      id: 'action-reload',
      label: 'Hot Reload Bot Engine',
      description: 'Re-instantiate plugins, commands & refresh session state in background',
      category: 'System Action',
      icon: RefreshCw,
      shortcut: 'R',
      action: () => {
        onHotReload();
      }
    },
    {
      id: 'action-clear-logs',
      label: 'Clear Terminal & Console Logs',
      description: 'Flush current log memory buffers across client & server view',
      category: 'System Action',
      icon: Trash2,
      action: () => {
        onClearLogs();
      }
    }
  ];

  const filteredItems = commandItems.filter(item => {
    const q = query.toLowerCase().trim();
    if (!q) return true;
    return (
      item.label.toLowerCase().includes(q) ||
      item.description.toLowerCase().includes(q) ||
      item.category.toLowerCase().includes(q)
    );
  });

  // Focus input when modal opens
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    }
  }, [isOpen]);

  // Handle keyboard events inside command palette
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => (prev + 1) % Math.max(1, filteredItems.length));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => (prev - 1 + filteredItems.length) % Math.max(1, filteredItems.length));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (filteredItems[selectedIndex]) {
          filteredItems[selectedIndex].action();
          onClose();
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, filteredItems, selectedIndex, onClose]);

  // Keep selected item in view
  useEffect(() => {
    if (listRef.current) {
      const selectedEl = listRef.current.children[selectedIndex] as HTMLElement;
      if (selectedEl) {
        selectedEl.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [selectedIndex]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 sm:pt-24 px-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-150">
      {/* Backdrop Click */}
      <div className="absolute inset-0" onClick={onClose} />

      {/* Palette Modal Container */}
      <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden z-10 flex flex-col max-h-[80vh]">
        {/* Search Header Input */}
        <div className="flex items-center px-4 py-3.5 border-b border-slate-800 bg-slate-900/90 gap-3">
          <Command className="w-5 h-5 text-indigo-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            placeholder="Type a command or search tabs (e.g. Dashboard, Hot Reload, Plugins)..."
            className="flex-1 bg-transparent border-none outline-none text-slate-100 text-sm placeholder-slate-500 font-medium"
          />
          {query && (
            <button
              onClick={() => {
                setQuery('');
                setSelectedIndex(0);
              }}
              className="p-1 text-slate-400 hover:text-slate-200 rounded-md"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <kbd className="hidden sm:inline-block px-2 py-0.5 text-[10px] font-mono text-slate-400 bg-slate-800 border border-slate-700 rounded-md">
            ESC
          </kbd>
        </div>

        {/* Results List */}
        <div ref={listRef} className="flex-1 overflow-y-auto p-2 space-y-1">
          {filteredItems.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-xs">
              <Search className="w-6 h-6 text-slate-600 mx-auto mb-2" />
              No commands found matching "<span className="text-slate-200">{query}</span>"
            </div>
          ) : (
            filteredItems.map((item, idx) => {
              const Icon = item.icon;
              const isSelected = idx === selectedIndex;
              const isCurrentActive = activeTab && item.id.replace('nav-', '') === activeTab;

              return (
                <div
                  key={item.id}
                  onClick={() => {
                    item.action();
                    onClose();
                  }}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-left cursor-pointer transition ${
                    isSelected
                      ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20 font-medium'
                      : 'text-slate-300 hover:bg-slate-800/80'
                  }`}
                >
                  <div className="flex items-center space-x-3 min-w-0 pr-2">
                    <div
                      className={`p-2 rounded-lg shrink-0 ${
                        isSelected
                          ? 'bg-indigo-500/30 text-white'
                          : 'bg-slate-800 text-indigo-400 border border-slate-700/60'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center space-x-2">
                        <span className={`text-xs font-semibold truncate ${isSelected ? 'text-white' : 'text-slate-200'}`}>
                          {item.label}
                        </span>
                        {isCurrentActive && (
                          <span
                            className={`px-1.5 py-0.2 text-[9px] font-mono rounded ${
                              isSelected ? 'bg-indigo-500 text-white' : 'bg-slate-800 text-indigo-400 border border-slate-700'
                            }`}
                          >
                            ACTIVE
                          </span>
                        )}
                      </div>
                      <p className={`text-[11px] truncate ${isSelected ? 'text-indigo-100' : 'text-slate-400'}`}>
                        {item.description}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2 shrink-0">
                    <span
                      className={`text-[10px] font-mono px-2 py-0.5 rounded ${
                        isSelected
                          ? 'bg-indigo-500/40 text-white'
                          : 'bg-slate-950/60 text-slate-500 border border-slate-800'
                      }`}
                    >
                      {item.category}
                    </span>
                    {isSelected && <ArrowRight className="w-4 h-4 text-indigo-200" />}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer Shortcut Bar */}
        <div className="px-4 py-2.5 bg-slate-950 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
          <div className="flex items-center space-x-3">
            <span className="flex items-center space-x-1">
              <kbd className="px-1.5 py-0.5 bg-slate-800 border border-slate-700 rounded text-[10px] font-mono text-slate-300">
                ↑
              </kbd>
              <kbd className="px-1.5 py-0.5 bg-slate-800 border border-slate-700 rounded text-[10px] font-mono text-slate-300">
                ↓
              </kbd>
              <span>Navigate</span>
            </span>
            <span className="flex items-center space-x-1">
              <kbd className="px-1.5 py-0.5 bg-slate-800 border border-slate-700 rounded text-[10px] font-mono text-slate-300">
                ↵
              </kbd>
              <span>Select</span>
            </span>
          </div>

          <div className="flex items-center space-x-1 font-mono text-[10px] text-slate-500">
            <span>Press</span>
            <kbd className="px-1.5 py-0.5 bg-slate-800 border border-slate-700 rounded text-slate-300">
              Ctrl + K
            </kbd>
            <span>anytime</span>
          </div>
        </div>
      </div>
    </div>
  );
};
