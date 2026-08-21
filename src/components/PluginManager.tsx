import React, { useState, useEffect } from 'react';
import {
  Puzzle,
  Search,
  Code2,
  Plus,
  Shield,
  Clock,
  UserCheck,
  CheckCircle2,
  XCircle,
  Zap,
  Play,
  FileCode,
  Save,
  Trash2,
  RefreshCw,
  FolderOpen,
  Sparkles,
  Layers,
  AlertCircle,
  UploadCloud,
  FileArchive,
  FileCheck,
  Table,
  Gauge,
  Activity,
  Terminal,
  Copy,
  Check,
  ArrowUpDown,
  BarChart2
} from 'lucide-react';
import { ShiPuCommandConfig } from '../types/shipu';

export interface CommandFileItem {
  name: string;
  filename: string;
  description: string;
  category: string;
  role: number;
  aliases: string[];
  guide: string;
  countDown: number;
  enabled: boolean;
  author: string;
  version: string;
  code: string;
  updatedAt?: string;
}

export interface PluginMetric {
  commandName: string;
  category: string;
  totalExecutions: number;
  successCount: number;
  failureCount: number;
  totalDurationMs: number;
  avgExecutionTimeMs: number;
  minExecutionTimeMs: number;
  maxExecutionTimeMs: number;
  lastExecutedAt: string | null;
  lastError: string | null;
}

interface PluginManagerProps {
  plugins?: { config: ShiPuCommandConfig; hasCode?: boolean }[];
  adminToken?: string;
  onTogglePlugin?: (pluginName: string, enabled: boolean) => void;
  onAddCustomPlugin?: (data: {
    name: string;
    description: string;
    category: string;
    role: number;
    code: string;
  }) => Promise<void>;
}

