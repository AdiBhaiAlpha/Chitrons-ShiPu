import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Send,
  User,
  Shield,
  Crown,
  Sparkles,
  Bot,
  PlusCircle,
  RefreshCw,
  Hash,
  Terminal,
  Zap,
  Phone,
  Video,
  Info,
  MoreVertical,
  Smile,
  Image as ImageIcon,
  FileText,
  MapPin,
  HelpCircle,
  Play,
  Pause,
  FastForward,
  RotateCcw,
  UserPlus,
  Compass,
  FileCode,
  Volume2,
  Paperclip,
  Check,
  CheckCheck,
  Trash2,
  Edit2,
  CornerUpLeft,
  X,
  Plus,
  Sliders,
  Settings,
  Mic,
  Camera,
  Layers,
  ArrowRight,
  Eye,
  Vote,
  ExternalLink,
  MessageCircle,
  AlertCircle,
  Lock,
  MessageSquare,
  ChevronLeft,
  Search,
  Maximize2,
  Minimize2,
  Smartphone,
  Monitor,
  Share2,
  Download,
  RotateCw,
  Palette,
  VolumeX,
  PhoneOff,
  VideoOff,
  Clock,
  CheckCircle2,
  ShieldAlert,
  Moon,
  Sun,
  SmilePlus,
  Activity,
  MicOff,
  Flame,
  ThumbsUp,
  Heart
} from 'lucide-react';
import { ShiPuThread, ShiPuUser, ShiPuBotResponse, ShiPuEvent } from '../types/shipu';

interface LiveSimulatorProps {
  threads: ShiPuThread[];
  users: ShiPuUser[];
  onSendMessage: (threadID: string, senderID: string, messageText: string) => Promise<ShiPuBotResponse | null>;
  onCreateThread: (name: string, prefix: string) => void;
}

interface ChatMessage {
  id: string;
  senderID: string;
  senderName: string;
  senderRole: number;
  avatarUrl?: string;
  text: string;
  isBot: boolean;
  timestamp: number;
  timeStr: string;
  status: 'sent' | 'delivered' | 'seen';
  attachments?: SimulatorAttachment[];
  reactions?: { [emoji: string]: string[] };
  replyTo?: {
    id: string;
    senderName: string;
    text: string;
  };
  isEdited?: boolean;
  isDeleted?: boolean;
  isForwarded?: boolean;
  trace?: MessageTraceMeta;
  audioBlobUrl?: string;
  audioDuration?: number;
}

interface SimulatorAttachment {
  type: 'image' | 'video' | 'audio' | 'document' | 'location' | 'link_preview' | 'poll' | 'carousel' | 'button_template' | 'quick_replies';
  url?: string;
  title?: string;
  description?: string;
  fileSize?: string;
  fileName?: string;
  latitude?: number;
  longitude?: number;
  duration?: number;
  options?: { id: string; text: string; votes: number; votedUsers: string[] }[];
  carouselCards?: { imageUrl: string; title: string; description: string; buttons: { text: string; payload: string }[] }[];
  buttons?: { text: string; payload: string }[];
  quickReplies?: { text: string; payload: string }[];
}

interface MessageTraceMeta {
  messageID: string;
  threadID: string;
  senderID: string;
  executionTime: number;
  middleware: string[];
  geminiModel: string;
  prompt: string;
  tokenUsage: { input: number; output: number; total: number };
  dbReads: number;
  dbWrites: number;
  rawEvent: any;
}

type ThemeType = 'messenger_blue' | 'night_dark' | 'cyber_neon' | 'sunset_gradient' | 'emerald_luxe' | 'rose_gold';
type BubbleStyle = 'pill' | 'rounded' | 'curved';
type TabCategory = 'ALL' | 'GROUPS' | 'PERSONAL' | 'AI' | 'UNREAD';

