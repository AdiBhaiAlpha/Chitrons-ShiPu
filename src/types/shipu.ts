export type UserRole = 0 | 1 | 2 | 3; // 0: Normal User, 1: Group Admin, 2: Bot Admin, 3: Bot Owner

export type UnicodeFontStyle = 'boldSans' | 'boldSerif' | 'smallCaps';

export interface TypographyTargetsConfig {
  userName: boolean;
  username: boolean;
  userRole: boolean;
  commandOutput: boolean;
  groupName: boolean;
  botLabels: boolean;
}

export interface UnicodeStyleDefinition {
  upper: string;
  lower: string;
  digits: string;
}

export interface TypographyConfig {
  activeStyle: UnicodeFontStyle;
  targets: TypographyTargetsConfig;
  styles: {
    boldSerif: UnicodeStyleDefinition;
    smallCaps: UnicodeStyleDefinition;
    boldSans: UnicodeStyleDefinition;
  };
}

export interface ShiPuCommandConfig {
  name: string;
  aliases?: string[];
  version: string;
  role: UserRole;
  author: string;
  description: string;
  category: 'system' | 'admin' | 'economy' | 'fun' | 'ai' | 'subscription' | 'Custom';
  guide?: string;
  countDown?: number; // Cooldown in seconds
  enabled?: boolean;
}

export interface ShiPuUser {
  userID: string;
  name: string;
  rawName?: string;
  displayName?: string;
  rawUsername?: string;
  displayUsername?: string;
  username?: string;
  avatarUrl?: string;
  role: UserRole;
  formattedRole?: string;
  exp: number;
  level: number;
  money: number;
  bankMoney: number;
  inventory?: string[];
  isBanned: boolean;
  banReason?: string;
  marriagePartner?: { userID: string; name?: string; rawName?: string; displayName?: string } | null;
  lastDaily?: number;
  lastWork?: number;
}

export interface ShiPuThread {
  threadID: string;
  name: string;
  rawName?: string;
  displayName?: string;
  prefix: string;
  language: 'bn' | 'en';
  timezone: string;
  members: ShiPuUser[];
  participantIDs?: string[];
  adminIDs: string[];
  autoWelcome: boolean;
  welcomeMessage: string;
  goodbyeMessage: string;
  antiSpam: boolean;
  antiLink: boolean;
  aiEnabled: boolean;
  economyEnabled: boolean;
  isBanned: boolean;
  createdAt: number;
  initializedAt?: number;
  connectionMessageSent?: boolean;
  nicknameUpdated?: boolean;
  botPresent?: boolean;
  botNickname?: string;
}

export interface ShiPuEvent {
  type: 'message' | 'message_reply' | 'event' | 'reaction';
  threadID: string;
  senderID: string;
  messageID: string;
  body: string;
  args: string[];
  prefixUsed: string;
  timestamp: number;
  replyTo?: {
    messageID: string;
    senderID: string;
    body: string;
  };
  reaction?: string;
}

export interface ShiPuMessageReplyApi {
  reply: (textOrObj: any, attachments?: any) => Promise<ShiPuBotResponse>;
  send: (textOrObj: any, threadID?: string, attachments?: any) => Promise<ShiPuBotResponse>;
  react: (emoji: string) => Promise<void>;
  reaction: (emoji: string) => Promise<void>;
  kick: (userID: string) => Promise<void>;
  unsend?: (messageID: string) => Promise<void>;
}

export interface ShiPuCommandContext {
  message: ShiPuMessageReplyApi;
  args: string[];
  event: ShiPuEvent;
  threadID: string;
  senderID: string;
  accountId?: string;
  botUid?: string;
  currentUser: ShiPuUser;
  currentThread: ShiPuThread;
  usersData: {
    get: (userID: string, field?: string) => any; // Flexibility for field access or whole object
    set: (userID: string, data: Partial<ShiPuUser>) => void | Promise<void>;
    increment: (userID: string, field: 'money' | 'bankMoney' | 'exp', amount: number) => void | Promise<void>;
  };
  threadsData: {
    get: (threadID: string, field?: string) => any;
    set: (threadID: string, data: Partial<ShiPuThread>) => void | Promise<void>;
  };
  api: any; // Allow full access to adapter/api
  getLang?: (key: string) => string;
  Reply?: any;
  replyData?: any;
  Reaction?: any;
  reactionData?: any;
}

export interface ShiPuCommandModule {
  config: ShiPuCommandConfig;
  code?: string; // Source code if custom plugin
  onStart: (context: ShiPuCommandContext) => Promise<void | ShiPuBotResponse>;
  onChat?: (context: ShiPuCommandContext) => Promise<void>;
  onReply?: (context: ShiPuCommandContext) => Promise<void>;
  onReaction?: (context: ShiPuCommandContext) => Promise<void>;
  onEvent?: (context: ShiPuCommandContext) => Promise<void>;
  diagnostic?: {
    status: 'valid' | 'invalid' | 'diagnostic';
    error?: string;
  };
}

export interface ShiPuBotResponse {
  messageID: string;
  threadID: string;
  body: string;
  timestamp: number;
  senderName: string;
  attachments?: string[];
}

export interface BotConfig {
  botName: string;
  globalPrefix: string;
  botAdminIDs: string[];
  botOwnerID: string;
  autoRestart: boolean;
  webhookUrl: string;
  facebookAppState: string;
  enableAI: boolean;
  maintenanceMode: boolean;
}

export interface BotSystemStats {
  uptimeSeconds: number;
  totalCommandsExecuted: number;
  totalEventsHandled: number;
  activeThreadsCount: number;
  registeredUsersCount: number;
  memoryUsageMB: number;
  cpuLoadPercent: number;
  status: 'ONLINE' | 'MAINTENANCE' | 'OFFLINE';
  messengerStatus?: string;
  mongoStatus?: string;
  ftpStatus?: string;
}

export interface BotLog {
  id: string;
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'command' | 'event';
  message: string;
  source: string;
}

export interface ScheduledTask {
  id: string;
  name: string;
  cronExpression: string;
  lastRun: string;
  nextRun: string;
  status: 'active' | 'paused';
}

// Re-export alias types for compatibility
export type ShiPuAiUser = ShiPuUser;
export type ShiPuAiThread = ShiPuThread;
export type ShiPuAiCommandConfig = ShiPuCommandConfig;
export type ShiPuAiCommandModule = ShiPuCommandModule;
export type ShiPuAiCommandContext = ShiPuCommandContext;
export type ShiPuAiEvent = ShiPuEvent;
export type ShiPuAiMessageReplyApi = ShiPuMessageReplyApi;
export type ShiPuAiBotResponse = ShiPuBotResponse;
