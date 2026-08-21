module.exports = {
  config: {
    name: "request",
    version: "2.0.0",
    author: "ShiPu Ai Team",
    role: 0,
    description: "Request or verify Shared Bot Access based on Official Access Group memberships",
    category: "system",
    guide: "{pref}request",
    countDown: 3,
    aliases: ["req", "access", "shared"],
    packages: []
  },

  onStart: async function ({ api, event, args, message, currentThread }) {
    const senderID = event.senderID || event.senderId || event.author;
    const threadID = event.threadID || event.thread_fbid;
    const prefix = currentThread?.prefix || "#";

    try {
      const sharedAccessService = globalThis.sharedAccessService || global.sharedAccessService || (() => {
        try {
          const mod = require("../src/services/sharedAccessService");
          return mod.sharedAccessService || mod.default || mod;
        } catch {
          return null;
        }
      })();

      if (!sharedAccessService || typeof sharedAccessService.verifyUserMembership !== 'function') {
        return message.reply(`❌ Error verifying shared access: sharedAccessService is not available.`);
      }

      const status = await sharedAccessService.verifyUserMembership(senderID, undefined, api);

      if (status.hasAccess) {
        await sharedAccessService.registerAuthorizedGroup(senderID, threadID);

        return message.reply(
          `অভিনন্দন! আপনার সমস্ত Official Access Group-এর সদস্যপদ যাচাই সম্পন্ন হয়েছে। আপনার Shared Bot Access সফলভাবে সক্রিয় করা হয়েছে। এখন থেকে আপনি যেকোনো গ্রুপে ShiPu Ai যুক্ত করতে এবং ব্যবহার করতে পারবেন। ধন্যবাদ!`
        );
      } else {
        const officialGroups = await sharedAccessService.getOfficialGroups();
        const missingGroups = officialGroups.filter(g => status.missingGroupIDs.includes(g.threadID));

        let msg = `দুঃখিত! আপনার Shared Bot Access সক্রিয় করতে নিচের Official Access Group(গুলি)-এ সদস্য হওয়া বাধ্যতামূলক (${status.totalJoinedCount}/${status.totalRequiredCount} Joined):\n\n`;
        
        for (const g of missingGroups) {
          msg += `📌 ${g.threadName}\n🔗 Link: ${g.inviteLink || 'লিংক উপলব্ধ নেই'}\n\n`;
        }

        msg += `অনুগ্রহ করে উপরের গ্রুপগুলিতে যুক্ত হয়ে আবার ${prefix}request কমান্ড দিন। সব গ্রুপে যুক্ত হওয়ার সাথে সাথেই আপনার এক্সেস স্বয়ংক্রিয়ভাবে রিস্টোর হয়ে যাবে!`;

        return message.reply(msg);
      }
    } catch (err) {
      return message.reply(`❌ Error verifying shared access: ${err.message || err}`);
    }
  }
};
