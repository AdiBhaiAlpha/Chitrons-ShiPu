import { ShiPuBotResponse, ShiPuThread, ShiPuUser } from '../../types/shipu';
import { FacebookSession, SafeSessionMeta } from './FacebookSession';
import { MessageHandler } from './MessageHandler';
import { messengerLogger, MessengerLogger } from './MessengerLogger';
import { recordBotMessageId } from '../../utils/commandParser';
import { emergencyAntiSpamGuard } from '../../core/EmergencyAntiSpamGuard';
import { prepareAttachments } from '../../core/attachmentUtils';
import { sanitizeOutgoingMessage } from '../../utils/textFormatter';

export interface IMessengerAdapter {
  connect(): Promise<boolean>;
  disconnect(): Promise<void>;
  getSessionStatus(): SafeSessionMeta;
  sendMessage(threadID: string, text: string, attachments?: any): Promise<ShiPuBotResponse>;
  reply(threadID: string, messageID: string, text: string): Promise<ShiPuBotResponse>;
  react(messageID: string, emoji: string): Promise<void>;
  sendImage(threadID: string, url: string): Promise<ShiPuBotResponse>;
  sendVideo(threadID: string, url: string): Promise<ShiPuBotResponse>;
  sendFile(threadID: string, url: string): Promise<ShiPuBotResponse>;
  getUserInfo(userID: string): Promise<Partial<ShiPuUser>>;
  getThreadInfo(threadID: string): Promise<Partial<ShiPuThread>>;
  getThreadList(): Promise<ShiPuThread[]>;
  addUser(threadID: string, userID: string): Promise<void>;
  removeUser(threadID: string, userID: string): Promise<void>;
  markAsRead?(threadID: string): Promise<void>;
  sendTypingIndicator?(threadID: string, typing: boolean): Promise<void>;
}

export class MessengerAdapterImpl implements IMessengerAdapter {
  private session: FacebookSession;

  constructor(session?: FacebookSession) {
    this.session = session || new FacebookSession();
  }

  public async connect(): Promise<boolean> {
    return this.session.connect();
  }

  public async disconnect(): Promise<void> {
    return this.session.disconnect();
  }

  public getSessionStatus(): SafeSessionMeta {
    return this.session.getSafeMetadata();
  }

  public async sendMessage(threadID: string, text: string, attachments?: any): Promise<ShiPuBotResponse> {
    const meta = this.session.getSafeMetadata();
    const api = this.session.getFcaApi();

    if (!emergencyAntiSpamGuard.canSendSafely(threadID, undefined, text)) {
      messengerLogger.warn('SAFETY', '[SAFETY] Blocking further outgoing messages for this thread');
      return {
        messageID: 'blocked_by_safety',
        threadID,
        body: '',
        timestamp: Date.now(),
        senderName: meta.accountName || 'ShiPu Ai🤖'
      };
    }

    messengerLogger.info('SEND', 'Preparing response payload', { threadID: MessengerLogger.maskUid(threadID) }, 'send_prep');

    if (!api) {
      messengerLogger.error('SEND', 'Cannot send message: FCA API is not authenticated or connected.');
      messengerLogger.updatePipelineStage('fb_api', 'failed', 'FCA API disconnected');
      throw new Error('Facebook API is not connected. Upload valid appstate_cookie.json.');
    }

    const preparedAtt = await prepareAttachments(attachments);

    return new Promise<ShiPuBotResponse>((resolve, reject) => {
      messengerLogger.info('SEND', 'Calling real FCA api.sendMessage()...', { threadID: MessengerLogger.maskUid(threadID) });

      const safeToSend = emergencyAntiSpamGuard.recordOutgoingMessage(threadID, text, undefined, undefined, api);
      if (!safeToSend) {
        messengerLogger.warn('SAFETY', '[SAFETY] Blocking further outgoing messages for this thread');
        return resolve({
          messageID: 'blocked_by_safety',
          threadID,
          body: '',
          timestamp: Date.now(),
          senderName: meta.accountName || 'ShiPu Ai🤖'
        });
      }

      const cleanText = text ? sanitizeOutgoingMessage(text) : '';
      const msgPayload = preparedAtt
        ? { body: cleanText, attachment: preparedAtt }
        : cleanText;

      api.sendMessage(msgPayload, threadID, (err: any, info: any) => {
        if (err) {
          const errDetail = err.error || err.message || (typeof err === 'string' ? err : JSON.stringify(err));
          messengerLogger.error('SEND', `Real FCA api.sendMessage failed: ${errDetail}`);
          messengerLogger.updatePipelineStage('fb_api', 'failed', errDetail);

          // If MQTT client is uninitialized, disconnected or failing session, fall back smoothly
          if (
            errDetail.includes('MQTT client is not initialized') ||
            errDetail.includes('Not logged in') ||
            errDetail.includes('Connection closed') ||
            errDetail.includes('Not connected')
          ) {
            messengerLogger.warn('SEND', `FCA session pending/offline (${errDetail}). Simulating local message delivery.`);
            const fallbackMsgId = info?.messageID || info?.mid || `msg_sim_${Date.now()}`;
            recordBotMessageId(fallbackMsgId);
            return resolve({
              messageID: fallbackMsgId,
              threadID,
              body: text,
              timestamp: Date.now(),
              senderName: meta.accountName || 'ShiPu Ai🤖'
            });
          }

          return reject(new Error(`FB Send Failed: ${errDetail}`));
        }

        const msgID = info?.messageID || info?.mid || `msg_fb_${Date.now()}`;
        recordBotMessageId(msgID);
        messengerLogger.success('SEND', 'Facebook server acknowledged message delivery', { messageID: msgID });
        messengerLogger.updatePipelineStage('msg_sent', 'success', msgID);

        // Try marking thread as read
        this.markAsRead(threadID).catch(() => {});

        resolve({
          messageID: msgID,
          threadID,
          body: text,
          timestamp: Date.now(),
          senderName: meta.accountName || 'ShiPu Ai🤖'
        });
      });
    });
  }

