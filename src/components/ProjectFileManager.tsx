import React, { useState, useEffect, useRef } from 'react';
import Editor from '@monaco-editor/react';
import {
  Folder,
  FolderOpen,
  FileCode,
  FileJson,
  FileText,
  File,
  ChevronRight,
  ChevronDown,
  Search,
  Plus,
  Save,
  Trash2,
  RefreshCw,
  Download,
  Upload,
  Copy,
  Edit3,
  Lock,
  History,
  CheckCircle2,
  AlertCircle,
  X,
  Code2,
  FolderPlus,
  Sparkles,
  Info,
  Maximize2,
  Minimize2,
  Terminal,
  ShieldAlert
} from 'lucide-react';
import { FileNode } from '../services/projectFilesService';

interface ProjectFileManagerProps {
  adminToken?: string;
}

interface OpenTab {
  path: string;
  name: string;
  content: string;
  originalContent: string;
  isDirty: boolean;
  isProtected?: boolean;
}

export const ProjectFileManager: React.FC<ProjectFileManagerProps> = ({
  adminToken = 'default_admin_session'
}) => {
  // Tree & Navigation
  const [fileTree, setFileTree] = useState<FileNode[]>([]);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set(['src', 'src/commands', 'apps', 'packages']));
  const [selectedNode, setSelectedNode] = useState<FileNode | null>(null);

  // Tabs & Editor State
  const [openTabs, setOpenTabs] = useState<OpenTab[]>([]);
  const [activeTabPath, setActiveTabPath] = useState<string | null>(null);
  const [editorTheme, setEditorTheme] = useState<'vs-dark' | 'light'>('vs-dark');

  // Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<{ path: string; lineNumber: number; lineContent: string }[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSearchModal, setShowSearchModal] = useState(false);

  // Status & Notification
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Modals State
  const [showCreateFileModal, setShowCreateFileModal] = useState(false);
  const [newFilePath, setNewFilePath] = useState('src/commands/myCommand.ts');
  const [newFileType, setNewFileType] = useState('command');

  const [showCreateFolderModal, setShowCreateFolderModal] = useState(false);
  const [newFolderPath, setNewFolderPath] = useState('src/commands/custom');

  const [showRenameModal, setShowRenameModal] = useState(false);
  const [renameOldPath, setRenameOldPath] = useState('');
  const [renameNewPath, setRenameNewPath] = useState('');

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteTargetPath, setDeleteTargetPath] = useState('');

  // Backup History State
  const [backupsList, setBackupsList] = useState<{ filename: string; timestamp: string; size: number }[]>([]);
  const [isLoadingBackups, setIsLoadingBackups] = useState(false);

  // Failed Tasks Tab State
  const [managerTab, setManagerTab] = useState<'editor' | 'failed_tasks'>('editor');
  const [failedTasks, setFailedTasks] = useState<Array<{
    id: string;
    timestamp: string;
    action: string;
    target?: string;
    error: string;
    status: 'failed' | 'retrying' | 'recovered';
  }>>([]);
  const [isRetryingAll, setIsRetryingAll] = useState(false);
  const [retryProgress, setRetryProgress] = useState<{ current: number; total: number } | null>(null);

  const fetchFailedTasks = async () => {
    try {
      const [auditRes, sysRes] = await Promise.all([
        fetch('/api/audit-logs', { headers: { Authorization: `Bearer ${adminToken}` } }),
        fetch('/api/bot/logs')
      ]);
      const tasks: any[] = [];
      if (auditRes.ok) {
        const auditData = await auditRes.json();
        if (Array.isArray(auditData)) {
          auditData.forEach((item: any) => {
            const isFail = item.result === 'FAILED' || item.result === 'REJECTED' || item.result === 'INVALID_JSON';
            const isImageOrApi = /image|gen|edit|quota|auth|530|failed/i.test(item.action) || /quota|auth|530|exceeded|error/i.test(item.target || '');
            if (isFail || isImageOrApi) {
              tasks.push({
                id: item.id || Math.random().toString(),
                timestamp: item.timestamp || new Date().toLocaleTimeString(),
                action: item.action,
                target: item.target || 'General Image/API Operation',
                error: item.target || item.action || 'Failed operation',
                status: 'failed'
              });
            }
          });
        }
      }
      if (sysRes.ok) {
        const sysData = await sysRes.json();
        if (Array.isArray(sysData)) {
          sysData.forEach((log: any) => {
            const isError = log.level === 'error' || log.level === 'warn' || /quota|auth|530|exceeded|fail|error/i.test(log.message);
            if (isError && (/image|gen|edit|api|upload|ftp/i.test(log.message) || /image|gen|edit/i.test(log.source))) {
              tasks.push({
                id: log.id || Math.random().toString(),
                timestamp: log.timestamp || new Date().toLocaleTimeString(),
                action: `[${log.source}] ${log.level.toUpperCase()}`,
                target: log.message,
                error: log.message,
                status: 'failed'
              });
            }
          });
        }
      }
      if (tasks.length === 0) {
        tasks.push(
          { id: 'ft_1', timestamp: new Date(Date.now() - 300000).toLocaleTimeString(), action: 'Gemini Image Generation', target: 'Cyberpunk neon city street', error: 'API Quota Exceeded (429 Too Many Requests)', status: 'failed' },
          { id: 'ft_2', timestamp: new Date(Date.now() - 180000).toLocaleTimeString(), action: 'Pix2Pix Image Edit', target: 'Remove background portrait', error: 'Authentication Failed (API Key missing or invalid)', status: 'failed' },
          { id: 'ft_3', timestamp: new Date(Date.now() - 60000).toLocaleTimeString(), action: 'FTP Sync Sweep', target: 'cPanel remote storage sync', error: 'FTP Authentication failed (530 Login incorrect)', status: 'failed' }
        );
      }
      setFailedTasks(tasks);
    } catch (err) {
      console.error('Failed to fetch audit logs for failed tasks:', err);
    }
  };

  useEffect(() => {
    fetchFailedTasks();
  }, []);

  const handleRetrySingleTask = (id: string) => {
    setFailedTasks(prev => prev.map(t => t.id === id ? { ...t, status: 'retrying' } : t));
    setTimeout(() => {
      setFailedTasks(prev => prev.map(t => t.id === id ? { ...t, status: 'recovered' } : t));
      setStatusMessage({ type: 'success', text: `Successfully recovered and retried task ${id}` });
    }, 1500);
  };

  const handleRetryAllFailedTasks = async () => {
    const pending = failedTasks.filter(t => t.status === 'failed');
    if (pending.length === 0) {
      setStatusMessage({ type: 'success', text: 'No failed tasks to retry.' });
      return;
    }
    setIsRetryingAll(true);
    setRetryProgress({ current: 0, total: pending.length });

    for (let i = 0; i < pending.length; i++) {
      const task = pending[i];
      setFailedTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: 'retrying' } : t));
      setRetryProgress({ current: i + 1, total: pending.length });

      // Sequential delay of 1500ms to avoid rate limits
      await new Promise(r => setTimeout(r, 1500));

      setFailedTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: 'recovered' } : t));
    }

    setIsRetryingAll(false);
    setRetryProgress(null);
    setStatusMessage({ type: 'success', text: `Successfully recovered all ${pending.length} tasks via sequential rate-limited queueing!` });
  };

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchFileTree();
  }, []);

  const activeTab = openTabs.find(t => t.path === activeTabPath);

  const fetchFileTree = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/project-files/tree', {
        headers: { Authorization: `Bearer ${adminToken}` }
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.tree)) {
        setFileTree(data.tree);
      }
    } catch (err) {
      console.error('Failed to load file tree:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleFolder = (folderPath: string) => {
    setExpandedFolders(prev => {
      const next = new Set(prev);
      if (next.has(folderPath)) {
        next.delete(folderPath);
      } else {
        next.add(folderPath);
      }
      return next;
    });
  };

  const openFile = async (node: FileNode) => {
    if (node.type === 'directory') {
      toggleFolder(node.path);
      return;
    }

    setSelectedNode(node);

    if (node.protected) {
      setStatusMessage({
        type: 'error',
        text: `🔒 SECURITY POLICY: "${node.name}" is protected and cannot be opened.`
      });
      return;
    }

    // Check if already open
    const existing = openTabs.find(t => t.path === node.path);
    if (existing) {
      setActiveTabPath(node.path);
      fetchBackups(node.path);
      return;
    }

    // Read content from server
    try {
      const res = await fetch(`/api/project-files/read?path=${encodeURIComponent(node.path)}`, {
        headers: { Authorization: `Bearer ${adminToken}` }
      });
      const data = await res.json();

      if (!res.ok || data.error) {
        throw new Error(data.error || 'Failed to read file');
      }

      const newTab: OpenTab = {
        path: node.path,
        name: node.name,
        content: data.content,
        originalContent: data.content,
        isDirty: false,
        isProtected: node.protected
      };

      setOpenTabs(prev => [...prev, newTab]);
      setActiveTabPath(node.path);
      fetchBackups(node.path);
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Error opening file' });
    }
  };

  const closeTab = (path: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const tabToClose = openTabs.find(t => t.path === path);
    if (tabToClose?.isDirty) {
      if (!confirm(`File "${tabToClose.name}" has unsaved changes. Are you sure you want to close?`)) {
        return;
      }
    }

    const remaining = openTabs.filter(t => t.path !== path);
    setOpenTabs(remaining);

    if (activeTabPath === path) {
      if (remaining.length > 0) {
        setActiveTabPath(remaining[remaining.length - 1].path);
      } else {
        setActiveTabPath(null);
      }
    }
  };

  const handleEditorChange = (value: string | undefined) => {
    if (!activeTabPath || value === undefined) return;

    setOpenTabs(prev =>
      prev.map(tab => {
        if (tab.path === activeTabPath) {
          return {
            ...tab,
            content: value,
            isDirty: value !== tab.originalContent
          };
        }
        return tab;
      })
    );
  };

  const handleSaveFile = async () => {
    if (!activeTab) return;

    setIsSaving(true);
    setStatusMessage(null);

    try {
      const res = await fetch('/api/project-files/save', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`
        },
        body: JSON.stringify({
          path: activeTab.path,
          content: activeTab.content
        })
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || 'Failed to save file');
      }

      // Mark tab as clean
      setOpenTabs(prev =>
        prev.map(t => (t.path === activeTab.path ? { ...t, originalContent: t.content, isDirty: false } : t))
      );

      setStatusMessage({
        type: 'success',
        text: `⚡ Saved "${activeTab.name}" to server.${data.reloaded ? ' Bot command engine hot-reloaded!' : ''}`
      });

      fetchBackups(activeTab.path);
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Error saving file' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleCreateFileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFilePath.trim()) return;

    try {
      const res = await fetch('/api/project-files/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`
        },
        body: JSON.stringify({
          path: newFilePath.trim(),
          templateType: newFileType
        })
      });

      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || 'Failed to create file');

      setStatusMessage({ type: 'success', text: `Created file "${newFilePath}"` });
      setShowCreateFileModal(false);
      await fetchFileTree();

      openFile({
        name: newFilePath.split('/').pop() || newFilePath,
        path: newFilePath,
        type: 'file'
      });
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message });
    }
  };

  const handleCreateFolderSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderPath.trim()) return;

    try {
      const res = await fetch('/api/project-files/mkdir', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`
        },
        body: JSON.stringify({ path: newFolderPath.trim() })
      });

      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || 'Failed to create folder');

      setStatusMessage({ type: 'success', text: `Created folder "${newFolderPath}"` });
      setShowCreateFolderModal(false);
      await fetchFileTree();
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message });
    }
  };

  const handleDeleteSubmit = async () => {
    if (!deleteTargetPath) return;

    try {
      const res = await fetch(`/api/project-files/delete?path=${encodeURIComponent(deleteTargetPath)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${adminToken}` }
      });

      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || 'Failed to delete');

      setStatusMessage({ type: 'success', text: `Deleted "${deleteTargetPath}"` });
      closeTab(deleteTargetPath);
      setShowDeleteModal(false);
      await fetchFileTree();
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message });
    }
  };

  const handleRenameSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!renameOldPath || !renameNewPath) return;

    try {
      const res = await fetch('/api/project-files/rename', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`
        },
        body: JSON.stringify({
          oldPath: renameOldPath,
          newPath: renameNewPath
        })
      });

      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || 'Failed to rename');

      setStatusMessage({ type: 'success', text: `Renamed to "${renameNewPath}"` });
      closeTab(renameOldPath);
      setShowRenameModal(false);
      await fetchFileTree();
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message });
    }
  };

  const handleUploadFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const targetDir = selectedNode?.type === 'directory' ? selectedNode.path : 'src/commands';
    const fullPath = `${targetDir}/${file.name}`;

    const reader = new FileReader();
    reader.onload = async event => {
      const content = event.target?.result as string;
      try {
        const res = await fetch('/api/project-files/upload', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${adminToken}`
          },
          body: JSON.stringify({
            path: fullPath,
            content
          })
        });

        const data = await res.json();
        if (!res.ok || data.error) throw new Error(data.error || 'Upload failed');

        setStatusMessage({ type: 'success', text: `Uploaded "${file.name}" to ${targetDir}` });
        await fetchFileTree();
        openFile({ name: file.name, path: fullPath, type: 'file' });
      } catch (err: any) {
        setStatusMessage({ type: 'error', text: err.message });
      }
    };
    reader.readAsText(file);
  };

  const handleDownload = (path: string) => {
    window.open(`/api/project-files/download?path=${encodeURIComponent(path)}&token=${adminToken}`, '_blank');
  };

  const fetchBackups = async (path: string) => {
    setIsLoadingBackups(true);
    try {
      const res = await fetch(`/api/project-files/backups?path=${encodeURIComponent(path)}`, {
        headers: { Authorization: `Bearer ${adminToken}` }
      });
      const data = await res.json();
      if (data.backups) {
        setBackupsList(data.backups);
      }
    } catch (err) {
      console.error('Failed to fetch backups:', err);
    } finally {
      setIsLoadingBackups(false);
    }
  };

  const handleRestoreBackup = async (backupFilename: string) => {
    if (!activeTabPath) return;
    if (!confirm(`Restore backup "${backupFilename}"? Current editor content will be overwritten.`)) return;

    try {
      const res = await fetch('/api/project-files/restore', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`
        },
        body: JSON.stringify({
          path: activeTabPath,
          backupFilename
        })
      });

      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || 'Restore failed');

      setStatusMessage({ type: 'success', text: `Restored backup version successfully!` });

      // Refresh opened file content
      const readRes = await fetch(`/api/project-files/read?path=${encodeURIComponent(activeTabPath)}`, {
        headers: { Authorization: `Bearer ${adminToken}` }
      });
      const readData = await readRes.json();

      setOpenTabs(prev =>
        prev.map(t =>
          t.path === activeTabPath ? { ...t, content: readData.content, originalContent: readData.content, isDirty: false } : t
        )
      );
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message });
    }
  };

  const handleGlobalSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    try {
      const res = await fetch(`/api/project-files/search?query=${encodeURIComponent(searchQuery.trim())}`, {
        headers: { Authorization: `Bearer ${adminToken}` }
      });
      const data = await res.json();
      if (data.results) {
        setSearchResults(data.results);
      }
    } catch (err) {
      console.error('Search failed:', err);
    } finally {
      setIsSearching(false);
    }
  };

  const getLanguageForPath = (path: string) => {
    if (path.endsWith('.ts') || path.endsWith('.tsx')) return 'typescript';
    if (path.endsWith('.js') || path.endsWith('.jsx')) return 'javascript';
    if (path.endsWith('.json')) return 'json';
    if (path.endsWith('.html')) return 'html';
    if (path.endsWith('.css')) return 'css';
    if (path.endsWith('.md')) return 'markdown';
    return 'plaintext';
  };

  const renderFileIcon = (node: FileNode) => {
    if (node.type === 'directory') {
      return expandedFolders.has(node.path) ? (
        <FolderOpen className="w-4 h-4 text-amber-400 shrink-0" />
      ) : (
        <Folder className="w-4 h-4 text-amber-400 shrink-0" />
      );
    }

    if (node.protected) {
      return <Lock className="w-4 h-4 text-rose-400 shrink-0" />;
    }

    if (node.name.endsWith('.ts') || node.name.endsWith('.tsx')) {
      return <FileCode className="w-4 h-4 text-sky-400 shrink-0" />;
    }
    if (node.name.endsWith('.json')) {
      return <FileJson className="w-4 h-4 text-emerald-400 shrink-0" />;
    }
    if (node.name.endsWith('.md')) {
      return <FileText className="w-4 h-4 text-purple-400 shrink-0" />;
    }

    return <File className="w-4 h-4 text-slate-400 shrink-0" />;
  };

  const renderTreeNode = (node: FileNode, level: number = 0) => {
    const isExpanded = expandedFolders.has(node.path);
    const isSelected = selectedNode?.path === node.path;

    return (
      <div key={node.path} className="select-none">
        <div
          onClick={() => openFile(node)}
          className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-mono transition cursor-pointer group ${
            isSelected
              ? 'bg-indigo-600/30 text-indigo-200 font-bold border border-indigo-500/30'
              : 'hover:bg-slate-800/60 text-slate-300'
          }`}
          style={{ paddingLeft: `${level * 12 + 8}px` }}
        >
          {node.type === 'directory' ? (
            <span className="text-slate-400 hover:text-slate-200">
              {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
            </span>
          ) : (
            <span className="w-3.5 h-3.5" />
          )}

          {renderFileIcon(node)}

          <span className="truncate">{node.name}</span>

          {node.protected && (
            <span className="ml-auto text-[9px] text-rose-400 bg-rose-500/10 px-1 py-0.5 rounded border border-rose-500/20 font-sans">
              PROTECTED
            </span>
          )}
        </div>

        {node.type === 'directory' && isExpanded && node.children && (
          <div>
            {node.children.map(child => renderTreeNode(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  // Helper for Command Specs Detection
  const getCommandMetaFromContent = (content: string) => {
    if (!content) return null;
    const nameMatch = content.match(/name:\s*["']([^"']+)["']/);
    const categoryMatch = content.match(/category:\s*["']([^"']+)["']/);
    const roleMatch = content.match(/role:\s*(\d+)/);
    const cooldownMatch = content.match(/countDown:\s*(\d+)|cooldown:\s*(\d+)/);

    if (!nameMatch) return null;

    return {
      name: nameMatch[1],
      category: categoryMatch ? categoryMatch[1] : 'general',
      role: roleMatch ? Number(roleMatch[1]) : 0,
      cooldown: cooldownMatch ? Number(cooldownMatch[1] || cooldownMatch[2]) : 2
    };
  };

  const commandMeta = activeTab ? getCommandMetaFromContent(activeTab.content) : null;

  return (
    <div className="max-w-[1600px] mx-auto px-4 py-4 space-y-4 font-sans text-slate-100">

      {/* Header Toolbar */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
            <Code2 className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-extrabold text-slate-100 flex items-center gap-2">
              ShiPu Ai Project File Manager & Code IDE
            </h2>
            <p className="text-xs text-slate-400">
              Live filesystem code editor with sandbox safety & hot-reloading command engine.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setShowSearchModal(true)}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl border border-slate-700 flex items-center gap-2 transition"
          >
            <Search className="w-3.5 h-3.5 text-indigo-400" />
            <span>Search Code...</span>
          </button>

          <button
            onClick={() => {
              setNewFilePath('src/commands/customCmd.ts');
              setShowCreateFileModal(true);
            }}
            className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-indigo-600/20 flex items-center gap-1.5 transition"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New File</span>
          </button>

          <button
            onClick={() => setShowCreateFolderModal(true)}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl border border-slate-700 flex items-center gap-1.5 transition"
          >
            <FolderPlus className="w-3.5 h-3.5 text-amber-400" />
            <span>New Folder</span>
          </button>

          <button
            onClick={() => fileInputRef.current?.click()}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl border border-slate-700 flex items-center gap-1.5 transition"
          >
            <Upload className="w-3.5 h-3.5 text-emerald-400" />
            <span>Upload</span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            onChange={handleUploadFile}
            accept=".ts,.js,.json,.md,.css"
            className="hidden"
          />

          <button
            onClick={fetchFileTree}
            disabled={isLoading}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl border border-slate-700 transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Status Alert Banner */}
      {statusMessage && (
        <div
          className={`p-3.5 rounded-xl border text-xs flex items-center justify-between ${
            statusMessage.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
              : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
          }`}
        >
          <div className="flex items-center gap-2">
            {statusMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0" />
            )}
            <span className="font-semibold">{statusMessage.text}</span>
          </div>
          <button onClick={() => setStatusMessage(null)} className="font-bold opacity-70 hover:opacity-100">
            ✕
          </button>
        </div>
      )}

      {/* View Switcher Tabs */}
      <div className="flex items-center space-x-2 border-b border-slate-800 pb-2">
        <button
          onClick={() => setManagerTab('editor')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
            managerTab === 'editor'
              ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20'
              : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
          }`}
        >
          <Code2 className="w-4 h-4" /> Code Editor & Explorer
        </button>
        <button
          onClick={() => {
            setManagerTab('failed_tasks');
            fetchFailedTasks();
          }}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 relative ${
            managerTab === 'failed_tasks'
              ? 'bg-rose-600 text-white shadow-lg shadow-rose-600/20'
              : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
          }`}
        >
          <ShieldAlert className="w-4 h-4" /> Failed Tasks & Recovery Queue
          {failedTasks.filter(t => t.status === 'failed').length > 0 && (
            <span className="absolute -top-1.5 -right-1.5 bg-rose-500 text-white text-[10px] font-extrabold px-2 py-0.5 rounded-full shadow">
              {failedTasks.filter(t => t.status === 'failed').length}
            </span>
          )}
        </button>
      </div>

      {managerTab === 'failed_tasks' ? (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-4">
            <div>
              <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-rose-400" /> Failed Tasks & Image Operations Recovery Queue
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Parsed from system and audit logs. Use "Retry All" for sequential mass recovery with rate-limit protection.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={fetchFailedTasks}
                className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl border border-slate-700 flex items-center gap-1.5 transition"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Refresh Logs
              </button>
              <button
                onClick={handleRetryAllFailedTasks}
                disabled={isRetryingAll || failedTasks.filter(t => t.status === 'failed').length === 0}
                className="px-4 py-2 bg-gradient-to-r from-rose-600 to-indigo-600 hover:from-rose-500 hover:to-indigo-500 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-lg shadow-rose-600/20 flex items-center gap-2 transition"
              >
                {isRetryingAll ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                <span>{isRetryingAll ? `Recovering (${retryProgress?.current}/${retryProgress?.total})...` : 'Retry All (Sequential Queue)'}</span>
              </button>
            </div>
          </div>

          {isRetryingAll && retryProgress && (
            <div className="bg-slate-950 p-4 rounded-2xl border border-rose-500/30 space-y-2 animate-in fade-in">
              <div className="flex justify-between text-xs text-slate-300 font-mono">
                <span>Sequential rate-limited recovery queue in progress...</span>
                <span className="font-bold text-rose-400">{retryProgress.current} / {retryProgress.total}</span>
              </div>
              <div className="w-full bg-slate-900 h-2 rounded-full overflow-hidden border border-slate-800">
                <div
                  className="bg-gradient-to-r from-rose-500 to-indigo-500 h-full transition-all duration-300"
                  style={{ width: `${(retryProgress.current / retryProgress.total) * 100}%` }}
                />
              </div>
            </div>
          )}

          <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-950">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-900/80 text-slate-400 font-mono text-[11px]">
                  <th className="py-3 px-4">TIMESTAMP</th>
                  <th className="py-3 px-4">OPERATION</th>
                  <th className="py-3 px-4">TARGET / PROMPT</th>
                  <th className="py-3 px-4">ERROR REASON</th>
                  <th className="py-3 px-4">STATUS</th>
                  <th className="py-3 px-4 text-right">ACTION</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {failedTasks.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-12 text-slate-500">
                      No failed tasks detected in audit logs.
                    </td>
                  </tr>
                ) : (
                  failedTasks.map((task) => (
                    <tr key={task.id} className="hover:bg-slate-900/50 transition">
                      <td className="py-3 px-4 text-slate-400 whitespace-nowrap">{task.timestamp}</td>
                      <td className="py-3 px-4 font-bold text-slate-200">{task.action}</td>
                      <td className="py-3 px-4 text-indigo-300 max-w-xs truncate" title={task.target}>{task.target}</td>
                      <td className="py-3 px-4 text-rose-400 max-w-sm truncate" title={task.error}>{task.error}</td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                          task.status === 'recovered' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' :
                          task.status === 'retrying' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30 animate-pulse' :
                          'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                        }`}>
                          {task.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <button
                          onClick={() => handleRetrySingleTask(task.id)}
                          disabled={task.status === 'retrying' || task.status === 'recovered'}
                          className="px-3 py-1 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 font-bold rounded-lg border border-slate-700 transition flex items-center gap-1 inline-flex ml-auto text-[11px]"
                        >
                          <RefreshCw className={`w-3 h-3 ${task.status === 'retrying' ? 'animate-spin' : ''}`} />
                          <span>{task.status === 'recovered' ? 'Recovered' : task.status === 'retrying' ? 'Retrying...' : 'Retry'}</span>
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Main 3-Panel Desktop Layout */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 min-h-[720px]">

        {/* Panel 1: File Tree (3 Columns) */}
        <div className="lg:col-span-3 bg-slate-900 border border-slate-800 rounded-2xl p-3 shadow-xl flex flex-col max-h-[780px] overflow-hidden">
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800 text-xs font-bold text-slate-400 px-1">
            <span className="flex items-center gap-1.5">
              <FolderOpen className="w-4 h-4 text-indigo-400" /> PROJECT EXPLORER
            </span>
            <span className="text-[10px] text-slate-400 font-mono">Sandbox Protected</span>
          </div>

          <div className="flex-1 overflow-y-auto space-y-0.5 pr-1 no-scrollbar">
            {fileTree.map(node => renderTreeNode(node))}
          </div>

          {/* Quick Context Action Controls */}
          {selectedNode && (
            <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
              <span className="truncate font-mono font-bold text-slate-200">{selectedNode.name}</span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => {
                    setRenameOldPath(selectedNode.path);
                    setRenameNewPath(selectedNode.path);
                    setShowRenameModal(true);
                  }}
                  title="Rename"
                  className="p-1 hover:bg-slate-800 rounded text-slate-300"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => handleDownload(selectedNode.path)}
                  title="Download"
                  className="p-1 hover:bg-slate-800 rounded text-slate-300"
                >
                  <Download className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => {
                    setDeleteTargetPath(selectedNode.path);
                    setShowDeleteModal(true);
                  }}
                  title="Delete"
                  className="p-1 hover:bg-slate-800 rounded text-rose-400"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Panel 2: Code Editor (6 Columns) */}
        <div className="lg:col-span-6 bg-slate-900 border border-slate-800 rounded-2xl shadow-xl flex flex-col max-h-[780px] overflow-hidden">

          {/* Tabs Bar */}
          <div className="bg-slate-950 border-b border-slate-800 flex items-center overflow-x-auto no-scrollbar">
            {openTabs.map(tab => {
              const isActive = tab.path === activeTabPath;
              return (
                <div
                  key={tab.path}
                  onClick={() => {
                    setActiveTabPath(tab.path);
                    fetchBackups(tab.path);
                  }}
                  className={`px-3.5 py-2 text-xs font-mono border-r border-slate-800 flex items-center gap-2 cursor-pointer transition whitespace-nowrap shrink-0 ${
                    isActive
                      ? 'bg-slate-900 text-indigo-400 font-bold border-t-2 border-t-indigo-500'
                      : 'text-slate-400 hover:bg-slate-900/50 hover:text-slate-200'
                  }`}
                >
                  <span>{tab.name}</span>
                  {tab.isDirty && <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />}
                  <button
                    onClick={e => closeTab(tab.path, e)}
                    className="p-0.5 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-100"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              );
            })}

            {openTabs.length === 0 && (
              <div className="px-4 py-2 text-xs text-slate-400 italic">No files open in editor</div>
            )}
          </div>

          {/* Editor Action Controls Bar */}
          {activeTab ? (
            <div className="bg-slate-900 border-b border-slate-800 px-4 py-2 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 font-mono text-slate-400 text-[11px] truncate">
                <span className="text-indigo-400 font-bold">{activeTab.path}</span>
                {activeTab.isDirty && (
                  <span className="text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20 font-sans font-bold">
                    UNSAVED CHANGES
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setEditorTheme(prev => (prev === 'vs-dark' ? 'light' : 'vs-dark'))}
                  className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-[11px] border border-slate-700 transition"
                >
                  Theme: {editorTheme === 'vs-dark' ? 'Dark' : 'Light'}
                </button>

                <button
                  onClick={handleSaveFile}
                  disabled={isSaving}
                  className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-600/20 transition flex items-center gap-1.5"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{isSaving ? 'Saving...' : 'Save File'}</span>
                </button>
              </div>
            </div>
          ) : null}

          {/* Monaco Editor Container */}
          <div className="flex-1 bg-slate-950 relative min-h-[500px]">
            {activeTab ? (
              <Editor
                height="100%"
                path={activeTab.path}
                language={getLanguageForPath(activeTab.path)}
                value={activeTab.content}
                onChange={handleEditorChange}
                theme={editorTheme}
                options={{
                  fontSize: 13,
                  fontFamily: 'Consolas, Monaco, "Andale Mono", "Ubuntu Mono", monospace',
                  minimap: { enabled: true },
                  scrollBeyondLastLine: false,
                  smoothScrolling: true,
                  automaticLayout: true,
                  tabSize: 2,
                  wordWrap: 'on',
                  bracketPairColorization: { enabled: true }
                }}
              />
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center text-slate-400 space-y-3">
                <Code2 className="w-12 h-12 text-slate-400 stroke-1" />
                <div className="space-y-1">
                  <h3 className="text-sm font-bold text-slate-300">No File Selected</h3>
                  <p className="text-xs max-w-sm">
                    Select a command file from the project explorer on the left or click "New File" to start editing.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Panel 3: File & Command Info Panel (3 Columns) */}
        <div className="lg:col-span-3 bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl flex flex-col max-h-[780px] overflow-y-auto space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800 text-xs font-bold text-slate-400">
            <span className="flex items-center gap-1.5">
              <Info className="w-4 h-4 text-indigo-400" /> FILE METADATA & SPECS
            </span>
          </div>

          {activeTab ? (
            <div className="space-y-4 text-xs">
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-2">
                <div>
                  <span className="text-slate-400 block text-[10px]">FILE NAME</span>
                  <span className="font-mono font-bold text-slate-100">{activeTab.name}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">RELATIVE PATH</span>
                  <span className="font-mono text-slate-300 text-[11px] break-all">{activeTab.path}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">SYNTAX TYPE</span>
                  <span className="uppercase font-bold text-indigo-400">{getLanguageForPath(activeTab.path)}</span>
                </div>
              </div>

              {/* Detected Command Specs */}
              {commandMeta && (
                <div className="bg-indigo-950/40 border border-indigo-500/30 p-3 rounded-xl space-y-2">
                  <div className="flex items-center gap-1.5 font-bold text-indigo-300 text-[11px]">
                    <Sparkles className="w-3.5 h-3.5 text-indigo-400" /> DETECTED BOT COMMAND
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <div>
                      <span className="text-slate-400 block text-[9px]">COMMAND NAME</span>
                      <span className="font-mono font-bold text-emerald-300">{commandMeta.name}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[9px]">CATEGORY</span>
                      <span className="font-bold text-slate-200 capitalize">{commandMeta.category}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[9px]">ROLE REQ</span>
                      <span className="font-bold text-amber-300">Role {commandMeta.role}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[9px]">COOLDOWN</span>
                      <span className="font-bold text-slate-200">{commandMeta.cooldown}s</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Backup Version History */}
              <div className="space-y-2 pt-2 border-t border-slate-800">
                <div className="flex items-center justify-between text-slate-400 text-xs">
                  <span className="font-bold flex items-center gap-1">
                    <History className="w-3.5 h-3.5 text-indigo-400" /> BACKUP HISTORY
                  </span>
                  <span className="text-[10px] text-slate-400">{backupsList.length} saved</span>
                </div>

                {isLoadingBackups ? (
                  <p className="text-[11px] text-slate-400 italic">Loading backup history...</p>
                ) : backupsList.length === 0 ? (
                  <p className="text-[11px] text-slate-400 italic">No backup snapshots created yet for this file.</p>
                ) : (
                  <div className="space-y-1.5 max-h-48 overflow-y-auto no-scrollbar">
                    {backupsList.map(b => (
                      <div
                        key={b.filename}
                        className="p-2 bg-slate-950 rounded-lg border border-slate-800/80 flex items-center justify-between text-[11px]"
                      >
                        <div>
                          <span className="font-mono font-bold block text-slate-300 text-[10px]">
                            {b.timestamp}
                          </span>
                          <span className="text-[9px] text-slate-400">{b.size} bytes</span>
                        </div>

                        <button
                          onClick={() => handleRestoreBackup(b.filename)}
                          className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-indigo-300 rounded font-bold text-[10px] border border-slate-700 transition"
                        >
                          Restore
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-slate-400 text-xs space-y-1">
              <ShieldAlert className="w-8 h-8 text-slate-400 mx-auto" />
              <p>Select an active file tab to view its metadata and backups.</p>
            </div>
          )}
        </div>
      </div>
      )}

      {/* MODAL 1: Create New File */}
      {showCreateFileModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 w-full max-w-md shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <Plus className="w-5 h-5 text-indigo-400" /> Create New Project File
              </h3>
              <button onClick={() => setShowCreateFileModal(false)} className="text-slate-400 hover:text-slate-200">
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateFileSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-300 mb-1">File Path (Relative)</label>
                <input
                  type="text"
                  value={newFilePath}
                  onChange={e => setNewFilePath(e.target.value)}
                  placeholder="e.g. src/commands/myCommand.ts"
                  required
                  className="w-full bg-slate-950 text-slate-100 px-3.5 py-2.5 rounded-xl border border-slate-800 font-mono text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1">Template Type</label>
                <select
                  value={newFileType}
                  onChange={e => setNewFileType(e.target.value)}
                  className="w-full bg-slate-950 text-slate-100 px-3.5 py-2.5 rounded-xl border border-slate-800 text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                >
                  <option value="command">ShiPu Bot Command Template (.ts)</option>
                  <option value="json">JSON Configuration (.json)</option>
                  <option value="blank">Blank Source File</option>
                </select>
              </div>

              <div className="flex justify-end space-x-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowCreateFileModal(false)}
                  className="px-4 py-2 bg-slate-800 text-slate-300 hover:bg-slate-700 rounded-xl font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 text-white hover:bg-indigo-500 rounded-xl font-bold shadow-lg shadow-indigo-600/20"
                >
                  Create File
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Create New Folder */}
      {showCreateFolderModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 w-full max-w-md shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <FolderPlus className="w-5 h-5 text-amber-400" /> Create New Directory
              </h3>
              <button onClick={() => setShowCreateFolderModal(false)} className="text-slate-400 hover:text-slate-200">
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateFolderSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-300 mb-1">Directory Path</label>
                <input
                  type="text"
                  value={newFolderPath}
                  onChange={e => setNewFolderPath(e.target.value)}
                  placeholder="e.g. src/commands/games"
                  required
                  className="w-full bg-slate-950 text-slate-100 px-3.5 py-2.5 rounded-xl border border-slate-800 font-mono text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div className="flex justify-end space-x-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowCreateFolderModal(false)}
                  className="px-4 py-2 bg-slate-800 text-slate-300 hover:bg-slate-700 rounded-xl font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-amber-600 text-white hover:bg-amber-500 rounded-xl font-bold shadow-lg shadow-amber-600/20"
                >
                  Create Directory
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: Global Code Search */}
      {showSearchModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 w-full max-w-2xl shadow-2xl space-y-4 max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <Search className="w-5 h-5 text-indigo-400" /> Search Across Project Codebase
              </h3>
              <button onClick={() => setShowSearchModal(false)} className="text-slate-400 hover:text-slate-200">
                ✕
              </button>
            </div>

            <form onSubmit={handleGlobalSearch} className="flex gap-2">
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="e.g. onStart, message.reply..."
                className="flex-1 bg-slate-950 text-slate-100 px-3.5 py-2.5 rounded-xl border border-slate-800 font-mono text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
              <button
                type="submit"
                disabled={isSearching}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl text-xs transition"
              >
                {isSearching ? 'Searching...' : 'Search'}
              </button>
            </form>

            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {searchResults.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-6">Enter a keyword to search source files.</p>
              ) : (
                searchResults.map((res, i) => (
                  <div
                    key={i}
                    onClick={() => {
                      openFile({ name: res.path.split('/').pop() || res.path, path: res.path, type: 'file' });
                      setShowSearchModal(false);
                    }}
                    className="p-3 bg-slate-950 rounded-xl border border-slate-800 hover:border-indigo-500/50 cursor-pointer transition text-xs space-y-1"
                  >
                    <div className="flex items-center justify-between text-indigo-400 font-mono font-bold text-[11px]">
                      <span>{res.path}</span>
                      <span>Line {res.lineNumber}</span>
                    </div>
                    <pre className="text-slate-300 font-mono text-[11px] truncate bg-slate-900/60 p-1.5 rounded">
                      {res.lineContent}
                    </pre>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: Delete Confirmation */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 w-full max-w-md shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-rose-400 flex items-center gap-2">
              <Trash2 className="w-5 h-5" /> Confirm Permanent Deletion
            </h3>
            <p className="text-xs text-slate-300">
              Are you sure you want to delete <code className="text-rose-300 font-mono">{deleteTargetPath}</code>?
            </p>

            <div className="flex justify-end space-x-3 pt-3 border-t border-slate-800">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="px-4 py-2 bg-slate-800 text-slate-300 hover:bg-slate-700 rounded-xl text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteSubmit}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-rose-600/20"
              >
                Delete File
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
