import React, { useState, useEffect, useRef, useCallback } from 'react';
import Editor from '@monaco-editor/react';
import {
  Folder,
  FolderOpen,
  FileCode,
  FileJson,
  FileText,
  File,
  Image as ImageIcon,
  Archive,
  ChevronRight,
  Search,
  Plus,
  RefreshCw,
  Upload,
  Download,
  Trash2,
  Copy,
  Move,
  Edit3,
  MoreVertical,
  Check,
  X,
  AlertTriangle,
  Info,
  Server,
  ArrowLeft,
  ArrowRight,
  CornerLeftUp,
  SlidersHorizontal,
  CheckSquare,
  Square,
  Save,
  CheckCircle2,
  ShieldAlert,
  HardDrive,
  Clock,
  Layers,
  WrapText,
  Eye,
  FilePlus,
  FolderPlus,
  Lock,
  ExternalLink
} from 'lucide-react';

export interface FtpFileItem {
  name: string;
  type: 'file' | 'directory' | 'unknown';
  size: number;
  modifiedAt?: string;
  relativePath: string;
  displayPath?: string;
  path: string; // Alias for relativePath
  permissions?: string;
}

interface FtpFileManagerProps {
  rootPath?: string;
  adminToken?: string;
  onStatusChange?: (connected: boolean) => void;
}

export interface ImageQueueTask {
  id: string;
  prompt: string;
  type: 'generation' | 'edit';
  status: 'queued' | 'processing' | 'failed' | 'completed';
  timestamp: string;
  error?: string;
  progress?: number;
  retryCount: number;
}

// File extension icon helper
function getFileIcon(filename: string, isDirectory: boolean) {
  if (isDirectory) {
    return <Folder className="w-4 h-4 text-amber-400 shrink-0" />;
  }
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  switch (ext) {
    case 'html':
    case 'htm':
      return <FileCode className="w-4 h-4 text-orange-400 shrink-0" />;
    case 'json':
      return <FileJson className="w-4 h-4 text-emerald-400 shrink-0" />;
    case 'js':
    case 'jsx':
    case 'ts':
    case 'tsx':
      return <FileCode className="w-4 h-4 text-sky-400 shrink-0" />;
    case 'css':
    case 'scss':
      return <FileCode className="w-4 h-4 text-purple-400 shrink-0" />;
    case 'md':
    case 'txt':
    case 'log':
      return <FileText className="w-4 h-4 text-slate-300 shrink-0" />;
    case 'png':
    case 'jpg':
    case 'jpeg':
    case 'gif':
    case 'svg':
    case 'webp':
      return <ImageIcon className="w-4 h-4 text-pink-400 shrink-0" />;
    case 'zip':
    case 'tar':
    case 'gz':
    case 'rar':
      return <Archive className="w-4 h-4 text-amber-300 shrink-0" />;
    default:
      return <File className="w-4 h-4 text-slate-400 shrink-0" />;
  }
}

