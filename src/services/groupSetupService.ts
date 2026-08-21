import { threadsData } from '../db/database';
import { botEngine } from '../core/botEngine';
import { messengerLogger, MessengerLogger } from '../adapters/messenger/MessengerLogger';
import { recordBotMessageId } from '../utils/commandParser';

export class GroupSetupService {
  private static instance: GroupSetupService;
  private initializingThreads = new Set<string>();
  private dedupCache = new Map<string, number>();

  private constructor() {
    // Periodically clean up old deduplication cache entries
    setInterval(() => {
      const now = Date.now();
      for (const [key, expiresAt] of this.dedupCache.entries()) {
        if (now > expiresAt) {
          this.dedupCache.delete(key);
        }
      }
    }, 30000);
  }

  public static getInstance(): GroupSetupService {
    if (!GroupSetupService.instance) {
      GroupSetupService.instance = new GroupSetupService();
    }
    return GroupSetupService.instance;
  }

  /**
   * Main entrypoint for incoming FCA events related to threads
   */
  public async handleGroupEvent(api: any, event: any, botUserID: string): Promise<void> {
    if (!event || event.type !== 'event') return;

    const threadID = String(event.threadID || event.thread_fbid || '');
    if (!threadID) return;

    const logMessageType = String(event.logMessageType || '');

    if (logMessageType === 'log:subscribe') {
      await this.handleSubscribeEvent(api, event, threadID, botUserID);
    } else if (logMessageType === 'log:unsubscribe') {
      await this.handleUnsubscribeEvent(event, threadID, botUserID);
    }
  }

  /**
   * Handles member/bot additions to a thread
   */
  private async handleSubscribeEvent(api: any, event: any, threadID: string, botUserID: string): Promise<void> {
    const rawParticipants = event.logMessageData?.addedParticipants || [];
    const addedParticipants = Array.isArray(rawParticipants) ? rawParticipants : [];

    // Extract added UIDs
    const addedUids = addedParticipants.map((p: any) => String(p.userFbId || p.userID || p.id || '')).filter(Boolean);

    const cleanBotUid = String(botUserID || '').trim();
    const isBotAdded = (cleanBotUid && addedUids.includes(cleanBotUid)) || 
                       (addedParticipants.length === 0 && String(event.author || '') === cleanBotUid);

    if (isBotAdded) {
      // Bot itself joined/rejoined the group
      await this.initializeNewGroup(api, threadID, cleanBotUid);

      // If other users were added alongside the bot in the same subscribe event
      const otherMembers = addedParticipants.filter((p: any) => {
        const uid = String(p.userFbId || p.userID || p.id || '');
        return uid !== cleanBotUid;
      });

      if (otherMembers.length > 0) {
        await this.welcomeMembers(api, threadID, otherMembers);
      }
    } else if (addedParticipants.length > 0) {
      // Normal member(s) joined
      await this.welcomeMembers(api, threadID, addedParticipants);
    }
  }

  /**
   * Handles bot removal or member departure
   */
  private async handleUnsubscribeEvent(event: any, threadID: string, botUserID: string): Promise<void> {
    const leftUid = String(event.logMessageData?.leftParticipantFbId || event.author || '').trim();
    const cleanBotUid = String(botUserID || '').trim();

    if (cleanBotUid && leftUid === cleanBotUid) {
      messengerLogger.info('GROUP', `Bot removed from thread ${MessengerLogger.maskUid(threadID)}`);
      await threadsData.update(threadID, { botPresent: false });
    }
  }