export const LiveSimulator: React.FC<LiveSimulatorProps> = React.memo(({
  threads,
  users,
  onSendMessage,
  onCreateThread
}) => {
  // Avatars
  const avatars = [
    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop',
    'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop',
    'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop',
    'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&h=100&fit=crop',
    'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=100&h=100&fit=crop'
  ];

  const fallbackUser: ShiPuUser = {
    userID: '10001',
    name: 'ShiPu Admin (Owner)',
    role: 3,
    exp: 2850,
    level: 25,
    money: 500000,
    bankMoney: 2000000,
    isBanned: false,
    avatarUrl: avatars[0]
  };

  const fallbackThread: ShiPuThread = {
    threadID: 'thread_101',
    name: '🤖 ShiPu Ai Official Lounge',
    prefix: '#',
    language: 'en',
    timezone: 'Asia/Dhaka',
    members: [fallbackUser],
    adminIDs: ['10001'],
    autoWelcome: true,
    welcomeMessage: 'Welcome to ShiPu Ai🤖 Official Group {name}!',
    goodbyeMessage: 'Goodbye!',
    antiSpam: true,
    antiLink: false,
    aiEnabled: true,
    economyEnabled: true,
    isBanned: false,
    createdAt: Date.now()
  };

  // Layout View Mode
  const [viewMode, setViewMode] = useState<'phone_frame' | 'fullscreen'>('phone_frame');
  const [selectedThreadID, setSelectedThreadID] = useState<string>('thread_101');
  const [selectedUserID, setSelectedUserID] = useState<string>('10001');
  const [inputMessage, setInputMessage] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeCategory, setActiveCategory] = useState<TabCategory>('ALL');

  // UI Drawers & Panels
  const [showThreadDrawer, setShowThreadDrawer] = useState<boolean>(false);
  const [showInfoPanel, setShowInfoPanel] = useState<boolean>(false);
  const [showNewThreadModal, setShowNewThreadModal] = useState<boolean>(false);
  const [showFakeUserModal, setShowFakeUserModal] = useState<boolean>(false);

  // Customization & Themes
  const [activeTheme, setActiveTheme] = useState<ThemeType>('night_dark');
  const [bubbleStyle, setBubbleStyle] = useState<BubbleStyle>('rounded');
  const [quickEmoji, setQuickEmoji] = useState<string>('👍');
  const [wallpaper, setWallpaper] = useState<string>('default');
  const [simulatedNicknames, setSimulatedNicknames] = useState<Record<string, string>>({});
  const [editingNicknameUid, setEditingNicknameUid] = useState<string | null>(null);
  const [tempNickname, setTempNickname] = useState<string>('');

  // Voice Note Recording
  const [isRecordingVoice, setIsRecordingVoice] = useState<boolean>(false);
  const [voiceDuration, setVoiceDuration] = useState<number>(0);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Audio Note Playback State
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);
  const [audioPlaybackSpeed, setAudioPlaybackSpeed] = useState<number>(1);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);

  // Call Overlays
  const [activeCallType, setActiveCallType] = useState<'audio' | 'video' | null>(null);
  const [callDuration, setCallDuration] = useState<number>(0);
  const callTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Fullscreen Media Lightbox Viewer
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const [lightboxZoom, setLightboxZoom] = useState<number>(1);
  const [lightboxRotation, setLightboxRotation] = useState<number>(0);

  // Pending attachments in composer
  const [pendingAttachments, setPendingAttachments] = useState<SimulatorAttachment[]>([]);
  const [composerPicker, setComposerPicker] = useState<'emoji' | 'sticker' | 'gif' | 'none'>('none');

  // Context Actions / Long Press
  const [actionMenuMsgId, setActionMenuMsgId] = useState<string | null>(null);
  const [replyToMsg, setReplyToMsg] = useState<ChatMessage | null>(null);
  const [inspectedMessage, setInspectedMessage] = useState<ChatMessage | null>(null);

  // Simulated typing
  const [isTyping, setIsTyping] = useState<boolean>(false);
  const [typingUser, setTypingUser] = useState<string>('');

  // Simulation Controls State
  const [simulatedStatus, setSimulatedStatus] = useState<'sent' | 'delivered' | 'seen'>('seen');
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [typingDelayMs, setTypingDelayMs] = useState<number>(1000);

  // Fake user simulation state
  const [fakeUsers, setFakeUsers] = useState<ShiPuUser[]>([
    { userID: '20001', name: 'Alamin Islam', role: 0, exp: 450, level: 5, money: 1200, bankMoney: 5000, isBanned: false, avatarUrl: avatars[1] },
    { userID: '20002', name: 'Nusrat Jahan', role: 1, exp: 950, level: 9, money: 4500, bankMoney: 15000, isBanned: false, avatarUrl: avatars[2] },
    { userID: '20003', name: 'Michael Tan', role: 0, exp: 120, level: 2, money: 350, bankMoney: 1000, isBanned: false, avatarUrl: avatars[3] },
    { userID: '20004', name: 'ShiPu Assistant', role: 2, exp: 9999, level: 99, money: 999999, bankMoney: 9999999, isBanned: false, avatarUrl: avatars[4] }
  ]);
  const [newFakeName, setNewFakeName] = useState<string>('');
  const [newFakeRole, setNewFakeRole] = useState<number>(0);
  const [newThreadName, setNewThreadName] = useState<string>('');
  const [newThreadPrefix, setNewThreadPrefix] = useState<string>('#');

  // Chat message history mapped by ThreadID
  const [chatHistory, setChatHistory] = useState<Record<string, ChatMessage[]>>({
    thread_101: [
      {
        id: 'init_101_1',
        senderID: '0',
        senderName: 'ShiPu BotEngine',
        senderRole: 3,
        text: '🤖 Welcome to ShiPu AI Official Messenger Lounge! Connected directly to your multi-account Gemini Bot Engine. Type #help to begin.',
        isBot: true,
        timestamp: Date.now() - 3600000,
        timeStr: '10:00 AM',
        status: 'seen',
        attachments: [
          {
            type: 'link_preview',
            title: 'ShiPu AI Messenger Engine',
            description: 'Automated Facebook Group Moderation, Multi-Thread Parallel Gemini Logic & Real-Time Sync.',
            url: 'https://shipu.ai'
          }
        ]
      },
      {
        id: 'init_101_2',
        senderID: '20001',
        senderName: 'Alamin Islam',
        senderRole: 0,
        avatarUrl: avatars[1],
        text: '#ping',
        isBot: false,
        timestamp: Date.now() - 3000000,
        timeStr: '10:10 AM',
        status: 'seen'
      },
      {
        id: 'init_101_3',
        senderID: '0',
        senderName: 'ShiPu BotEngine',
        senderRole: 3,
        text: 'pong! 🏓 Latency: 32ms. Operating with Per-Context Locks & Multi-Provider Fallback.',
        isBot: true,
        timestamp: Date.now() - 2990000,
        timeStr: '10:10 AM',
        status: 'seen',
        reactions: { '❤️': ['Alamin Islam'], '👍': ['Nusrat Jahan'] }
      }
    ],
    thread_102: [
      {
        id: 'init_102_1',
        senderID: '0',
        senderName: 'ShiPu BotEngine',
        senderRole: 3,
        text: '🎮 Gaming Lounge initialized. Thread prefix: "!" | Run !work to start making ShiPu coins.',
        isBot: true,
        timestamp: Date.now() - 5000000,
        timeStr: '09:45 AM',
        status: 'seen'
      }
    ]
  });

  const chatEndRef = useRef<HTMLDivElement>(null);

  // Active Thread & Active User Resolution
  const currentThread = useMemo(() => {
    return threads.find(t => t.threadID === selectedThreadID) || fallbackThread;
  }, [threads, selectedThreadID]);

  const activeUser = useMemo(() => {
    const combinedUsers = [...users, ...fakeUsers, fallbackUser];
    return combinedUsers.find(u => u.userID === selectedUserID) || fallbackUser;
  }, [users, fakeUsers, selectedUserID]);

  const currentThreadMessages = useMemo(() => {
    return chatHistory[selectedThreadID] || [];
  }, [chatHistory, selectedThreadID]);

  // Scroll to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [currentThreadMessages, isTyping]);

  // Handle Call Timers
  useEffect(() => {
    if (activeCallType) {
      setCallDuration(0);
      callTimerRef.current = setInterval(() => {
        setCallDuration(prev => prev + 1);
      }, 1000);
    } else {
      if (callTimerRef.current) clearInterval(callTimerRef.current);
    }
    return () => {
      if (callTimerRef.current) clearInterval(callTimerRef.current);
    };
  }, [activeCallType]);

  // Voice Recording System
  const startVoiceRecording = async () => {
    setIsRecordingVoice(true);
    setVoiceDuration(0);
    audioChunksRef.current = [];

    recordingTimerRef.current = setInterval(() => {
      setVoiceDuration(prev => prev + 1);
    }, 1000);

    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const recorder = new MediaRecorder(stream);
        mediaRecorderRef.current = recorder;

        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) audioChunksRef.current.push(e.data);
        };

        recorder.start();
      }
    } catch (err) {
      console.warn('Microphone permission denied or unavailable, using simulated voice recording:', err);
    }
  };

  const stopAndSendVoiceRecording = () => {
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    setIsRecordingVoice(false);

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
    }

    const durationSeconds = Math.max(2, voiceDuration);

    // Create Audio Blob
    let audioUrl = '';
    if (audioChunksRef.current.length > 0) {
      const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
      audioUrl = URL.createObjectURL(audioBlob);
    }

    const voiceMsg: ChatMessage = {
      id: 'voice_' + Date.now(),
      senderID: activeUser.userID,
      senderName: activeUser.name,
      senderRole: activeUser.role,
      avatarUrl: activeUser.avatarUrl || avatars[0],
      text: '🎙️ Voice note (' + durationSeconds + 's)',
      isBot: false,
      timestamp: Date.now(),
      timeStr: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      status: simulatedStatus,
      audioBlobUrl: audioUrl,
      audioDuration: durationSeconds,
      attachments: [{ type: 'audio', duration: durationSeconds, url: audioUrl }]
    };

    setChatHistory(prev => ({
      ...prev,
      [selectedThreadID]: [...(prev[selectedThreadID] || []), voiceMsg]
    }));

    // Trigger AI response after voice note
    dispatchMessage('Voice message received', activeUser);
  };

  const cancelVoiceRecording = () => {
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    setIsRecordingVoice(false);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
    }
    audioChunksRef.current = [];
  };

  // Dispatch live BotEngine call
  const dispatchMessage = async (text: string, sender: ShiPuUser, attachList: SimulatorAttachment[] = []) => {
    if (!text.trim() && attachList.length === 0) return;

    const userMsg: ChatMessage = {
      id: 'msg_' + Math.random().toString(36).substring(2, 9),
      senderID: sender.userID,
      senderName: sender.name,
      senderRole: sender.role,
      avatarUrl: sender.avatarUrl || avatars[0],
      text: text,
      isBot: false,
      timestamp: Date.now(),
      timeStr: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      status: simulatedStatus,
      attachments: attachList.length > 0 ? attachList : undefined,
      replyTo: replyToMsg ? { id: replyToMsg.id, senderName: replyToMsg.senderName, text: replyToMsg.text } : undefined
    };

    setChatHistory(prev => ({
      ...prev,
      [selectedThreadID]: [...(prev[selectedThreadID] || []), userMsg]
    }));

    setReplyToMsg(null);
    setLoading(true);
    setIsTyping(true);
    setTypingUser('ShiPu Bot');

    try {
      const startTime = Date.now();
      const response = await onSendMessage(selectedThreadID, sender.userID, text);
      const executionTime = Date.now() - startTime;

      setTimeout(() => {
        setIsTyping(false);

        if (response) {
          const botMsg: ChatMessage = {
            id: response.messageID || 'bot_' + Math.random().toString(36).substring(2, 9),
            senderID: '0',
            senderName: response.senderName || 'ShiPu BotEngine',
            senderRole: 3,
            text: response.body,
            isBot: true,
            timestamp: Date.now(),
            timeStr: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            status: 'seen',
            trace: {
              messageID: response.messageID || 'trace_' + Date.now(),
              threadID: selectedThreadID,
              senderID: '0',
              executionTime,
              middleware: ['Logger', 'RateLimiter', 'AuthCheck', 'GeminiProviderManager'],
              geminiModel: 'Gemini 2.5 Flash',
              prompt: text,
              tokenUsage: { input: text.length, output: response.body.length, total: text.length + response.body.length },
              dbReads: 1,
              dbWrites: 1,
              rawEvent: response
            }
          };

          setChatHistory(prev => ({
            ...prev,
            [selectedThreadID]: [...(prev[selectedThreadID] || []), botMsg]
          }));
        }
        setLoading(false);
      }, typingDelayMs);
    } catch (err) {
      setIsTyping(false);
      setLoading(false);
    }
  };

  // Submit Handler
  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMessage.trim() && pendingAttachments.length === 0) return;
    dispatchMessage(inputMessage, activeUser, pendingAttachments);
    setInputMessage('');
    setPendingAttachments([]);
    setComposerPicker('none');
  };

  // Quick Emoji Send
  const handleSendQuickEmoji = () => {
    dispatchMessage(quickEmoji, activeUser);
  };

  // Add Attachment Helper
  const addAttachment = (type: SimulatorAttachment['type']) => {
    if (type === 'image') {
      setPendingAttachments(prev => [...prev, {
        type: 'image',
        url: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=600&h=400&fit=crop',
        title: 'Uploaded Photo'
      }]);
    } else if (type === 'document') {
      setPendingAttachments(prev => [...prev, {
        type: 'document',
        fileName: 'Project_Design_Brief.pdf',
        fileSize: '2.4 MB'
      }]);
    } else if (type === 'location') {
      setPendingAttachments(prev => [...prev, {
        type: 'location',
        title: 'Dhaka, Bangladesh',
        latitude: 23.8103,
        longitude: 90.4125
      }]);
    }
  };

  // Reaction Toggle
  const handleToggleReaction = (msgId: string, emoji: string) => {
    setChatHistory(prev => {
      const list = prev[selectedThreadID] || [];
      const updated = list.map(msg => {
        if (msg.id === msgId) {
          const rx = { ...(msg.reactions || {}) };
          if (rx[emoji]?.includes(activeUser.name)) {
            rx[emoji] = rx[emoji].filter(n => n !== activeUser.name);
            if (rx[emoji].length === 0) delete rx[emoji];
          } else {
            rx[emoji] = [...(rx[emoji] || []), activeUser.name];
          }
          return { ...msg, reactions: rx };
        }
        return msg;
      });
      return { ...prev, [selectedThreadID]: updated };
    });
    setActionMenuMsgId(null);
  };

  // Save Nickname
  const handleSaveNickname = (uid: string) => {
    setSimulatedNicknames(prev => ({
      ...prev,
      [uid]: tempNickname.trim()
    }));
    setEditingNicknameUid(null);
  };

  // Theme styling definitions
  const themeStyles = {
    messenger_blue: {
      bg: 'bg-slate-900',
      headerBg: 'bg-slate-900/95 border-slate-800 text-white',
      chatBg: 'bg-slate-950',
      bubbleSent: 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white',
      bubbleReceived: 'bg-slate-800/90 text-slate-100 border border-slate-700/50',
      accent: 'text-blue-400'
    },
    night_dark: {
      bg: 'bg-black',
      headerBg: 'bg-zinc-900/95 border-zinc-800 text-zinc-100',
      chatBg: 'bg-zinc-950',
      bubbleSent: 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white',
      bubbleReceived: 'bg-zinc-800/90 text-zinc-100 border border-zinc-700/50',
      accent: 'text-indigo-400'
    },
    cyber_neon: {
      bg: 'bg-slate-950',
      headerBg: 'bg-slate-900/95 border-cyan-500/30 text-cyan-300',
      chatBg: 'bg-slate-950',
      bubbleSent: 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-lg shadow-cyan-500/20',
      bubbleReceived: 'bg-slate-900 text-slate-200 border border-cyan-500/30',
      accent: 'text-cyan-400'
    },
    sunset_gradient: {
      bg: 'bg-slate-950',
      headerBg: 'bg-slate-900/95 border-rose-500/30 text-rose-300',
      chatBg: 'bg-slate-950',
      bubbleSent: 'bg-gradient-to-r from-rose-500 via-purple-600 to-amber-500 text-white',
      bubbleReceived: 'bg-slate-900 text-slate-200 border border-rose-500/20',
      accent: 'text-rose-400'
    },
    emerald_luxe: {
      bg: 'bg-slate-950',
      headerBg: 'bg-slate-900/95 border-emerald-500/30 text-emerald-300',
      chatBg: 'bg-slate-950',
      bubbleSent: 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white',
      bubbleReceived: 'bg-slate-900 text-slate-200 border border-emerald-500/20',
      accent: 'text-emerald-400'
    },
    rose_gold: {
      bg: 'bg-slate-950',
      headerBg: 'bg-slate-900/95 border-pink-500/30 text-pink-300',
      chatBg: 'bg-slate-950',
      bubbleSent: 'bg-gradient-to-r from-pink-500 to-rose-600 text-white',
      bubbleReceived: 'bg-slate-900 text-slate-200 border border-pink-500/20',
      accent: 'text-pink-400'
    }
  }[activeTheme];

  const getBubbleRadiusClass = (isSent: boolean) => {
    if (bubbleStyle === 'pill') return 'rounded-2xl';
    if (bubbleStyle === 'curved') return 'rounded-3xl';
    return isSent ? 'rounded-2xl rounded-tr-none' : 'rounded-2xl rounded-tl-none';
  };

  return (
    <div className="flex flex-col h-[calc(100vh-60px)] bg-slate-950 text-slate-100 overflow-hidden font-sans select-none relative">
      
      {/* TOP DASHBOARD CONTROL BAR */}
      <div className="bg-slate-900/90 border-b border-slate-800/80 px-4 py-2.5 flex items-center justify-between shrink-0 z-30">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 rounded-lg p-1">
            <button
              onClick={() => setViewMode('phone_frame')}
              className={`px-3 py-1 rounded-md text-xs font-medium flex items-center gap-1.5 transition ${
                viewMode === 'phone_frame' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>Android App View</span>
            </button>
            <button
              onClick={() => setViewMode('fullscreen')}
              className={`px-3 py-1 rounded-md text-xs font-medium flex items-center gap-1.5 transition ${
                viewMode === 'fullscreen' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Monitor className="w-3.5 h-3.5" />
              <span>Full Studio Canvas</span>
            </button>
          </div>

          <div className="hidden md:flex items-center gap-2 text-xs text-slate-400 border-l border-slate-800 pl-3">
            <span className="flex items-center gap-1 text-emerald-400 font-mono text-[11px]">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              ShiPu Bot Engine Online
            </span>
            <span className="text-slate-600">|</span>
            <span>Thread: <strong className="text-slate-200">{currentThread.name}</strong></span>
          </div>
        </div>

        {/* Quick Settings & Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowNewThreadModal(true)}
            className="px-2.5 py-1.5 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 rounded-lg text-xs font-medium flex items-center gap-1.5 transition"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Thread</span>
          </button>
          <button
            onClick={() => setShowFakeUserModal(true)}
            className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium flex items-center gap-1.5 transition"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Simulate Sender</span>
          </button>
        </div>
      </div>

      {/* MAIN CONTAINER */}
      <div className="flex-1 overflow-hidden flex items-center justify-center p-0 md:p-4 bg-slate-950">
        
        {/* ANDROID MESSENGER PHONE CONTAINER */}
        <div className={`transition-all duration-300 flex flex-col relative overflow-hidden shadow-2xl border ${
          viewMode === 'phone_frame' 
            ? 'w-full max-w-[420px] h-[calc(100vh-120px)] max-h-[840px] rounded-[38px] border-slate-800 bg-slate-950 ring-1 ring-slate-800/80' 
            : 'w-full h-full rounded-none border-transparent bg-slate-950'
        }`}>

          {/* ANDROID STATUS BAR (In Phone Frame Mode) */}
          {viewMode === 'phone_frame' && (
            <div className="bg-slate-900/95 text-slate-300 px-6 pt-2 pb-1 text-[11px] font-mono flex items-center justify-between shrink-0 select-none z-20">
              <span className="font-bold">10:15</span>
              {/* Punch-hole camera */}
              <div className="w-3.5 h-3.5 rounded-full bg-slate-950 border border-slate-800 mx-auto" />
              <div className="flex items-center gap-2 text-[10px]">
                <span>5G</span>
                <span>98%</span>
              </div>
            </div>
          )}

          {/* MESSENGER TOP APP HEADER */}
          <div className={`${themeStyles.headerBg} px-4 py-3 flex items-center justify-between shrink-0 border-b z-20 shadow-sm transition-colors`}>
            <div className="flex items-center gap-2.5 min-w-0">
              <button
                onClick={() => setShowThreadDrawer(true)}
                className="p-1.5 hover:bg-slate-800/60 rounded-full text-slate-300 transition"
                title="Open Chats Drawer"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>

              <div className="relative shrink-0 cursor-pointer" onClick={() => setShowInfoPanel(true)}>
                <img
                  src={currentThread.members[0]?.avatarUrl || avatars[0]}
                  referrerPolicy="no-referrer"
                  alt="Profile"
                  className="w-10 h-10 rounded-full object-cover border border-slate-700/50 shadow-sm"
                />
                {isOnline && (
                  <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-emerald-500 border-2 border-slate-900" />
                )}
              </div>

              <div className="min-w-0 cursor-pointer" onClick={() => setShowInfoPanel(true)}>
                <h3 className="text-sm font-bold text-slate-100 truncate leading-tight">
                  {currentThread.name}
                </h3>
                <p className="text-[11px] text-slate-400 flex items-center gap-1.5">
                  {isTyping ? (
                    <span className="text-indigo-400 font-medium flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce" />
                      {typingUser} is typing...
                    </span>
                  ) : (
                    <span>{isOnline ? 'Active now' : 'Active 15m ago'}</span>
                  )}
                </p>
              </div>
            </div>

            {/* Top Right Action Icons */}
            <div className="flex items-center gap-1">
              <button
                onClick={() => setActiveCallType('audio')}
                className={`p-2 hover:bg-slate-800/60 rounded-full ${themeStyles.accent} transition`}
                title="Audio Call"
              >
                <Phone className="w-4 h-4" />
              </button>
              <button
                onClick={() => setActiveCallType('video')}
                className={`p-2 hover:bg-slate-800/60 rounded-full ${themeStyles.accent} transition`}
                title="Video Call"
              >
                <Video className="w-4 h-4" />
              </button>
              <button
                onClick={() => setShowInfoPanel(prev => !prev)}
                className={`p-2 hover:bg-slate-800/60 rounded-full ${themeStyles.accent} transition`}
                title="Chat Details & Customization"
              >
                <Info className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* CHAT MESSAGES CANVAS */}
          <div className={`flex-1 overflow-y-auto p-4 space-y-3 relative ${themeStyles.chatBg}`}>
            
            {/* Wallpaper Overlay */}
            {wallpaper === 'grid' && (
              <div className="absolute inset-0 bg-[radial-gradient(#334155_1px,transparent_1px)] [background-size:16px_16px] opacity-15 pointer-events-none" />
            )}

            {/* Date separator */}
            <div className="text-center my-4">
              <span className="px-3 py-1 bg-slate-900/80 text-slate-400 rounded-full text-[10px] font-mono border border-slate-800/60">
                TODAY • {new Date().toLocaleDateString()}
              </span>
            </div>

            {/* Message List */}
            {currentThreadMessages.map((msg, index) => {
              const isSentByMe = msg.senderID === activeUser.userID || (!msg.isBot && msg.senderID === '10001');
              const nickname = simulatedNicknames[msg.senderID];
              const displayName = nickname || msg.senderName;

              return (
                <div
                  key={msg.id}
                  className={`flex flex-col group relative ${isSentByMe ? 'items-end' : 'items-start'}`}
                >
                  {/* Reply Reference Bubble */}
                  {msg.replyTo && (
                    <div className="text-[10px] text-slate-400 mb-1 px-2 py-1 bg-slate-900/60 rounded border-l-2 border-indigo-500 max-w-[75%] truncate">
                      <span className="font-bold text-slate-300">Replying to {msg.replyTo.senderName}:</span> {msg.replyTo.text}
                    </div>
                  )}

                  <div className={`flex items-end gap-2 max-w-[85%] ${isSentByMe ? 'flex-row-reverse' : 'flex-row'}`}>
                    {/* Sender Avatar */}
                    {!isSentByMe && (
                      <img
                        src={msg.avatarUrl || avatars[0]}
                        referrerPolicy="no-referrer"
                        alt="Avatar"
                        className="w-7 h-7 rounded-full object-cover shrink-0 mb-1 border border-slate-800"
                      />
                    )}

                    {/* Bubble Content */}
                    <div className="space-y-1 relative">
                      {!isSentByMe && (
                        <p className="text-[10px] text-slate-400 font-medium px-1">
                          {displayName} {msg.senderRole === 3 && <span className="text-indigo-400 font-bold">(Owner)</span>}
                        </p>
                      )}

                      {/* Main Message Box */}
                      <div
                        onContextMenu={(e) => {
                          e.preventDefault();
                          setActionMenuMsgId(msg.id);
                        }}
                        className={`p-3 text-xs leading-relaxed transition-all shadow-sm ${getBubbleRadiusClass(isSentByMe)} ${
                          isSentByMe ? themeStyles.bubbleSent : themeStyles.bubbleReceived
                        }`}
                      >
                        {/* Text */}
                        {msg.text && <p className="whitespace-pre-wrap break-words">{msg.text}</p>}

                        {/* Attachments */}
                        {msg.attachments && msg.attachments.length > 0 && (
                          <div className="mt-2 space-y-2">
                            {msg.attachments.map((att, i) => (
                              <div key={i}>
                                {att.type === 'image' && (
                                  <img
                                    src={att.url}
                                    referrerPolicy="no-referrer"
                                    alt="Attachment"
                                    onClick={() => setLightboxImage(att.url || null)}
                                    className="rounded-lg max-h-48 object-cover cursor-pointer hover:opacity-90 transition border border-black/20"
                                  />
                                )}

                                {att.type === 'audio' && (
                                  <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-2.5 flex items-center gap-3 min-w-[200px]">
                                    <button
                                      onClick={() => {
                                        if (playingAudioId === msg.id) {
                                          setPlayingAudioId(null);
                                        } else {
                                          setPlayingAudioId(msg.id);
                                        }
                                      }}
                                      className="p-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-full transition shrink-0"
                                    >
                                      {playingAudioId === msg.id ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                                    </button>

                                    <div className="flex-1 space-y-1">
                                      <div className="h-4 flex items-center gap-0.5">
                                        {[40, 70, 30, 90, 60, 100, 40, 80, 50, 30, 90, 60].map((h, idx) => (
                                          <div
                                            key={idx}
                                            className={`w-1 rounded-full transition-all ${
                                              playingAudioId === msg.id ? 'bg-indigo-400 animate-pulse' : 'bg-slate-600'
                                            }`}
                                            style={{ height: `${h}%` }}
                                          />
                                        ))}
                                      </div>
                                      <div className="flex justify-between text-[9px] text-slate-400 font-mono">
                                        <span>0:00</span>
                                        <span>{msg.audioDuration || att.duration || 12}s</span>
                                      </div>
                                    </div>

                                    <button
                                      onClick={() => {
                                        const speeds = [1, 1.5, 2];
                                        const nextIdx = (speeds.indexOf(audioPlaybackSpeed) + 1) % speeds.length;
                                        setAudioPlaybackSpeed(speeds[nextIdx]);
                                      }}
                                      className="px-1.5 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-[9px] font-mono font-bold"
                                    >
                                      {audioPlaybackSpeed}x
                                    </button>
                                  </div>
                                )}

                                {att.type === 'document' && (
                                  <div className="flex items-center gap-2 p-2 bg-slate-900/80 rounded-lg border border-slate-800 text-slate-200">
                                    <FileText className="w-4 h-4 text-indigo-400 shrink-0" />
                                    <div className="min-w-0 flex-1">
                                      <p className="font-bold text-[11px] truncate">{att.fileName || 'Document.pdf'}</p>
                                      <span className="text-[9px] text-slate-400">{att.fileSize || '1.2 MB'}</span>
                                    </div>
                                    <Download className="w-3.5 h-3.5 text-slate-400 cursor-pointer hover:text-white" />
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Message Reactions */}
                        {msg.reactions && Object.keys(msg.reactions).length > 0 && (
                          <div className="absolute -bottom-2 right-2 flex items-center gap-0.5 bg-slate-900 border border-slate-800 px-1.5 py-0.5 rounded-full shadow text-[10px]">
                            {Object.entries(msg.reactions).map(([emoji, userList]) => {
                              const list = userList as string[];
                              return (
                                <span key={emoji} title={list.join(', ')}>
                                  {emoji} {list.length > 1 && <strong className="text-[9px] text-slate-400">{list.length}</strong>}
                                </span>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      {/* Status & Timestamp */}
                      <div className={`flex items-center gap-1 text-[9px] text-slate-500 px-1 ${isSentByMe ? 'justify-end' : 'justify-start'}`}>
                        <span>{msg.timeStr}</span>
                        {isSentByMe && (
                          <span>
                            {msg.status === 'seen' ? (
                              <CheckCheck className="w-3 h-3 text-indigo-400" />
                            ) : msg.status === 'delivered' ? (
                              <CheckCheck className="w-3 h-3 text-slate-500" />
                            ) : (
                              <Check className="w-3 h-3 text-slate-500" />
                            )}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Context Action Menu Modal */}
                  {actionMenuMsgId === msg.id && (
                    <div className="absolute z-30 -top-8 bg-slate-900 border border-slate-800 rounded-xl p-1.5 shadow-2xl flex items-center gap-1 animate-in fade-in zoom-in-95">
                      {['❤️', '👍', '😆', '😮', '😢', '🔥'].map(emoji => (
                        <button
                          key={emoji}
                          onClick={() => handleToggleReaction(msg.id, emoji)}
                          className="p-1 hover:bg-slate-800 rounded text-sm transition"
                        >
                          {emoji}
                        </button>
                      ))}
                      <div className="w-px h-4 bg-slate-800 mx-1" />
                      <button
                        onClick={() => {
                          setReplyToMsg(msg);
                          setActionMenuMsgId(null);
                        }}
                        className="p-1.5 hover:bg-slate-800 rounded text-slate-300 transition"
                        title="Reply"
                      >
                        <CornerUpLeft className="w-3.5 h-3.5" />
                      </button>
                      {msg.trace && (
                        <button
                          onClick={() => {
                            setInspectedMessage(msg);
                            setActionMenuMsgId(null);
                          }}
                          className="p-1.5 hover:bg-slate-800 rounded text-indigo-400 transition"
                          title="Inspect AI Developer Trace"
                        >
                          <Terminal className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <button
                        onClick={() => setActionMenuMsgId(null)}
                        className="p-1 text-slate-500 hover:text-slate-300"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}

            <div ref={chatEndRef} />
          </div>

          {/* VOICE RECORDING OVERLAY HUD */}
          <AnimatePresence>
            {isRecordingVoice && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                className="bg-slate-900 border-t border-slate-800 px-4 py-3 flex items-center justify-between shrink-0 z-30"
              >
                <div className="flex items-center gap-3">
                  <span className="w-3 h-3 rounded-full bg-red-500 animate-ping" />
                  <span className="text-xs font-mono font-bold text-red-400">
                    Recording: 00:{voiceDuration < 10 ? '0' + voiceDuration : voiceDuration}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={cancelVoiceRecording}
                    className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-full text-xs transition"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={stopAndSendVoiceRecording}
                    className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-full text-xs font-bold transition flex items-center gap-1.5 shadow-lg shadow-indigo-600/30"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Send Voice</span>
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* MESSENGER BOTTOM COMPOSER INPUT */}
          {!isRecordingVoice && (
            <div className="bg-slate-900/95 border-t border-slate-800/80 p-3 shrink-0 z-20 space-y-2">
              
              {/* Reply Preview Bar */}
              {replyToMsg && (
                <div className="flex items-center justify-between bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800 text-xs text-slate-300">
                  <div className="truncate">
                    <span className="text-indigo-400 font-bold">Replying to {replyToMsg.senderName}:</span> {replyToMsg.text}
                  </div>
                  <button onClick={() => setReplyToMsg(null)} className="text-slate-500 hover:text-slate-300">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {/* Pending Attachments */}
              {pendingAttachments.length > 0 && (
                <div className="flex items-center gap-2 overflow-x-auto py-1">
                  {pendingAttachments.map((att, i) => (
                    <div key={i} className="relative shrink-0 bg-slate-950 p-1.5 rounded-lg border border-slate-800 flex items-center gap-2 text-xs">
                      <ImageIcon className="w-4 h-4 text-indigo-400" />
                      <span className="text-[11px] text-slate-300">{att.type}</span>
                      <button
                        onClick={() => setPendingAttachments(prev => prev.filter((_, idx) => idx !== i))}
                        className="text-slate-500 hover:text-red-400"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Input Bar Layout */}
              <form onSubmit={handleFormSubmit} className="flex items-center gap-2">
                
                {/* Left Media Actions */}
                <div className="flex items-center gap-1 text-slate-400">
                  <button
                    type="button"
                    onClick={() => addAttachment('image')}
                    className="p-1.5 hover:bg-slate-800 rounded-full hover:text-indigo-400 transition"
                    title="Attach Image"
                  >
                    <ImageIcon className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={startVoiceRecording}
                    className="p-1.5 hover:bg-slate-800 rounded-full hover:text-indigo-400 transition"
                    title="Voice Note"
                  >
                    <Mic className="w-4 h-4" />
                  </button>
                </div>

                {/* Input Text Box */}
                <div className="flex-1 relative">
                  <input
                    type="text"
                    value={inputMessage}
                    onChange={e => setInputMessage(e.target.value)}
                    placeholder="Aa"
                    className="w-full bg-slate-950 border border-slate-800/80 rounded-full px-4 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition"
                  />
                </div>

                {/* Send Button or Quick Emoji */}
                {inputMessage.trim() || pendingAttachments.length > 0 ? (
                  <button
                    type="submit"
                    disabled={loading}
                    className="p-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-full transition shadow-lg shadow-indigo-600/20 disabled:opacity-50"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleSendQuickEmoji}
                    className="p-1.5 hover:bg-slate-800 rounded-full text-lg transition"
                    title="Send Quick Emoji"
                  >
                    {quickEmoji}
                  </button>
                )}
              </form>
            </div>
          )}

          {/* ANDROID BOTTOM NAVIGATION PILL (In Phone Frame Mode) */}
          {viewMode === 'phone_frame' && (
            <div className="bg-slate-950 py-1.5 flex justify-center shrink-0">
              <div className="w-28 h-1 bg-slate-700 rounded-full" />
            </div>
          )}

          {/* THREAD DRAWER OVERLAY */}
          <AnimatePresence>
            {showThreadDrawer && (
              <motion.div
                initial={{ x: '-100%' }}
                animate={{ x: 0 }}
                exit={{ x: '-100%' }}
                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                className="absolute inset-0 bg-slate-950 z-40 flex flex-col"
              >
                <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-900">
                  <h3 className="font-bold text-sm text-slate-100">All Messenger Chats</h3>
                  <button onClick={() => setShowThreadDrawer(false)} className="p-1 text-slate-400 hover:text-white">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto p-3 space-y-2">
                  {threads.map(t => (
                    <div
                      key={t.threadID}
                      onClick={() => {
                        setSelectedThreadID(t.threadID);
                        setShowThreadDrawer(false);
                      }}
                      className={`p-3 rounded-xl border flex items-center gap-3 cursor-pointer transition ${
                        t.threadID === selectedThreadID
                          ? 'bg-indigo-600/20 border-indigo-500/50'
                          : 'bg-slate-900/60 border-slate-800 hover:bg-slate-850'
                      }`}
                    >
                      <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-indigo-600 to-purple-600 flex items-center justify-center font-bold text-sm text-white">
                        {t.name.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="text-xs font-bold text-slate-200 truncate">{t.name}</h4>
                        <p className="text-[10px] text-slate-400 font-mono">Prefix: {t.prefix}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* MESSENGER SETTINGS & INFO PANEL (ⓘ) */}
          <AnimatePresence>
            {showInfoPanel && (
              <motion.div
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                exit={{ x: '100%' }}
                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                className="absolute inset-0 bg-slate-950 z-40 flex flex-col overflow-y-auto"
              >
                {/* Header */}
                <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-900 sticky top-0 z-10">
                  <h3 className="font-bold text-sm text-slate-100 flex items-center gap-2">
                    <Info className="w-4 h-4 text-indigo-400" />
                    <span>Chat Details & Customization</span>
                  </h3>
                  <button onClick={() => setShowInfoPanel(false)} className="p-1 text-slate-400 hover:text-white">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="p-4 space-y-6 text-xs text-slate-300">
                  
                  {/* Chat Customization */}
                  <div className="space-y-3">
                    <h4 className="font-bold text-slate-200 uppercase tracking-wider text-[10px] text-indigo-400">
                      🎨 Chat Customization
                    </h4>
                    
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1">Theme Palette</label>
                      <select
                        value={activeTheme}
                        onChange={e => setActiveTheme(e.target.value as ThemeType)}
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-slate-200 outline-none"
                      >
                        <option value="night_dark">Night Dark (AMOLED)</option>
                        <option value="messenger_blue">Messenger Classic Blue</option>
                        <option value="cyber_neon">Cyberpunk Neon</option>
                        <option value="sunset_gradient">Sunset Gradient</option>
                        <option value="emerald_luxe">Emerald Luxe</option>
                        <option value="rose_gold">Rose Gold</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1">Bubble Radius Style</label>
                      <div className="grid grid-cols-3 gap-2">
                        {(['rounded', 'pill', 'curved'] as BubbleStyle[]).map(style => (
                          <button
                            key={style}
                            onClick={() => setBubbleStyle(style)}
                            className={`p-2 rounded-lg border text-[11px] capitalize transition ${
                              bubbleStyle === style
                                ? 'bg-indigo-600 text-white border-indigo-500'
                                : 'bg-slate-900 border-slate-800 text-slate-400'
                            }`}
                          >
                            {style}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1">Default Quick Emoji</label>
                      <div className="flex gap-2">
                        {['👍', '❤️', '🔥', '🤖', '⚡', '🎉'].map(emoji => (
                          <button
                            key={emoji}
                            onClick={() => setQuickEmoji(emoji)}
                            className={`p-2 rounded-lg border text-sm transition ${
                              quickEmoji === emoji ? 'bg-indigo-600/30 border-indigo-500' : 'bg-slate-900 border-slate-800'
                            }`}
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Member Nicknames */}
                  <div className="space-y-3">
                    <h4 className="font-bold text-slate-200 uppercase tracking-wider text-[10px] text-indigo-400">
                      🏷️ Member Nicknames
                    </h4>
                    <div className="space-y-2">
                      {currentThread.members.map(member => (
                        <div key={member.userID} className="bg-slate-900 p-2.5 rounded-lg border border-slate-800 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <img src={member.avatarUrl || avatars[0]} alt="Member" className="w-6 h-6 rounded-full object-cover" />
                            <div>
                              <p className="font-bold text-slate-200">{simulatedNicknames[member.userID] || member.name}</p>
                              <span className="text-[9px] text-slate-500 font-mono">UID: {member.userID}</span>
                            </div>
                          </div>

                          {editingNicknameUid === member.userID ? (
                            <div className="flex items-center gap-1">
                              <input
                                type="text"
                                value={tempNickname}
                                onChange={e => setTempNickname(e.target.value)}
                                className="bg-slate-950 border border-slate-700 rounded px-2 py-0.5 text-[10px] text-white"
                              />
                              <button onClick={() => handleSaveNickname(member.userID)} className="p-1 bg-indigo-600 rounded text-white">
                                <Check className="w-3 h-3" />
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => {
                                setEditingNicknameUid(member.userID);
                                setTempNickname(simulatedNicknames[member.userID] || member.name);
                              }}
                              className="text-slate-400 hover:text-indigo-400"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Simulation Diagnostics & Controls */}
                  <div className="space-y-3">
                    <h4 className="font-bold text-slate-200 uppercase tracking-wider text-[10px] text-indigo-400">
                      ⚙️ Simulation & Delivery Controls
                    </h4>

                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1">Simulated Message Delivery Status</label>
                      <div className="grid grid-cols-3 gap-2">
                        {(['sent', 'delivered', 'seen'] as const).map(st => (
                          <button
                            key={st}
                            onClick={() => setSimulatedStatus(st)}
                            className={`p-2 rounded-lg border text-[11px] capitalize transition ${
                              simulatedStatus === st
                                ? 'bg-indigo-600 text-white border-indigo-500'
                                : 'bg-slate-900 border-slate-800 text-slate-400'
                            }`}
                          >
                            {st}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1">AI Response Delay ({typingDelayMs}ms)</label>
                      <input
                        type="range"
                        min="200"
                        max="3000"
                        step="200"
                        value={typingDelayMs}
                        onChange={e => setTypingDelayMs(Number(e.target.value))}
                        className="w-full accent-indigo-500"
                      />
                    </div>
                  </div>

                </div>
              </motion.div>
            )}
          </AnimatePresence>

        </div>
      </div>

      {/* CALL OVERLAY SCREEN */}
      <AnimatePresence>
        {activeCallType && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="fixed inset-0 bg-slate-950/95 backdrop-blur-xl z-50 flex flex-col items-center justify-between p-8"
          >
            <div className="text-center space-y-2 mt-8">
              <p className="text-xs text-indigo-400 font-mono uppercase tracking-widest">
                Messenger {activeCallType === 'video' ? 'Video' : 'Audio'} Call
              </p>
              <h2 className="text-2xl font-black text-white">{currentThread.name}</h2>
              <p className="text-sm font-mono text-slate-400">
                00:{callDuration < 10 ? '0' + callDuration : callDuration}
              </p>
            </div>

            <div className="relative">
              <div className="w-32 h-32 rounded-full bg-gradient-to-tr from-indigo-600 to-purple-600 p-1 shadow-2xl animate-pulse">
                <img
                  src={currentThread.members[0]?.avatarUrl || avatars[0]}
                  referrerPolicy="no-referrer"
                  alt="Caller"
                  className="w-full h-full rounded-full object-cover"
                />
              </div>
            </div>

            <div className="flex items-center gap-6 mb-8">
              <button className="p-4 bg-slate-900 border border-slate-800 text-slate-300 rounded-full hover:bg-slate-800 transition">
                <MicOff className="w-6 h-6" />
              </button>
              <button
                onClick={() => setActiveCallType(null)}
                className="p-5 bg-red-600 text-white rounded-full hover:bg-red-500 transition shadow-xl shadow-red-600/30"
              >
                <PhoneOff className="w-7 h-7" />
              </button>
              <button className="p-4 bg-slate-900 border border-slate-800 text-slate-300 rounded-full hover:bg-slate-800 transition">
                <VolumeX className="w-6 h-6" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* FULLSCREEN LIGHTBOX VIEWER */}
      {lightboxImage && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-xl z-50 flex flex-col items-center justify-between p-6">
          <div className="w-full flex justify-between items-center text-white">
            <span className="text-xs font-mono text-slate-400">Media Lightbox</span>
            <button onClick={() => setLightboxImage(null)} className="p-2 hover:bg-slate-800 rounded-full">
              <X className="w-6 h-6" />
            </button>
          </div>

          <div className="flex-1 flex items-center justify-center p-4">
            <img
              src={lightboxImage}
              referrerPolicy="no-referrer"
              alt="Expanded"
              className="max-h-[80vh] max-w-full object-contain rounded-xl shadow-2xl transition-transform duration-200"
              style={{ transform: `scale(${lightboxZoom}) rotate(${lightboxRotation}deg)` }}
            />
          </div>

          <div className="flex items-center gap-4 bg-slate-900 border border-slate-800 px-6 py-3 rounded-full text-white">
            <button onClick={() => setLightboxZoom(prev => Math.min(prev + 0.25, 3))} className="p-1 hover:text-indigo-400">
              <Plus className="w-5 h-5" />
            </button>
            <button onClick={() => setLightboxZoom(prev => Math.max(prev - 0.25, 0.5))} className="p-1 hover:text-indigo-400">
              <X className="w-5 h-5" />
            </button>
            <button onClick={() => setLightboxRotation(prev => (prev + 90) % 360)} className="p-1 hover:text-indigo-400">
              <RotateCw className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      {/* NEW THREAD MODAL */}
      {showNewThreadModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 w-full max-w-md space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-slate-100 text-sm">Create New Messenger Group Thread</h3>
              <button onClick={() => setShowNewThreadModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 mb-1">Group Thread Name</label>
                <input
                  type="text"
                  value={newThreadName}
                  onChange={e => setNewThreadName(e.target.value)}
                  placeholder="e.g. ShiPu Developers Lounge"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-100 outline-none"
                />
              </div>
              <div>
                <label className="block text-slate-400 mb-1">Command Prefix</label>
                <input
                  type="text"
                  value={newThreadPrefix}
                  onChange={e => setNewThreadPrefix(e.target.value)}
                  placeholder="#"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-100 outline-none font-mono"
                />
              </div>
            </div>

            <button
              onClick={() => {
                if (newThreadName.trim()) {
                  onCreateThread(newThreadName.trim(), newThreadPrefix.trim() || '#');
                  setShowNewThreadModal(false);
                  setNewThreadName('');
                }
              }}
              className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition shadow-lg"
            >
              Create Thread
            </button>
          </div>
        </div>
      )}

      {/* SIMULATED FAKE SENDER USER MODAL */}
      {showFakeUserModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 w-full max-w-md space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-slate-100 text-sm">Switch Simulated Message Sender</h3>
              <button onClick={() => setShowFakeUserModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2 max-h-60 overflow-y-auto">
              {[fallbackUser, ...fakeUsers].map(u => (
                <div
                  key={u.userID}
                  onClick={() => {
                    setSelectedUserID(u.userID);
                    setShowFakeUserModal(false);
                  }}
                  className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition ${
                    selectedUserID === u.userID ? 'bg-indigo-600/20 border-indigo-500' : 'bg-slate-950 border-slate-800 hover:bg-slate-850'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <img src={u.avatarUrl || avatars[0]} alt="User" className="w-8 h-8 rounded-full object-cover" />
                    <div>
                      <p className="text-xs font-bold text-slate-100">{u.name}</p>
                      <span className="text-[10px] text-slate-400 font-mono">
                        Role: {u.role === 3 ? 'Owner' : u.role === 1 ? 'Admin' : 'User'}
                      </span>
                    </div>
                  </div>
                  {selectedUserID === u.userID && <Check className="w-4 h-4 text-indigo-400" />}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

    </div>
  );
});

LiveSimulator.displayName = 'LiveSimulator';