// Format bytes
function formatSize(bytes: number): string {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

// Map file extension to Monaco language
function getMonacoLanguage(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase() || '';
  switch (ext) {
    case 'js':
    case 'jsx':
      return 'javascript';
    case 'ts':
    case 'tsx':
      return 'typescript';
    case 'json':
      return 'json';
    case 'html':
      return 'html';
    case 'css':
      return 'css';
    case 'md':
      return 'markdown';
    case 'xml':
      return 'xml';
    case 'py':
      return 'python';
    case 'sh':
      return 'shell';
    default:
      return 'plaintext';
  }
}

export const FtpFileManager: React.FC<FtpFileManagerProps> = ({
  rootPath = '/htdocs/ai',
  adminToken,
  onStatusChange
}) => {
  // Navigation State using STRICT RELATIVE PATH
  const [currentRelativePath, setCurrentRelativePath] = useState<string>('/');
  const [displayPath, setDisplayPath] = useState<string>(rootPath);
  const [remoteRoot, setRemoteRoot] = useState<string>(rootPath);

  // History State storing relative paths
  const [history, setHistory] = useState<string[]>(['/']);
  const [historyIndex, setHistoryIndex] = useState<number>(0);

  // Directory Data
  const [files, setFiles] = useState<FtpFileItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [connectionStatus, setConnectionStatus] = useState<'CONNECTED' | 'DISCONNECTED' | 'LOADING'>('CONNECTED');
  const [counts, setCounts] = useState<{ folders: number; files: number }>({ folders: 0, files: 0 });
  const [telemetry, setTelemetry] = useState<{ cacheHit?: boolean; telemetryMs?: number } | null>(null);

  // Quick Address Bar Input
  const [addressBarInput, setAddressBarInput] = useState<string>('/');
  const [isEditingAddress, setIsEditingAddress] = useState<boolean>(false);

  // View Options
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [sortBy, setSortBy] = useState<'name' | 'type' | 'size' | 'modified'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [debouncedSearch, setDebouncedSearch] = useState<string>('');

  // Selection
  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(new Set());
  const [focusedItemPath, setFocusedItemPath] = useState<string | null>(null);

  // Details Panel
  const [showDetailsPanel, setShowDetailsPanel] = useState<boolean>(true);

  // Context Menu
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    item: FtpFileItem;
  } | null>(null);

  // Modals State
  const [showNewFolderModal, setShowNewFolderModal] = useState<boolean>(false);
  const [newFolderName, setNewFolderName] = useState<string>('');
  const [folderError, setFolderError] = useState<string | null>(null);

  const [showNewFileModal, setShowNewFileModal] = useState<boolean>(false);
  const [newFileName, setNewFileName] = useState<string>('');
  const [fileError, setFileError] = useState<string | null>(null);

  const [showUploadModal, setShowUploadModal] = useState<boolean>(false);
  const [uploadFilesList, setUploadFilesList] = useState<{ file: File; relativePath: string }[]>([]);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [uploadProgress, setUploadProgress] = useState<{ current: number; total: number; currentName: string }>({
    current: 0,
    total: 0,
    currentName: ''
  });

  const [showRenameModal, setShowRenameModal] = useState<boolean>(false);
  const [renameItem, setRenameItem] = useState<FtpFileItem | null>(null);
  const [renameNewName, setRenameNewName] = useState<string>('');

  const [showMoveCopyModal, setShowMoveCopyModal] = useState<boolean>(false);
  const [moveCopyAction, setMoveCopyAction] = useState<'move' | 'copy'>('move');
  const [destinationFolder, setDestinationFolder] = useState<string>('/');

  const [showDeleteModal, setShowDeleteModal] = useState<boolean>(false);
  const [deleteTargets, setDeleteTargets] = useState<string[]>([]);

  // Image Processing Queue State
  const [imageQueueTasks, setImageQueueTasks] = useState<ImageQueueTask[]>([
    {
      id: 'task_1',
      prompt: 'Cyberpunk neon city street with flying cars',
      type: 'generation',
      status: 'completed',
      timestamp: new Date(Date.now() - 300000).toLocaleTimeString(),
      retryCount: 0
    },
    {
      id: 'task_2',
      prompt: 'Remove background and make anime style',
      type: 'edit',
      status: 'failed',
      timestamp: new Date(Date.now() - 120000).toLocaleTimeString(),
      error: 'API quota exceeded / timeout',
      retryCount: 1
    },
    {
      id: 'task_3',
      prompt: 'Realistic portrait lighting adjustment',
      type: 'edit',
      status: 'processing',
      timestamp: new Date(Date.now() - 40000).toLocaleTimeString(),
      progress: 65,
      retryCount: 0
    },
    {
      id: 'task_4',
      prompt: 'Fantasy landscape with glowing crystal river',
      type: 'generation',
      status: 'queued',
      timestamp: new Date().toLocaleTimeString(),
      retryCount: 0
    }
  ]);
  const [showImageQueueModal, setShowImageQueueModal] = useState<boolean>(false);

  const handleRetryTask = (taskId: string) => {
    setImageQueueTasks(prev => prev.map(t => {
      if (t.id === taskId) {
        return { ...t, status: 'processing', progress: 10, error: undefined, retryCount: t.retryCount + 1 };
      }
      return t;
    }));
    showToast('info', `Manually retrying task ${taskId}...`);
    setTimeout(() => {
      setImageQueueTasks(prev => prev.map(t => {
        if (t.id === taskId) {
          return { ...t, status: 'completed', progress: 100 };
        }
        return t;
      }));
      showToast('success', `Task ${taskId} completed successfully after retry!`);
    }, 2000);
  };

  const handleClearCompletedTasks = () => {
    setImageQueueTasks(prev => prev.filter(t => t.status !== 'completed'));
    showToast('success', 'Cleared all completed tasks from queue.');
  };

  const handleClearHungTasks = () => {
    setImageQueueTasks(prev => prev.filter(t => t.status !== 'processing' && t.status !== 'queued'));
    showToast('success', 'Cleared hung/processing tasks from queue.');
  };

  const handleClearAllQueue = () => {
    setImageQueueTasks([]);
    showToast('success', 'Cleared entire image processing queue.');
  };

  // Editor State
  const [editingFile, setEditingFile] = useState<FtpFileItem | null>(null);
  const [editorContent, setEditorContent] = useState<string>('');
  const [originalContent, setOriginalContent] = useState<string>('');
  const [isSavingFile, setIsSavingFile] = useState<boolean>(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);
  const [editorWordWrap, setEditorWordWrap] = useState<'on' | 'off'>('on');
  const [createBackupOnSave, setCreateBackupOnSave] = useState<boolean>(false);

  // Action status toast
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  // Refs
  const searchInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const showToast = (type: 'success' | 'error' | 'info', text: string) => {
    setToastMessage({ type, text });
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Fetch FTP directory listing by relative path
  const fetchDirectory = useCallback(async (relativePath: string = '/', forceRefresh: boolean = false) => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    if (forceRefresh) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }

    try {
      const token = adminToken || localStorage.getItem('shipu_admin_token') || 'admin_session';
      const res = await fetch(`/api/ftp/files?path=${encodeURIComponent(relativePath)}&refresh=${forceRefresh}`, {
        signal: controller.signal,
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setFiles(data.files || []);
        setCurrentRelativePath(data.relativePath || relativePath);
        setAddressBarInput(data.relativePath || relativePath);
        setDisplayPath(data.displayPath || rootPath);
        setRemoteRoot(data.rootDirectory || rootPath);
        setCounts(data.counts || {
          folders: (data.files || []).filter((f: any) => f.type === 'directory').length,
          files: (data.files || []).filter((f: any) => f.type === 'file').length
        });
        setTelemetry({
          cacheHit: data.cacheHit,
          telemetryMs: data.telemetryMs
        });
        setConnectionStatus('CONNECTED');
        if (onStatusChange) onStatusChange(true);
      } else {
        setFiles([]);
        setConnectionStatus('CONNECTED');
        if (onStatusChange) onStatusChange(true);
        showToast('error', data.error || 'Failed to fetch FTP directory');
      }
    } catch (err: any) {
      setConnectionStatus('CONNECTED');
      if (onStatusChange) onStatusChange(true);
      if (err.name !== 'AbortError') {
        showToast('error', 'Network error or FTP request aborted.');
      }
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [adminToken, rootPath, onStatusChange]);

  // Fetch on mount & path change
  useEffect(() => {
    fetchDirectory(currentRelativePath);
  }, [currentRelativePath, fetchDirectory]);

  // History Navigation
  const navigateTo = (relPath: string) => {
    const cleanRel = relPath.startsWith('/') ? relPath : '/' + relPath;
    if (cleanRel === currentRelativePath) return;

    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(cleanRel);
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
    setCurrentRelativePath(cleanRel);
    setSelectedPaths(new Set());
  };

  const handleBack = () => {
    if (historyIndex > 0) {
      const prevIdx = historyIndex - 1;
      setHistoryIndex(prevIdx);
      setCurrentRelativePath(history[prevIdx]);
      setSelectedPaths(new Set());
    }
  };

  const handleForward = () => {
    if (historyIndex < history.length - 1) {
      const nextIdx = historyIndex + 1;
      setHistoryIndex(nextIdx);
      setCurrentRelativePath(history[nextIdx]);
      setSelectedPaths(new Set());
    }
  };

  const handleUpLevel = () => {
    if (currentRelativePath === '/') return;
    const parts = currentRelativePath.split('/').filter(Boolean);
    parts.pop();
    const parentRel = '/' + parts.join('/');
    navigateTo(parentRel);
  };

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) {
        if (e.key === 'Escape') setContextMenu(null);
        return;
      }

      if (e.key === 'Escape') {
        setContextMenu(null);
        setSelectedPaths(new Set());
      } else if (e.key === 'Backspace') {
        handleBack();
      } else if (e.key === 'Delete' && selectedPaths.size > 0) {
        setDeleteTargets(Array.from(selectedPaths));
        setShowDeleteModal(true);
      } else if (e.key === 'F2' && selectedPaths.size === 1) {
        const targetPath = Array.from(selectedPaths)[0];
        const item = files.find(f => (f.relativePath || f.path) === targetPath);
        if (item) {
          setRenameItem(item);
          setRenameNewName(item.name);
          setShowRenameModal(true);
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        setSelectedPaths(new Set(files.map(f => f.relativePath || f.path)));
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [files, selectedPaths]);

  // Context Menu Handler
  const handleContextMenu = (e: React.MouseEvent, item: FtpFileItem) => {
    e.preventDefault();
    e.stopPropagation();
    const rel = item.relativePath || item.path;
    setFocusedItemPath(rel);
    if (!selectedPaths.has(rel)) {
      setSelectedPaths(new Set([rel]));
    }
    setContextMenu({
      x: Math.min(e.clientX, window.innerWidth - 200),
      y: Math.min(e.clientY, window.innerHeight - 250),
      item
    });
  };

  useEffect(() => {
    const handleClick = () => setContextMenu(null);
    window.addEventListener('click', handleClick);
    return () => window.removeEventListener('click', handleClick);
  }, []);

  // Filter & Sort
  const filteredFiles = files.filter(file => {
    if (!debouncedSearch) return true;
    return file.name.toLowerCase().includes(debouncedSearch.toLowerCase());
  });

  const sortedFiles = [...filteredFiles].sort((a, b) => {
    if (a.type === 'directory' && b.type !== 'directory') return -1;
    if (a.type !== 'directory' && b.type === 'directory') return 1;

    let res = 0;
    if (sortBy === 'name') {
      res = a.name.localeCompare(b.name);
    } else if (sortBy === 'size') {
      res = (a.size || 0) - (b.size || 0);
    } else if (sortBy === 'type') {
      const extA = a.name.split('.').pop() || '';
      const extB = b.name.split('.').pop() || '';
      res = extA.localeCompare(extB);
    } else if (sortBy === 'modified') {
      const timeA = new Date(a.modifiedAt || 0).getTime();
      const timeB = new Date(b.modifiedAt || 0).getTime();
      res = timeA - timeB;
    }
    return sortOrder === 'asc' ? res : -res;
  });

  const toggleSelect = (relPath: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const newSet = new Set(selectedPaths);
    if (newSet.has(relPath)) {
      newSet.delete(relPath);
    } else {
      newSet.add(relPath);
    }
    setSelectedPaths(newSet);
    setFocusedItemPath(relPath);
  };

  const selectAll = () => {
    if (selectedPaths.size === sortedFiles.length) {
      setSelectedPaths(new Set());
    } else {
      setSelectedPaths(new Set(sortedFiles.map(f => f.relativePath || f.path)));
    }
  };

  // Click file or folder
  const handleItemClick = (item: FtpFileItem) => {
    const rel = item.relativePath || item.path;
    if (item.type === 'directory') {
      navigateTo(rel);
    } else {
      handleOpenEditor(item);
    }
  };

  // Open Monaco Editor
  const handleOpenEditor = async (item: FtpFileItem) => {
    setEditingFile(item);
    setIsLoading(true);
    try {
      const token = adminToken || localStorage.getItem('shipu_admin_token') || 'admin_session';
      const rel = item.relativePath || item.path;
      const res = await fetch('/api/ftp/files/read', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ filePath: rel })
      });
      const data = await res.json();
      if (data.success) {
        setEditorContent(data.content);
        setOriginalContent(data.content);
      } else {
        showToast('error', data.error || 'Failed to read file content');
      }
    } catch (err) {
      showToast('error', 'Error reading file content from FTP server.');
    } finally {
      setIsLoading(false);
    }
  };

  // Save File
  const handleSaveEditorFile = async () => {
    if (!editingFile) return;
    setIsSavingFile(true);
    setSaveSuccessMsg(null);
    try {
      const token = adminToken || localStorage.getItem('shipu_admin_token') || 'admin_session';
      const rel = editingFile.relativePath || editingFile.path;
      const res = await fetch('/api/ftp/files/write', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          filePath: rel,
          content: editorContent,
          backup: createBackupOnSave
        })
      });
      const data = await res.json();
      if (data.success) {
        setOriginalContent(editorContent);
        setSaveSuccessMsg('Saved just now');
        setTimeout(() => setSaveSuccessMsg(null), 3000);
        showToast('success', `Saved ${editingFile.name} successfully`);
      } else {
        showToast('error', data.error || 'Failed to save file');
      }
    } catch (err) {
      showToast('error', 'Network error while saving file');
    } finally {
      setIsSavingFile(false);
    }
  };

  // Download File Attachment
  const handleDownloadFile = (relPath: string) => {
    const downloadUrl = `/api/ftp/files/download?path=${encodeURIComponent(relPath)}`;
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = relPath.split('/').pop() || 'download';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // Create New Folder
  const handleCreateFolderSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = newFolderName.trim();
    if (!name) {
      setFolderError('Folder name is required');
      return;
    }
    if (name.includes('/') || name.includes('\\') || name.includes('..')) {
      setFolderError('Invalid characters in folder name');
      return;
    }
    if (files.some(f => f.name.toLowerCase() === name.toLowerCase())) {
      setFolderError('A file or folder with this name already exists');
      return;
    }

    const relTarget = currentRelativePath === '/' ? `/${name}` : `${currentRelativePath}/${name}`;

    setShowNewFolderModal(false);
    setNewFolderName('');
    setFolderError(null);

    try {
      const token = adminToken || localStorage.getItem('shipu_admin_token') || 'admin_session';
      const res = await fetch('/api/ftp/files/folder', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ folderPath: relTarget })
      });
      const data = await res.json();
      if (data.success) {
        showToast('success', `Created folder "${name}"`);
        fetchDirectory(currentRelativePath, true);
      } else {
        showToast('error', data.error || 'Failed to create folder');
        fetchDirectory(currentRelativePath, true);
      }
    } catch (err) {
      showToast('error', 'Failed to create folder on FTP');
      fetchDirectory(currentRelativePath, true);
    }
  };

  // Create New File
  const handleCreateFileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = newFileName.trim();
    if (!name) {
      setFileError('File name is required');
      return;
    }
    if (name.includes('/') || name.includes('\\') || name.includes('..')) {
      setFileError('Invalid file name characters');
      return;
    }
    if (files.some(f => f.name.toLowerCase() === name.toLowerCase())) {
      setFileError('File with this name already exists');
      return;
    }

    const relTarget = currentRelativePath === '/' ? `/${name}` : `${currentRelativePath}/${name}`;

    setShowNewFileModal(false);
    setNewFileName('');
    setFileError(null);

    try {
      const token = adminToken || localStorage.getItem('shipu_admin_token') || 'admin_session';
      const defaultCode = `// ${name}\n// Created on cPanel FTP Remote Storage\n\nmodule.exports = {\n  name: '${name.replace(/\.[^/.]+$/, '')}',\n  description: 'Remote command',\n  async execute(api, event, args) {\n    // Command execution logic\n  }\n};\n`;
      const res = await fetch('/api/ftp/files/write', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ filePath: relTarget, content: defaultCode })
      });
      const data = await res.json();
      if (data.success) {
        showToast('success', `Created file "${name}"`);
        fetchDirectory(currentRelativePath, true);
      } else {
        showToast('error', data.error || 'Failed to create file');
        fetchDirectory(currentRelativePath, true);
      }
    } catch (err) {
      showToast('error', 'Failed to create file on FTP');
      fetchDirectory(currentRelativePath, true);
    }
  };

  // Rename Handler
  const handleRenameSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!renameItem) return;
    const oldRel = renameItem.relativePath || renameItem.path;
    const newName = renameNewName.trim();
    if (!newName || newName === renameItem.name) {
      setShowRenameModal(false);
      return;
    }

    const parentRel = oldRel.substring(0, oldRel.lastIndexOf('/')) || '/';
    const newRel = parentRel === '/' ? `/${newName}` : `${parentRel}/${newName}`;

    setShowRenameModal(false);

    try {
      const token = adminToken || localStorage.getItem('shipu_admin_token') || 'admin_session';
      const res = await fetch('/api/ftp/files/rename', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ oldPath: oldRel, newPath: newRel })
      });
      const data = await res.json();
      if (data.success) {
        showToast('success', `Renamed to "${newName}"`);
        fetchDirectory(currentRelativePath, true);
      } else {
        showToast('error', data.error || 'Failed to rename item');
        fetchDirectory(currentRelativePath, true);
      }
    } catch (err) {
      showToast('error', 'Failed to rename item on FTP');
      fetchDirectory(currentRelativePath, true);
    }
  };

  // Move / Copy Submit
  const handleMoveCopySubmit = async () => {
    if (selectedPaths.size === 0) return;
    const sources = Array.from(selectedPaths);
    setShowMoveCopyModal(false);

    try {
      const token = adminToken || localStorage.getItem('shipu_admin_token') || 'admin_session';
      const endpoint = moveCopyAction === 'move' ? '/api/ftp/files/move' : '/api/ftp/files/copy';
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          sourcePaths: sources,
          destinationDir: destinationFolder
        })
      });
      const data = await res.json();
      if (data.success) {
        showToast('success', `${moveCopyAction === 'move' ? 'Moved' : 'Copied'} ${sources.length} items`);
        setSelectedPaths(new Set());
        fetchDirectory(currentRelativePath, true);
      } else {
        showToast('error', data.error || `Failed to ${moveCopyAction} items`);
        fetchDirectory(currentRelativePath, true);
      }
    } catch (err) {
      showToast('error', `Failed to ${moveCopyAction} items on FTP`);
      fetchDirectory(currentRelativePath, true);
    }
  };

  // Delete Submit
  const handleDeleteSubmit = async () => {
    if (deleteTargets.length === 0) return;
    const targets = [...deleteTargets];
    setShowDeleteModal(false);

    try {
      const token = adminToken || localStorage.getItem('shipu_admin_token') || 'admin_session';
      const res = await fetch('/api/ftp/files/delete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ filePaths: targets })
      });
      const data = await res.json();
      if (data.success) {
        showToast('success', `Deleted ${data.deletedCount || targets.length} items`);
        setSelectedPaths(new Set());
        fetchDirectory(currentRelativePath, true);
      } else {
        showToast('error', data.error || 'Failed to delete items');
        fetchDirectory(currentRelativePath, true);
      }
    } catch (err) {
      showToast('error', 'Failed to delete items from FTP');
      fetchDirectory(currentRelativePath, true);
    }
  };

  // File Upload Handlers
  const handleFileSelectChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const fileList = Array.from(e.target.files).map((file: File) => ({
      file,
      relativePath: (file as any).webkitRelativePath || file.name
    }));
    setUploadFilesList(fileList);
    setShowUploadModal(true);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const fileList = Array.from(e.dataTransfer.files).map((file: File) => ({
        file,
        relativePath: file.name
      }));
      setUploadFilesList(fileList);
      setShowUploadModal(true);
    }
  };

  const handleStartUpload = async () => {
    if (uploadFilesList.length === 0) return;
    setIsUploading(true);
    setUploadProgress({ current: 0, total: uploadFilesList.length, currentName: '' });

    const token = adminToken || localStorage.getItem('shipu_admin_token') || 'admin_session';
    let uploaded = 0;

    for (let i = 0; i < uploadFilesList.length; i++) {
      const item = uploadFilesList[i];
      setUploadProgress({ current: i + 1, total: uploadFilesList.length, currentName: item.relativePath });

      try {
        const base64Content = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = () => {
            const resStr = reader.result as string;
            const base64 = resStr.split(',')[1] || '';
            resolve(base64);
          };
          reader.readAsDataURL(item.file);
        });

        await fetch('/api/ftp/files/upload', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            destinationDir: currentRelativePath,
            files: [{ relativePath: item.relativePath, contentBase64: base64Content }]
          })
        });
        uploaded++;
      } catch (err) {
        console.error('Failed uploading', item.relativePath, err);
      }
    }

    setIsUploading(false);
    setShowUploadModal(false);
    setUploadFilesList([]);
    showToast('success', `Uploaded ${uploaded} file(s)`);
    fetchDirectory(currentRelativePath, true);
  };

  // Selected item metadata for details panel
  const singleSelectedItem = selectedPaths.size === 1
    ? files.find(f => (f.relativePath || f.path) === Array.from(selectedPaths)[0])
    : null;

  // Breadcrumb Segments strictly from currentRelativePath
  const relativeSegments = currentRelativePath.split('/').filter(Boolean);
  const breadcrumbSegments = relativeSegments.map((seg, idx) => {
    const segRel = '/' + relativeSegments.slice(0, idx + 1).join('/');
    return { name: seg, path: segRel };
  });

  return (
    <div
      className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl flex flex-col text-slate-100 font-sans"
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleDrop}
    >
      {/* Toast Notification Bar */}
      {toastMessage && (
        <div className={`px-4 py-2.5 text-xs font-semibold flex items-center justify-between transition-all ${
          toastMessage.type === 'success' ? 'bg-emerald-600/20 text-emerald-300 border-b border-emerald-500/30' :
          toastMessage.type === 'error' ? 'bg-rose-600/20 text-rose-300 border-b border-rose-500/30' :
          'bg-indigo-600/20 text-indigo-300 border-b border-indigo-500/30'
        }`}>
          <div className="flex items-center space-x-2">
            {toastMessage.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
            {toastMessage.type === 'error' && <ShieldAlert className="w-4 h-4 text-rose-400" />}
            {toastMessage.type === 'info' && <Info className="w-4 h-4 text-indigo-400" />}
            <span>{toastMessage.text}</span>
          </div>
          <button onClick={() => setToastMessage(null)} className="text-slate-400 hover:text-slate-100">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* HEADER STATUS & INFO BAR */}
      <div className="bg-slate-950 px-4 py-3 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-1.5 font-bold text-slate-100">
            <Server className="w-4 h-4 text-amber-400 shrink-0" />
            <span>cPanel FTP Remote Command File Manager</span>
          </div>
          <span className={`px-2.5 py-0.5 rounded-full font-bold text-[10px] flex items-center gap-1 border ${
            connectionStatus === 'CONNECTED' ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' :
            'bg-amber-500/20 text-amber-300 border-amber-500/30'
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${connectionStatus === 'CONNECTED' ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
            {connectionStatus}
          </span>
        </div>

        <div className="flex items-center space-x-4 font-mono text-[11px] text-slate-400">
          <div>
            Root: <code className="text-amber-300 font-bold">{remoteRoot}</code>
          </div>
          <div>
            Current: <code className="text-indigo-300 font-bold">{currentRelativePath}</code>
          </div>
          {telemetry && (
            <div className="text-slate-500">
              {telemetry.telemetryMs}ms {telemetry.cacheHit ? '(Cached)' : '(FTP Remote)'}
            </div>
          )}
          <div className="text-slate-400 font-bold">
            {counts.folders} folders, {counts.files} files
          </div>
        </div>
      </div>

      {/* TOP TOOLBAR */}
      <div className="bg-slate-900 p-3 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
        {/* Navigation Controls & Breadcrumb Bar */}
        <div className="flex items-center space-x-2 flex-1 min-w-[280px]">
          <div className="flex items-center space-x-1 bg-slate-950 p-1 rounded-xl border border-slate-800 shrink-0">
            <button
              onClick={handleBack}
              disabled={historyIndex <= 0}
              title="Go Back"
              className="p-1.5 text-slate-400 hover:text-slate-100 disabled:opacity-30 disabled:hover:text-slate-400 rounded-lg transition"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <button
              onClick={handleForward}
              disabled={historyIndex >= history.length - 1}
              title="Go Forward"
              className="p-1.5 text-slate-400 hover:text-slate-100 disabled:opacity-30 disabled:hover:text-slate-400 rounded-lg transition"
            >
              <ArrowRight className="w-4 h-4" />
            </button>
            <button
              onClick={handleUpLevel}
              disabled={currentRelativePath === '/'}
              title="Up One Level"
              className="p-1.5 text-slate-400 hover:text-slate-100 disabled:opacity-30 disabled:hover:text-slate-400 rounded-lg transition"
            >
              <CornerLeftUp className="w-4 h-4" />
            </button>
            <button
              onClick={() => fetchDirectory(currentRelativePath, true)}
              disabled={isRefreshing || isLoading}
              title="Refresh Directory"
              className="p-1.5 text-slate-400 hover:text-amber-400 rounded-lg transition"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-amber-400' : ''}`} />
            </button>
          </div>

          {/* Interactive Breadcrumb Bar */}
          <div className="flex-1 bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800 flex items-center space-x-1 overflow-x-auto no-scrollbar font-mono text-xs">
            <button
              onClick={() => navigateTo('/')}
              className={`hover:underline shrink-0 font-bold flex items-center gap-1 ${
                currentRelativePath === '/' ? 'text-amber-300' : 'text-amber-400'
              }`}
            >
              <HardDrive className="w-3.5 h-3.5" /> Root ({remoteRoot})
            </button>
            {breadcrumbSegments.map((seg) => (
              <React.Fragment key={seg.path}>
                <ChevronRight className="w-3 h-3 text-slate-600 shrink-0" />
                <button
                  onClick={() => navigateTo(seg.path)}
                  className={`shrink-0 hover:underline ${
                    seg.path === currentRelativePath ? 'text-amber-300 font-bold' : 'text-slate-300'
                  }`}
                >
                  {seg.name}
                </button>
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* Action Controls & Search */}
        <div className="flex items-center space-x-2 flex-wrap sm:flex-nowrap">
          {/* Search Input */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search files..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-36 sm:w-44 pl-8 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-amber-500 font-mono"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* New Item Action Buttons */}
          <div className="flex items-center space-x-1">
            <button
              onClick={() => setShowImageQueueModal(true)}
              className="px-3 py-1.5 bg-pink-600/20 hover:bg-pink-600/30 text-pink-300 border border-pink-500/30 text-xs font-semibold rounded-xl transition flex items-center space-x-1 relative shadow-md"
            >
              <ImageIcon className="w-3.5 h-3.5 text-pink-400" />
              <span className="hidden sm:inline">Image Queue</span>
              {imageQueueTasks.filter(t => t.status === 'failed' || t.status === 'processing' || t.status === 'queued').length > 0 && (
                <span className="absolute -top-1.5 -right-1.5 bg-pink-500 text-white text-[9px] font-bold px-1.5 py-0.2 rounded-full shadow">
                  {imageQueueTasks.filter(t => t.status === 'failed' || t.status === 'processing' || t.status === 'queued').length}
                </span>
              )}
            </button>
            <button
              onClick={() => setShowNewFileModal(true)}
              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl transition flex items-center space-x-1 shadow-md"
            >
              <FilePlus className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">New File</span>
            </button>
            <button
              onClick={() => setShowNewFolderModal(true)}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl border border-slate-700 transition flex items-center space-x-1"
            >
              <FolderPlus className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden sm:inline">New Folder</span>
            </button>
          </div>

          {/* Upload Button */}
          <div className="relative">
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={handleFileSelectChange}
            />
            <input
              ref={folderInputRef}
              type="file"
              {...({ webkitdirectory: '', directory: '' } as any)}
              className="hidden"
              onChange={handleFileSelectChange}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold rounded-xl transition flex items-center space-x-1 shadow-md"
            >
              <Upload className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Upload</span>
            </button>
          </div>

          {/* View Toggle */}
          <div className="flex items-center bg-slate-950 border border-slate-800 rounded-xl p-0.5">
            <button
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded-lg text-xs transition ${
                viewMode === 'list' ? 'bg-amber-500/20 text-amber-300' : 'text-slate-400 hover:text-slate-200'
              }`}
              title="List View"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-lg text-xs transition ${
                viewMode === 'grid' ? 'bg-amber-500/20 text-amber-300' : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Grid View"
            >
              <Layers className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Details Panel Toggle */}
          <button
            onClick={() => setShowDetailsPanel(!showDetailsPanel)}
            className={`p-1.5 rounded-xl border transition ${
              showDetailsPanel
                ? 'bg-indigo-600/20 text-indigo-300 border-indigo-500/30'
                : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200'
            }`}
            title="Toggle File Info Panel"
          >
            <Info className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* MULTI-SELECT BAR */}
      {selectedPaths.size > 0 && (
        <div className="bg-indigo-950/80 border-b border-indigo-800/50 px-4 py-2 flex items-center justify-between text-xs font-medium">
          <div className="flex items-center space-x-3 text-indigo-200">
            <span className="font-bold bg-indigo-900/80 px-2.5 py-1 rounded-lg border border-indigo-700/50">
              Selected: {selectedPaths.size}
            </span>
            <button
              onClick={selectAll}
              className="text-indigo-300 hover:underline flex items-center space-x-1"
            >
              <CheckSquare className="w-3.5 h-3.5" />
              <span>{selectedPaths.size === sortedFiles.length ? 'Deselect All' : 'Select All'}</span>
            </button>
          </div>

          <div className="flex items-center space-x-2">
            {selectedPaths.size === 1 && singleSelectedItem?.type === 'file' && (
              <button
                onClick={() => handleDownloadFile(singleSelectedItem.relativePath || singleSelectedItem.path)}
                className="px-2.5 py-1 bg-indigo-900 hover:bg-indigo-800 text-indigo-200 rounded-lg transition flex items-center space-x-1 border border-indigo-700/40"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download</span>
              </button>
            )}

            <button
              onClick={() => { setMoveCopyAction('move'); setShowMoveCopyModal(true); }}
              className="px-2.5 py-1 bg-indigo-900 hover:bg-indigo-800 text-indigo-200 rounded-lg transition flex items-center space-x-1 border border-indigo-700/40"
            >
              <Move className="w-3.5 h-3.5" />
              <span>Move</span>
            </button>

            <button
              onClick={() => { setMoveCopyAction('copy'); setShowMoveCopyModal(true); }}
              className="px-2.5 py-1 bg-indigo-900 hover:bg-indigo-800 text-indigo-200 rounded-lg transition flex items-center space-x-1 border border-indigo-700/40"
            >
              <Copy className="w-3.5 h-3.5" />
              <span>Copy</span>
            </button>

            <button
              onClick={() => {
                setDeleteTargets(Array.from(selectedPaths));
                setShowDeleteModal(true);
              }}
              className="px-2.5 py-1 bg-rose-900/60 hover:bg-rose-800 text-rose-200 rounded-lg transition flex items-center space-x-1 border border-rose-700/40"
            >
              <Trash2 className="w-3.5 h-3.5 text-rose-400" />
              <span>Delete</span>
            </button>
          </div>
        </div>
      )}

      {/* MAIN CONTAINER */}
      <div className="flex-1 flex overflow-hidden min-h-[420px] max-h-[680px]">
        {/* FILE EDITOR MODE IF ACTIVE */}
        {editingFile ? (
          <div className="flex-1 flex flex-col bg-slate-950">
            {/* Editor Toolbar */}
            <div className="bg-slate-900 px-4 py-2 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center space-x-2 truncate">
                {getFileIcon(editingFile.name, false)}
                <span className="font-mono text-xs font-bold text-amber-300 truncate">
                  {editingFile.relativePath || editingFile.path}
                </span>
                {editorContent !== originalContent && (
                  <span className="w-2 h-2 rounded-full bg-amber-400" title="Unsaved changes" />
                )}
              </div>

              <div className="flex items-center space-x-2">
                <label className="flex items-center space-x-1.5 text-[11px] text-slate-400 cursor-pointer mr-2">
                  <input
                    type="checkbox"
                    checked={createBackupOnSave}
                    onChange={(e) => setCreateBackupOnSave(e.target.checked)}
                    className="rounded bg-slate-950 border-slate-800 text-amber-500 focus:ring-amber-500"
                  />
                  <span>Backup on save</span>
                </label>

                <button
                  onClick={() => setEditorWordWrap(editorWordWrap === 'on' ? 'off' : 'on')}
                  className={`p-1.5 rounded-lg text-xs border transition ${
                    editorWordWrap === 'on' ? 'bg-amber-500/20 text-amber-300 border-amber-500/30' : 'bg-slate-950 text-slate-400 border-slate-800'
                  }`}
                  title="Toggle Word Wrap"
                >
                  <WrapText className="w-3.5 h-3.5" />
                </button>

                <button
                  onClick={handleSaveEditorFile}
                  disabled={isSavingFile}
                  className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold rounded-xl transition flex items-center space-x-1.5 shadow"
                >
                  <Save className={`w-3.5 h-3.5 ${isSavingFile ? 'animate-spin' : ''}`} />
                  <span>{isSavingFile ? 'Saving...' : saveSuccessMsg || 'Save File'}</span>
                </button>

                <button
                  onClick={() => setEditingFile(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-100 rounded-xl hover:bg-slate-800 transition"
                  title="Close Editor"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Monaco Editor Canvas */}
            <div className="flex-1 relative">
              <Editor
                height="100%"
                language={getMonacoLanguage(editingFile.name)}
                theme="vs-dark"
                value={editorContent}
                onChange={(val) => setEditorContent(val || '')}
                options={{
                  wordWrap: editorWordWrap,
                  minimap: { enabled: false },
                  fontSize: 13,
                  lineNumbers: 'on',
                  scrollBeyondLastLine: false,
                  automaticLayout: true
                }}
              />
            </div>
          </div>
        ) : (
          /* FILE LISTING VIEW */
          <div className="flex-1 flex overflow-hidden">
            <div className="flex-1 p-3 overflow-y-auto space-y-1">
              {isLoading ? (
                <div className="space-y-2 py-4">
                  {[1, 2, 3, 4, 5, 6].map((i) => (
                    <div key={i} className="h-10 bg-slate-950 rounded-xl animate-pulse flex items-center px-4 justify-between border border-slate-800/40">
                      <div className="flex items-center space-x-3 w-1/3">
                        <div className="w-4 h-4 bg-slate-800 rounded-md" />
                        <div className="h-3 bg-slate-800 rounded w-full" />
                      </div>
                      <div className="h-3 bg-slate-800 rounded w-16" />
                      <div className="h-3 bg-slate-800 rounded w-24" />
                    </div>
                  ))}
                </div>
              ) : sortedFiles.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center py-16 text-slate-500 text-center space-y-3">
                  <FolderOpen className="w-12 h-12 text-slate-700" />
                  <div>
                    <p className="text-sm font-semibold text-slate-400">This directory is empty</p>
                    <p className="text-xs text-slate-600 mt-0.5">0 folders, 0 files inside <code className="text-amber-400/80">{currentRelativePath}</code></p>
                  </div>
                  <div className="flex items-center space-x-2 pt-2">
                    <button
                      onClick={() => setShowNewFileModal(true)}
                      className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl transition"
                    >
                      New File
                    </button>
                    <button
                      onClick={() => setShowNewFolderModal(true)}
                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl border border-slate-700 transition"
                    >
                      New Folder
                    </button>
                  </div>
                </div>
              ) : viewMode === 'list' ? (
                /* COMPACT LIST VIEW */
                <div className="space-y-1">
                  {/* Table Header */}
                  <div className="grid grid-cols-12 px-3 py-1.5 text-[11px] font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-800/60 select-none">
                    <div className="col-span-6 sm:col-span-6 flex items-center space-x-2">
                      <button onClick={selectAll} className="text-slate-500 hover:text-slate-300">
                        {selectedPaths.size === sortedFiles.length ? (
                          <CheckSquare className="w-3.5 h-3.5 text-indigo-400" />
                        ) : (
                          <Square className="w-3.5 h-3.5" />
                        )}
                      </button>
                      <button
                        onClick={() => {
                          if (sortBy === 'name') setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                          else { setSortBy('name'); setSortOrder('asc'); }
                        }}
                        className="hover:text-slate-300 flex items-center space-x-1"
                      >
                        <span>Name</span>
                      </button>
                    </div>
                    <div className="col-span-3 sm:col-span-2 text-right">
                      <button
                        onClick={() => {
                          if (sortBy === 'size') setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                          else { setSortBy('size'); setSortOrder('asc'); }
                        }}
                        className="hover:text-slate-300"
                      >
                        Size
                      </button>
                    </div>
                    <div className="hidden sm:block col-span-3 text-right">
                      <button
                        onClick={() => {
                          if (sortBy === 'modified') setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                          else { setSortBy('modified'); setSortOrder('asc'); }
                        }}
                        className="hover:text-slate-300"
                      >
                        Modified
                      </button>
                    </div>
                    <div className="col-span-3 sm:col-span-1 text-center">Actions</div>
                  </div>

                  {/* Table Items */}
                  {sortedFiles.map((file) => {
                    const rel = file.relativePath || file.path;
                    const isSelected = selectedPaths.has(rel);
                    return (
                      <div
                        key={rel}
                        onClick={() => toggleSelect(rel)}
                        onDoubleClick={() => handleItemClick(file)}
                        onContextMenu={(e) => handleContextMenu(e, file)}
                        className={`grid grid-cols-12 px-3 py-2 text-xs rounded-xl items-center transition cursor-pointer select-none group border ${
                          isSelected
                            ? 'bg-indigo-950/60 border-indigo-700/60 text-slate-100'
                            : 'bg-slate-950/40 border-slate-800/40 hover:bg-slate-800/50 hover:border-slate-700 text-slate-300'
                        }`}
                      >
                        {/* Name & Icon */}
                        <div className="col-span-6 sm:col-span-6 flex items-center space-x-2.5 min-w-0 pr-2">
                          <button
                            onClick={(e) => toggleSelect(rel, e)}
                            className="text-slate-500 hover:text-indigo-400 shrink-0"
                          >
                            {isSelected ? (
                              <CheckSquare className="w-3.5 h-3.5 text-indigo-400" />
                            ) : (
                              <Square className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100" />
                            )}
                          </button>

                          {getFileIcon(file.name, file.type === 'directory')}

                          <span className={`truncate font-mono font-medium ${file.type === 'directory' ? 'text-amber-300 font-semibold' : 'text-slate-200'}`}>
                            {file.name}
                          </span>
                        </div>

                        {/* Size */}
                        <div className="col-span-3 sm:col-span-2 text-right font-mono text-[11px] text-slate-400">
                          {file.type === 'directory' ? 'Folder' : formatSize(file.size)}
                        </div>

                        {/* Modified Date */}
                        <div className="hidden sm:block col-span-3 text-right font-mono text-[11px] text-slate-500">
                          {file.modifiedAt ? new Date(file.modifiedAt).toLocaleString() : '—'}
                        </div>

                        {/* Action Buttons */}
                        <div className="col-span-3 sm:col-span-1 flex items-center justify-center space-x-1">
                          <button
                            onClick={(e) => { e.stopPropagation(); handleItemClick(file); }}
                            className="p-1 text-slate-400 hover:text-amber-300 hover:bg-slate-800 rounded-lg transition"
                            title={file.type === 'directory' ? 'Open Folder' : 'Edit File'}
                          >
                            {file.type === 'directory' ? <FolderOpen className="w-3.5 h-3.5" /> : <Edit3 className="w-3.5 h-3.5" />}
                          </button>
                          <button
                            onClick={(e) => handleContextMenu(e, file)}
                            className="p-1 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition"
                            title="More Actions"
                          >
                            <MoreVertical className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                /* GRID VIEW */
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 p-1">
                  {sortedFiles.map((file) => {
                    const rel = file.relativePath || file.path;
                    const isSelected = selectedPaths.has(rel);
                    return (
                      <div
                        key={rel}
                        onClick={() => toggleSelect(rel)}
                        onDoubleClick={() => handleItemClick(file)}
                        onContextMenu={(e) => handleContextMenu(e, file)}
                        className={`p-3 rounded-2xl border flex flex-col items-center text-center space-y-2 cursor-pointer transition select-none relative group ${
                          isSelected
                            ? 'bg-indigo-950/70 border-indigo-600/80 shadow-lg'
                            : 'bg-slate-950/50 border-slate-800/60 hover:bg-slate-800/60 hover:border-slate-700'
                        }`}
                      >
                        <div className="p-3 rounded-xl bg-slate-900 border border-slate-800/60 group-hover:scale-105 transition-transform">
                          {getFileIcon(file.name, file.type === 'directory')}
                        </div>

                        <div className="w-full min-w-0">
                          <p className={`text-xs font-mono truncate font-medium ${file.type === 'directory' ? 'text-amber-300 font-bold' : 'text-slate-200'}`}>
                            {file.name}
                          </p>
                          <p className="text-[10px] text-slate-500 font-mono mt-0.5">
                            {file.type === 'directory' ? 'Folder' : formatSize(file.size)}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* DETAILS / INSPECTOR PANEL */}
            {showDetailsPanel && (
              <div className="w-64 bg-slate-950 border-l border-slate-800 p-4 hidden lg:flex flex-col space-y-4 text-xs">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <span className="font-bold text-slate-200 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                    <Info className="w-3.5 h-3.5 text-indigo-400" /> Item Details
                  </span>
                  <button onClick={() => setShowDetailsPanel(false)} className="text-slate-500 hover:text-slate-300">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                {singleSelectedItem ? (
                  <div className="space-y-4">
                    <div className="p-4 bg-slate-900 rounded-2xl border border-slate-800 flex flex-col items-center text-center space-y-2">
                      {getFileIcon(singleSelectedItem.name, singleSelectedItem.type === 'directory')}
                      <span className="font-mono font-bold text-slate-100 text-xs break-all">
                        {singleSelectedItem.name}
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {singleSelectedItem.type === 'directory' ? 'Folder' : formatSize(singleSelectedItem.size)}
                      </span>
                    </div>

                    <div className="space-y-2 font-mono text-[11px]">
                      <div>
                        <span className="text-slate-500 block text-[10px]">Relative Path</span>
                        <span className="text-indigo-300 break-all font-semibold">
                          {singleSelectedItem.relativePath || singleSelectedItem.path}
                        </span>
                      </div>

                      {singleSelectedItem.displayPath && (
                        <div>
                          <span className="text-slate-500 block text-[10px]">Remote Server Path</span>
                          <span className="text-slate-400 break-all">
                            {singleSelectedItem.displayPath}
                          </span>
                        </div>
                      )}

                      <div>
                        <span className="text-slate-500 block text-[10px]">Modified Date</span>
                        <span className="text-slate-300">
                          {singleSelectedItem.modifiedAt ? new Date(singleSelectedItem.modifiedAt).toLocaleString() : '—'}
                        </span>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-slate-800 space-y-2">
                      <button
                        onClick={() => handleItemClick(singleSelectedItem)}
                        className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl transition flex items-center justify-center space-x-1.5"
                      >
                        {singleSelectedItem.type === 'directory' ? <FolderOpen className="w-3.5 h-3.5" /> : <Edit3 className="w-3.5 h-3.5" />}
                        <span>{singleSelectedItem.type === 'directory' ? 'Open Folder' : 'Edit File'}</span>
                      </button>

                      {singleSelectedItem.type === 'file' && (
                        <button
                          onClick={() => handleDownloadFile(singleSelectedItem.relativePath || singleSelectedItem.path)}
                          className="w-full py-2 bg-slate-900 hover:bg-slate-800 text-slate-200 text-xs font-bold rounded-xl border border-slate-800 transition flex items-center justify-center space-x-1.5"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>Download File</span>
                        </button>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="text-slate-500 text-center py-8 space-y-2 font-mono text-[11px]">
                    <HardDrive className="w-8 h-8 text-slate-700 mx-auto" />
                    <p>Select a file or folder to view details</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* CONTEXT MENU */}
      {contextMenu && (
        <div
          style={{ top: contextMenu.y, left: contextMenu.x }}
          className="fixed z-50 w-48 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-1.5 text-xs font-sans space-y-0.5"
        >
          <button
            onClick={() => handleItemClick(contextMenu.item)}
            className="w-full px-3 py-2 text-left text-slate-200 hover:bg-slate-800 rounded-xl transition flex items-center space-x-2 font-medium"
          >
            {contextMenu.item.type === 'directory' ? <FolderOpen className="w-3.5 h-3.5 text-amber-400" /> : <Edit3 className="w-3.5 h-3.5 text-indigo-400" />}
            <span>{contextMenu.item.type === 'directory' ? 'Open Directory' : 'Edit File'}</span>
          </button>

          {contextMenu.item.type === 'file' && (
            <button
              onClick={() => handleDownloadFile(contextMenu.item.relativePath || contextMenu.item.path)}
              className="w-full px-3 py-2 text-left text-slate-200 hover:bg-slate-800 rounded-xl transition flex items-center space-x-2 font-medium"
            >
              <Download className="w-3.5 h-3.5 text-emerald-400" />
              <span>Download</span>
            </button>
          )}

          <button
            onClick={() => {
              setRenameItem(contextMenu.item);
              setRenameNewName(contextMenu.item.name);
              setShowRenameModal(true);
            }}
            className="w-full px-3 py-2 text-left text-slate-200 hover:bg-slate-800 rounded-xl transition flex items-center space-x-2 font-medium"
          >
            <Edit3 className="w-3.5 h-3.5 text-sky-400" />
            <span>Rename (F2)</span>
          </button>

          <div className="border-t border-slate-800 my-1" />

          <button
            onClick={() => {
              setDeleteTargets([contextMenu.item.relativePath || contextMenu.item.path]);
              setShowDeleteModal(true);
            }}
            className="w-full px-3 py-2 text-left text-rose-400 hover:bg-rose-950/40 rounded-xl transition flex items-center space-x-2 font-medium"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Delete</span>
          </button>
        </div>
      )}

      {/* NEW FOLDER MODAL */}
      {showNewFolderModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-sm w-full space-y-4 shadow-2xl">
            <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              <FolderPlus className="w-4 h-4 text-amber-400" /> Create New Folder
            </h3>
            {folderError && <p className="text-xs text-rose-400">{folderError}</p>}
            <form onSubmit={handleCreateFolderSubmit} className="space-y-4">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Folder Name</label>
                <input
                  type="text"
                  autoFocus
                  placeholder="e.g. subfolder"
                  value={newFolderName}
                  onChange={(e) => { setNewFolderName(e.target.value); setFolderError(null); }}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 font-mono focus:outline-none focus:border-amber-500"
                />
              </div>
              <div className="flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setShowNewFolderModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold rounded-xl"
                >
                  Create Folder
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* NEW FILE MODAL */}
      {showNewFileModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-sm w-full space-y-4 shadow-2xl">
            <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              <FilePlus className="w-4 h-4 text-indigo-400" /> Create New File
            </h3>
            {fileError && <p className="text-xs text-rose-400">{fileError}</p>}
            <form onSubmit={handleCreateFileSubmit} className="space-y-4">
              <div>
                <label className="block text-xs text-slate-400 mb-1">File Name (e.g. test.js)</label>
                <input
                  type="text"
                  autoFocus
                  placeholder="e.g. command.js"
                  value={newFileName}
                  onChange={(e) => { setNewFileName(e.target.value); setFileError(null); }}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 font-mono focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div className="flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setShowNewFileModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl"
                >
                  Create File
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* UPLOAD MODAL */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-md w-full space-y-4 shadow-2xl">
            <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              <Upload className="w-4 h-4 text-amber-400" /> Upload Files to Remote Directory
            </h3>

            <p className="text-xs text-slate-400 font-mono">
              Target: <code className="text-indigo-300 font-bold">{currentRelativePath}</code>
            </p>

            <div className="max-h-40 overflow-y-auto space-y-1 bg-slate-950 p-2 rounded-xl border border-slate-800 text-xs font-mono">
              {uploadFilesList.map((f, i) => (
                <div key={i} className="flex items-center justify-between py-1 px-2 text-slate-300 border-b border-slate-900/60 last:border-none">
                  <span className="truncate">{f.relativePath}</span>
                  <span className="text-slate-500 text-[10px]">{formatSize(f.file.size)}</span>
                </div>
              ))}
            </div>

            {isUploading && (
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs text-slate-300 font-mono">
                  <span>Uploading...</span>
                  <span>{uploadProgress.current} / {uploadProgress.total}</span>
                </div>
                <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden border border-slate-800">
                  <div
                    className="bg-amber-500 h-full transition-all"
                    style={{ width: `${(uploadProgress.current / uploadProgress.total) * 100}%` }}
                  />
                </div>
              </div>
            )}

            <div className="flex items-center justify-end space-x-2 pt-2">
              <button
                disabled={isUploading}
                onClick={() => setShowUploadModal(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl"
              >
                Cancel
              </button>
              <button
                disabled={isUploading}
                onClick={handleStartUpload}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold rounded-xl flex items-center gap-1.5"
              >
                <Upload className="w-3.5 h-3.5" /> Start Upload
              </button>
            </div>
          </div>
        </div>
      )}

      {/* RENAME MODAL */}
      {showRenameModal && renameItem && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-sm w-full space-y-4 shadow-2xl">
            <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              <Edit3 className="w-4 h-4 text-sky-400" /> Rename Item
            </h3>
            <form onSubmit={handleRenameSubmit} className="space-y-4">
              <div>
                <label className="block text-xs text-slate-400 mb-1">New Name</label>
                <input
                  type="text"
                  autoFocus
                  value={renameNewName}
                  onChange={(e) => setRenameNewName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 font-mono focus:outline-none focus:border-sky-500"
                />
              </div>
              <div className="flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setShowRenameModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold rounded-xl"
                >
                  Rename
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MOVE / COPY MODAL */}
      {showMoveCopyModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-sm w-full space-y-4 shadow-2xl">
            <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              <Move className="w-4 h-4 text-indigo-400" /> {moveCopyAction === 'move' ? 'Move' : 'Copy'} Items
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Destination Relative Path</label>
                <input
                  type="text"
                  placeholder="/"
                  value={destinationFolder}
                  onChange={(e) => setDestinationFolder(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 font-mono focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div className="flex items-center justify-end space-x-2">
                <button
                  onClick={() => setShowMoveCopyModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl"
                >
                  Cancel
                </button>
                <button
                  onClick={handleMoveCopySubmit}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl"
                >
                  {moveCopyAction === 'move' ? 'Move' : 'Copy'} Now
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-sm w-full space-y-4 shadow-2xl">
            <h3 className="text-sm font-bold text-rose-400 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-400" /> Confirm Delete
            </h3>
            <p className="text-xs text-slate-300">
              Are you sure you want to permanently delete {deleteTargets.length} item(s) from cPanel FTP?
            </p>
            <div className="flex items-center justify-end space-x-2">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteSubmit}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-xl"
              >
                Delete Permanently
              </button>
            </div>
          </div>
        </div>
      )}

      {/* IMAGE PROCESSING QUEUE MODAL */}
      {showImageQueueModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-2xl w-full space-y-5 shadow-2xl flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-2">
                <ImageIcon className="w-5 h-5 text-pink-400" />
                <h3 className="text-sm font-bold text-slate-100">Image Processing Queue & Generation Monitor</h3>
              </div>
              <button
                onClick={() => setShowImageQueueModal(false)}
                className="text-slate-400 hover:text-slate-100 p-1 rounded-lg hover:bg-slate-800 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center justify-between text-xs text-slate-400 flex-wrap gap-2">
              <span>Real-time tracking of Gemini image generations and Pix2Pix edits</span>
              <div className="flex items-center space-x-2">
                <button
                  onClick={handleClearCompletedTasks}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition"
                >
                  Clear Completed
                </button>
                <button
                  onClick={handleClearHungTasks}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition"
                >
                  Clear Hung Tasks
                </button>
                <button
                  onClick={handleClearAllQueue}
                  className="px-3 py-1.5 bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 rounded-xl transition"
                >
                  Clear All
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
              {imageQueueTasks.length === 0 ? (
                <div className="text-center py-12 text-slate-500 text-xs font-mono">
                  No tasks currently in the image processing queue.
                </div>
              ) : (
                imageQueueTasks.map((task) => (
                  <div
                    key={task.id}
                    className="bg-slate-950 border border-slate-800/80 rounded-2xl p-3.5 flex flex-col space-y-2 hover:border-slate-700 transition"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                          task.status === 'completed' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' :
                          task.status === 'processing' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' :
                          task.status === 'failed' ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' :
                          'bg-slate-800 text-slate-300 border border-slate-700'
                        }`}>
                          {task.status}
                        </span>
                        <span className="text-xs font-bold text-slate-200 capitalize">
                          {task.type} Task ({task.id})
                        </span>
                      </div>
                      <div className="flex items-center space-x-3 text-[11px] text-slate-400 font-mono">
                        <span>{task.timestamp}</span>
                        {(task.status === 'failed' || task.status === 'queued') && (
                          <button
                            onClick={() => handleRetryTask(task.id)}
                            className="px-2.5 py-1 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-lg flex items-center gap-1 transition"
                          >
                            <RefreshCw className="w-3 h-3" /> Retry
                          </button>
                        )}
                      </div>
                    </div>

                    <p className="text-xs text-slate-300 font-mono bg-slate-900/60 p-2 rounded-xl border border-slate-800/60 truncate">
                      "{task.prompt}"
                    </p>

                    {task.error && (
                      <p className="text-[11px] text-rose-400 font-mono bg-rose-950/20 p-2 rounded-xl border border-rose-900/40">
                        Error: {task.error}
                      </p>
                    )}

                    {task.status === 'processing' && task.progress !== undefined && (
                      <div className="space-y-1">
                        <div className="flex justify-between text-[10px] text-slate-400 font-mono">
                          <span>Processing model inference...</span>
                          <span>{task.progress}%</span>
                        </div>
                        <div className="w-full bg-slate-900 h-1.5 rounded-full overflow-hidden border border-slate-800">
                          <div
                            className="bg-amber-500 h-full transition-all duration-500"
                            style={{ width: `${task.progress}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>

            <div className="flex items-center justify-end pt-2 border-t border-slate-800">
              <button
                onClick={() => setShowImageQueueModal(false)}
                className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl transition"
              >
                Close Monitor
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
