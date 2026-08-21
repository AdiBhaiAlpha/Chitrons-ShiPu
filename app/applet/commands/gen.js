const axios = require("axios");
const fs = require("fs-extra");
const path = require("path");

const config = {
  name: "gen",
  category: "ai",
  role: 0,
  author: "Chitron Bhattacharjee",
  description: "Generate images from multiple AI models"
};

const MODELS = [
  "Spit-fires/flux-schnell",
  "Catniti/agnes-image-2.1-flash",
  "Catniti/qwen-image-3.0-pro",
  "vendouple/seedream-5-lite",
  "tomdacatto/nano-banana-2"
];

const API_BASE = "https://image.pollinations.ai/prompt/";
const API_KEY = "sk_wSYUQloVOJl8N2rnDoj4oyzr8tu6qDAG";
const TEMP_DIR = path.join(__dirname, "..", "..", "temp_images");
const MESSENGER_LIMIT = 10;

async function ensureTempDir() {
  await fs.ensureDir(TEMP_DIR);
}

function encodePrompt(prompt) {
  return encodeURIComponent(prompt);
}

async function downloadImage(model, prompt, index) {
  try {
    const url = `${API_BASE}${encodePrompt(prompt)}?model=${encodeURIComponent(model)}&key=${API_KEY}`;
    
    const response = await axios({
      method: "get",
      url,
      responseType: "stream",
      timeout: 60000,
      headers: {
        "User-Agent": "GoatBot v2"
      }
    });

    const filename = path.join(TEMP_DIR, `${index}_${model.replace(/\//g, "_")}.png`);
    
    return new Promise((resolve, reject) => {
      const writeStream = fs.createWriteStream(filename);
      
      response.data.pipe(writeStream);
      
      writeStream.on("finish", () => {
        resolve({ model, filename, success: true });
      });
      
      writeStream.on("error", (err) => {
        reject({ model, error: err.message, success: false });
      });
      
      response.data.on("error", (err) => {
        reject({ model, error: err.message, success: false });
      });
    });
  } catch (error) {
    return {
      model,
      error: error.message || "Unknown error",
      success: false
    };
  }
}

async function generateAllImages(prompt) {
  const promises = MODELS.map((model, index) =>
    downloadImage(model, prompt, index)
  );

  const results = await Promise.allSettled(promises);
  
  const successful = results
    .filter(r => r.status === "fulfilled" && r.value.success)
    .map(r => r.value);
  
  return successful;
}

async function splitAttachments(attachments) {
  const batches = [];
  
  for (let i = 0; i < attachments.length; i += MESSENGER_LIMIT) {
    batches.push(attachments.slice(i, i + MESSENGER_LIMIT));
  }
  
  return batches;
}

async function cleanupImages(filenames) {
  for (const filename of filenames) {
    try {
      await fs.remove(filename);
    } catch (error) {
      console.error(`Failed to delete ${filename}:`, error.message);
    }
  }
}

async function onStart({ event, api, Threads, Users, utils }) {
  const { threadID, senderID, body } = event;
  
  const prompt = body.substring(3).trim();
  
  if (!prompt) {
    return api.sendMessage(
      "Please provide a prompt. Usage: gen [prompt]",
      threadID
    );
  }

  const loadingMsg = await api.sendMessage(
    "🎨 Generating images from 5 models...",
    threadID
  );

  try {
    await ensureTempDir();
    
    const images = await generateAllImages(prompt);
    
    if (images.length === 0) {
      await api.editMessage(
        "❌ All models failed. Please try again.",
        loadingMsg.messageID
      );
      return;
    }

    const attachments = images.map(img => ({
      attachment: fs.createReadStream(img.filename)
    }));

    const batches = await splitAttachments(attachments);
    
    const filesToCleanup = images.map(img => img.filename);

    for (let i = 0; i < batches.length; i++) {
      if (i === 0) {
        await api.editMessage(
          {
            body: `✅ Generated ${images.length}/${MODELS.length} images`,
            attachment: batches[i].map(a => a.attachment)
          },
          loadingMsg.messageID
        );
      } else {
        await api.sendMessage(
          {
            body: `Images ${i * MESSENGER_LIMIT + 1}-${Math.min((i + 1) * MESSENGER_LIMIT, images.length)}`,
            attachment: batches[i].map(a => a.attachment)
          },
          threadID
        );
      }
    }

    await cleanupImages(filesToCleanup);

  } catch (error) {
    await api.editMessage(
      `❌ Error: ${error.message || "Unknown error"}`,
      loadingMsg.messageID
    );
    try {
      const files = await fs.readdir(TEMP_DIR);
      const fullPaths = files.map(f => path.join(TEMP_DIR, f));
      await cleanupImages(fullPaths);
    } catch {}
  }
}

module.exports = {
  config,
  onStart
};