  /**
   * Initializes a newly joined group thread
   */
  public async initializeNewGroup(api: any, threadID: string, botUserID: string): Promise<void> {
    if (this.initializingThreads.has(threadID)) {
      return;
    }

    this.initializingThreads.add(threadID);

    try {
      // Check existing thread record in DB
      const existingThread = await threadsData.get(threadID);
      
      // Idempotency check: If already initialized and bot is present, avoid duplicate connection messages
      if (existingThread && existingThread.initializedAt && existingThread.botPresent && existingThread.connectionMessageSent) {
        messengerLogger.info('GROUP', `Thread ${MessengerLogger.maskUid(threadID)} is already initialized. Skipping connection message.`);
        this.initializingThreads.delete(threadID);
        return;
      }

      messengerLogger.info('GROUP', 'New group detected');
      messengerLogger.info('GROUP', `Thread ID: ${MessengerLogger.maskUid(threadID)}`);

      // Attempt to fetch group name from FCA
      let groupName = existingThread?.name || 'Messenger Group';
      try {
        if (api && typeof api.getThreadInfo === 'function') {
          const info = await new Promise<any>((resolve) => {
            api.getThreadInfo(threadID, (err: any, res: any) => resolve(err ? null : res));
          });
          if (info && (info.threadName || info.name)) {
            groupName = info.threadName || info.name;
          }
        }
      } catch {
        groupName = existingThread?.name || 'এই Messenger Group';
      }

      messengerLogger.info('GROUP', `Group name: ${groupName}`);

      // Step 1: Update bot's nickname in the thread to "ShiPu Ai🤖"
      let nicknameUpdated = false;
      messengerLogger.info('IDENTITY', 'Setting bot nickname to "ShiPu Ai🤖"');

      if (api && typeof api.changeNickname === 'function' && botUserID) {
        try {
          const nicknameRes = await new Promise<boolean>((resolve) => {
            api.changeNickname('ShiPu Ai🤖', threadID, botUserID, (err: any) => {
              if (err) resolve(false);
              else resolve(true);
            });
          });
          nicknameUpdated = nicknameRes;
          if (nicknameUpdated) {
            messengerLogger.success('GROUP', 'Bot nickname updated successfully');
          } else {
            messengerLogger.warn('IDENTITY', 'Could not update nickname via FCA API');
          }
        } catch (err: any) {
          messengerLogger.warn('IDENTITY', `Nickname update error: ${err?.message || err}`);
        }
      }

      // Step 2: Build & send the Bangla Group Connected Message
      const prefix = existingThread?.prefix || botEngine.getBotConfig().globalPrefix || '#';

      const connectedMessageText = 
`━━━━━━━━━━━━━━━━━━
ShiPu Ai🤖
Messenger Assistant
━━━━━━━━━━━━━━━━━━

হ্যালো সবাই!

আমি এখন এই গ্রুপের সঙ্গে সফলভাবে connected।
এই গ্রুপে এখন থেকে ShiPu Ai-এর বিভিন্ন command ব্যবহার করা যাবে।

⚙️ Prefix: ${prefix}

📌 ব্যবহার:
${prefix}help
${prefix}command
${prefix}info

💡 কোনো command সম্পর্কে জানতে:
${prefix}help <command>

🤖 Bot: ShiPu Ai
🔧 Engine: ShiPu Ai v2.5

━━━━━━━━━━━━━━━━━━
Created & Maintained by
চিত্রণ ভট্টাচার্য আদি
Facebook: facebook.com/ssfadi
WhatsApp: wa.me/+8801316655254

© ShiPu Ai — All rights reserved.
━━━━━━━━━━━━━━━━━━`;

      messengerLogger.info('GROUP', 'Sending connection message...');

      let messageSent = false;
      if (api && typeof api.sendMessage === 'function') {
        try {
          messageSent = await new Promise<boolean>((resolve) => {
            api.sendMessage(connectedMessageText, threadID, (err: any, info: any) => {
              if (err) {
                // Retry once
                api.sendMessage(connectedMessageText, threadID, (err2: any, info2: any) => {
                  if (!err2 && (info2?.messageID || info2?.mid)) recordBotMessageId(info2.messageID || info2.mid);
                  resolve(!err2);
                });
              } else {
                if (info?.messageID || info?.mid) recordBotMessageId(info.messageID || info.mid);
                resolve(true);
              }
            });
          });
        } catch (err: any) {
          messengerLogger.warn('GROUP', `Failed to send connection message: ${err?.message || err}`);
        }
      }

      if (messageSent) {
        messengerLogger.success('GROUP', 'Connection message sent');
        messengerLogger.success('GROUP', 'Group initialization completed');
      }

      // Step 3: Persist state in MongoDB
      const now = Date.now();
      await threadsData.set(threadID, {
        threadID,
        name: groupName,
        prefix,
        language: existingThread?.language || 'bn',
        timezone: existingThread?.timezone || 'Asia/Dhaka',
        members: existingThread?.members || [],
        adminIDs: existingThread?.adminIDs || [],
        autoWelcome: existingThread?.autoWelcome ?? true,
        welcomeMessage: existingThread?.welcomeMessage || 'Welcome to the group!',
        goodbyeMessage: existingThread?.goodbyeMessage || 'Goodbye!',
        antiSpam: existingThread?.antiSpam ?? true,
        antiLink: existingThread?.antiLink ?? false,
        aiEnabled: existingThread?.aiEnabled ?? true,
        economyEnabled: existingThread?.economyEnabled ?? true,
        isBanned: existingThread?.isBanned ?? false,
        createdAt: existingThread?.createdAt || now,
        initializedAt: now,
        connectionMessageSent: messageSent,
        nicknameUpdated,
        botPresent: true,
        botNickname: 'ShiPu Ai🤖'
      });

      // Synchronize botEngine memory
      botEngine.getOrCreateThread(threadID);

    } catch (err: any) {
      messengerLogger.error('GROUP', `Group setup error: ${err?.message || err}`);
    } finally {
      this.initializingThreads.delete(threadID);
    }
  }

