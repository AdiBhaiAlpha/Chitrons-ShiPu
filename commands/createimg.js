const axios = require("axios");
const fs = require("fs-extra");
const path = require("path");

const config = {
  name: "createimg",
  category: "ai",
  role: 0,
  author: "Chitron Bhattacharjee",
  description: "Generate images from dual AI APIs with fallback support"
};

// ===== API Definitions =====
const APIs = [
  {
    name: "Remote Config",
    getUrl: async () => {
      const base = await axios.get(
        "https://raw.githubusercontent.com/mahmudx7/exe/main/baseApiUrl.json",
        { timeout: 5000 }
      );
      return base.data.mahmud;
    }
  },
  {
    name: "Pollinations",
    getUrl: async () => "https://gen.pollinations.ai/image/"
  }
];

const TEMP_DIR = path.join(__dirname, "cache");

// ===== Download one image using a specific API =====
async function downloadImage(prompt, index, apiConfig) {
  try {
    console.log(`[CREATEIMG] Image ${index + 1} - Using ${apiConfig.name}`);
    const baseUrl = await apiConfig.getUrl();
    console.log(`[CREATEIMG] Base URL: ${baseUrl}`);

    let response;

    if (apiConfig.name === "Remote Config") {
      // POST method for custom API
      console.log(`[CREATEIMG] Using POST method for Remote Config`);
      response = await axios.post(
        `${baseUrl}/api/poli/generate`,
        { prompt },
        {
          responseType: "arraybuffer",
          timeout: 120000,
          headers: {
            "author": "ShiPuAI",
            "Content-Type": "application/json"
          }
        }
      );
    } else if (apiConfig.name === "Pollinations") {
      // GET method – NO Authorization header (just User‑Agent)
      console.log(`[CREATEIMG] Using GET method for Pollinations (no auth header)`);
      response = await axios.get(
        `${baseUrl}${encodeURIComponent(prompt)}?model=flux`,
        {
          responseType: "arraybuffer",
          timeout: 120000,
          headers: { "User-Agent": "ShiPuAI" }
        }
      );
    }

    // Check for non‑200 status
    if (response.status !== 200) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const contentType = response.headers["content-type"] || "image/png";
    console.log(`[CREATEIMG] Content-Type: ${contentType}`);

    if (!contentType.includes("image")) {
      throw new Error(`Invalid content type: ${contentType}. Expected image/*`);
    }

    let ext = ".png";
    if (contentType.includes("jpeg")) ext = ".jpg";
    else if (contentType.includes("webp")) ext = ".webp";
    else if (contentType.includes("gif")) ext = ".gif";

    const filename = path.join(TEMP_DIR, `generated_${Date.now()}_${index}${ext}`);
    fs.writeFileSync(filename, response.data);

    const stats = fs.statSync(filename);
    console.log(`[CREATEIMG] File saved: ${filename} (${stats.size} bytes, ext: ${ext})`);

    if (stats.size === 0) {
      throw new Error("File saved but size is 0 bytes");
    }

    return {
      filename,
      success: true,
      api: apiConfig.name,
      size: stats.size
    };
  } catch (error) {
    console.error(`[CREATEIMG] Image ${index + 1} failed with ${apiConfig.name}: ${error.message}`);
    console.error(`[CREATEIMG] Error details:`, error);
    return {
      error: error.message,
      success: false,
      api: apiConfig.name
    };
  }
}

// ===== Generate all images with multiple style variations and fallback =====
async function generateAllImages(prompt) {
  const styles = [
    "ultra detailed",
    "4k resolution",
    "realistic lighting",
    "artstation",
    "digital painting"
  ];

  const results = [];

  for (let i = 0; i < styles.length; i++) {
    const enhancedPrompt = `${prompt}, ${styles[i]}`;
    let success = false;

    // Try each API in order until one succeeds
    for (const apiConfig of APIs) {
      if (success) break;
      const result = await downloadImage(enhancedPrompt, i, apiConfig);
      if (result.success) {
        results.push(result);
        success = true;
      }
    }
  }

  console.log(`[CREATEIMG] Total generated: ${results.length}/${styles.length} images`);
  return results;
}

