import React, { useState, useEffect } from 'react';
import {
  Brain,
  Search,
  Plus,
  Trash2,
  Edit2,
  Sparkles,
  Download,
  Upload,
  Check,
  X,
  AlertCircle,
  Eye,
  RefreshCw,
  Sliders,
  ChevronRight,
  User,
  Shield,
  Activity,
  ThumbsUp,
  FileJson,
  History
} from 'lucide-react';

interface Memory {
  _id: string;
  trigger: string;
  reply: string;
  category: string;
  variations: string[];
  aiNormalizedTrigger: string[];
  replyVariations: string[];
  createdBy: string;
  enabled: boolean;
  usageCount: number;
  lastUsed?: string;
  createdAt: string;
  isFact?: boolean;
  factEntity?: string;
  factAttribute?: string;
  factValue?: string;
}

interface Suggestion {
  _id: string;
  trigger: string;
  suggestedReply: string;
  count: number;
  confidence: number;
  status: 'pending' | 'approved' | 'rejected';
  category?: string;
  isFact?: boolean;
  factEntity?: string;
  factAttribute?: string;
  factValue?: string;
  learningContext?: string;
  conflictStatus?: string;
  conflictDetails?: string;
}

function stripEmojiFormatters(str: string): string {
  if (!str) return '';
  return str.normalize('NFC').replace(/[\uFE00-\uFE0F\u200B-\u200D\u200E\u200F]/g, '');
}

function collapseRepeatingChars(str: string): string {
  if (!str) return '';
  const points = Array.from(str);
  const result: string[] = [];
  let count = 0;
  let last = '';
  for (const char of points) {
    if (char === last) {
      count++;
      if (count <= 2) result.push(char);
    } else {
      last = char;
      count = 1;
      result.push(char);
    }
  }
  return result.join('');
}

