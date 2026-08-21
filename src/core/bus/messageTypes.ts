export type MessageProviderType = 'messenger' | 'telegram' | 'simulator' | 'sms' | string;

export type ChatType = 'private' | 'group' | 'channel' | 'thread';

export interface MessageAttachment {
  type: 'image' | 'video' | 'audio' | 'file' | 'sticker' | 'url';
  url?: string;
  data?: any;
  filename?: string;
  mimeType?: string;
}

/**
 * Normalized incoming message format across all transport providers.
 * Core ShiPu AI services strictly consume this normalized structure.
 */
export interface IncomingMessage {
  /** Originating messaging provider identifier (e.g. 'telegram', 'messenger') */
  provider: MessageProviderType;
  /** Optional account ID when multi-account is used */
  accountId?: string;
  /** Unique message identifier on the transport network */
  messageId: string;
  /** Thread or chat ID where the message was posted */
  chatId: string;
  /** Sender user ID on the transport network */
  senderId: string;
  /** Sender display name or username if available */
  senderName?: string;
  /** Chat type: private direct chat, group chat, channel, etc. */
  chatType?: ChatType;
  /** Text content of the message */
  text: string;
  /** Message arrival or origin timestamp (ms) */
  timestamp: number;
  /** ID of the message being replied to (if any) */
  replyToMessageId?: string | null;
  /** Optional normalized attachments */
  attachments?: MessageAttachment[];
  /** Optional raw transport payload for diagnostics */
  raw?: any;
}

/**
 * Normalized outgoing response message format.
 * Emitted by ShiPu AI core and consumed by the originating Provider Adapter.
 */
export interface OutgoingMessage {
  /** Destination provider (must match originating message provider) */
  provider: MessageProviderType;
  /** Destination account ID (must match originating message account ID) */
  accountId?: string;
  /** Target thread or chat ID */
  chatId: string;
  /** Message text content to deliver */
  text: string;
  /** ID of the message to reply to */
  replyToMessageId?: string | null;
  /** Optional attachments to send (images, files, etc.) */
  attachments?: any[];
  /** Optional provider-specific formatting or metadata */
  metadata?: Record<string, any>;
}

export interface ProviderDeliveryResult {
  messageId?: string;
  success: boolean;
  error?: string;
  timestamp?: number;
}

export type ProviderConnectionStatus = 'ONLINE' | 'OFFLINE' | 'CONNECTING' | 'AUTH_FAILED' | 'ERROR';
export type ProviderReceiverStatus = 'RUNNING' | 'STOPPED' | 'STARTING' | 'ERROR';

export interface ProviderStatus {
  provider: MessageProviderType;
  accountId?: string;
  status: ProviderConnectionStatus;
  receiverStatus: ProviderReceiverStatus;
  accountName?: string;
  accountUsername?: string;
  accountIdOrUid?: string;
  uptimeSeconds: number;
  lastError?: string;
  lastUpdateAt?: number;
  stats?: {
    messagesReceived: number;
    messagesProcessed: number;
    messagesFailed: number;
    commandsExecuted: number;
  };
}