// ===== Main command handler =====
async function onStart({ message, args, event, api }) {
  const prompt = args.join(' ').trim();
  console.log(`[CREATEIMG] Command started. Prompt: "${prompt}"`);

  if (!prompt) {
    console.log("[CREATEIMG] No prompt provided");
    await message.reply(
      "❌ Error: No prompt provided\n\n" +
      "Usage: createimg <your prompt>\n" +
      "Example: createimg cute anime girl in rain"
    );
    return;
  }

  try {
    console.log("[CREATEIMG] Sending loading message");
    await message.reply(
      "🎨 Processing your image generation request...\n" +
      "⏳ Generating images (this may take up to 2 minutes)"
    );

    // Ensure temp directory exists
    if (!fs.existsSync(TEMP_DIR)) {
      fs.mkdirSync(TEMP_DIR, { recursive: true });
    }

    console.log("[CREATEIMG] Starting image generation with dual API support");
    const images = await generateAllImages(prompt);
    console.log(`[CREATEIMG] Generated ${images.length} successful images`);

    if (images.length === 0) {
      console.log("[CREATEIMG] No images generated");
      await message.reply(
        "❌ Image generation failed. Please try again with a different prompt."
      );
      return;
    }

    // Verify all files exist and have size > 0
    const validImages = [];
    for (const img of images) {
      const exists = fs.existsSync(img.filename);
      const size = exists ? fs.statSync(img.filename).size : 0;
      console.log(`[CREATEIMG] File: ${img.filename} | Exists: ${exists} | Size: ${size} bytes`);
      if (exists && size > 0) {
        validImages.push(img);
      }
    }

    if (validImages.length === 0) {
      console.error("[CREATEIMG] No valid images to send");
      await message.reply("❌ Generated images but files are invalid.");
      return;
    }

    // Create readable streams for all valid images
    const attachments = [];
    for (const img of validImages) {
      const stream = fs.createReadStream(img.filename);
      attachments.push(stream);
      console.log(`[CREATEIMG] Created stream for: ${img.filename}`);
    }

    // Log the stream array for debugging
    console.log("[CREATEIMG] Stream array:", attachments);

    // Send the images
    console.log(`[CREATEIMG] Sending ${attachments.length} images via api.sendMessage`);
    await new Promise((resolve, reject) => {
      api.sendMessage(
        {
          body: `✅ Successfully generated ${validImages.length} images\n\nPrompt: "${prompt}"`,
          attachment: attachments
        },
        event.threadID,
        (err) => {
          console.log("[CREATEIMG] sendMessage callback triggered");
          if (err) {
            // Stringify error to get full details
            console.error(`[CREATEIMG] Send error (stringified):`, JSON.stringify(err, null, 2));
            reject(err);
          } else {
            console.log("[CREATEIMG] Images sent successfully");
            resolve();
          }
        }
      );
    });

    console.log("[CREATEIMG] Send promise resolved, closing streams");

    // Destroy all streams
    for (const stream of attachments) {
      try {
        stream.destroy();
        console.log("[CREATEIMG] Stream destroyed");
      } catch (streamErr) {
        console.error("[CREATEIMG] Error destroying stream:", streamErr.message);
      }
    }

    // Wait 10 seconds before cleaning up (Messenger needs time to upload)
    console.log("[CREATEIMG] Waiting 10 seconds before cleanup...");
    await new Promise(resolve => setTimeout(resolve, 10000));

    // Delete temporary files
    console.log("[CREATEIMG] Cleaning up temp files");
    for (const img of validImages) {
      try {
        if (fs.existsSync(img.filename)) {
          fs.unlinkSync(img.filename);
          console.log(`[CREATEIMG] Deleted: ${img.filename}`);
        }
      } catch (delErr) {
        console.error(`[CREATEIMG] Failed to delete ${img.filename}:`, delErr.message);
      }
    }
    console.log("[CREATEIMG] Cleanup complete");

  } catch (error) {
    console.error(`[CREATEIMG] Main error: ${error.message}`);
    console.error(`[CREATEIMG] Stack: ${error.stack}`);
    await message.reply(`❌ An error occurred\n\nError: ${error.message}`);

    // Cleanup any leftover files
    try {
      const files = fs.readdirSync(TEMP_DIR);
      for (const file of files) {
        fs.unlinkSync(path.join(TEMP_DIR, file));
      }
    } catch (cleanErr) {
      console.error("[CREATEIMG] Cleanup error:", cleanErr.message);
    }
  }
}

module.exports = {
  config,
  onStart
};