function cleanForMatching(text: string): string {
  if (!text) return '';
  let norm = stripEmojiFormatters(text).toLowerCase();
  norm = collapseRepeatingChars(norm);
  norm = norm.replace(/[?.,!:'"\-_()\[\]{}]/gu, '');
  norm = norm.replace(/[^\p{L}\p{M}\p{N}\p{Emoji}\p{Extended_Pictographic}\p{So}\s]/gu, ' ').replace(/\s+/g, ' ').trim();
  return norm;
}

function containsEmoji(text: string): boolean {
  if (!text) return false;
  return /[\p{Emoji}\p{Extended_Pictographic}\p{So}]/u.test(text);
}

export const BrainManager: React.FC = () => {
  const [memories, setMemories] = useState<Memory[]>([]);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [activePane, setActivePane] = useState<'general' | 'admin' | 'suggestions' | 'inferred_attributes'>('general');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOption, setSortOption] = useState<'newest' | 'usage' | 'trigger' | 'lastUsed'>('newest');
  const [isLoading, setIsLoading] = useState(false);

  // Modal / Form state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isQuickViewOpen, setIsQuickViewOpen] = useState(false);
  const [quickViewSearch, setQuickViewSearch] = useState('');
  const [editingMemory, setEditingMemory] = useState<Memory | null>(null);
  const [formTrigger, setFormTrigger] = useState('');
  const [formReply, setFormReply] = useState('');
  const [formCategory, setFormCategory] = useState<'general' | 'admin'>('general');
  const [formEnabled, setFormEnabled] = useState(true);
  const [aiGenerating, setAiGenerating] = useState(false);

  // Inferred Attributes state
  interface InferredAttribute {
    _id: string;
    threadID: string;
    userID: string;
    userName?: string;
    attributeType: 'relationship' | 'nickname' | 'communication_style';
    value: string;
    confidence: number;
    history: Array<{
      value: string;
      timestamp: string;
      context?: string;
    }>;
    updatedAt: string;
    createdAt: string;
  }

  const [inferredAttributes, setInferredAttributes] = useState<InferredAttribute[]>([]);
  const [isAttrModalOpen, setIsAttrModalOpen] = useState(false);
  const [editingAttr, setEditingAttr] = useState<InferredAttribute | null>(null);
  
  const [attrThreadID, setAttrThreadID] = useState('');
  const [attrUserID, setAttrUserID] = useState('');
  const [attrUserName, setAttrUserName] = useState('');
  const [attrType, setAttrType] = useState<'relationship' | 'nickname' | 'communication_style'>('relationship');
  const [attrValue, setAttrValue] = useState('');
  const [attrConfidence, setAttrConfidence] = useState(1.0);
  const [attrContext, setAttrContext] = useState('');
  const [selectedTimelineAttr, setSelectedTimelineAttr] = useState<InferredAttribute | null>(null);

  // Edit Suggestion state
  const [editingSuggestion, setEditingSuggestion] = useState<Suggestion | null>(null);
  const [isEditSuggestionModalOpen, setIsEditSuggestionModalOpen] = useState(false);
  const [editSuggTrigger, setEditSuggTrigger] = useState('');
  const [editSuggReply, setEditSuggReply] = useState('');
  const [editSuggIsFact, setEditSuggIsFact] = useState(false);
  const [editSuggEntity, setEditSuggEntity] = useState('');
  const [editSuggAttr, setEditSuggAttr] = useState('');
  const [editSuggValue, setEditSuggValue] = useState('');

  // Live Preview tester state
  const [testQuery, setTestQuery] = useState('');
  const [testResult, setTestResult] = useState<{
    matched: boolean;
    trigger?: string;
    reply?: string;
    score?: number;
    category?: string;
  } | null>(null);

  // Load memories and suggestions
  const fetchMemories = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/bot/brain/memories?search=${encodeURIComponent(searchQuery)}&sort=${sortOption}`);
      if (res.ok) {
        const data = await res.json();
        setMemories(data);
      }
    } catch (err) {
      console.error('Failed to load brain memories:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchSuggestions = async () => {
    try {
      const res = await fetch('/api/bot/brain/suggestions');
      if (res.ok) {
        const data = await res.json();
        setSuggestions(data);
      }
    } catch (err) {
      console.error('Failed to load brain suggestions:', err);
    }
  };

  const fetchInferredAttributes = async () => {
    try {
      const res = await fetch('/api/bot/brain/inferred-attributes');
      if (res.ok) {
        const data = await res.json();
        setInferredAttributes(data);
      }
    } catch (err) {
      console.error('Failed to load inferred attributes:', err);
    }
  };

  useEffect(() => {
    fetchMemories();
    fetchSuggestions();
    fetchInferredAttributes();
  }, [searchQuery, sortOption]);

  // Handle live matching tester
  const handleTestMatch = () => {
    if (!testQuery.trim()) {
      setTestResult(null);
      return;
    }

    const rawNormalized = stripEmojiFormatters(testQuery.trim().normalize('NFC').toLowerCase());
    const cleanInput = cleanForMatching(testQuery);
    const rawNoSpace = rawNormalized.replace(/\s+/g, '');
    let bestMatch: Memory | null = null;
    let bestScore = 0;

    for (const mem of memories) {
      if (!mem.enabled) continue;
      const candidates = [
        mem.trigger,
        ...(mem.variations || []),
        ...(mem.aiNormalizedTrigger || [])
      ].map(c => stripEmojiFormatters((c || '').trim().normalize('NFC').toLowerCase())).filter(Boolean);

      for (const candRaw of candidates) {
        let score = 0;
        const candNoSpace = candRaw.replace(/\s+/g, '');
        // 1. Direct exact raw match or space-stripped match for emojis
        if (candRaw === rawNormalized || (candNoSpace && candNoSpace === rawNoSpace)) {
          score = 1.0;
        } else {
          const candClean = cleanForMatching(candRaw);
          if (candClean && cleanInput && candClean === cleanInput) {
            score = 1.0;
          } else if (cleanInput && candClean) {
            if (cleanInput.includes(candClean) || candClean.includes(cleanInput)) {
              const overlap = Math.min(candClean.length, cleanInput.length) / Math.max(candClean.length, cleanInput.length);
              score = Math.max(score, overlap * 0.85);
            }
            // Standalone emoji inclusion boost
            if (containsEmoji(candRaw) && testQuery.includes(candRaw.trim())) {
              score = Math.max(score, 0.90);
            }
          }
        }

        if (score > bestScore) {
          bestScore = score;
          bestMatch = mem;
        }
      }
    }

    if (bestScore >= 0.50 && bestMatch) {
      setTestResult({
        matched: true,
        trigger: bestMatch.trigger,
        reply: bestMatch.reply,
        score: bestScore,
        category: bestMatch.category
      });
    } else {
      setTestResult({ matched: false });
    }
  };

  useEffect(() => {
    const delayDebounce = setTimeout(() => {
      handleTestMatch();
    }, 250);
    return () => clearTimeout(delayDebounce);
  }, [testQuery, memories]);

  // Create or Update memory
  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTrigger.trim() || !formReply.trim()) return;

    setAiGenerating(true);
    try {
      const url = editingMemory
        ? `/api/bot/brain/memories/${editingMemory._id}`
        : '/api/bot/brain/memories';
      const method = editingMemory ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trigger: formTrigger,
          reply: formReply,
          category: formCategory,
          enabled: formEnabled
        })
      });

      if (res.ok) {
        setIsModalOpen(false);
        setEditingMemory(null);
        setFormTrigger('');
        setFormReply('');
        fetchMemories();
      }
    } catch (err) {
      console.error('Failed to submit brain form:', err);
    } finally {
      setAiGenerating(false);
    }
  };

  const handleEditClick = (mem: Memory) => {
    setEditingMemory(mem);
    setFormTrigger(mem.trigger);
    setFormReply(mem.reply);
    setFormCategory(mem.category);
    setFormEnabled(mem.enabled);
    setIsModalOpen(true);
  };

  const handleDeleteClick = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this memory?')) return;
    try {
      const res = await fetch(`/api/bot/brain/memories/${id}`, { method: 'DELETE' });
      if (res.ok) {
        fetchMemories();
      }
    } catch (err) {
      console.error('Failed to delete memory:', err);
    }
  };

  const handleToggleEnabled = async (mem: Memory) => {
    try {
      const res = await fetch(`/api/bot/brain/memories/${mem._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !mem.enabled })
      });
      if (res.ok) {
        setMemories(prev => prev.map(m => m._id === mem._id ? { ...m, enabled: !m.enabled } : m));
      }
    } catch (err) {
      console.error('Failed to toggle enabled:', err);
    }
  };

  // Approve / Reject Suggestions
  const handleApproveSuggestion = async (id: string) => {
    try {
      const res = await fetch(`/api/bot/brain/suggestions/${id}/approve`, { method: 'POST' });
      if (res.ok) {
        fetchSuggestions();
        fetchMemories();
      }
    } catch (err) {
      console.error('Failed to approve suggestion:', err);
    }
  };

  const handleRejectSuggestion = async (id: string) => {
    try {
      const res = await fetch(`/api/bot/brain/suggestions/${id}`, { method: 'DELETE' });
      if (res.ok) {
        fetchSuggestions();
      }
    } catch (err) {
      console.error('Failed to reject suggestion:', err);
    }
  };

  // Suggestion edit handlers
  const handleOpenEditSuggestion = (s: Suggestion) => {
    setEditingSuggestion(s);
    setEditSuggTrigger(s.trigger);
    setEditSuggReply(s.suggestedReply);
    setEditSuggIsFact(s.isFact || false);
    setEditSuggEntity(s.factEntity || '');
    setEditSuggAttr(s.factAttribute || '');
    setEditSuggValue(s.factValue || '');
    setIsEditSuggestionModalOpen(true);
  };

  const handleSaveSuggestionEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSuggestion) return;

    try {
      const res = await fetch(`/api/bot/brain/suggestions/${editingSuggestion._id}/edit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trigger: editSuggTrigger,
          suggestedReply: editSuggReply,
          isFact: editSuggIsFact,
          factEntity: editSuggEntity,
          factAttribute: editSuggAttr,
          factValue: editSuggValue
        })
      });

      if (res.ok) {
        fetchSuggestions();
        setIsEditSuggestionModalOpen(false);
        setEditingSuggestion(null);
      } else {
        const errData = await res.json();
        alert(`Error: ${errData.error || 'Failed to edit suggestion'}`);
      }
    } catch (err) {
      console.error('Failed to save suggestion edit:', err);
    }
  };

  // Inferred attributes handlers
  const handleOpenAddAttr = () => {
    setEditingAttr(null);
    setAttrThreadID('');
    setAttrUserID('');
    setAttrUserName('');
    setAttrType('relationship');
    setAttrValue('');
    setAttrConfidence(1.0);
    setAttrContext('');
    setIsAttrModalOpen(true);
  };

  const handleOpenEditAttr = (attr: InferredAttribute) => {
    setEditingAttr(attr);
    setAttrThreadID(attr.threadID);
    setAttrUserID(attr.userID);
    setAttrUserName(attr.userName || '');
    setAttrType(attr.attributeType);
    setAttrValue(attr.value);
    setAttrConfidence(attr.confidence);
    setAttrContext('');
    setIsAttrModalOpen(true);
  };

  const handleSaveInferredAttribute = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!attrThreadID || !attrUserID || !attrValue) {
      alert('Thread ID, User ID, and Value are required');
      return;
    }

    try {
      const res = await fetch('/api/bot/brain/inferred-attributes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          threadID: attrThreadID,
          userID: attrUserID,
          userName: attrUserName,
          attributeType: attrType,
          value: attrValue,
          confidence: attrConfidence,
          context: attrContext || (editingAttr ? 'Manually updated' : 'Manually inferred')
        })
      });

      if (res.ok) {
        fetchInferredAttributes();
        setIsAttrModalOpen(false);
        setEditingAttr(null);
        // Reset
        setAttrThreadID('');
        setAttrUserID('');
        setAttrUserName('');
        setAttrValue('');
        setAttrConfidence(1.0);
        setAttrContext('');
      } else {
        const errData = await res.json();
        alert(`Error: ${errData.error || 'Failed to save attribute'}`);
      }
    } catch (err) {
      console.error('Error saving inferred attribute:', err);
    }
  };

  const handleDeleteInferredAttribute = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this attribute and its entire evolution timeline?')) return;
    try {
      const res = await fetch(`/api/bot/brain/inferred-attributes/${id}`, { method: 'DELETE' });
      if (res.ok) {
        fetchInferredAttributes();
      }
    } catch (err) {
      console.error('Failed to delete attribute:', err);
    }
  };

  // Export brain memories
  const handleExportBrain = () => {
    window.open('/api/bot/brain/bulk-export', '_blank');
  };

  // Bulk Boilerplate template Scaffolding
  const handleLoadBoilerplate = async (type: string) => {
    let list: any[] = [];
    if (type === 'greetings') {
      list = [
        { trigger: 'hi', reply: 'হাই! কেমন আছেন? শিপু আই বটের সাথে চ্যাট করার জন্য ধন্যবাদ। 😊', category: 'general' },
        { trigger: 'hello', reply: 'হ্যালো! আমি শিপু আই অ্যাসিস্ট্যান্ট। কিভাবে আপনাকে সাহায্য করতে পারি?', category: 'general' },
        { trigger: 'kemon achen', reply: 'আলহামদুলিল্লাহ্‌, আমি খুব ভালো আছি। আপনার দিনটি কেমন কাটছে?', category: 'general' },
        { trigger: 'assalamualaikum', reply: 'ওয়ালাইকুম আসসালাম! আপনার উপর আল্লাহর শান্তি বর্ষিত হোক।', category: 'general' }
      ];
    } else if (type === 'emojis') {
      list = [
        { trigger: '🙂', reply: 'স্মাইল করার জন্য অনেক ধন্যবাদ! আপনার দিনটি অনেক সুন্দর কাটুক। 😊', category: 'general' },
        { trigger: '💔', reply: 'আহারে! মন খারাপ করবেন না, সবকিছু ঠিক হয়ে যাবে ইনশাআল্লাহ। ❤️', category: 'general' },
        { trigger: '😞', reply: 'কী হয়েছে? কোনো সমস্যা থাকলে আমাকে বলতে পারেন, আমি সাহায্য করার চেষ্টা করবো। 💙', category: 'general' },
        { trigger: '🙏', reply: 'আপনাকেও অনেক অনেক শ্রদ্ধা ও ধন্যবাদ! 🙏✨', category: 'general' },
        { trigger: '💋', reply: 'অনেক ভালোবাসা আপনার জন্য! 💖', category: 'general' },
        { trigger: '🫦', reply: 'আরে ভাই! একটু সামলে কথা বলুন। 😉🔥', category: 'general' }
      ];
    } else if (type === 'system') {
      list = [
        { trigger: 'what is your name', reply: 'আমার নাম SHIPU AI Assistant. আমি একটি প্রোডাকশন-রেডি ম্যাসেঞ্জার বট ফ্রেমওয়ার্ক।', category: 'admin' },
        { trigger: 'system specifications', reply: 'ShiPu Bot Core v2.5 | Node.js TS Runtime | MongoDB High Availability Cache Active.', category: 'admin' },
        { trigger: 'who is your creator', reply: 'আমি শিপু এআই ডেভেলপমেন্ট টিম দ্বারা তৈরি হয়েছি। 🛠️', category: 'admin' }
      ];
    }

    if (list.length === 0) return;

    if (!window.confirm(`Load ${list.length} boilerplate memory templates into database?`)) return;

    try {
      const res = await fetch('/api/bot/brain/bulk-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memories: list })
      });
      if (res.ok) {
        fetchMemories();
        alert('Boilerplate scaffold templates loaded successfully.');
      }
    } catch (err) {
      console.error('Failed to import boilerplates:', err);
    }
  };

  const filteredMemories = memories.filter(m => {
    if (activePane === 'suggestions') return false;
    return m.category === activePane;
  });

  return (
    <div className="space-y-6">
      
      {/* Title Header with Action Buttons */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-900/60 p-5 rounded-2xl border border-slate-800 backdrop-blur-sm shadow-xl">
        <div className="flex items-center space-x-3">
          <div className="p-3 bg-indigo-600/20 text-indigo-400 rounded-xl border border-indigo-500/30">
            <Brain className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-100 flex items-center gap-2">
              Brain Manager
              <span className="text-[10px] bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 px-2 py-0.5 rounded-full font-mono font-medium tracking-wide">
                ACTIVE COGNITION
              </span>
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">Manage permanent editable knowledge base, custom intents, and auto-reply caches live.</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Boilerplate dropdown template */}
          <div className="relative group">
            <button className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-semibold rounded-xl border border-slate-700 transition flex items-center gap-1.5 shadow-sm">
              <Sliders className="w-3.5 h-3.5 text-indigo-400" />
              <span>Scaffold Boilerplate</span>
            </button>
            <div className="absolute right-0 top-full mt-1.5 w-48 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl p-1.5 hidden group-hover:block z-50 animate-in fade-in slide-in-from-top-1 duration-150">
              <button
                onClick={() => handleLoadBoilerplate('greetings')}
                className="w-full text-left px-3 py-2 text-xs text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition"
              >
                🇧🇩 Bangla & English Greetings
              </button>
              <button
                onClick={() => handleLoadBoilerplate('emojis')}
                className="w-full text-left px-3 py-2 text-xs text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition"
              >
                😀 Unicode Emoji Triggers
              </button>
              <button
                onClick={() => handleLoadBoilerplate('system')}
                className="w-full text-left px-3 py-2 text-xs text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition"
              >
                🔒 System & Admin Prompts
              </button>
            </div>
          </div>

          <button
            onClick={handleExportBrain}
            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-semibold rounded-xl border border-slate-700 transition flex items-center gap-1.5 shadow-sm"
            title="Download full backup database"
          >
            <Download className="w-3.5 h-3.5 text-emerald-400" />
            <span>Export Backup</span>
          </button>

          <button
            onClick={() => setIsQuickViewOpen(true)}
            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-semibold rounded-xl border border-slate-700 transition flex items-center gap-1.5 shadow-sm"
            title="Quick View indexed entities & intents"
          >
            <Eye className="w-3.5 h-3.5 text-cyan-400" />
            <span>Quick View</span>
          </button>

          <button
            onClick={() => {
              setEditingMemory(null);
              setFormTrigger('');
              setFormReply('');
              setFormCategory(activePane === 'suggestions' ? 'general' : activePane);
              setFormEnabled(true);
              setIsModalOpen(true);
            }}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl transition flex items-center gap-1.5 shadow-lg shadow-indigo-600/10 hover:shadow-indigo-600/20 transform active:scale-95 duration-150"
          >
            <Plus className="w-4 h-4" />
            <span>Teach New Memory</span>
          </button>
        </div>
      </div>

      {/* Grid Layout: Main Cognition Hub & Interactive Simulator */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Side: Real-time Live Cognition Matcher Tester */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-slate-900/60 p-5 rounded-2xl border border-slate-800 backdrop-blur-sm shadow-xl flex flex-col h-full justify-between">
            <div>
              <div className="flex items-center space-x-2 pb-3 mb-4 border-b border-slate-800">
                <Activity className="w-4.5 h-4.5 text-indigo-400" />
                <h3 className="font-bold text-sm text-slate-200">Live Cognitive Matcher</h3>
              </div>
              <p className="text-[11px] text-slate-400 mb-4 leading-relaxed">
                Test matching logic instantly without saving. Type raw text containing spelling errors, Bangla, accents, or Banglish words to verify cognitive routing.
              </p>

              <div className="space-y-3">
                <div className="relative">
                  <input
                    type="text"
                    value={testQuery}
                    onChange={(e) => setTestQuery(e.target.value)}
                    placeholder="Type raw chat sentence (e.g. hlo tmi kmn aso?)"
                    className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl px-3.5 py-2.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none transition duration-150 font-mono"
                  />
                  {testQuery && (
                    <button
                      onClick={() => setTestQuery('')}
                      className="absolute right-3 top-3 p-0.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-slate-200 transition"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>

                {/* Match Result UI */}
                {testQuery ? (
                  testResult ? (
                    testResult.matched ? (
                      <div className="p-4 bg-emerald-950/20 border border-emerald-500/20 rounded-xl space-y-2 animate-in fade-in duration-200">
                        <div className="flex justify-between items-center">
                          <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
                            Match Confirmed
                          </span>
                          <span className="font-mono text-[10px] text-emerald-300 font-semibold bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">
                            Confidence: {(testResult.score! * 100).toFixed(0)}%
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-300">
                          <p className="font-semibold text-slate-200">🎯 Trigger Target:</p>
                          <p className="font-mono bg-slate-950 px-2 py-1.5 rounded-lg border border-slate-800/60 mt-1">{testResult.trigger}</p>
                        </div>
                        <div className="text-[11px] text-slate-300 mt-2">
                          <p className="font-semibold text-slate-200">💬 Response Output:</p>
                          <p className="bg-slate-950/40 px-2.5 py-2 rounded-lg border border-slate-800/40 mt-1 italic text-slate-300 leading-relaxed">
                            {testResult.reply}
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="p-4 bg-rose-950/10 border border-rose-500/15 rounded-xl text-center space-y-1.5 animate-in fade-in duration-200">
                        <AlertCircle className="w-5 h-5 text-rose-400 mx-auto" />
                        <p className="text-[11px] font-bold text-rose-300">No Confident Match Detected</p>
                        <p className="text-[10px] text-slate-400 leading-relaxed">This query will trigger fallback handlers and be added to the suggestions model logs.</p>
                      </div>
                    )
                  ) : (
                    <div className="flex items-center justify-center p-6 text-slate-500 text-xs">
                      <RefreshCw className="w-4 h-4 animate-spin text-indigo-400 mr-2" />
                      Analyzing linguistic vectors...
                    </div>
                  )
                ) : (
                  <div className="p-4 bg-slate-950/40 border border-slate-800/80 rounded-xl text-center text-slate-500 text-[11px] py-8 border-dashed">
                    Linguistic testing sandbox ready. Type any chat text above.
                  </div>
                )}
              </div>
            </div>

            <div className="mt-5 pt-4 border-t border-slate-800/60 text-[10px] text-slate-500 space-y-1.5 leading-relaxed font-mono">
              <div className="flex items-center justify-between">
                <span>Normalization:</span>
                <span className="text-indigo-400 font-semibold">Enabled (Unicode NFC)</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Intelligent Vector:</span>
                <span className="text-indigo-400 font-semibold">Levenshtein + Token Similarity</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Minimum Match:</span>
                <span className="text-slate-400 font-semibold">70.0% confidence score</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side: Brain Databases (General / Admin / Suggestions) */}
        <div className="lg:col-span-8 space-y-6">
          
          {/* Tabs Navigator & Filters */}
          <div className="bg-slate-900/60 p-4 rounded-2xl border border-slate-800 backdrop-blur-sm shadow-xl flex flex-col md:flex-row justify-between items-center gap-4">
            
            {/* Split Tab Panels selector */}
            <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800 w-full md:w-auto">
              <button
                onClick={() => setActivePane('general')}
                className={`flex-1 md:flex-none px-4 py-2 text-xs font-bold rounded-lg transition flex items-center justify-center gap-1.5 ${
                  activePane === 'general'
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/15'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <User className="w-3.5 h-3.5" />
                <span>General Brain</span>
                <span className="bg-slate-900/60 border border-slate-800 text-[10px] px-1.5 py-0.5 rounded-full font-mono">
                  {memories.filter(m => m.category === 'general').length}
                </span>
              </button>

              <button
                onClick={() => setActivePane('admin')}
                className={`flex-1 md:flex-none px-4 py-2 text-xs font-bold rounded-lg transition flex items-center justify-center gap-1.5 ${
                  activePane === 'admin'
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/15'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Shield className="w-3.5 h-3.5" />
                <span>Admin Brain</span>
                <span className="bg-slate-900/60 border border-slate-800 text-[10px] px-1.5 py-0.5 rounded-full font-mono">
                  {memories.filter(m => m.category === 'admin').length}
                </span>
              </button>

              <button
                onClick={() => setActivePane('suggestions')}
                className={`flex-1 md:flex-none px-4 py-2 text-xs font-bold rounded-lg transition flex items-center justify-center gap-1.5 ${
                  activePane === 'suggestions'
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/15'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Pending Learnings</span>
                {suggestions.length > 0 && (
                  <span className="bg-rose-500 text-white text-[10px] px-1.5 py-0.5 rounded-full font-mono animate-pulse">
                    {suggestions.length}
                  </span>
                )}
              </button>

              <button
                onClick={() => setActivePane('inferred_attributes')}
                className={`flex-1 md:flex-none px-4 py-2 text-xs font-bold rounded-lg transition flex items-center justify-center gap-1.5 ${
                  activePane === 'inferred_attributes'
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/15'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Sliders className="w-3.5 h-3.5" />
                <span>Inferred Attributes</span>
                {inferredAttributes.length > 0 && (
                  <span className="bg-cyan-500 text-white text-[10px] px-1.5 py-0.5 rounded-full font-mono">
                    {inferredAttributes.length}
                  </span>
                )}
              </button>
            </div>

            {/* Quick search & sort selectors */}
            <div className="flex flex-col sm:flex-row items-center gap-2.5 w-full md:w-auto">
              {activePane !== 'suggestions' && activePane !== 'inferred_attributes' && (
                <>
                  <div className="relative w-full sm:w-48">
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search memory..."
                      className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl pl-9 pr-4 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none transition duration-150"
                    />
                    <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
                  </div>

                  <select
                    value={sortOption}
                    onChange={(e: any) => setSortOption(e.target.value)}
                    className="w-full sm:w-auto bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-indigo-500 transition"
                  >
                    <option value="newest">Sort: Newest</option>
                    <option value="usage">Sort: Popularity</option>
                    <option value="trigger">Sort: Trigger (A-Z)</option>
                    <option value="lastUsed">Sort: Recently Used</option>
                  </select>
                </>
              )}
            </div>
          </div>

          {/* Table / List Panel of active memories */}
          <div className="bg-slate-900/60 rounded-2xl border border-slate-800 backdrop-blur-sm shadow-xl overflow-hidden min-h-[300px]">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center p-16 text-slate-400 space-y-3">
                <RefreshCw className="w-8 h-8 text-indigo-500 animate-spin" />
                <p className="text-xs font-mono">Loading cognition indexes...</p>
              </div>
            ) : activePane === 'suggestions' ? (
              suggestions.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-16 text-center text-slate-500 py-24 space-y-3.5">
                  <ThumbsUp className="w-12 h-12 text-slate-700" />
                  <div>
                    <h4 className="font-bold text-sm text-slate-400">Linguistic Knowledge Complete</h4>
                    <p className="text-xs text-slate-500 mt-1">Awesome! No missing knowledge suggestions have been registered yet.</p>
                  </div>
                </div>
              ) : (
                <div className="divide-y divide-slate-800">
                  <div className="px-5 py-3.5 bg-slate-950/60 flex items-center justify-between border-b border-slate-800">
                    <span className="text-xs font-bold text-slate-300">Missing Trigger Query</span>
                    <span className="text-xs font-bold text-slate-300">AI Suggested Response & Approve Actions</span>
                  </div>
                  {suggestions.map((s) => (
                    <div key={s._id} className="p-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 hover:bg-slate-800/20 transition duration-150">
                      <div className="space-y-1.5 flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-xs font-bold text-slate-100 bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-800">
                            {s.trigger}
                          </span>
                          <span className="text-[10px] bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 px-2 py-0.5 rounded-md font-semibold">
                            Asked: {s.count} times
                          </span>
                          {s.isFact && (
                            <span className="text-[10px] bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 px-2 py-0.5 rounded-md font-semibold flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
                              Learned Fact
                            </span>
                          )}
                        </div>

                        {s.isFact && s.factEntity && (
                          <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-slate-400 font-mono">
                            <span className="text-slate-500">Subject:</span>
                            <span className="bg-slate-950 px-1.5 py-0.5 rounded border border-slate-800 text-indigo-300">{s.factEntity}</span>
                            <span className="text-slate-500">Property:</span>
                            <span className="bg-slate-950 px-1.5 py-0.5 rounded border border-slate-800 text-indigo-300">{s.factAttribute}</span>
                            <span className="text-slate-500">Value:</span>
                            <span className="bg-slate-950 px-1.5 py-0.5 rounded border border-slate-800 text-emerald-300">{s.factValue}</span>
                          </div>
                        )}

                        <div className="text-[11px] text-slate-400 flex items-center gap-1">
                          <Sparkles className="w-3 h-3 text-indigo-400" />
                          <span>AI Suggestion confidence score: {(s.confidence * 100).toFixed(0)}%</span>
                        </div>
                        
                        <p className="text-xs text-slate-300 italic bg-slate-950/40 p-2 rounded-lg border border-slate-800/40 font-serif leading-relaxed">
                          "{s.suggestedReply}"
                        </p>

                        {s.conflictStatus === 'warning' && (
                          <div className="p-2.5 bg-rose-500/10 border border-rose-500/30 text-[11px] text-rose-300 rounded-lg flex items-start gap-2 animate-pulse mt-1.5">
                            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                            <div>
                              <span className="font-bold text-rose-400">Careful! Fact Replacement Conflict:</span> {s.conflictDetails}
                            </div>
                          </div>
                        )}

                        {s.learningContext && (
                          <p className="text-[10px] text-slate-500 font-mono italic">
                            💡 Context: {s.learningContext}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => handleOpenEditSuggestion(s)}
                          className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-lg border border-slate-700 transition"
                          title="Edit suggestion before approving"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleRejectSuggestion(s._id)}
                          className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 hover:text-rose-400 text-xs font-semibold rounded-lg border border-slate-700 transition"
                          title="Discard suggestion"
                        >
                          Discard
                        </button>
                        <button
                          onClick={() => handleApproveSuggestion(s._id)}
                          className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-lg transition flex items-center gap-1 shadow-md shadow-indigo-600/10"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Approve & Learn</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )
            ) : activePane === 'inferred_attributes' ? (
              inferredAttributes.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-16 text-center text-slate-500 py-24 space-y-3.5">
                  <Sliders className="w-12 h-12 text-slate-700" />
                  <div>
                    <h4 className="font-bold text-sm text-slate-400">No Inferred User Traits Found</h4>
                    <p className="text-xs text-slate-500 mt-1">
                      Start chatting with users! The AI automatically infers relationships, nicknames, and communication styles in the background, or add them manually.
                    </p>
                    <button
                      onClick={handleOpenAddAttr}
                      className="mt-4 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl transition duration-150 inline-flex items-center gap-1.5 shadow-md shadow-indigo-600/15"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Manually Add Trait</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="divide-y divide-slate-800">
                  <div className="px-5 py-3.5 bg-slate-950/60 flex items-center justify-between border-b border-slate-800">
                    <span className="text-xs font-bold text-slate-300 uppercase tracking-wider font-mono">Inferred User Traits & Communication Styles</span>
                    <button
                      onClick={handleOpenAddAttr}
                      className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-lg transition flex items-center gap-1 shadow-md shadow-indigo-600/10"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add Custom Trait</span>
                    </button>
                  </div>
                  {inferredAttributes.map((attr) => (
                    <div key={attr._id} className="p-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 hover:bg-slate-800/10 transition duration-150">
                      <div className="space-y-2 flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`text-[10px] uppercase px-2.5 py-1 rounded-full font-bold font-mono border ${
                            attr.attributeType === 'relationship'
                              ? 'bg-rose-500/10 text-rose-300 border-rose-500/20'
                              : attr.attributeType === 'nickname'
                              ? 'bg-amber-500/10 text-amber-300 border-amber-500/20'
                              : 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20'
                          }`}>
                            {attr.attributeType.replace('_', ' ')}
                          </span>
                          <span className="text-xs font-mono text-slate-400 bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                            Thread: {attr.threadID}
                          </span>
                          <span className="text-xs font-mono text-slate-400 bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                            User ID: {attr.userID} {attr.userName ? `(${attr.userName})` : ''}
                          </span>
                        </div>

                        <div className="text-sm font-semibold text-slate-100 flex items-center gap-1.5">
                          <span>Current Value:</span>
                          <span className="text-indigo-400 bg-indigo-950/40 px-2.5 py-1 rounded-lg border border-indigo-900/40">
                            {attr.value}
                          </span>
                        </div>

                        <div className="flex items-center gap-4 text-xs text-slate-400">
                          <div className="flex items-center gap-2">
                            <span>Confidence:</span>
                            <div className="w-20 bg-slate-800 h-2 rounded-full overflow-hidden">
                              <div
                                className="bg-indigo-500 h-full rounded-full"
                                style={{ width: `${Math.min(100, attr.confidence * 100)}%` }}
                              />
                            </div>
                            <span className="font-mono text-[10px]">{(attr.confidence * 100).toFixed(0)}%</span>
                          </div>
                          <span>Last Sync: {new Date(attr.updatedAt || attr.createdAt || new Date()).toLocaleString()}</span>
                        </div>

                        {attr.history && attr.history.length > 0 && (
                          <button
                            onClick={() => setSelectedTimelineAttr(attr)}
                            className="text-[11px] text-indigo-400 hover:text-indigo-300 flex items-center gap-1 font-mono mt-1 hover:underline"
                          >
                            <History className="w-3 h-3 text-indigo-400" />
                            <span>View Evolution Timeline ({attr.history.length} updates)</span>
                          </button>
                        )}
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => handleOpenEditAttr(attr)}
                          className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-lg border border-slate-700 transition"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDeleteInferredAttribute(attr._id)}
                          className="px-3 py-1.5 bg-slate-800 hover:bg-rose-950/40 text-slate-400 hover:text-rose-300 text-xs font-semibold rounded-lg border border-slate-700 transition"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )
            ) : filteredMemories.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-16 text-center text-slate-500 py-24 space-y-3.5">
                <Brain className="w-12 h-12 text-slate-700" />
                <div>
                  <h4 className="font-bold text-sm text-slate-400">Empty Cognition Database</h4>
                  <p className="text-xs text-slate-500 mt-1">Use the "Teach New Memory" button above or load boilerplate templates.</p>
                </div>
              </div>
            ) : (
              <div className="divide-y divide-slate-800">
                
                {/* Header row */}
                <div className="hidden sm:flex px-5 py-3.5 bg-slate-950/60 items-center justify-between border-b border-slate-800 font-mono text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  <div className="w-1/3">Linguistic Trigger & Variations</div>
                  <div className="w-1/3">Auto-Reply Content</div>
                  <div className="w-1/12 text-center">Popularity</div>
                  <div className="w-1/4 text-right">Actions</div>
                </div>

                {filteredMemories.map((mem) => (
                  <div key={mem._id} className="p-5 sm:px-5 sm:py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-800/10 transition duration-150">
                    
                    {/* Trigger info */}
                    <div className="w-full sm:w-1/3 min-w-0 space-y-1">
                      <div className="flex items-center space-x-1.5 flex-wrap gap-y-1">
                        <span className="font-mono text-xs font-bold text-slate-100 bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-800 inline-block truncate max-w-full shadow-inner">
                          {mem.trigger}
                        </span>
                        {containsEmoji(mem.trigger) && (
                          <span className="text-[9px] bg-amber-500/10 text-amber-300 border border-amber-500/20 px-1.5 py-0.5 rounded font-bold flex items-center gap-0.5 shrink-0">
                            <span>😀 Emoji Trigger</span>
                          </span>
                        )}
                        {mem.aiNormalizedTrigger && mem.aiNormalizedTrigger.length > 0 && (
                          <span className="text-[9px] bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 px-1.5 py-0.5 rounded font-bold flex items-center gap-0.5 shrink-0 animate-pulse">
                            <Sparkles className="w-2.5 h-2.5" />
                            <span>AI enriched</span>
                          </span>
                        )}
                      </div>

                      {/* Expanded variations preview */}
                      {mem.variations && mem.variations.length > 0 && (
                        <div className="text-[10px] text-slate-400 font-mono flex flex-wrap items-center gap-1 pt-1.5">
                          <span className="text-slate-500">Variants:</span>
                          {mem.variations.slice(0, 3).map((v, i) => (
                            <span key={i} className="bg-slate-950/40 border border-slate-800/80 text-[10px] text-slate-300 px-1.5 py-0.5 rounded">
                              {v}
                            </span>
                          ))}
                          {mem.variations.length > 3 && (
                            <span className="text-[9px] text-indigo-400 font-semibold bg-indigo-950/20 px-1 rounded-sm">
                              +{mem.variations.length - 3} more
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Auto reply preview */}
                    <div className="w-full sm:w-1/3 text-xs text-slate-300 italic font-serif leading-relaxed line-clamp-2 pr-4">
                      "{mem.reply}"
                    </div>

                    {/* Usage count */}
                    <div className="w-full sm:w-1/12 flex sm:flex-col sm:items-center justify-between sm:justify-center text-xs font-mono text-slate-400">
                      <span className="sm:hidden text-slate-500">Popularity Usage:</span>
                      <span className="font-bold text-slate-200 bg-slate-950/40 border border-slate-800 px-2 py-0.5 rounded-lg">
                        {mem.usageCount || 0}
                      </span>
                    </div>

                    {/* Action buttons */}
                    <div className="w-full sm:w-1/4 flex items-center justify-between sm:justify-end gap-3.5">
                      <div className="flex items-center space-x-2">
                        {/* Enabled switch toggler */}
                        <button
                          onClick={() => handleToggleEnabled(mem)}
                          className={`w-9 h-5 rounded-full p-0.5 transition duration-200 focus:outline-none ${
                            mem.enabled ? 'bg-indigo-600' : 'bg-slate-800'
                          }`}
                        >
                          <div
                            className={`bg-white w-4 h-4 rounded-full shadow-md transform transition duration-200 ${
                              mem.enabled ? 'translate-x-4' : 'translate-x-0'
                            }`}
                          />
                        </button>
                        <span className="text-[11px] font-semibold text-slate-400">
                          {mem.enabled ? 'Enabled' : 'Disabled'}
                        </span>
                      </div>

                      <div className="flex items-center space-x-1.5">
                        <button
                          onClick={() => handleEditClick(mem)}
                          className="p-2 hover:bg-slate-800 text-slate-400 hover:text-white rounded-lg transition border border-transparent hover:border-slate-700"
                          title="Edit Memory"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteClick(mem._id)}
                          className="p-2 hover:bg-rose-950/40 text-slate-400 hover:text-rose-400 rounded-lg transition border border-transparent hover:border-rose-500/20"
                          title="Delete Memory"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                  </div>
                ))}

              </div>
            )}
          </div>

        </div>

      </div>

      {/* Teaching Modal (Modal Drawer Overlay) */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 max-w-lg w-full rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150">
            
            <div className="px-6 py-4 border-b border-slate-800 flex justify-between items-center bg-slate-950/40">
              <div className="flex items-center space-x-2">
                <Brain className="w-4.5 h-4.5 text-indigo-400" />
                <h3 className="font-bold text-sm text-slate-100">
                  {editingMemory ? 'Edit Memory Definition' : 'Teach New Knowledge Memory'}
                </h3>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-200 rounded-lg"
              >
                <X className="w-4.5 h-4.5" />
              </button>
            </div>

            <form onSubmit={handleSubmitForm} className="p-6 space-y-4">
              
              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-bold text-slate-300 uppercase tracking-wider font-mono">
                    Linguistic Trigger Word / Expression
                  </label>
                  <span className="text-[10px] text-amber-400 font-medium">Supports Unicode Emojis (🙂💔😞🙏💋🫦)</span>
                </div>
                <input
                  type="text"
                  required
                  value={formTrigger}
                  onChange={(e) => setFormTrigger(e.target.value)}
                  placeholder="e.g. kemon aso, hi, 🙂, 💔, 😞, 🙏, 💋, 🫦"
                  className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl px-3.5 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none transition duration-150 font-mono"
                />
                
                {/* Emoji Quick Selector Chips */}
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  <span className="text-[10px] text-slate-500 font-mono font-medium">Quick Emojis:</span>
                  {['🙂', '💔', '😞', '🙏', '💋', '🫦', '❤️', '😊', '👍', '🔥', '😍', '🥰', '🎉', '✨', '🥳', '😴'].map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => setFormTrigger(prev => (prev ? `${prev} ${emoji}`.trim() : emoji))}
                      className="px-2 py-0.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-indigo-500/50 rounded-md text-xs transition active:scale-95 text-slate-200"
                      title={`Insert ${emoji} into trigger`}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>

                <p className="text-[10px] text-slate-400 leading-relaxed pt-0.5">
                  The primary text or emoji that triggers this memory. Normal emojis (🙂💔😞🙏💋🫦) are preserved and matched cleanly.
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300 uppercase tracking-wider font-mono">
                  Linguistic Auto-Reply Output Response
                </label>
                <textarea
                  required
                  rows={4}
                  value={formReply}
                  onChange={(e) => setFormReply(e.target.value)}
                  placeholder="Type the exact message the bot should reply with..."
                  className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none transition duration-150 leading-relaxed"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-300 uppercase tracking-wider font-mono">
                    Category Partition
                  </label>
                  <select
                    value={formCategory}
                    onChange={(e: any) => setFormCategory(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none transition"
                  >
                    <option value="general">General Brain (Everyone)</option>
                    <option value="admin">Admin Brain (Internal Private)</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-300 uppercase tracking-wider font-mono">
                    Default Status State
                  </label>
                  <select
                    value={formEnabled ? 'true' : 'false'}
                    onChange={(e) => setFormEnabled(e.target.value === 'true')}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none transition"
                  >
                    <option value="true">Active Enabled</option>
                    <option value="false">Inactive Disabled</option>
                  </select>
                </div>
              </div>

              <div className="p-4 bg-indigo-950/10 border border-indigo-500/20 rounded-xl flex items-start space-x-3 mt-4">
                <Sparkles className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5 animate-pulse" />
                <div className="text-[11px] text-slate-300 leading-relaxed">
                  <span className="font-bold text-white block">AI Normalization Vector Active</span>
                  ShiPu AI Gemini engine will generate, correct, translate, and expand variations in both Bengali, Banglish, and English for high fidelity fuzzy-matching.
                </div>
              </div>

              <div className="pt-4 border-t border-slate-800 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-bold rounded-lg border border-slate-700 transition"
                  disabled={aiGenerating}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-700/50 text-white text-xs font-bold rounded-lg transition flex items-center gap-1 shadow-md shadow-indigo-600/10"
                  disabled={aiGenerating}
                >
                  {aiGenerating ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>AI Re-indexing...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Save Memory</span>
                    </>
                  )}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* Quick View Modal */}
      {isQuickViewOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-800 flex justify-between items-center bg-slate-950/60">
              <div className="flex items-center space-x-3">
                <div className="p-2.5 bg-cyan-600/20 text-cyan-400 rounded-xl border border-cyan-500/30">
                  <Eye className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-100 flex items-center gap-2">
                    ShiPu Brain - Quick View Index Debugger
                    <span className="text-[10px] bg-cyan-600/20 text-cyan-300 border border-cyan-500/30 px-2 py-0.5 rounded-full font-mono font-medium">
                      {memories.length} Indexed Entities
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">Inspect all indexed triggers, variants, intents, and associated responses instantly.</p>
                </div>
              </div>
              <button
                onClick={() => setIsQuickViewOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-200 bg-slate-800/80 hover:bg-slate-800 rounded-xl transition"
              >
                <X className="w-4.5 h-4.5" />
              </button>
            </div>

            <div className="p-4 border-b border-slate-800 bg-slate-950/30 flex items-center gap-3">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={quickViewSearch}
                  onChange={(e) => setQuickViewSearch(e.target.value)}
                  placeholder="Filter indexed entities, triggers, or intents..."
                  className="w-full bg-slate-950 border border-slate-800 focus:border-cyan-500 rounded-xl pl-10 pr-4 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none transition font-mono"
                />
              </div>
              <div className="text-xs text-slate-400 font-mono px-3 py-2 bg-slate-800/50 rounded-xl border border-slate-800">
                Showing {memories.filter(m => {
                  if (!quickViewSearch) return true;
                  const q = quickViewSearch.toLowerCase();
                  return m.trigger.toLowerCase().includes(q) || m.reply.toLowerCase().includes(q) || (m.variations || []).some(v => v.toLowerCase().includes(q)) || (m.aiNormalizedTrigger || []).some(v => v.toLowerCase().includes(q));
                }).length} entries
              </div>
            </div>

            <div className="p-6 overflow-y-auto space-y-3 flex-1 custom-scrollbar">
              {memories
                .filter(m => {
                  if (!quickViewSearch) return true;
                  const q = quickViewSearch.toLowerCase();
                  return m.trigger.toLowerCase().includes(q) || m.reply.toLowerCase().includes(q) || (m.variations || []).some(v => v.toLowerCase().includes(q)) || (m.aiNormalizedTrigger || []).some(v => v.toLowerCase().includes(q));
                })
                .map((mem) => (
                  <div key={mem._id} className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-4 hover:border-slate-700 transition space-y-2.5 shadow-sm">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-800/60">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-bold text-cyan-400 font-mono bg-cyan-950/40 px-2.5 py-1 rounded-lg border border-cyan-800/40">
                          🎯 Trigger: "{mem.trigger}"
                        </span>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-semibold ${mem.category === 'admin' ? 'bg-amber-950/40 text-amber-300 border border-amber-800/40' : 'bg-indigo-950/40 text-indigo-300 border border-indigo-800/40'}`}>
                          {mem.category.toUpperCase()}
                        </span>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-semibold ${mem.enabled ? 'bg-emerald-950/40 text-emerald-300 border border-emerald-800/40' : 'bg-rose-950/40 text-rose-300 border border-rose-800/40'}`}>
                          {mem.enabled ? 'ACTIVE' : 'DISABLED'}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400 font-mono flex items-center gap-3">
                        <span>⚡ Usage: <strong className="text-slate-200">{mem.usageCount || 0}</strong></span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase font-mono tracking-wider block mb-1">
                          Indexed Variants & AI Normalizations:
                        </span>
                        <div className="flex flex-wrap gap-1.5 max-h-20 overflow-y-auto">
                          {(mem.aiNormalizedTrigger || mem.variations || []).length > 0 ? (
                            (mem.aiNormalizedTrigger || mem.variations || []).map((v, i) => (
                              <span key={i} className="text-[11px] bg-slate-900 text-slate-300 px-2 py-0.5 rounded-md border border-slate-800 font-mono">
                                {v}
                              </span>
                            ))
                          ) : (
                            <span className="text-[11px] text-slate-400 italic">None</span>
                          )}
                        </div>
                      </div>

                      <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase font-mono tracking-wider block mb-1">
                          Intent Auto-Reply Output:
                        </span>
                        <p className="text-xs text-slate-200 bg-slate-900/80 p-2.5 rounded-lg border border-slate-800/80 leading-relaxed font-sans line-clamp-3">
                          {mem.reply}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              {memories.length === 0 && (
                <div className="text-center py-12 text-slate-400 text-xs font-mono">
                  No indexed memories found in database.
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-slate-800 bg-slate-950/60 flex justify-between items-center">
              <span className="text-xs text-slate-400 font-mono">
                ShiPu AI Knowledge Engine v2.5
              </span>
              <button
                onClick={() => setIsQuickViewOpen(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl border border-slate-700 transition"
              >
                Close Debugger
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Suggestion Modal */}
      {isEditSuggestionModalOpen && editingSuggestion && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 max-w-lg w-full rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="px-6 py-4 border-b border-slate-800 flex justify-between items-center bg-slate-950/40">
              <div className="flex items-center space-x-2">
                <Sparkles className="w-4.5 h-4.5 text-indigo-400" />
                <h3 className="font-bold text-sm text-slate-100">Edit Potential Learning Snippet</h3>
              </div>
              <button
                onClick={() => {
                  setIsEditSuggestionModalOpen(false);
                  setEditingSuggestion(null);
                }}
                className="p-1 text-slate-400 hover:text-slate-200 rounded-lg"
              >
                <X className="w-4.5 h-4.5" />
              </button>
            </div>

            <form onSubmit={handleSaveSuggestionEdit} className="p-6 space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300 uppercase tracking-wider font-mono">Linguistic Trigger Word / Expression</label>
                <input
                  type="text"
                  required
                  value={editSuggTrigger}
                  onChange={(e) => setEditSuggTrigger(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-100 focus:outline-none focus:border-indigo-500 font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300 uppercase tracking-wider font-mono">Suggested Response Reply</label>
                <textarea
                  required
                  rows={4}
                  value={editSuggReply}
                  onChange={(e) => setEditSuggReply(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-100 focus:outline-none focus:border-indigo-500 leading-relaxed"
                />
              </div>

              <div className="flex items-center space-x-2 py-2">
                <input
                  type="checkbox"
                  id="editSuggIsFact"
                  checked={editSuggIsFact}
                  onChange={(e) => setEditSuggIsFact(e.target.checked)}
                  className="rounded border-slate-800 text-indigo-600 focus:ring-indigo-500 bg-slate-950"
                />
                <label htmlFor="editSuggIsFact" className="text-xs font-bold text-slate-300 uppercase font-mono tracking-wider cursor-pointer">This snippet is a Learned Personal Fact</label>
              </div>

              {editSuggIsFact && (
                <div className="grid grid-cols-3 gap-3 p-3 bg-slate-950/40 rounded-xl border border-slate-800/80">
                  <div className="space-y-1.5 col-span-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase font-mono">Entity (Subject)</label>
                    <input
                      type="text"
                      value={editSuggEntity}
                      onChange={(e) => setEditSuggEntity(e.target.value)}
                      placeholder="e.g. Alvi"
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-100 focus:outline-none"
                    />
                  </div>
                  <div className="space-y-1.5 col-span-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase font-mono">Property (Attr)</label>
                    <input
                      type="text"
                      value={editSuggAttr}
                      onChange={(e) => setEditSuggAttr(e.target.value)}
                      placeholder="e.g. nickname"
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-100 focus:outline-none"
                    />
                  </div>
                  <div className="space-y-1.5 col-span-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase font-mono">Value (Fact)</label>
                    <input
                      type="text"
                      value={editSuggValue}
                      onChange={(e) => setEditSuggValue(e.target.value)}
                      placeholder="e.g. Shiplu"
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-100 focus:outline-none"
                    />
                  </div>
                </div>
              )}

              <div className="pt-4 border-t border-slate-800 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setIsEditSuggestionModalOpen(false);
                    setEditingSuggestion(null);
                  }}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-bold rounded-lg border border-slate-700 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-lg transition"
                >
                  Save Modifications
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Inferred Attribute Add/Edit Modal */}
      {isAttrModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 max-w-lg w-full rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="px-6 py-4 border-b border-slate-800 flex justify-between items-center bg-slate-950/40">
              <div className="flex items-center space-x-2">
                <Sliders className="w-4.5 h-4.5 text-indigo-400" />
                <h3 className="font-bold text-sm text-slate-100">
                  {editingAttr ? 'Edit Inferred User Trait' : 'Record New Inferred User Trait'}
                </h3>
              </div>
              <button
                onClick={() => {
                  setIsAttrModalOpen(false);
                  setEditingAttr(null);
                }}
                className="p-1 text-slate-400 hover:text-slate-200 rounded-lg"
              >
                <X className="w-4.5 h-4.5" />
              </button>
            </div>

            <form onSubmit={handleSaveInferredAttribute} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-300 uppercase tracking-wider font-mono">Thread ID</label>
                  <input
                    type="text"
                    required
                    value={attrThreadID}
                    onChange={(e) => setAttrThreadID(e.target.value)}
                    placeholder="e.g. 1785520988730"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 font-mono"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-300 uppercase tracking-wider font-mono">User ID</label>
                  <input
                    type="text"
                    required
                    value={attrUserID}
                    onChange={(e) => setAttrUserID(e.target.value)}
                    placeholder="e.g. 100002873491822"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-300 uppercase tracking-wider font-mono">User Name</label>
                  <input
                    type="text"
                    value={attrUserName}
                    onChange={(e) => setAttrUserName(e.target.value)}
                    placeholder="e.g. Shiplu Ahmed"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-300 uppercase tracking-wider font-mono">Trait Category</label>
                  <select
                    value={attrType}
                    onChange={(e: any) => setAttrType(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none transition"
                  >
                    <option value="relationship">Personal Relationships</option>
                    <option value="nickname">Nicknames</option>
                    <option value="communication_style">Communication Style</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300 uppercase tracking-wider font-mono">Value / Trait Description</label>
                <input
                  type="text"
                  required
                  value={attrValue}
                  onChange={(e) => setAttrValue(e.target.value)}
                  placeholder="e.g. GF of Alvi, Speaks in rich Banglish with lots of emoji"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-300 uppercase tracking-wider font-mono">Confidence Level</label>
                  <select
                    value={attrConfidence.toString()}
                    onChange={(e) => setAttrConfidence(parseFloat(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none transition"
                  >
                    <option value="1">100% High Certainty</option>
                    <option value="0.85">85% Highly Probable</option>
                    <option value="0.7">70% Moderate Prediction</option>
                    <option value="0.5">50% Speculative / Low</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-300 uppercase tracking-wider font-mono">Reasoning / context</label>
                  <input
                    type="text"
                    value={attrContext}
                    onChange={(e) => setAttrContext(e.target.value)}
                    placeholder="e.g. Mentioned in thread chat"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-slate-800 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setIsAttrModalOpen(false);
                    setEditingAttr(null);
                  }}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-bold rounded-lg border border-slate-700 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-lg transition"
                >
                  Save Trait State
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Visual Timeline Evolution Modal */}
      {selectedTimelineAttr && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 max-w-xl w-full rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150 flex flex-col max-h-[85vh]">
            <div className="px-6 py-4 border-b border-slate-800 flex justify-between items-center bg-slate-950/40">
              <div className="flex items-center space-x-2">
                <History className="w-5 h-5 text-indigo-400" />
                <div>
                  <h3 className="font-bold text-sm text-slate-100">Trait Evolution Timeline</h3>
                  <p className="text-[11px] text-slate-400">Evolution track for {selectedTimelineAttr.attributeType.replace('_', ' ')}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedTimelineAttr(null)}
                className="p-1 text-slate-400 hover:text-slate-200 rounded-lg"
              >
                <X className="w-4.5 h-4.5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1 space-y-6">
              {/* Present State */}
              <div className="bg-indigo-950/20 border border-indigo-500/20 p-4 rounded-xl space-y-2">
                <span className="text-[10px] uppercase font-bold text-indigo-400 font-mono tracking-wider">Current Active Value</span>
                <p className="text-sm font-semibold text-white">"{selectedTimelineAttr.value}"</p>
                <p className="text-[10px] text-slate-400 font-mono">Confidence Level: {(selectedTimelineAttr.confidence * 100).toFixed(0)}% • Synced {new Date(selectedTimelineAttr.updatedAt).toLocaleString()}</p>
              </div>

              {/* Evolution History Timeline Tracker */}
              <div className="space-y-4">
                <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider font-mono">Historical Evolution Progression</h4>
                
                {(!selectedTimelineAttr.history || selectedTimelineAttr.history.length === 0) ? (
                  <p className="text-xs text-slate-500 italic font-mono">This attribute is in its original first state. No previous modifications tracked.</p>
                ) : (
                  <div className="relative pl-6 border-l-2 border-slate-800 space-y-6 ml-2.5">
                    {/* Map through history in reverse chronological order */}
                    {[...selectedTimelineAttr.history].reverse().map((hist, idx) => (
                      <div key={idx} className="relative">
                        {/* Dot */}
                        <div className="absolute -left-[31px] top-1.5 w-3 h-3 rounded-full bg-slate-800 border-2 border-slate-900 hover:bg-indigo-500 transition duration-150" />
                        
                        <div className="bg-slate-950/40 border border-slate-800/80 rounded-lg p-3 space-y-1.5">
                          <div className="flex justify-between items-center">
                            <span className="text-xs font-bold text-slate-300">"{hist.value}"</span>
                            <span className="text-[10px] text-slate-500 font-mono">{new Date(hist.timestamp).toLocaleString()}</span>
                          </div>
                          {hist.context && (
                            <p className="text-[11px] text-slate-400 italic bg-slate-950/20 p-1.5 rounded border border-slate-800/40">
                              Context: {hist.context}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="px-6 py-4 border-t border-slate-800 bg-slate-950/40 flex justify-end">
              <button
                onClick={() => setSelectedTimelineAttr(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-bold rounded-lg border border-slate-700 transition"
              >
                Close Timeline
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