  /**
   * Welcomes new members who joined the thread
   */
  public async welcomeMembers(api: any, threadID: string, participants: any[]): Promise<void> {
    if (!participants || participants.length === 0) return;

    // Fetch thread DB record
    const threadRecord = await threadsData.get(threadID);
    if (threadRecord && threadRecord.autoWelcome === false) {
      return; // Disabled by admin setting
    }

    // Extract valid UIDs
    const memberDetails = participants.map((p: any) => {
      const uid = String(p.userFbId || p.userID || p.id || '').trim();
      const name = p.fullName || p.name || `User_${uid.slice(-4)}`;
      return { uid, name };
    }).filter(p => p.uid.length > 0);

    if (memberDetails.length === 0) return;

    // Deduplication key with 60-second TTL
    const sortedUids = memberDetails.map(m => m.uid).sort().join('_');
    const dedupKey = `welcome_${threadID}_${sortedUids}`;
    if (this.dedupCache.has(dedupKey)) {
      return;
    }
    this.dedupCache.set(dedupKey, Date.now() + 60000);

    messengerLogger.info('GROUP', 'Member join event received');
    messengerLogger.info('GROUP', `Thread: ${MessengerLogger.maskUid(threadID)}`);

    const groupName = threadRecord?.name || 'এই Messenger Group';
    messengerLogger.info('GROUP', `Group: ${groupName}`);

    for (const member of memberDetails) {
      messengerLogger.info('GROUP', `New member UID: ${MessengerLogger.maskUid(member.uid)}`);
    }

    const prefix = threadRecord?.prefix || botEngine.getBotConfig().globalPrefix || '#';

    // Build tagged mentions array for FCA
    const mentions = memberDetails.map(m => ({
      tag: `@${m.name}`,
      id: m.uid
    }));

    const mentionsText = mentions.map(m => m.tag).join(', ');

    messengerLogger.info('GROUP', 'Creating mention...');
    messengerLogger.info('GROUP', 'Welcome message prepared');

    const welcomeText = 
`╭━━━━━━━━━━━━━━━━━━╮
🌸 স্বাগতম!
╰━━━━━━━━━━━━━━━━━━╯

এই যে ${mentionsText}! আপনাকে স্বাগতম
“${groupName}” গ্রুপে। 💙

আপনার আগমনে আমাদের আড্ডাটা
আরও একটু জমে উঠুক!

আমি এই গ্রুপের ছোট্ট
AI assistant — ShiPu Ai🤖

প্রয়োজনে আমাকে ব্যবহার করতে পারেন।

⚙️ Prefix: ${prefix}

📚 Command list দেখতে:
${prefix}help

কোনো command সম্পর্কে জানতে:
${prefix}help <command>

আশা করি আমাদের সঙ্গে আপনার
সময়টা সুন্দর কাটবে। 🌿

━━━━━━━━━━━━━━━━━━
🤖 ShiPu Ai — Created by চিত্রণ ভট্টাচার্য আদি
━━━━━━━━━━━━━━━━━━`;

    if (api && typeof api.sendMessage === 'function') {
      try {
        const payload = {
          body: welcomeText,
          mentions
        };

        api.sendMessage(payload, threadID, (err: any, info: any) => {
          if (!err) {
            if (info?.messageID || info?.mid) recordBotMessageId(info.messageID || info.mid);
            messengerLogger.success('GROUP', 'Welcome message sent');
          } else {
            // Fallback plain string if object message fails
            api.sendMessage(welcomeText, threadID, (err2: any, info2: any) => {
              if (!err2) {
                if (info2?.messageID || info2?.mid) recordBotMessageId(info2.messageID || info2.mid);
                messengerLogger.success('GROUP', 'Welcome message sent (text fallback)');
              } else {
                messengerLogger.warn('GROUP', `Failed to send welcome message: ${err2?.message || err2}`);
              }
            });
          }
        });
      } catch (err: any) {
        messengerLogger.warn('GROUP', `Error executing welcome message send: ${err?.message || err}`);
      }
    }
  }
}

export const groupSetupService = GroupSetupService.getInstance();
