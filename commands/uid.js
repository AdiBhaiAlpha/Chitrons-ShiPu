module.exports = {
  config: {
    name: "uid",
    version: "1.0.0",
    author: "Chitron Bhattacharjee",
    countDown: 5,
    role: 0,
    shortDescription: {
      en: "Get User ID"
    },
    description: {
      en: "Get your Facebook User ID or target's ID by replying or tagging."
    },
    category: "utility",
    guide: {
      en: "{pn} or {pn} @tag"
    }
  },

  onStart: async function ({ message, event }) {
    if (Object.keys(event.mentions || {}).length > 0) {
      const mentions = Object.keys(event.mentions);
      let replyMsg = "";
      for (const id of mentions) {
        replyMsg += `${event.mentions[id].replace("@", "")}: ${id}\n`;
      }
      return message.reply(replyMsg.trim());
    }

    if (event.type === "message_reply") {
      return message.reply(event.messageReply.senderID);
    }

    return message.reply(event.senderID);
  }
};
