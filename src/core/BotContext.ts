export type PlatformType = 'messenger' | 'telegram';

export interface BotContext {
  platform: PlatformType;
  botId: string;
  senderId: string;
  threadId: string;
  messageId: string;
  body: string;
  rawEvent?: any;

  reply(text: string): Promise<any>;
  sendImage(url: string, caption?: string): Promise<any>;
  react(reaction: string): Promise<any>;
  kick?(userId: string): Promise<any>;
}