  public async reply(threadID: string, messageID: string, text: string): Promise<ShiPuBotResponse> {
    messengerLogger.info('REPLY', `Replying to message ${messageID}`, { threadID: MessengerLogger.maskUid(threadID), messageID });
    return this.sendMessage(threadID, text);
  }

  public async react(messageID: string, emoji: string): Promise<void> {
    const api = this.session.getFcaApi();
    if (!api || !api.setMessageReaction) {
      messengerLogger.warn('REACTION', 'Cannot send reaction: FCA API not available');
      return;
    }

    return new Promise<void>((resolve) => {
      messengerLogger.info('REACTION', `Sending emoji reaction '${emoji}' to message ${messageID}`);
      api.setMessageReaction(emoji, messageID, (err: any) => {
        if (err) {
          messengerLogger.warn('REACTION', `Reaction failed: ${err.message || err}`);
        } else {
          messengerLogger.success('REACTION', `Reaction '${emoji}' sent to Facebook servers`, { messageID, emoji });
        }
        resolve();
      });
    });
  }

  public async markAsRead(threadID: string): Promise<void> {
    const api = this.session.getFcaApi();
    if (!api || !api.markAsRead) return;

    return new Promise<void>((resolve) => {
      api.markAsRead(threadID, (err: any) => {
        if (err) {
          messengerLogger.warn('SEEN', `markAsRead warning: ${err.message || err}`);
        } else {
          messengerLogger.success('SEEN', 'Marked thread as seen on Facebook servers', { threadID: MessengerLogger.maskUid(threadID) });
          messengerLogger.updatePipelineStage('seen_updated', 'success', 'Thread marked as read');
        }
        resolve();
      });
    });
  }

  public async sendTypingIndicator(threadID: string, typing: boolean): Promise<void> {
    const api = this.session.getFcaApi();
    if (!api || !api.sendTypingIndicator) return;

    try {
      api.sendTypingIndicator(threadID, (err: any) => {
        if (!err) {
          messengerLogger.info('TYPING', `Typing indicator set to ${typing}`, { threadID: MessengerLogger.maskUid(threadID) });
        }
      });
    } catch {}
  }

  public async sendImage(threadID: string, url: string): Promise<ShiPuBotResponse> {
    return this.sendMessage(threadID, `📷 [Image: ${url}]`, [url]);
  }

  public async sendVideo(threadID: string, url: string): Promise<ShiPuBotResponse> {
    return this.sendMessage(threadID, `🎥 [Video: ${url}]`, [url]);
  }