export const PluginManager: React.FC<PluginManagerProps> = React.memo(({
  adminToken = 'default_admin_session'
}) => {
  const [commandFiles, setCommandFiles] = useState<CommandFileItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [activeFile, setActiveFile] = useState<CommandFileItem | null>(null);

  // Performance Metrics State
  const [metricsMap, setMetricsMap] = useState<Record<string, PluginMetric>>({});
  const [overallStats, setOverallStats] = useState<{
    totalRequests: number;
    avgLatency: number;
    successRate: number;
  } | null>(null);
  const [sortBy, setSortBy] = useState<'name' | 'executionTime' | 'errorRate' | 'executions'>('name');

  // Editor State
  const [editorName, setEditorName] = useState('');
  const [editorFilename, setEditorFilename] = useState('');
  const [editorDescription, setEditorDescription] = useState('');
  const [editorCategory, setEditorCategory] = useState('Custom');
  const [editorRole, setEditorRole] = useState<number>(0);
  const [editorCooldown, setEditorCooldown] = useState<number>(2);
  const [editorAliases, setEditorAliases] = useState('');
  const [editorGuide, setEditorGuide] = useState('');
  const [editorCode, setEditorCode] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Modal State for New Command
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newCmdName, setNewCmdName] = useState('');
  const [newCmdCategory, setNewCmdCategory] = useState('Custom');
  const [newCmdRole, setNewCmdRole] = useState<number>(0);
  const [newCmdTemplate, setNewCmdTemplate] = useState('basic');

  // Modal State for Quick Test
  const [showTestModal, setShowTestModal] = useState(false);
  const [testCmdName, setTestCmdName] = useState('');
  const [testArgs, setTestArgs] = useState('');
  const [testRole, setTestRole] = useState<number>(3); // Default Bot Owner (Role 3)
  const [isTesting, setIsTesting] = useState(false);
  const [copiedResult, setCopiedResult] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    commandName: string;
    rawInput: string;
    response?: string;
    error?: string;
    durationMs: number;
    timestamp: string;
  } | null>(null);

  // ZIP Importer State
  const [showZipModal, setShowZipModal] = useState(false);
  const [isImportingZip, setIsImportingZip] = useState(false);
  const [zipReport, setZipReport] = useState<any>(null);

  // Bulk Actions State
  const [selectedPluginNames, setSelectedPluginNames] = useState<string[]>([]);
  const [showBulkConfirmModal, setShowBulkConfirmModal] = useState<{
    action: 'enable' | 'disable' | 'delete';
    isOpen: boolean;
  } | null>(null);

  const categories = ['All', 'system', 'admin', 'economy', 'fun', 'ai', 'Custom'];

  useEffect(() => {
    fetchCommandFiles();
    fetchPerformanceMetrics();
    fetchZipReport();
  }, []);

  const handleToggleSelectPlugin = (name: string) => {
    setSelectedPluginNames(prev =>
      prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name]
    );
  };

  const handleBulkAction = async (action: 'enable' | 'disable' | 'delete') => {
    if (selectedPluginNames.length === 0) return;

    setIsLoading(true);
    setStatusMessage(null);
    try {
      const res = await fetch('/api/bot/commands/bulk-action', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`
        },
        body: JSON.stringify({
          action,
          names: selectedPluginNames
        })
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || 'Failed to execute bulk action');
      }
      setStatusMessage({
        type: 'success',
        text: `🚀 Bulk Action Complete: Successfully ${action === 'enable' ? 'enabled' : action === 'disable' ? 'disabled' : 'deleted'} ${selectedPluginNames.length} commands and hot-reloaded the bot!`
      });
      setSelectedPluginNames([]);
      await fetchCommandFiles();
      await fetchPerformanceMetrics();
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Error processing bulk action' });
    } finally {
      setIsLoading(false);
      setShowBulkConfirmModal(null);
    }
  };

  const fetchZipReport = async () => {
    try {
      const res = await fetch('/api/bot/plugins/import-report');
      const data = await res.json();
      if (data && data.report) {
        setZipReport(data.report);
      }
    } catch {}
  };

  const fetchPerformanceMetrics = async () => {
    try {
      const res = await fetch('/api/system/performance');
      const data = await res.json();
      if (data && Array.isArray(data.commandStats)) {
        const map: Record<string, PluginMetric> = {};
        data.commandStats.forEach((stat: PluginMetric) => {
          map[stat.commandName.toLowerCase()] = stat;
        });
        setMetricsMap(map);
      }
      if (data && data.summary) {
        setOverallStats({
          totalRequests: data.summary.totalRequests || 0,
          avgLatency: data.summary.overallAvgExecutionTimeMs || 0,
          successRate: data.summary.successRatePercent || 100
        });
      }
    } catch (err) {
      console.error('Failed to fetch performance metrics:', err);
    }
  };

  const handleImportZip = async (zipBase64?: string) => {
    setIsImportingZip(true);
    setStatusMessage(null);
    try {
      const res = await fetch('/api/bot/plugins/import-zip', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`
        },
        body: JSON.stringify({ zipBase64 })
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || 'ZIP Import failed');
      }
      setZipReport(data.report);
      setStatusMessage({
        type: 'success',
        text: `🎉 ZIP Import Completed! Converted ${data.report.successfullyConverted + data.report.convertedWithAdapter} command files into Database & hot-reloaded!`
      });
      await fetchCommandFiles();
      await fetchPerformanceMetrics();
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Error importing ZIP collection' });
    } finally {
      setIsImportingZip(false);
    }
  };

  const handleZipFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const result = evt.target?.result as string;
      const base64 = result.split(',')[1] || result;
      handleImportZip(base64);
    };
    reader.readAsDataURL(file);
  };

  const fetchCommandFiles = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/bot/commands');
      const data = await res.json();
      if (Array.isArray(data)) {
        setCommandFiles(data);
        if (data.length > 0 && !activeFile) {
          selectFileForEditing(data[0]);
        }
      }
    } catch (err: any) {
      console.error('Failed to load command files:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const selectFileForEditing = (file: CommandFileItem) => {
    setActiveFile(file);
    setEditorName(file.name);
    setEditorFilename(file.filename || `${file.name}.js`);
    setEditorDescription(file.description || '');
    setEditorCategory(file.category || 'Custom');
    setEditorRole(file.role ?? 0);
    setEditorCooldown(file.countDown ?? 2);
    setEditorAliases(file.aliases ? file.aliases.join(', ') : '');
    setEditorGuide(file.guide || `{pref}${file.name}`);
    setEditorCode(file.code || `// Command Source Code for ${file.name}\nawait message.reply("Command executed successfully!");`);
  };

  const handleSaveAndPublish = async () => {
    if (!editorName.trim() || !editorCode.trim()) {
      setStatusMessage({ type: 'error', text: 'Command Name and Source Code are required!' });
      return;
    }

    setSaving(true);
    setStatusMessage(null);

    const aliasesArray = editorAliases
      ? editorAliases.split(',').map(s => s.trim()).filter(Boolean)
      : [];

    const payload = {
      name: editorName.toLowerCase().trim(),
      filename: editorFilename.trim() || `${editorName.toLowerCase().trim()}.js`,
      description: editorDescription,
      category: editorCategory,
      role: Number(editorRole),
      aliases: aliasesArray,
      guide: editorGuide,
      countDown: Number(editorCooldown),
      enabled: activeFile ? activeFile.enabled : true,
      author: 'ShiPu Admin (Owner)',
      version: '1.0.0',
      code: editorCode
    };

    try {
      const res = await fetch('/api/bot/commands/save', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`
        },
        body: JSON.stringify(payload)
      });

      const data = await res.json();

      if (!res.ok || data.error) {
        throw new Error(data.error || 'Failed to save command in Database');
      }

      setStatusMessage({
        type: 'success',
        text: `⚡ ${payload.filename} saved to Database & hot-reloaded live into Bot Engine without restart!`
      });

      await fetchCommandFiles();
      await fetchPerformanceMetrics();
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Error publishing command' });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteCommand = async () => {
    if (!activeFile) return;
    if (!confirm(`Are you sure you want to delete "${activeFile.filename}" from Database?`)) return;

    setDeleting(true);
    setStatusMessage(null);

    try {
      const res = await fetch(`/api/bot/commands/${activeFile.name}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${adminToken}`
        }
      });
      const data = await res.json();

      if (!res.ok || data.error) {
        throw new Error(data.error || 'Failed to delete command');
      }

      setStatusMessage({
        type: 'success',
        text: `🗑️ Command "${activeFile.filename}" deleted from Database and hot-reloaded.`
      });

      setActiveFile(null);
      await fetchCommandFiles();
      await fetchPerformanceMetrics();
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Error deleting command' });
    } finally {
      setDeleting(false);
    }
  };

  const handleOpenQuickTest = (cmd: CommandFileItem) => {
    setTestCmdName(cmd.name);
    setTestArgs('');
    setTestResult(null);
    setCopiedResult(false);
    setShowTestModal(true);
  };

  const handleExecuteQuickTest = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!testCmdName.trim()) return;

    setIsTesting(true);
    setTestResult(null);
    setCopiedResult(false);

    try {
      const res = await fetch('/api/bot/commands/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`
        },
        body: JSON.stringify({
          commandName: testCmdName.toLowerCase().trim(),
          args: testArgs,
          senderID: testRole === 3 ? '10001' : testRole === 2 ? '10002' : testRole === 1 ? '10003' : '10004',
          threadID: 'test_group_01',
          customCode: (activeFile && activeFile.name === testCmdName.toLowerCase().trim()) ? editorCode : undefined
        })
      });

      const data = await res.json();
      setTestResult(data);
      await fetchPerformanceMetrics();
    } catch (err: any) {
      setTestResult({
        success: false,
        commandName: testCmdName,
        rawInput: `#${testCmdName} ${testArgs}`,
        error: err.message || 'Failed to execute test request',
        durationMs: 0,
        timestamp: new Date().toISOString()
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleCopyTestOutput = () => {
    if (!testResult) return;
    const textToCopy = testResult.success ? (testResult.response || '') : (testResult.error || '');
    navigator.clipboard.writeText(textToCopy);
    setCopiedResult(true);
    setTimeout(() => setCopiedResult(false), 2000);
  };

  const handleCreateNewFile = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCmdName.trim()) return;

    const cleanName = newCmdName.toLowerCase().trim();
    let templateCode = '';
    let description = `Custom ${cleanName} command`;

    if (newCmdTemplate === 'reply') {
      description = `Reply Bot: Displays stylized replies with sender details`;
      templateCode = `module.exports = {
  config: {
    name: "${cleanName}",
    version: "1.0.0",
    author: "ShiPu Bot Admin",
    countDown: 3,
    role: ${newCmdRole},
    category: "${newCmdCategory.toLowerCase()}",
    shortDescription: {
      en: "Demonstrates custom formatted replies, emojis, and mention structures."
    },
    description: {
      en: "A beautiful reply boilerplate displaying stylized unicode responses and sender details."
    },
    guide: {
      en: "{pn} <your message>"
    }
  },

  onStart: async function ({ message, args, event, currentUser }) {
    const text = args.join(" ").trim();
    if (!text) {
      return message.reply("⚠️ Please provide some text to reply!\\nExample: {pn} Hello world");
    }

    const userName = currentUser ? currentUser.name : "Member";
    const senderID = event.senderID;

    const replyText = \`✦━━━━━━━━━━━━━━━━━━✦
      💬 REPLY ECHO
✦━━━━━━━━━━━━━━━━━━✦

👤 Sender: \\\${userName}
🆔 ID: \\\${senderID}
💬 Message: \\\${text}

✨ Formatting Demo:
- **Bold Text** (Auto-converted to Unicode Bold)
- *Italic Text* (Auto-converted to Unicode Italic)

✦━━━━━━━━━━━━━━━━━━✦\`;

    return message.reply(replyText);
  }
};`;
    } else if (newCmdTemplate === 'api') {
      description = `API Interaction: Fetches facts using axios asynchronously`;
      templateCode = `const axios = require("axios"); // Automatically scanned and installed by DependencyManager

module.exports = {
  config: {
    name: "${cleanName}",
    version: "1.0.0",
    author: "ShiPu Bot Admin",
    countDown: 5,
    role: ${newCmdRole},
    category: "${newCmdCategory.toLowerCase()}",
    shortDescription: {
      en: "Demonstrates asynchronous API requests and graceful error handling."
    },
    description: {
      en: "An API interaction boilerplate fetching random facts from a safe public server."
    },
    guide: {
      en: "{pn}"
    }
  },

  onStart: async function ({ message }) {
    await message.reply("⏳ Connecting to server and fetching random fact...");

    try {
      const response = await axios.get("https://catfact.ninja/fact", { timeout: 8000 });
      const fact = response.data.fact;

      const replyMsg = \`✦━━━━━━━━━━━━━━━━━━✦
     💡 RANDOM CAT FACT
✦━━━━━━━━━━━━━━━━━━✦

🐱 Fact: \\\${fact}

*Fetched asynchronously using axios with 8 second safety timeout.*
✦━━━━━━━━━━━━━━━━━━✦\`;

      return message.reply(replyMsg);
    } catch (err) {
      console.error("[API Boilerplate Error]:", err.message);
      return message.reply(\`❌ Failed to retrieve fact: \\\${err.message}\`);
    }
  }
};`;
    } else if (newCmdTemplate === 'event') {
      description = `Event Listener: Registers dynamic reply-event listener`;
      templateCode = `module.exports = {
  config: {
    name: "${cleanName}",
    version: "1.0.0",
    author: "ShiPu Bot Admin",
    countDown: 5,
    role: ${newCmdRole},
    category: "${newCmdCategory.toLowerCase()}",
    shortDescription: {
      en: "Interactive conversational flow tracking reply events."
    },
    description: {
      en: "Demonstrates how to register multi-step interactive conversation flow by tracking next reply event."
    },
    guide: {
      en: "{pn}"
    }
  },

  onStart: async function ({ message, event, globalData }) {
    const question = "❓ What is your favorite programming language?\\n(Please reply to this message to answer)";
    const replyRes = await message.reply(question);

    if (globalData && globalData.onReply) {
      globalData.onReply.set(replyRes.messageID, {
        commandName: "${cleanName}",
        authorID: event.senderID,
        messageID: replyRes.messageID
      });
    }
  },

  onReply: async function ({ message, event, Reply, globalData }) {
    const { authorID, messageID } = Reply;
    if (event.senderID !== authorID) return;

    const answer = event.body.trim();
    await message.reply(\`🎉 Awesome choice! You replied with: **\\\${answer}**.\\n\\n*Interactive multi-step session completed successfully!*\`);

    if (globalData && globalData.onReply) {
      globalData.onReply.delete(messageID);
    }
  }
};`;
    } else {
      templateCode =
        `// Command File: ${cleanName}.js\n` +
        `// Context parameters available: { message, args, event, currentUser, currentThread, usersData, threadsData, api }\n\n` +
        `const argText = args.join(' ') || 'No arguments provided';\n` +
        `await message.reply("🚀 Command \\"${cleanName}\\" executed by " + currentUser.name + "\\nArguments: " + argText);`;
    }

    const newFile: CommandFileItem = {
      name: cleanName,
      filename: `${cleanName}.js`,
      description: description,
      category: newCmdCategory,
      role: newCmdRole,
      aliases: [],
      guide: `{pref}${cleanName}`,
      countDown: 2,
      enabled: true,
      author: 'ShiPu Admin (Owner)',
      version: '1.0.0',
      code: templateCode
    };

    selectFileForEditing(newFile);
    setShowCreateModal(false);
    setNewCmdName('');
    setNewCmdTemplate('basic');
  };

  const filteredFiles = commandFiles.filter(f => {
    const matchesSearch =
      f.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      f.filename.toLowerCase().includes(searchQuery.toLowerCase()) ||
      f.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCat = selectedCategory === 'All' || f.category === selectedCategory;
    return matchesSearch && matchesCat;
  });

  const sortedFiles = [...filteredFiles].sort((a, b) => {
    const metricA = metricsMap[a.name.toLowerCase()];
    const metricB = metricsMap[b.name.toLowerCase()];

    if (sortBy === 'executionTime') {
      const timeA = metricA ? metricA.avgExecutionTimeMs : 0;
      const timeB = metricB ? metricB.avgExecutionTimeMs : 0;
      return timeB - timeA;
    }
    if (sortBy === 'errorRate') {
      const rateA = metricA && metricA.totalExecutions > 0 ? (metricA.failureCount / metricA.totalExecutions) : 0;
      const rateB = metricB && metricB.totalExecutions > 0 ? (metricB.failureCount / metricB.totalExecutions) : 0;
      return rateB - rateA;
    }
    if (sortBy === 'executions') {
      const countA = metricA ? metricA.totalExecutions : 0;
      const countB = metricB ? metricB.totalExecutions : 0;
      return countB - countA;
    }
    return a.name.localeCompare(b.name);
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">

      {/* Header & Database Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl">
        <div className="space-y-1">
          <h2 className="text-xl font-extrabold text-slate-100 flex items-center gap-2.5">
            <FolderOpen className="w-6 h-6 text-indigo-400" /> Database Command File Manager
          </h2>
          <p className="text-xs text-slate-400">
            Edit command code directly in Database with live hot-reloading & instant performance tracking.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => setShowZipModal(true)}
            className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-emerald-600/20 transition flex items-center gap-2"
          >
            <FileArchive className="w-4 h-4" />
            <span>Import ZIP Collection</span>
          </button>

          <button
            onClick={() => {
              fetchCommandFiles();
              fetchPerformanceMetrics();
            }}
            disabled={isLoading}
            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold border border-slate-700 transition flex items-center gap-2"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Reload DB & Metrics</span>
          </button>

          {/* Create from Template Dropdown Option */}
          <div className="relative group">
            <button className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl text-xs font-semibold border border-slate-700 transition flex items-center gap-1.5 shadow-sm">
              <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
              <span>Create from Template</span>
            </button>
            <div className="absolute right-0 top-full mt-1 w-56 bg-slate-950 border border-slate-800 rounded-2xl shadow-2xl p-1.5 hidden group-hover:block z-50 animate-in fade-in slide-in-from-top-1 duration-150">
              <button
                type="button"
                onClick={() => {
                  setNewCmdTemplate('reply');
                  setNewCmdName('');
                  setShowCreateModal(true);
                }}
                className="w-full text-left px-3 py-2 text-xs text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition"
              >
                💬 Reply Bot Template
              </button>
              <button
                type="button"
                onClick={() => {
                  setNewCmdTemplate('api');
                  setNewCmdName('');
                  setShowCreateModal(true);
                }}
                className="w-full text-left px-3 py-2 text-xs text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition"
              >
                💡 API Interaction Template
              </button>
              <button
                type="button"
                onClick={() => {
                  setNewCmdTemplate('event');
                  setNewCmdName('');
                  setShowCreateModal(true);
                }}
                className="w-full text-left px-3 py-2 text-xs text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition"
              >
                ❓ Event Listener Template
              </button>
            </div>
          </div>

          <button
            onClick={() => {
              setNewCmdTemplate('basic');
              setNewCmdName('');
              setShowCreateModal(true);
            }}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-indigo-600/20 transition flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            <span>New Command File</span>
          </button>
        </div>
      </div>

      {/* Performance Summary Metrics Banner */}
      {overallStats && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 flex items-center justify-between">
            <div className="space-y-0.5">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">Total Executions</span>
              <span className="text-xl font-black text-slate-100">{overallStats.totalRequests} calls</span>
            </div>
            <Activity className="w-6 h-6 text-indigo-400" />
          </div>

          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 flex items-center justify-between">
            <div className="space-y-0.5">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">Average Latency</span>
              <span className="text-xl font-black text-amber-300">⚡ {overallStats.avgLatency}ms</span>
            </div>
            <Gauge className="w-6 h-6 text-amber-400" />
          </div>

          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 flex items-center justify-between">
            <div className="space-y-0.5">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">Success Rate</span>
              <span className="text-xl font-black text-emerald-400">{overallStats.successRate}%</span>
            </div>
            <CheckCircle2 className="w-6 h-6 text-emerald-400" />
          </div>
        </div>
      )}

      {/* Unicode Font System Banner */}
      <div className="bg-slate-900/90 border border-indigo-500/20 rounded-2xl p-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Sparkles className="w-5 h-5 text-indigo-400 shrink-0" />
          <div className="text-xs">
            <span className="font-bold text-slate-200 block">Unicode Font Map Persistence (Markdown Free System)</span>
            <span className="text-slate-400">
              Bot messages auto-format markdown bold <code className="text-amber-300">**text**</code> into Unicode Sans-Serif Bold letters:
              <strong className="text-indigo-300 ml-1.5 font-mono">𝗦𝗵𝗶𝗣𝘂 𝗔𝗱𝗺𝗶𝗻 (𝗢𝘄𝗻𝗲𝗿)</strong>
            </span>
          </div>
        </div>
        <span className="px-2.5 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-mono rounded-full font-bold">
          DB FONT ACTIVE
        </span>
      </div>

      {/* Search, Filter & Sort Controls */}
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="flex items-center space-x-1.5 overflow-x-auto w-full md:w-auto pb-2 md:pb-0 no-scrollbar">
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition whitespace-nowrap ${
                selectedCategory === cat
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          {/* Sorting Dropdown */}
          <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300">
            <ArrowUpDown className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
            <select
              value={sortBy}
              onChange={(e: any) => setSortBy(e.target.value)}
              className="bg-transparent text-slate-200 text-xs font-semibold focus:outline-none cursor-pointer"
            >
              <option value="name" className="bg-slate-900">Sort by Name</option>
              <option value="executionTime" className="bg-slate-900">Sort by Latency (Slowest)</option>
              <option value="errorRate" className="bg-slate-900">Sort by Error Rate (Highest)</option>
              <option value="executions" className="bg-slate-900">Sort by Executions (Most Called)</option>
            </select>
          </div>

          <div className="relative w-full md:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search command files (*.js)..."
              className="w-full bg-slate-900 text-slate-100 placeholder-slate-500 text-xs pl-10 pr-4 py-2.5 rounded-xl border border-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>
      </div>

      {/* Status Message Notification */}
      {statusMessage && (
        <div className={`p-4 rounded-2xl border text-xs flex items-center justify-between ${
          statusMessage.type === 'success'
            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
            : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
        }`}>
          <div className="flex items-center gap-2">
            {statusMessage.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
            <span className="font-semibold">{statusMessage.text}</span>
          </div>
          <button onClick={() => setStatusMessage(null)} className="font-bold opacity-70 hover:opacity-100">✕</button>
        </div>
      )}

      {/* Main Grid: Left File Tree Explorer + Right Live Code Editor */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* Left Panel: Command Files List (5 columns) */}
        <div className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-3xl p-4 shadow-xl space-y-2.5 max-h-[720px] overflow-y-auto">
          {/* Bulk Action Toolbar */}
          {selectedPluginNames.length > 0 && (
            <div className="bg-slate-950 border border-indigo-500/30 rounded-2xl p-3 flex flex-col gap-2 shadow-lg shadow-indigo-500/5 animate-in slide-in-from-top-2 duration-200">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-300">
                  ⚡ {selectedPluginNames.length} selected
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedPluginNames([])}
                  className="text-[10px] text-slate-400 hover:text-slate-200 underline font-semibold"
                >
                  Clear
                </button>
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                <button
                  type="button"
                  onClick={() => setShowBulkConfirmModal({ action: 'enable', isOpen: true })}
                  className="px-1.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-lg text-[10px] transition text-center"
                >
                  Enable
                </button>
                <button
                  type="button"
                  onClick={() => setShowBulkConfirmModal({ action: 'disable', isOpen: true })}
                  className="px-1.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-bold rounded-lg text-[10px] border border-slate-700 transition text-center"
                >
                  Disable
                </button>
                <button
                  type="button"
                  onClick={() => setShowBulkConfirmModal({ action: 'delete', isOpen: true })}
                  className="px-1.5 py-1.5 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-lg text-[10px] transition text-center"
                >
                  Delete
                </button>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between px-2 py-1 text-xs text-slate-400 font-semibold border-b border-slate-800 pb-2">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={sortedFiles.length > 0 && sortedFiles.every(f => selectedPluginNames.includes(f.name))}
                onChange={() => {
                  const allFilteredNames = sortedFiles.map(f => f.name);
                  const isAllSelected = allFilteredNames.every(name => selectedPluginNames.includes(name));
                  if (isAllSelected) {
                    setSelectedPluginNames(prev => prev.filter(name => !allFilteredNames.includes(name)));
                  } else {
                    setSelectedPluginNames(prev => Array.from(new Set([...prev, ...allFilteredNames])));
                  }
                }}
                className="rounded border-slate-800 bg-slate-950 text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5 cursor-pointer"
              />
              <span>COMMAND FILES ({sortedFiles.length})</span>
            </div>
            <span className="text-[10px] text-indigo-400 font-mono">Metrics Live</span>
          </div>

          {sortedFiles.map(file => {
            const isSelected = activeFile?.name === file.name;
            const lineCount = (file.code || '').split('\n').length;

            const metric = metricsMap[file.name.toLowerCase()];
            const avgMs = metric ? metric.avgExecutionTimeMs : 0;
            const totalCalls = metric ? metric.totalExecutions : 0;
            const failCount = metric ? metric.failureCount : 0;
            const errorRate = totalCalls > 0 ? Math.round((failCount / totalCalls) * 100) : 0;

            return (
              <div
                key={file.name}
                className={`p-3 rounded-2xl border transition flex flex-col gap-2 ${
                  isSelected
                    ? 'bg-slate-800/90 border-indigo-500 shadow-md shadow-indigo-500/10'
                    : 'bg-slate-950/60 border-slate-800/80 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center space-x-2 min-w-0 flex-1">
                    <input
                      type="checkbox"
                      checked={selectedPluginNames.includes(file.name)}
                      onChange={(e) => {
                        e.stopPropagation();
                        handleToggleSelectPlugin(file.name);
                      }}
                      className="rounded border-slate-800 bg-slate-950 text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5 shrink-0 cursor-pointer"
                    />

                    <div
                      onClick={() => selectFileForEditing(file)}
                      className="flex items-center space-x-2.5 min-w-0 cursor-pointer flex-1"
                    >
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-mono text-[10px] font-bold shrink-0 ${
                        isSelected ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-300 border border-slate-700'
                      }`}>
                        .js
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center space-x-1.5 flex-wrap gap-y-0.5">
                          <span className="font-bold text-slate-100 text-xs truncate max-w-[120px]">
                            {file.filename || `${file.name}.js`}
                          </span>
                          <span className="text-[8px] font-bold px-1.5 py-0.5 rounded bg-slate-850 text-slate-400 border border-slate-800 uppercase">
                            {file.category}
                          </span>
                          {!file.enabled && (
                            <span className="text-[8px] font-bold px-1 py-0.5 rounded bg-rose-500/20 text-rose-400 border border-rose-500/30 uppercase">
                              Disabled
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-400 mt-0.5 truncate">{file.description || 'No description'}</p>
                      </div>
                    </div>
                  </div>

                  {/* Quick Test Action Button */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenQuickTest(file);
                      }}
                      className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-[10px] font-bold transition flex items-center gap-1 shadow-sm shadow-indigo-600/20"
                      title="Quick Test command logic"
                    >
                      <Play className="w-3 h-3 fill-current" />
                      <span>Quick Test</span>
                    </button>
                  </div>
                </div>

                {/* Individual Performance Metrics & Role Badge Row */}
                <div className="flex items-center justify-between border-t border-slate-800/60 pt-2 text-[10px] text-slate-400 font-mono">
                  <div className="flex items-center gap-2 flex-wrap">
                    {/* Execution Latency Metric */}
                    <span className={`px-1.5 py-0.5 rounded font-bold flex items-center gap-1 ${
                      avgMs > 200 ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' :
                      avgMs > 50 ? 'bg-amber-500/10 text-amber-300 border border-amber-500/20' :
                      avgMs > 0 ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                      'bg-slate-900 text-slate-500 border border-slate-800'
                    }`}>
                      <Zap className="w-2.5 h-2.5" />
                      <span>{avgMs > 0 ? `${avgMs}ms` : '~0ms'}</span>
                    </span>

                    {/* Error Rate Metric */}
                    <span className={`px-1.5 py-0.5 rounded font-bold ${
                      errorRate > 0
                        ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                        : totalCalls > 0
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        : 'bg-slate-900 text-slate-500 border border-slate-800'
                    }`}>
                      {totalCalls > 0 ? `${errorRate}% error (${totalCalls}x)` : '0 calls'}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-slate-500">{lineCount} lines</span>
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                      file.role === 3 ? 'bg-amber-500/20 text-amber-300' :
                      file.role === 2 ? 'bg-purple-500/20 text-purple-300' :
                      file.role === 1 ? 'bg-blue-500/20 text-blue-300' :
                      'bg-slate-800 text-slate-400'
                    }`}>
                      R{file.role}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Right Panel: Live Code Editor & Command Meta Form (7 columns) */}
        <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-5">

          {/* Active File Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <FileCode className="w-5 h-5 text-indigo-400" />
                <h3 className="text-lg font-black text-slate-100 font-mono">
                  {editorFilename || `${editorName}.js`}
                </h3>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Editing source code in Database. Click Publish to apply live changes without restarting.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  if (activeFile) {
                    handleOpenQuickTest(activeFile);
                  } else if (editorName) {
                    handleOpenQuickTest({
                      name: editorName,
                      filename: editorFilename || `${editorName}.js`,
                      description: editorDescription,
                      category: editorCategory,
                      role: editorRole,
                      aliases: [],
                      guide: editorGuide,
                      countDown: editorCooldown,
                      enabled: true,
                      author: 'Admin',
                      version: '1.0.0',
                      code: editorCode
                    });
                  }
                }}
                className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-indigo-600/20 transition flex items-center gap-1.5"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Quick Test</span>
              </button>

              {activeFile && (
                <button
                  onClick={handleDeleteCommand}
                  disabled={deleting}
                  className="px-3 py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 rounded-xl text-xs font-semibold border border-rose-500/20 transition flex items-center gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>{deleting ? 'Deleting...' : 'Delete'}</span>
                </button>
              )}

              <button
                onClick={handleSaveAndPublish}
                disabled={saving}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-indigo-600/20 transition flex items-center gap-2"
              >
                <Save className="w-4 h-4" />
                <span>{saving ? 'Publishing...' : 'Publish & Hot Reload'}</span>
              </button>
            </div>
          </div>

          {/* Metadata Specs Fields */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            <div>
              <label className="block text-slate-400 font-semibold mb-1">Command Name</label>
              <input
                type="text"
                value={editorName}
                onChange={e => setEditorName(e.target.value)}
                placeholder="e.g. ping"
                className="w-full bg-slate-950 text-slate-100 px-3 py-2 rounded-xl border border-slate-800 font-mono text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-slate-400 font-semibold mb-1">Category</label>
              <select
                value={editorCategory}
                onChange={e => setEditorCategory(e.target.value)}
                className="w-full bg-slate-950 text-slate-100 px-3 py-2 rounded-xl border border-slate-800 text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              >
                <option value="system">System</option>
                <option value="admin">Admin</option>
                <option value="economy">Economy</option>
                <option value="fun">Fun</option>
                <option value="ai">AI</option>
                <option value="Custom">Custom</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-400 font-semibold mb-1">Permission Role</label>
              <select
                value={editorRole}
                onChange={e => setEditorRole(Number(e.target.value))}
                className="w-full bg-slate-950 text-slate-100 px-3 py-2 rounded-xl border border-slate-800 text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              >
                <option value={0}>Role 0 - Normal User</option>
                <option value={1}>Role 1 - Group Admin</option>
                <option value={2}>Role 2 - Bot Admin</option>
                <option value={3}>Role 3 - Bot Owner</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block text-slate-400 font-semibold mb-1">Description</label>
              <input
                type="text"
                value={editorDescription}
                onChange={e => setEditorDescription(e.target.value)}
                placeholder="Command summary..."
                className="w-full bg-slate-950 text-slate-100 px-3 py-2 rounded-xl border border-slate-800 text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-slate-400 font-semibold mb-1">Aliases (comma separated)</label>
              <input
                type="text"
                value={editorAliases}
                onChange={e => setEditorAliases(e.target.value)}
                placeholder="e.g. p, latency"
                className="w-full bg-slate-950 text-slate-100 px-3 py-2 rounded-xl border border-slate-800 text-xs font-mono focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Source Code Monospaced Editor */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span className="font-semibold text-slate-300">JavaScript Source Code Execution Body</span>
              <span className="font-mono text-[11px] text-indigo-400">
                Scope: &#123; message, args, event, currentUser, currentThread, usersData, threadsData, api &#125;
              </span>
            </div>

            <textarea
              value={editorCode}
              onChange={e => setEditorCode(e.target.value)}
              rows={16}
              spellCheck={false}
              className="w-full bg-slate-950 text-emerald-400 p-4 rounded-2xl border border-slate-800 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 leading-relaxed shadow-inner"
            ></textarea>
          </div>
        </div>
      </div>

      {/* Modal: Quick Test Command Execution Modal */}
      {showTestModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 w-full max-w-xl shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3.5">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center">
                  <Play className="w-4 h-4 fill-current" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-100">
                    Quick Command Logic Test
                  </h3>
                  <p className="text-xs text-slate-400">
                    Execute command logic directly in live bot engine and inspect output & latency.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowTestModal(false)}
                className="text-slate-400 hover:text-slate-200 text-base font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleExecuteQuickTest} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Command Name</label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-slate-500 font-mono font-bold">#</span>
                    <input
                      type="text"
                      value={testCmdName}
                      onChange={e => setTestCmdName(e.target.value)}
                      placeholder="e.g. ping"
                      required
                      className="w-full bg-slate-950 text-indigo-300 pl-7 pr-3 py-2 rounded-xl border border-slate-800 text-xs font-mono font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Simulated User Role</label>
                  <select
                    value={testRole}
                    onChange={e => setTestRole(Number(e.target.value))}
                    className="w-full bg-slate-950 text-slate-200 px-3 py-2 rounded-xl border border-slate-800 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value={3}>Role 3 - Bot Owner (Full Access)</option>
                    <option value={2}>Role 2 - Bot Admin</option>
                    <option value={1}>Role 1 - Group Admin</option>
                    <option value={0}>Role 0 - Normal User</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1">Command Arguments (Optional)</label>
                <input
                  type="text"
                  value={testArgs}
                  onChange={e => setTestArgs(e.target.value)}
                  placeholder="e.g. hello world or 10"
                  className="w-full bg-slate-950 text-slate-200 px-3.5 py-2.5 rounded-xl border border-slate-800 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="flex items-center justify-between pt-1">
                <span className="text-[11px] text-slate-400 font-mono">
                  Full Input: <strong className="text-indigo-300">#{testCmdName.toLowerCase().trim()} {testArgs}</strong>
                </span>

                <button
                  type="submit"
                  disabled={isTesting}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl text-xs transition flex items-center gap-2 shadow-lg shadow-indigo-600/20"
                >
                  <Zap className={`w-4 h-4 ${isTesting ? 'animate-bounce' : ''}`} />
                  <span>{isTesting ? 'Executing Logic...' : 'Run Test'}</span>
                </button>
              </div>
            </form>

            {/* Test Execution Output Box */}
            {testResult && (
              <div className="space-y-2 border-t border-slate-800 pt-3">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] uppercase ${
                      testResult.success
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                    }`}>
                      {testResult.success ? '✓ SUCCESS' : '❌ ERROR'}
                    </span>
                    <span className="text-amber-300 font-mono text-[11px] font-bold">
                      ⚡ {testResult.durationMs}ms
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={handleCopyTestOutput}
                    className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg text-[10px] font-semibold transition flex items-center gap-1"
                  >
                    {copiedResult ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedResult ? 'Copied!' : 'Copy Output'}</span>
                  </button>
                </div>

                <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 max-h-56 overflow-y-auto font-mono text-xs text-slate-200 leading-relaxed whitespace-pre-wrap shadow-inner">
                  {testResult.success ? (
                    <div>{testResult.response}</div>
                  ) : (
                    <div className="text-rose-400">{testResult.error}</div>
                  )}
                </div>
              </div>
            )}

            <div className="flex justify-end pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setShowTestModal(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Create New Command File */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 w-full max-w-md shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <Code2 className="w-5 h-5 text-indigo-400" /> Create New Command File
              </h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-slate-200 text-base font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateNewFile} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-300 mb-1">Command Name</label>
                <input
                  type="text"
                  value={newCmdName}
                  onChange={e => setNewCmdName(e.target.value)}
                  placeholder="e.g. echo"
                  required
                  className="w-full bg-slate-800 text-slate-100 px-3.5 py-2.5 rounded-xl border border-slate-700 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1">Create from Template</label>
                <select
                  value={newCmdTemplate}
                  onChange={e => setNewCmdTemplate(e.target.value)}
                  className="w-full bg-slate-800 text-slate-100 px-3.5 py-2.5 rounded-xl border border-slate-700 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="basic">Default (Basic Echo Snippet)</option>
                  <option value="reply">Reply Bot (Formatted replies & sender info)</option>
                  <option value="api">API Interaction (Async data fetch with Axios)</option>
                  <option value="event">Event Listener (Multi-step reply flow)</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1">Category</label>
                <select
                  value={newCmdCategory}
                  onChange={e => setNewCmdCategory(e.target.value)}
                  className="w-full bg-slate-800 text-slate-100 px-3.5 py-2.5 rounded-xl border border-slate-700 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="Custom">Custom</option>
                  <option value="system">System</option>
                  <option value="admin">Admin</option>
                  <option value="economy">Economy</option>
                  <option value="fun">Fun</option>
                  <option value="ai">AI</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1">Required Role</label>
                <select
                  value={newCmdRole}
                  onChange={e => setNewCmdRole(Number(e.target.value))}
                  className="w-full bg-slate-800 text-slate-100 px-3.5 py-2.5 rounded-xl border border-slate-700 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value={0}>Role 0 - All Members</option>
                  <option value={1}>Role 1 - Group Admin</option>
                  <option value={2}>Role 2 - Bot Admin</option>
                  <option value={3}>Role 3 - Bot Owner</option>
                </select>
              </div>

              <div className="flex justify-end space-x-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 bg-slate-800 text-slate-300 hover:bg-slate-700 rounded-xl font-semibold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 text-white hover:bg-indigo-500 rounded-xl font-bold shadow-lg shadow-indigo-600/20 transition flex items-center gap-1.5"
                >
                  <Plus className="w-4 h-4" />
                  <span>Create File</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: ZIP Command Importer & Audit Report Viewer */}
      {showZipModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 w-full max-w-4xl shadow-2xl space-y-6 my-8">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-2.5">
                <FileArchive className="w-6 h-6 text-emerald-400" />
                <div>
                  <h3 className="text-lg font-bold text-slate-100">
                    Facebook Messenger Bot Command ZIP Migration Suite
                  </h3>
                  <p className="text-xs text-slate-400">
                    Upload a ZIP containing .js command/plugin files (FCA, Mirai, GoatBot, Xavia, or ShiPu).
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowZipModal(false)}
                className="text-slate-400 hover:text-slate-200 text-base font-bold"
              >
                ✕
              </button>
            </div>

            {/* Action Buttons */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <label className="border-2 border-dashed border-slate-700 hover:border-emerald-500 bg-slate-950/60 hover:bg-slate-950 p-6 rounded-2xl flex flex-col items-center justify-center cursor-pointer transition text-center group">
                <UploadCloud className="w-8 h-8 text-emerald-400 group-hover:scale-110 transition mb-2" />
                <span className="text-xs font-bold text-slate-200 block">Select & Upload scripts.zip</span>
                <span className="text-[10px] text-slate-500">Auto-converts and seeds database</span>
                <input
                  type="file"
                  accept=".zip"
                  onChange={handleZipFileChange}
                  disabled={isImportingZip}
                  className="hidden"
                />
              </label>

              <div className="bg-slate-950/60 border border-slate-800 p-6 rounded-2xl flex flex-col justify-between space-y-3">
                <div>
                  <span className="text-xs font-bold text-slate-200 block">Server-Side Scan</span>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Triggers recursive inspection on <code className="text-amber-300 font-mono">scripts.zip</code> if already placed in server directory.
                  </p>
                </div>
                <button
                  onClick={() => handleImportZip()}
                  disabled={isImportingZip}
                  className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs transition flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20"
                >
                  <RefreshCw className={`w-4 h-4 ${isImportingZip ? 'animate-spin' : ''}`} />
                  <span>{isImportingZip ? 'Converting & Importing...' : 'Scan & Import Server scripts.zip'}</span>
                </button>
              </div>
            </div>

            {/* Audit Report Statistics */}
            {zipReport && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                  <div className="bg-slate-950 border border-slate-800 p-3 rounded-xl">
                    <span className="text-[10px] text-slate-400 font-semibold block">Total .js Files</span>
                    <span className="text-lg font-black text-slate-100">{zipReport.totalJsFilesFound || 0}</span>
                  </div>
                  <div className="bg-slate-950 border border-emerald-500/30 p-3 rounded-xl">
                    <span className="text-[10px] text-emerald-400 font-semibold block">Converted</span>
                    <span className="text-lg font-black text-emerald-400">
                      {(zipReport.successfullyConverted || 0) + (zipReport.convertedWithAdapter || 0)}
                    </span>
                  </div>
                  <div className="bg-slate-950 border border-indigo-500/30 p-3 rounded-xl">
                    <span className="text-[10px] text-indigo-400 font-semibold block">Imported to DB</span>
                    <span className="text-lg font-black text-indigo-400">{zipReport.importedIntoDatabase || 0}</span>
                  </div>
                  <div className="bg-slate-950 border border-amber-500/30 p-3 rounded-xl">
                    <span className="text-[10px] text-amber-400 font-semibold block">Updated DB</span>
                    <span className="text-lg font-black text-amber-400">{zipReport.updatedExistingCommands || 0}</span>
                  </div>
                </div>

                {/* Audit Table */}
                {zipReport.auditTable && zipReport.auditTable.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs text-slate-300 font-bold">
                      <span className="flex items-center gap-1.5"><Table className="w-4 h-4 text-indigo-400" /> Command Conversion Mapping Table</span>
                      <span className="text-[10px] text-slate-500">{zipReport.auditTable.length} Records</span>
                    </div>

                    <div className="max-h-64 overflow-y-auto border border-slate-800 rounded-xl bg-slate-950">
                      <table className="w-full text-left border-collapse text-[11px]">
                        <thead>
                          <tr className="border-b border-slate-800 bg-slate-900/80 text-slate-400 font-semibold sticky top-0">
                            <th className="p-2.5">Command</th>
                            <th className="p-2.5">Source File</th>
                            <th className="p-2.5">Status</th>
                            <th className="p-2.5">Original Features</th>
                            <th className="p-2.5">ShiPu Mapping</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/60 font-mono text-slate-300">
                          {zipReport.auditTable.map((item: any, idx: number) => (
                            <tr key={idx} className="hover:bg-slate-900/40">
                              <td className="p-2.5 font-bold text-indigo-300">{item.commandName}</td>
                              <td className="p-2.5 text-slate-400">{item.sourceFile}</td>
                              <td className="p-2.5">
                                <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                                  item.status === 'READY' ? 'bg-emerald-500/20 text-emerald-300' :
                                  item.status === 'CONVERTED_WITH_ADAPTER' ? 'bg-blue-500/20 text-blue-300' :
                                  'bg-amber-500/20 text-amber-300'
                                }`}>
                                  {item.status}
                                </span>
                              </td>
                              <td className="p-2.5 text-slate-400">{item.originalFeatures?.join(', ') || 'Standard'}</td>
                              <td className="p-2.5 text-emerald-400">{item.requiredShipuApi?.join(', ') || 'Native Context'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-end pt-3 border-t border-slate-800">
              <button
                onClick={() => setShowZipModal(false)}
                className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold transition"
              >
                Close Importer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Bulk Action Confirmation Dialog */}
      {showBulkConfirmModal && showBulkConfirmModal.isOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 w-full max-w-md shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <AlertCircle className={`w-5 h-5 ${showBulkConfirmModal.action === 'delete' ? 'text-rose-500' : 'text-indigo-400'}`} />
                <span>Confirm Bulk Operation</span>
              </h3>
              <button
                onClick={() => setShowBulkConfirmModal(null)}
                className="text-slate-400 hover:text-slate-200 text-base font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <p className="text-slate-300">
                You are about to perform a batch <strong className="uppercase text-indigo-400">{showBulkConfirmModal.action}</strong> action on <strong className="text-white">{selectedPluginNames.length} command files</strong>.
              </p>

              {showBulkConfirmModal.action === 'delete' ? (
                <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-300 text-[11px] leading-relaxed">
                  ⚠️ <strong>CRITICAL WARNING:</strong> This action is permanent and will completely delete these command source codes from the database! This action cannot be undone.
                </div>
              ) : (
                <p className="text-slate-400">
                  This will update the enabled status for all selected files and hot-reload the changes live into the bot engine.
                </p>
              )}

              <div className="bg-slate-950/60 border border-slate-800 p-3 rounded-xl max-h-32 overflow-y-auto font-mono text-[10px] text-slate-400 divide-y divide-slate-900">
                {selectedPluginNames.map(name => (
                  <div key={name} className="py-1">{name}.js</div>
                ))}
              </div>
            </div>

            <div className="flex justify-end space-x-3 pt-3 border-t border-slate-800 text-xs">
              <button
                type="button"
                onClick={() => setShowBulkConfirmModal(null)}
                className="px-4 py-2 bg-slate-800 text-slate-300 hover:bg-slate-700 rounded-xl font-semibold transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleBulkAction(showBulkConfirmModal.action)}
                className={`px-5 py-2 text-white font-bold rounded-xl shadow-lg transition flex items-center gap-1.5 ${
                  showBulkConfirmModal.action === 'delete'
                    ? 'bg-rose-600 hover:bg-rose-500 shadow-rose-600/20'
                    : 'bg-indigo-600 hover:bg-indigo-500 shadow-indigo-600/20'
                }`}
              >
                Confirm Action
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
});
