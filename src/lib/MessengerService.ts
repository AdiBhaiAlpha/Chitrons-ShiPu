export interface ShiPuThread {
  id: string;
  threadID: string;
  name: string;
  isGroup: boolean;
  category: 'inbox' | 'request' | 'spam' | 'archived';
  unreadCount: number;
  lastMessage: {
    body: string;
    senderName: string;
    timestamp: number;
  };
  participantCount?: number;
  threadIcon?: string;
  accountId: string;
  accountName: string;
}

export interface ShiPuMessage {
  messageID: string;
  senderID: string;
  senderName: string;
  body: string;
  timestamp: number;
  attachments?: any[];
  isBot?: boolean;
}

export const MessengerService = {
  async getAllInboxData(): Promise<{ success: boolean; accounts: any[]; items: ShiPuThread[]; diagnostics: any[] }> {
    try {
      const res = await fetch('/api/messenger/inbox/all');
      const contentType = res.headers.get('content-type');
      if (res.ok && contentType && contentType.includes('application/json')) {
        return await res.json();
      }
      return { success: false, accounts: [], items: [], diagnostics: [] };
    } catch {
      return { success: false, accounts: [], items: [], diagnostics: [] };
    }
  },

  async getThreadHistory(accountId: string, threadID: string): Promise<{ success: boolean; messages: ShiPuMessage[]; threadInfo: any; diagnostic?: any }> {
    try {
      const res = await fetch(`/api/messenger/inbox/history?accountId=${encodeURIComponent(accountId)}&threadID=${encodeURIComponent(threadID)}`);
      const contentType = res.headers.get('content-type');
      if (res.ok && contentType && contentType.includes('application/json')) {
        return await res.json();
      }
      return { success: false, messages: [], threadInfo: null };
    } catch {
      return { success: false, messages: [], threadInfo: null };
    }
  },

  async performAction(accountId: string, threadID: string, action: string, payload?: any, userId?: string): Promise<{ success: boolean; action: string; result?: any; diagnostic?: any }> {
    const res = await fetch('/api/messenger/inbox/action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountId, threadID, action, payload, userId })
    });
    return await res.json();
  },

  async approvePendingThread(accountId: string, threadID: string): Promise<any> {
    return this.performAction(accountId, threadID, 'accept_request');
  },

  async archiveThread(accountId: string, threadID: string): Promise<any> {
    return this.performAction(accountId, threadID, 'archive');
  },

  async unarchiveThread(accountId: string, threadID: string): Promise<any> {
    return this.performAction(accountId, threadID, 'restore');
  },

  async markAsRead(accountId: string, threadID: string): Promise<any> {
    return this.performAction(accountId, threadID, 'mark_read');
  },

  async deleteThread(accountId: string, threadID: string, userId?: string): Promise<any> {
    return this.performAction(accountId, threadID, 'decline_request', undefined, userId);
  }
};