  public async sendFile(threadID: string, url: string): Promise<ShiPuBotResponse> {
    return this.sendMessage(threadID, `📁 [File: ${url}]`, [url]);
  }

  public async getUserInfo(userID: string): Promise<Partial<ShiPuUser>> {
    const api = this.session.getFcaApi();
    if (api && api.getUserInfo) {
      return new Promise<Partial<ShiPuUser>>((resolve) => {
        api.getUserInfo(userID, (err: any, ret: any) => {
          if (!err && ret && ret[userID]) {
            const u = ret[userID];
            return resolve({
              userID,
              name: u.name || `User_${userID}`
            });
          }
          resolve({ userID, name: `User_${userID}` });
        });
      });
    }
    return { userID, name: `User_${userID.slice(-4)}` };
  }

  public async getThreadInfo(threadID: string): Promise<Partial<ShiPuThread>> {
    const api = this.session.getFcaApi();
    if (api && api.getThreadInfo) {
      return new Promise<Partial<ShiPuThread>>((resolve) => {
        try {
          api.getThreadInfo(threadID, (err: any, info: any) => {
            if (err) {
              messengerLogger.warn('FACEBOOK', `getThreadInfo GraphQL warning for ${threadID}: ${err.errorSummary || err.message || err}`);
              return resolve({ threadID, name: `Thread_${threadID}` });
            }
            if (info) {
              return resolve({
                threadID,
                name: info.threadName || info.name || `Thread_${threadID}`,
                participantIDs: (info.participantIDs || []).map((id: any) => id.toString()),
                adminIDs: (info.adminIDs || []).map((id: any) => (id.id || id).toString())
              });
            }
            resolve({ threadID, name: `Thread_${threadID}` });
          });
        } catch (e) {
          resolve({ threadID, name: `Thread_${threadID}` });
        }
      });
    }
    return { threadID, name: `Thread_${threadID}` };
  }

  public async getThreadList(): Promise<ShiPuThread[]> {
    const api = this.session.getFcaApi();
    if (!api || !api.getThreadList) {
      messengerLogger.warn('API', 'Cannot get thread list: FCA API not available or method missing');
      return [];
    }

    return new Promise<ShiPuThread[]>((resolve) => {
      api.getThreadList(0, 20, null, (err: any, list: any) => {
        if (err) {
          messengerLogger.error('API', `getThreadList failed: ${err.message || err}`);
          if (list && list.length > 0) {
            messengerLogger.info('API', 'Recovered threads despite error');
          } else {
            return resolve([]);
          }
        }
        
        if (list) {
          messengerLogger.info('API', `getThreadList returned ${list.length} threads`);
        } else {
          messengerLogger.warn('API', 'getThreadList returned no list');
        }
        
        const threads: ShiPuThread[] = (list || []).map((t: any) => ({
          threadID: t.threadID,
          name: t.threadName || t.name || `Thread_${t.threadID}`,
          participantIDs: (t.participantIDs || []).map((id: any) => id.toString()),
          snippet: t.snippet,
          timestamp: t.timestamp
        }));
        
        resolve(threads);
      });
    });
  }

  public async addUser(threadID: string, userID: string): Promise<void> {
    const api = this.session.getFcaApi();
    if (!api || !api.addUserToGroup) {
      messengerLogger.warn('GROUP', 'Cannot add user: FCA API not available');
      return;
    }

    return new Promise<void>((resolve, reject) => {
      api.addUserToGroup(userID, threadID, (err: any) => {
        if (err) {
          messengerLogger.error('GROUP', `addUserToGroup failed: ${err.message || err}`);
          return reject(err);
        }
        messengerLogger.success('GROUP', `User ${userID} added to thread ${threadID}`);
        resolve();
      });
    });
  }

  public async removeUser(threadID: string, userID: string): Promise<void> {
    const api = this.session.getFcaApi();
    if (!api || !api.removeUserFromGroup) {
      messengerLogger.warn('GROUP', 'Cannot remove user: FCA API not available');
      return;
    }

    return new Promise<void>((resolve, reject) => {
      api.removeUserFromGroup(userID, threadID, (err: any) => {
        if (err) {
          messengerLogger.error('GROUP', `removeUserFromGroup failed: ${err.message || err}`);
          return reject(err);
        }
        messengerLogger.success('GROUP', `User ${userID} removed from thread ${threadID}`);
        resolve();
      });
    });
  }
}
