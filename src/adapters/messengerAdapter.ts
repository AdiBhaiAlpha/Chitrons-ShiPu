import { ShiPuBotResponse, ShiPuThread, ShiPuUser } from '../types/shipu';

export interface MessengerAdapter {
  sendMessage(threadID: string, text: string, attachments?: any): Promise<ShiPuBotResponse>;
  reply(threadID: string, messageID: string, text: string): Promise<ShiPuBotResponse>;
  react(messageID: string, emoji: string): Promise<void>;
  sendImage(threadID: string, url: any): Promise<ShiPuBotResponse>;
  sendVideo(threadID: string, url: any): Promise<ShiPuBotResponse>;
  sendFile(threadID: string, url: any): Promise<ShiPuBotResponse>;
  getUserInfo(userID: string): Promise<Partial<ShiPuUser>>;
  getThreadInfo(threadID: string): Promise<Partial<ShiPuThread>>;
  getThreadList(): Promise<ShiPuThread[]>;
  addUser(threadID: string, userID: string): Promise<void>;
  removeUser(threadID: string, userID: string): Promise<void>;
  markAsRead(threadID: string): Promise<void>;
}

/**
 * Mock Messenger Adapter for interactive web simulator testing and isolated dev environments
 */
export class MockMessengerAdapter implements MessengerAdapter {
  private botName: string;

  constructor(botName: string = 'ShiPu Ai🤖') {
    this.botName = botName;
  }

  async sendMessage(threadID: string, text: string, attachments?: string[]): Promise<ShiPuBotResponse> {
    return {
      messageID: `msg_mock_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      threadID,
      body: text,
      timestamp: Date.now(),
      senderName: this.botName,
      attachments
    };
  }

  async reply(threadID: string, messageID: string, text: string): Promise<ShiPuBotResponse> {
    return this.sendMessage(threadID, `↪️ [In reply to ${messageID}]\n${text}`);
  }

  async react(messageID: string, emoji: string): Promise<void> {
    console.log(`[MockMessengerAdapter] Reacted with ${emoji} to message ${messageID}`);
  }

  async sendImage(threadID: string, url: string): Promise<ShiPuBotResponse> {
    return this.sendMessage(threadID, `📷 [Image Attachment: ${url}]`, [url]);
  }

  async sendVideo(threadID: string, url: string): Promise<ShiPuBotResponse> {
    return this.sendMessage(threadID, `🎥 [Video Attachment: ${url}]`, [url]);
  }

  async sendFile(threadID: string, url: string): Promise<ShiPuBotResponse> {
    return this.sendMessage(threadID, `📁 [File Attachment: ${url}]`, [url]);
  }

  async getUserInfo(userID: string): Promise<Partial<ShiPuUser>> {
    return {
      userID,
      name: `ShiPu_User_${userID.slice(-4)}`
    };
  }

  async getThreadInfo(threadID: string): Promise<Partial<ShiPuThread>> {
    return {
      threadID,
      name: `ShiPu Thread ${threadID}`
    };
  }

  async getThreadList(): Promise<ShiPuThread[]> {
    return [];
  }

  async addUser(threadID: string, userID: string): Promise<void> {
    console.log(`[MockMessengerAdapter] User ${userID} added to thread ${threadID}`);
  }

  async removeUser(threadID: string, userID: string): Promise<void> {
    console.log(`[MockMessengerAdapter] User ${userID} removed from thread ${threadID}`);
  }

  async markAsRead(threadID: string): Promise<void> {
    console.log(`[MockMessengerAdapter] Thread ${threadID} marked as read`);
  }
}

/**
 * Facebook Graph API / FCA Messenger Adapter implementation wrapper
 */
export class FacebookMessengerAdapter implements MessengerAdapter {
  private pageAccessToken: string;

  constructor(pageAccessToken: string = '') {
    this.pageAccessToken = pageAccessToken;
  }

  async sendMessage(threadID: string, text: string, attachments?: string[]): Promise<ShiPuBotResponse> {
    if (!this.pageAccessToken) {
      // Fallback if no FB token set
      return new MockMessengerAdapter().sendMessage(threadID, text, attachments);
    }

    try {
      const res = await fetch(`https://graph.facebook.com/v18.0/me/messages?access_token=${this.pageAccessToken}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipient: { id: threadID },
          message: { text }
        })
      });
      const data = await res.json();
      return {
        messageID: data.message_id || `msg_fb_${Date.now()}`,
        threadID,
        body: text,
        timestamp: Date.now(),
        senderName: 'ShiPu Ai🤖'
      };
    } catch (err) {
      console.error('[FacebookMessengerAdapter] Error sending message:', err);
      return new MockMessengerAdapter().sendMessage(threadID, text, attachments);
    }
  }

  async reply(threadID: string, messageID: string, text: string): Promise<ShiPuBotResponse> {
    return this.sendMessage(threadID, text);
  }

  async react(messageID: string, emoji: string): Promise<void> {
    console.log(`[FacebookMessengerAdapter] Reacted ${emoji} on message ${messageID}`);
  }

  async sendImage(threadID: string, url: string): Promise<ShiPuBotResponse> {
    return this.sendMessage(threadID, `📷 Image: ${url}`);
  }

  async sendVideo(threadID: string, url: string): Promise<ShiPuBotResponse> {
    return this.sendMessage(threadID, `🎥 Video: ${url}`);
  }

  async sendFile(threadID: string, url: string): Promise<ShiPuBotResponse> {
    return this.sendMessage(threadID, `📁 File: ${url}`);
  }

  async getUserInfo(userID: string): Promise<Partial<ShiPuUser>> {
    return { userID, name: `User_${userID}` };
  }

  async getThreadInfo(threadID: string): Promise<Partial<ShiPuThread>> {
    return { threadID, name: `Thread_${threadID}` };
  }

  async getThreadList(): Promise<ShiPuThread[]> {
    return [];
  }

  async addUser(threadID: string, userID: string): Promise<void> {}
  async removeUser(threadID: string, userID: string): Promise<void> {}
  async markAsRead(threadID: string): Promise<void> {}
}
