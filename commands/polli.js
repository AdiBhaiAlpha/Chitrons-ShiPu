const axios = require("axios");
const fs = require("fs-extra");
const path = require("path");

module.exports = {
  config: {
    name: "polli",
    version: "1.0.0",
    author: "Chitron Bhattacharjee",
    countDown: 5,
    role: 0,
    shortDescription: {
      en: "Generate AI image"
    },
    description: {
      en: "Generate AI images using Pollinations Flux"
    },
    category: "ai",
    guide: {
      en: "{pn} <prompt>"
    }
  },

  onStart: async function ({ message, args }) {
    const prompt = args.join(" ").trim();

    if (!prompt)
      return message.reply(
        "❌ | Please provide a prompt.\n\nExample:\n#polli cute anime girl in rain"
      );

    let loading;

    try {
      loading = await message.reply(
        "⏳ | Generating your AI image...\nPlease wait a moment."
      );

      const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(
        prompt
      )}?model=flux`;

      const response = await axios({
        method: "GET",
        url,
        responseType: "arraybuffer",
        timeout: 180000,
        headers: {
          "User-Agent": "ShiPuAI"
        }
      });

      const cacheDir = path.join(__dirname, "cache");
      await fs.ensureDir(cacheDir);

      const filePath = path.join(
        cacheDir,
        `polli_${Date.now()}.png`
      );

      await fs.writeFile(filePath, response.data);

      if (loading?.messageID) {
        try {
          message.unsend(loading.messageID);
        } catch {}
      }

      await message.reply({
        body:
`✦━━━━━━━━━━━━━━━━━━✦
        𝗣𝗢𝗟𝗟𝗜𝗡𝗔𝗧𝗜𝗢𝗡𝗦 𝗔𝗜
✦━━━━━━━━━━━━━━━━━━✦

▸ 𝗠𝗼𝗱𝗲𝗹  : FLUX
▸ 𝗣𝗿𝗼𝗺𝗽𝘁 : ${prompt}

✓ Image generated successfully.

✦━━━━━━━━━━━━━━━━━━✦`,
        attachment: fs.createReadStream(filePath)
      });

      fs.unlink(filePath).catch(() => {});

    } catch (err) {
      console.error(err);

      if (loading?.messageID) {
        try {
          message.unsend(loading.messageID);
        } catch {}
      }

      return message.reply(
        "❌ | Failed to generate image.\nPlease try again later."
      );
    }
  }
};
