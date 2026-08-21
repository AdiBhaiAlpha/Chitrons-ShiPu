# SHIPU AI Bot Command Development Guideline
## For Human and AI Developers

This document defines the architectural blueprint, security standards, cache-safe practices, and integration models required to write commands for the SHIPU AI Messenger Bot Framework. 

All commands must be fully compatible with the **Live FTP Bi-Directional Hot-Reload Engine**, meaning they must support runtime unloading, automatic dependency injection, and complete memory cleanup without restarting the application.

---

## 1. Core Command Anatomy

Each command is written in JavaScript/TypeScript as an CommonJS module, conforming to the following structured schema:

```javascript
const axios = require("axios"); // Auto-detected & auto-installed at runtime
const fs = require("fs-extra");
const path = require("path");

const config = {
  name: "cmdname",            // String: Unique identifier (lowercase, no spaces)
  version: "1.0.0",           // String: Semantic versioning
  author: "Author Name",      // String: Developer handle
  countDown: 5,               // Number: Cool-down cooldown in seconds
  role: 0,                    // Number: 0 = User, 1 = Admin, 2 = Thread Admin, 3 = Owner
  category: "utility",        // String: Help organizer category
  shortDescription: {
    en: "Short description"   // Object: Multi-language short description
  },
  description: {
    en: "Detailed description"// Object: Multi-language detailed explanation
  },
  guide: {
    en: "{pn} <arguments>"    // Object: Guide on how to use ({pn} expands to prefix + name)
  }
};

/**
 * Main Command Handler
 * @param {Object} context
 * @param {Object} context.message - Wrapped wrapper for sending, replying, and unsending
 * @param {String[]} context.args - Parsed space-delimited command arguments
 * @param {Object} context.event - Raw chat event (senderID, threadID, type, attachments, replies)
 * @param {Object} context.api - Fca-unofficial bot API controller
 */
async function onStart({ message, args, event, api }) {
  try {
    // 1. Inputs validation
    const prompt = args.join(" ").trim();
    if (!prompt) {
      return message.reply("❌ Please provide a prompt.");
    }

    // 2. Process tasks asynchronously (Never block Node's Event Loop)
    const replyHandle = await message.reply("⏳ Processing your request...");

    // 3. Complete work and reply
    await message.reply({
      body: `Processed successfully.`,
      attachment: fs.createReadStream(someCacheFile)
    });

  } catch (err) {
    console.error(`[Command Name Error]:`, err.message);
    return message.reply(`❌ Operation failed: ${err.message}`);
  }
}

module.exports = {
  config,
  onStart
};
```

---

## 2. Dynamic Hot-Reload & Cache Clearing

The SHIPU AI Framework monitors command directories continuously within **1 second** using `chokidar`. When a command file is saved, modified, or renamed, the framework runs the following hot-reload pipeline:

```
[File Saved/FTP Upload] -> [Syntax Validation] -> [Dependency Scan & Install] -> [Unload Old Command] -> [Purge Cache] -> [Load New Module]
```

To enable flawless reloads, commands **MUST NOT** leave state side-effects in memory.

### 🚫 The "Leaky Command" Trap (Anti-Pattern)
Do **NOT** register global variables, event listeners, or start unmanaged intervals directly at the top level of your command:

```javascript
// ❌ WRONG: Survives hot-reloads and causes memory leaks & duplicate executions
const interval = setInterval(() => { doSync(); }, 1000);
api.on("message", (msg) => { ... });
```

### ✅ Clean Lifecycle Management
If your command requires event listeners or intervals, write a setup listener inside the loader, or ensure listeners are keyed by the command name so they can be unbound during the `unload` hook.

---

## 3. Strict Requiring and Module Caches

Whenever the synchronization engine unloads a command, it purges Node's `require.cache`. 
Any changes made inside `commands/*.js` files are instantly reflected on the next invocation. 

To ensure your helper files or external module edits update instantly as well, utilize deep cache-purging patterns:

```javascript
// Under the hood in FtpSyncEngine:
const fullPath = path.resolve(process.cwd(), relPath);
delete require.cache[require.resolve(fullPath)];
delete require.cache[fullPath];
```

---

## 4. Automatic On-the-Fly Package Installation

SHIPU AI scans files for `require("...")` and `import` declarations. If it detects a package not defined in `package.json`, it is automatically fetched and compiled **without server restarts**.

### Best Practices:
* Only import standard, reliable libraries (e.g., `axios`, `fs-extra`, `canvas`, `jimp`).
* Avoid relying on libraries requiring native build tools (`node-gyp`) at load-time, as they might fail on sandboxed server/VPS architectures.

---

## 5. Streams and File Descriptors Safety

Since commands often generate or download transient multimedia assets (images, audio, videos), proper stream closure is vital to avoid reaching file descriptor limits.

### Proper File Stream Cleanup:
```javascript
const filePath = path.join(__dirname, "cache", `temp_${Date.now()}.png`);
await fs.writeFile(filePath, dataBuffer);

// Send attachment
await message.reply({
  body: "Here is your file",
  attachment: fs.createReadStream(filePath)
});

// Always wrap deletes in asynchronous catch blocks and decouple from main loop
setTimeout(() => {
  fs.unlink(filePath).catch(() => {});
}, 15000); // 15s delay allows the platform to finish reading & uploading the stream
```

---

## 6. Mathematical Conflict Resolution (Heuristics)

The Bi-Directional Live Sync System resolves file content collisions between local files and remote FTP instances by analyzing modification times (`mtime`):

1. **Newest Version Wins:** If a remote FTP file has a modification timestamp greater than the local copy (+3 seconds skew allowance), it instantly overwrites the local copy and triggers a hot-reload.
2. **Local Priority:** If the local file has been saved or modified locally, it instantly updates the remote FTP instance.
3. **SHA-256 Fingerprinting:** File checksums are indexed. If content matches exactly, no upload or download is performed, saving bandwidth and system performance.
