export type TelegramConnectionStatus = 'ONLINE' | 'OFFLINE' | 'CONNECTING' | 'AUTH_FAILED' | 'ERROR';
export type TelegramReceiverStatus = 'RUNNING' | 'STOPPED' | 'STARTING' | 'ERROR';

export type TelegramLogCategory =
  | 'TOKEN_VALIDATION'
  | 'BOT_CONNECTED'
  | 'RECEIVER_STARTED'
  | 'UPDATE_RECEIVED'
  | 'MESSAGE_PROCESSED'
  | 'COMMAND_EXECUTED'
  | 'MESSAGE_SENT'
  | 'NETWORK_RETRY'
  | 'RECEIVER_STOPPED'
  | 'AUTH_FAILED'
  | 'API_ERROR'
  | 'DATABASE_LOAD_FAILED'
  | 'RUNTIME_ERROR';

export interface TelegramLogEntry {
  id: string;
  timestamp: string;
  level: 'INFO' | 'SUCCESS' | 'WARN' | 'ERROR';
  category: TelegramLogCategory;
  message: string;
  details?: any;
}

export interface TelegramStats {
  messagesReceived: number;
  messagesProcessed: number;
  messagesFailed: number;
  commandsExecuted: number;
  uptimeMs: number;
}

export interface TelegramConfigRecord {
  configId: string;
  encryptedToken: string;
  adminUserIds: string[];
  enabled: boolean;
  autoConnect: boolean;
  botUsername: string;
  botId: string;
  botFirstName: string;
  status: TelegramConnectionStatus;
  receiverStatus: TelegramReceiverStatus;
  lastConnectedAt: number;
  lastDisconnectedAt: number;
  lastUpdateAt: number;
  lastError: string;
  stats: TelegramStats;
  createdAt?: number;
  updatedAt?: number;
}

export interface TelegramStatusResponse {
  status: TelegramConnectionStatus;
  receiverStatus: TelegramReceiverStatus;
  botUsername: string;
  botId: string;
  botFirstName: string;
  adminUserIds: string[];
  hasToken: boolean;
  maskedToken: string;
  enabled: boolean;
  autoConnect: boolean;
  lastConnectedAt: number;
  lastDisconnectedAt: number;
  lastUpdateAt: number;
  lastError: string;
  stats: TelegramStats;
  uptimeSeconds: number;
}

export interface TelegramUser {
  id: number;
  is_bot: boolean;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
}

export interface TelegramChat {
  id: number | string;
  type: 'private' | 'group' | 'supergroup' | 'channel';
  title?: string;
  username?: string;
  first_name?: string;
  last_name?: string;
}

export interface TelegramPhotoSize {
  file_id: string;
  file_unique_id: string;
  width: number;
  height: number;
  file_size?: number;
}

export interface TelegramDocument {
  file_id: string;
  file_unique_id: string;
  file_name?: string;
  mime_type?: string;
  file_size?: number;
}

export interface TelegramVideo {
  file_id: string;
  file_unique_id: string;
  width: number;
  height: number;
  duration: number;
  file_name?: string;
  mime_type?: string;
  file_size?: number;
}

export interface TelegramAudio {
  file_id: string;
  file_unique_id: string;
  duration: number;
  performer?: string;
  title?: string;
  file_name?: string;
  mime_type?: string;
  file_size?: number;
}

export interface TelegramMessage {
  message_id: number;
  message_thread_id?: number;
  from?: TelegramUser;
  sender_chat?: TelegramChat;
  date: number;
  chat: TelegramChat;
  forward_from?: TelegramUser;
  forward_date?: number;
  reply_to_message?: TelegramMessage;
  text?: string;
  caption?: string;
  photo?: TelegramPhotoSize[];
  document?: TelegramDocument;
  video?: TelegramVideo;
  audio?: TelegramAudio;
  new_chat_members?: TelegramUser[];
  left_chat_member?: TelegramUser[];
  new_chat_title?: string;
}

export interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
  edited_message?: TelegramMessage;
  channel_post?: TelegramMessage;
  edited_channel_post?: TelegramMessage;
  callback_query?: {
    id: string;
    from: TelegramUser;
    message?: TelegramMessage;
    data?: string;
  };
}
