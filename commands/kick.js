/**
 * @file kick.js
 * @description Advanced member removal system for ShiPu AI Messenger Bot Framework.
 * Optimized based on user-provided patterns.
 */

module.exports = {
  config: {
    name: 'kick',
    aliases: ['remove', 'out', 'banish'],
    version: '2.1.0',
    author: 'ShiPu AI Team',
    countDown: 5,
    role: 1, // Requires Admin
    category: 'moderation',
    description: 'Remove members from the group.',
    guide: '{pref}kick [@mention | reply]'
  },

  /**
   * Main entry point for prefixed commands (#kick @user)
   */
  onStart: async function (ctx) {
    const { message, event, args, threadsData, api, getLang } = ctx;
    const { threadID, senderID } = event;

    // 1. Bot Admin Check (Can I kick?)
    const adminIDs = await threadsData.get(threadID, "adminIDs") || [];
    const botID = api.getCurrentUserID();
    
    if (!adminIDs.includes(botID)) {
      return message.reply(getLang("needAdmin"));
    }

    // 2. Sender Permission Check
    const isSenderAdmin = adminIDs.includes(senderID);
    const isGlobalOwner = ctx.currentUser?.role >= 2;

    if (!isSenderAdmin && !isGlobalOwner) {
      return message.reply(getLang("notAdmin"));
    }

    // 3. Kick Execution Helper
    const kickAndCheckError = async (uid) => {
      try {
        if (uid === botID) return message.reply("⚠️ I cannot kick myself.");
        if (uid === senderID) return message.reply("⚠️ You cannot kick yourself.");
        
        // Check if target is admin (Bot owner can kick admins, others can't)
        if (adminIDs.includes(uid) && !isGlobalOwner) {
          return message.reply("🛡️ I cannot remove another administrator.");
        }

        await api.removeUserFromGroup(uid, threadID);
        return "SUCCESS";
      } catch (e) {
        console.error('[Kick] Execution Error:', e);
        message.reply(getLang("needAdmin"));
        return "ERROR";
      }
    };

    // 4. Target Detection
    if (!args[0]) {
      if (!event.messageReply) {
        if (typeof message.SyntaxError === 'function') return message.SyntaxError();
        return message.reply(`❌ Please reply to a message or mention someone. Usage: ${this.config.guide}`);
      }
      await kickAndCheckError(event.messageReply.senderID);
    } else {
      const uids = Object.keys(event.mentions || {});
      if (uids.length === 0) {
        // Try fallback to UID if provided in args
        const input = args[0];
        if (/^\d{10,20}$/.test(input)) {
           await kickAndCheckError(input);
           return;
        }
        if (typeof message.SyntaxError === 'function') return message.SyntaxError();
        return message.reply(`❌ Please mention users to kick.`);
      }

      for (const uid of uids) {
        const res = await kickAndCheckError(uid);
        if (res === "ERROR") break;
      }
    }
  },

  /**
   * Handle no-prefix messages (kick @user)
   */
  onChat: async function (ctx) {
    const { event, message } = ctx;
    if (event.type !== 'message' || !event.body) return;

    const body = event.body.toLowerCase().trim();
    const triggers = (this.config.aliases || []).concat(this.config.name);
    
    const matchedTrigger = triggers.find(t => body.startsWith(t));
    if (!matchedTrigger) return;

    const hasArgs = body.split(/\s+/).length > 1;
    const hasReply = !!event.messageReply;
    const hasMentions = Object.keys(event.mentions || {}).length > 0;

    if (hasArgs || hasReply || hasMentions) {
      // Re-parse args for onChat
      const fullArgs = event.body.trim().split(/\s+/);
      ctx.args = fullArgs.slice(1);
      return this.onStart(ctx);
    }
  }
};
