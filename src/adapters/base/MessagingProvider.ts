import {
  MessageProviderType,
  IncomingMessage,
  OutgoingMessage,
  ProviderDeliveryResult,
  ProviderStatus
} from '../../core/bus/messageTypes';

export type IncomingMessageHandler = (msg: IncomingMessage) => Promise<OutgoingMessage | void>;

export interface MessagingProvider {
  /** Identifier of the messaging network (e.g. 'telegram', 'messenger') */
  readonly providerId: MessageProviderType;
  /** Specific account identifier under this provider (for multi-account support) */
  readonly accountId?: string;
  /** Human-readable display label */
  readonly displayName: string;

  /** Initialize transport receiver and establish connection */
  startProvider(): Promise<boolean>;
  /** Safely stop transport receiver and terminate connection */
  stopProvider(): Promise<boolean>;
  /** Restart transport receiver with clean re-initialization */
  restartProvider(): Promise<boolean>;
  /** Retrieve current connection and health metrics */
  getProviderStatus(): ProviderStatus;

  /** Deliver a normalized outgoing message to the transport network */
  sendOutgoing(message: OutgoingMessage): Promise<ProviderDeliveryResult>;

  /** Register listener for incoming normalized messages */
  setIncomingHandler(handler: IncomingMessageHandler): void;
}
