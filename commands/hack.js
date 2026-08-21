const { loadImage, createCanvas } = require("canvas");
const fs = require("fs-extra");
const axios = require("axios");
const path = require("path");

module.exports = {
  config: {
    name: "hack",
    version: "1.0.0",
    author: "opu",
    countDown: 5,
    role: 0,
    category: "fun",
    description: "Facebook account hacking simulation (just for fun)",
    shortDescription: {
      en: "Just for fun",
    },
    guide: {
      en: "{pn} \nor {pn} [UID/mention/Message reply]",
    },
    packages: ["canvas", "fs-extra", "axios"]
  },

  wrapText: async (ctx, text, maxWidth) => {
    return new Promise((resolve) => {
      if (ctx.measureText(text).width < maxWidth) return resolve([text]);
      const words = text.split(" ");
      const lines = [];
      let line = "";
      while (words.length > 0) {
        if (ctx.measureText(`${line}${words[0]}`).width < maxWidth) {
          line += `${words.shift()} `;
        } else {
          lines.push(line.trim());
          line = "";
        }
      }
      if (line) lines.push(line.trim());
      resolve(lines);
    });
  },

  hackMessage: async function ({ api, event, name, message }) {
    try {
      const threadID = event?.threadID || event?.thread_fbid;
      const messageID = event?.messageID;

      let loadingMessage;
      if (api && typeof api.sendMessage === 'function') {
        loadingMessage = await api.sendMessage(
          `Hacking Facebook Password for ${name}, Please wait...`,
          threadID
        );
      } else if (message && typeof message.reply === 'function') {
        loadingMessage = await message.reply(
          `Hacking Facebook Password for ${name}, Please wait...`
        );
      }

      if (!loadingMessage || !loadingMessage.messageID) {
        if (api && typeof api.sendMessage === 'function') {
          return api.sendMessage(
            "❌ An error occurred while starting the process.",
            threadID,
            messageID
          );
        } else if (message && typeof message.reply === 'function') {
          return message.reply("❌ An error occurred while starting the process.");
        }
      }

      const loadingMessageID = loadingMessage.messageID;

      await new Promise(resolve => setTimeout(resolve, 3000));
      try {
        if (loadingMessageID && api && typeof api.editMessage === 'function') {
          await api.editMessage(
            `Successfully Cracked Facebook password for *${name}*`,
            loadingMessageID
          );
        } else if (api && typeof api.sendMessage === 'function') {
          await api.sendMessage(
            `Successfully Cracked Facebook password for *${name}*`,
            threadID
          );
        } else if (message && typeof message.reply === 'function') {
          await message.reply(`Successfully Cracked Facebook password for *${name}*`);
        }
      } catch (error) {
        if (api && typeof api.sendMessage === 'function') {
          await api.sendMessage(
            `Successfully Cracked Facebook password for *${name}*`,
            threadID
          );
        }
      }

      await new Promise(resolve => setTimeout(resolve, 3000));
      try {
        if (loadingMessageID && api && typeof api.editMessage === 'function') {
          await api.editMessage(
            `Login failed! 2FA is enabled on *${name}*'s account.`,
            loadingMessageID
          );
        } else if (api && typeof api.sendMessage === 'function') {
          await api.sendMessage(
            `Login failed! 2FA is enabled on *${name}*'s account.`,
            threadID
          );
        } else if (message && typeof message.reply === 'function') {
          await message.reply(`Login failed! 2FA is enabled on *${name}*'s account.`);
        }
      } catch (error) {
        if (api && typeof api.sendMessage === 'function') {
          await api.sendMessage(
            `Login failed! 2FA is enabled on *${name}*'s account.`,
            threadID
          );
        }
      }

      await new Promise(resolve => setTimeout(resolve, 3000));
      try {
        if (loadingMessageID && api && typeof api.editMessage === 'function') {
          await api.editMessage(
            `2FA Bypass Successful! Logged into *${name}*'s account.`,
            loadingMessageID
          );
        } else if (api && typeof api.sendMessage === 'function') {
          await api.sendMessage(
            `2FA Bypass Successful! Logged into *${name}*'s account.`,
            threadID
          );
        } else if (message && typeof message.reply === 'function') {
          await message.reply(`2FA Bypass Successful! Logged into *${name}*'s account.`);
        }
      } catch (error) {
        if (api && typeof api.sendMessage === 'function') {
          await api.sendMessage(
            `2FA Bypass Successful! Logged into ${name} account.`,
            threadID
          );
        }
      }

    } catch (error) {
      if (api && typeof api.sendMessage === 'function') {
        api.sendMessage(
          "❌ An error occurred during the hacking process. Please try again later.",
          event.threadID,
          event.messageID
        );
      } else if (message && typeof message.reply === 'function') {
        message.reply("❌ An error occurred during the hacking process. Please try again later.");
      }
    }
  },

  onStart: async function (ctx) {
    const { args = [], usersData, threadsData, api, event = {}, message, Users } = ctx;
    try {
      const cacheDir = path.join(__dirname, "cache");
      await fs.ensureDir(cacheDir);

      const timeStamp = Date.now();
      const pathImg = path.join(cacheDir, `background_${timeStamp}.png`);
      const pathAvt1 = path.join(cacheDir, `Avtmot_${timeStamp}.png`);

      let id = event.senderID || "10001";
      let targetName = "";

      if (event.messageReply) {
        id = event.messageReply.senderID || id;
        targetName = event.messageReply.senderName || event.messageReply.name || "";
      } else if (event.mentions && Object.keys(event.mentions).length > 0) {
        id = Object.keys(event.mentions)[0];
        const m = event.mentions[id];
        if (typeof m === "string") {
          targetName = m.replace(/^@/, "").trim();
        } else if (m && typeof m === "object") {
          targetName = (m.name || m.tag || "").replace(/^@/, "").trim();
        }
      } else if (args && args.length > 0) {
        const argText = args.join(" ").trim();
        if (/^\d+$/.test(argText)) {
          id = argText;
        } else {
          targetName = argText;
        }
      }

      let name = targetName;

      // Fetch real display name if targetName is missing or invalid
      if (!name || name === "Unknown User") {
        try {
          if (usersData && typeof usersData.getName === 'function') {
            const uName = await usersData.getName(id);
            if (uName) name = uName;
          }
          if (!name && usersData && typeof usersData.get === 'function') {
            const u = await usersData.get(id);
            if (u?.name) name = u.name;
          }
          if (!name && Users && typeof Users.getNameUser === 'function') {
            const uName = await Users.getNameUser(id);
            if (uName) name = uName;
          }
          if (!name && api && typeof api.getUserInfo === 'function') {
            const userInfo = await api.getUserInfo(id);
            if (userInfo && userInfo[id]?.name) {
              name = userInfo[id].name;
            } else if (userInfo && userInfo.name) {
              name = userInfo.name;
            }
          }
        } catch (error) {
          // ignore error
        }
      }

      // Check event sender name fallback
      if ((!name || name === "Unknown User") && (id === event.senderID || !id)) {
        if (event.senderName) name = event.senderName;
        else if (event.name) name = event.name;
        else if (event.user?.name) name = event.user.name;
      }

      // Ensure name is never a raw UID or user_xxxxxxx format
      if (!name || name === "Unknown User" || /^user_\d+$/i.test(name) || /^\d+$/.test(name)) {
        if (targetName && !/^\d+$/.test(targetName)) {
          name = targetName;
        } else {
          name = "Facebook User";
        }
      }

      await this.hackMessage({ api, event, name, message });

      const backgroundImageURL = "https://i.ibb.co/DCLzrQQ/VQXViKI.png";
      let avatarData, backgroundData;
      try {
        let avatarUrl = `https://graph.facebook.com/${id}/picture?width=720&height=720&access_token=6628568379%7Cc1e620fa708a1d5696fb991c1bde5662`;
        try {
          const avatarRes = await axios.get(avatarUrl, { responseType: "arraybuffer", timeout: 15000 });
          avatarData = avatarRes.data;
        } catch (avtErr) {
          avatarUrl = `https://api.dicebear.com/7.x/bottts/png?seed=${id}`;
          const avatarRes = await axios.get(avatarUrl, { responseType: "arraybuffer", timeout: 15000 });
          avatarData = avatarRes.data;
        }

        try {
          const bgRes = await axios.get(backgroundImageURL, { responseType: "arraybuffer", timeout: 15000 });
          backgroundData = bgRes.data;
        } catch (bgErr) {
          const bgCanvas = createCanvas(1200, 630);
          const bgCtx = bgCanvas.getContext("2d");
          bgCtx.fillStyle = "#1e1e2e";
          bgCtx.fillRect(0, 0, 1200, 630);
          backgroundData = bgCanvas.toBuffer("image/png");
        }

        await fs.writeFile(pathAvt1, Buffer.from(avatarData));
        await fs.writeFile(pathImg, Buffer.from(backgroundData));
      } catch (error) {
        const errorMsg = "❌ Unable to generate the hacking image. Please try again.";
        if (api && typeof api.sendMessage === 'function') {
          return api.sendMessage(errorMsg, event.threadID, event.messageID);
        } else if (message && typeof message.reply === 'function') {
          return message.reply(errorMsg);
        }
      }

      const baseImage = await loadImage(pathImg);
      const baseAvt1 = await loadImage(pathAvt1);
      const canvas = createCanvas(baseImage.width, baseImage.height);
      const ctxCanvas = canvas.getContext("2d");

      ctxCanvas.drawImage(baseImage, 0, 0, canvas.width, canvas.height);
      ctxCanvas.drawImage(baseAvt1, 83, 437, 100, 101);

      ctxCanvas.font = "400 23px Arial, sans-serif";
      ctxCanvas.fillStyle = "#1878F3";
      ctxCanvas.textAlign = "start";
      const lines = await this.wrapText(ctxCanvas, name, 1160);
      ctxCanvas.fillText(lines.join("\n"), 200, 497);

      const imageBuffer = canvas.toBuffer("image/png");
      await fs.writeFile(pathImg, imageBuffer);
      await fs.remove(pathAvt1).catch(() => {});

      const responseMsg = {
        body: `Successfully hacked ${name}\nPlease check your inbox to get Number and Password`,
        attachment: fs.createReadStream(pathImg),
      };

      if (api && typeof api.sendMessage === 'function') {
        return api.sendMessage(
          responseMsg,
          event.threadID,
          () => {
            setTimeout(() => {
              fs.remove(pathImg).catch(() => {});
            }, 5000);
          },
          event.messageID
        );
      } else if (message && typeof message.reply === 'function') {
        await message.reply(responseMsg);
        setTimeout(() => {
          fs.remove(pathImg).catch(() => {});
        }, 5000);
      }
    } catch (error) {
      console.error("[Hack Command Error]:", error);
      const errMsg = "An error occurred while processing. Please try again later.";
      if (api && typeof api.sendMessage === 'function') {
        api.sendMessage(errMsg, event.threadID, event.messageID);
      } else if (message && typeof message.reply === 'function') {
        message.reply(errMsg);
      }
    }
  },
};
