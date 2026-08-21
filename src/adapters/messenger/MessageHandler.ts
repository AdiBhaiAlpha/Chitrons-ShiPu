import { ShiPuBotResponse } from '../../types/shipu';

export interface RawMessengerMessage {
  messageID: string;
  threadID: string;
  senderID: string;
  body: string;
  attachments?: any[];
  timestamp: number;
}

export class MessageHandler {
  public static parseIncomingMessage(raw: RawMessengerMessage): {
    threadID: string;
    senderID: string;
    body: string;
    timestamp: number;
  } {
    return {
      threadID: raw.threadID,
      senderID: raw.senderID,
      body: raw.body || '',
      timestamp: raw.timestamp || Date.now()
    };
  }

  public static formatOutgoingResponse(
    threadID: string,
    text: string,
    botName: string,
    attachments?: string[]
  ): ShiPuBotResponse {
    return {
      messageID: `msg_fca_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      threadID,
      body: text,
      timestamp: Date.now(),
      senderName: botName,
      attachments
    };
  }
}
