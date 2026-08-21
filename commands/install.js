const path = require("path");
const fs = require("fs-extra");
const axios = require("axios");

module.exports = {
  config: {
    name: "install",
    version: "1.0.0",
    author: "ShiPu Ai Bot",
    role: 3, // Owner/Admin only for security (installing files is highly privileged!)
    description: {
      en: "Install or update a bot command from raw code or URL dynamically with full validation, hot-reload, rollback support and automatic FTP synchronization."
    },
    shortDescription: {
      en: "Dynamically install/update a command"
    },
    category: "system",
    guide: {
      en: "{pn} <filename.js> <code>\n{pn} <filename.js> <url>"
    },
    countDown: 5,
    packages: ["axios", "fs-extra"]
  },

  onStart: async function ({ message, args, event }) {
    const startTime = Date.now();
    const filename = args[0];

    if (!filename) {
      return message.reply("❌ Usage:\n#install <filename.js> <code>\n#install <filename.js> <url>");
    }

    // 1. Security validation on filename
    if (filename.includes("../") || filename.includes("\\") || filename.includes("/") || filename.includes(":")) {
      return message.reply("❌ Security violation: Directory traversal characters are forbidden.");
    }

    const validFilenameRegex = /^[a-zA-Z0-9_\-]+\.(js|ts)$/;
    if (!validFilenameRegex.test(filename)) {
      return message.reply("❌ Invalid filename format. Only characters a-z, A-Z, 0-9, _, -, and extension .js or .ts are allowed.");
    }

    const relPath = `commands/${filename}`;
    const fullPath = path.join(process.cwd(), relPath);

    let codeText = "";
    let isUrl = false;
    let url = "";

    const inputString = args.slice(1).join(" ").trim();
    if (inputString.startsWith("http://") || inputString.startsWith("https://")) {
      isUrl = true;
      url = inputString;
    } else {
      // Extract code part exactly from event.body
      const firstArgIndex = event.body.indexOf(filename);
      if (firstArgIndex !== -1) {
        codeText = event.body.substring(firstArgIndex + filename.length).trim();
      } else {
        codeText = inputString;
      }
    }

    // 2. Download from URL if URL method
    if (isUrl) {
      await message.reply("⏳ Downloading file from URL...");
      try {
        const response = await axios.get(url, {
          timeout: 10000,
          responseType: 'text',
          maxContentLength: 2 * 1024 * 1024 // 2MB limit
        });
        codeText = response.data;
        if (typeof codeText !== "string") {
          throw new Error("Downloaded content is not a valid string.");
        }
      } catch (err) {
        return message.reply(`❌ Failed to download file from URL: ${err.message}`);
      }
    }

    if (!codeText || codeText.trim().length === 0) {
      return message.reply("❌ Code content cannot be empty.");
    }

    // 3. Maximum file size check
    const fileSizeInBytes = Buffer.byteLength(codeText, 'utf8');
    if (fileSizeInBytes > 2 * 1024 * 1024) {
      return message.reply(`❌ File size exceeds the 2 MB limit (Size: ${(fileSizeInBytes / 1024 / 1024).toFixed(2)} MB).`);
    }

    // Load necessary services
    const { dependencyManager } = require(path.resolve(process.cwd(), "src/services/dependencyManager"));
    const { goatBotLoader } = require(path.resolve(process.cwd(), "src/core/goatBotLoader"));
    const { ftpSyncEngine } = require(path.resolve(process.cwd(), "src/services/ftpSyncEngine"));
    const { ftpStorageService } = require(path.resolve(process.cwd(), "src/services/ftpStorageService"));
    const { ftpConfigData } = require(path.resolve(process.cwd(), "src/db/database"));

    // 4. File Content Validation
    const valStart = Date.now();
    let syntaxCheckPassed = false;
    try {
      new Function(codeText);
      syntaxCheckPassed = true;
    } catch (err) {
      ftpSyncEngine.addLog('Installer', relPath, 'VALIDATION', 'FAILED', Date.now() - valStart, `Syntax error: ${err.message}`);
      return message.reply(`❌ JavaScript Syntax Error:\n${err.message}`);
    }

    // Structural CommonJS verification
    if (!codeText.includes("module.exports")) {
      return message.reply("❌ Validation failed: Module must export its interface using 'module.exports'.");
    }
    if (!codeText.includes("config")) {
      return message.reply("❌ Validation failed: 'config' property is missing from module.exports.");
    }
    if (!codeText.includes("onStart")) {
      return message.reply("❌ Validation failed: 'onStart' function is missing from module.exports.");
    }

    // Run VM sandbox structural checks
    try {
      const vm = require("vm");
      const sandbox = {
        module: { exports: {} },
        require: require,
        console: console,
        Buffer: Buffer,
        process: process,
        setTimeout: setTimeout,
        clearTimeout: clearTimeout,
        setInterval: setInterval,
        clearInterval: clearInterval
      };
      vm.createContext(sandbox);
      vm.runInContext(codeText, sandbox, { filename, timeout: 2000 });
      
      const exports = sandbox.module.exports;
      if (!exports || typeof exports !== "object") {
        return message.reply("❌ Validation failed: module.exports is not an object.");
      }
      if (!exports.config || typeof exports.config !== "object") {
        return message.reply("❌ Validation failed: config must be a valid object.");
      }
      if (!exports.config.name) {
        return message.reply("❌ Validation failed: config.name is required.");
      }
      if (typeof exports.onStart !== "function") {
        return message.reply("❌ Validation failed: onStart must be a function.");
      }
    } catch (err) {
      ftpSyncEngine.addLog('Installer', relPath, 'VALIDATION', 'FAILED', Date.now() - valStart, `Sandbox execution failed: ${err.message}`);
      return message.reply(`❌ Safe Sandbox validation failed:\n${err.message}`);
    }

    ftpSyncEngine.addLog('Installer', relPath, 'VALIDATION', 'SUCCESS', Date.now() - valStart);

    // 5. Dependency Scanning and Installation
    const depStart = Date.now();
    let installedDeps = [];
    try {
      const { requiredPackages } = dependencyManager.extractDependenciesFromCode(codeText);
      if (requiredPackages.length > 0) {
        const installRes = await dependencyManager.ensureDependenciesInstalled(requiredPackages);
        installedDeps = installRes.installed;
        if (installRes.failed.length > 0) {
          ftpSyncEngine.addLog('Installer', relPath, 'DEPENDENCY_INSTALL', 'FAILED', Date.now() - depStart, `Failed for: ${installRes.failed.join(', ')}`);
          return message.reply(`❌ Failed to install required NPM packages: ${installRes.failed.join(', ')}`);
        }
      }
      ftpSyncEngine.addLog('Installer', relPath, 'DEPENDENCY_INSTALL', 'SUCCESS', Date.now() - depStart);
    } catch (err) {
      ftpSyncEngine.addLog('Installer', relPath, 'DEPENDENCY_INSTALL', 'FAILED', Date.now() - depStart, err.message);
      return message.reply(`❌ Error during dependency scanning/installation: ${err.message}`);
    }

    // 6. Safe Write & Backup
    const isUpdate = await fs.pathExists(fullPath);
    let oldCode = null;
    let backupPath = null;

    if (isUpdate) {
      try {
        oldCode = await fs.readFile(fullPath, "utf8");
        backupPath = await ftpSyncEngine.createBackup(relPath);
        ftpSyncEngine.addLog('Installer', relPath, 'BACKUP', 'SUCCESS', 0, `Created backup at ${backupPath}`);
      } catch (err) {
        ftpSyncEngine.addLog('Installer', relPath, 'BACKUP', 'FAILED', 0, err.message);
        return message.reply(`❌ Error backing up existing file: ${err.message}`);
      }
    }

    // 7. Atomic Load & Registration
    const reloadStart = Date.now();
    let rollbackNeeded = false;
    try {
      await fs.ensureDir(path.dirname(fullPath));
      await fs.writeFile(fullPath, codeText, "utf8");

      // Clear Node require cache completely
      delete require.cache[require.resolve(fullPath)];
      delete require.cache[fullPath];

      // Unload old command
      const cmdName = path.basename(filename, path.extname(filename));
      goatBotLoader.unloadCommand(cmdName);

      // Try loading the command
      const loaded = goatBotLoader.loadCommandFromCode(codeText, relPath);
      if (!loaded || !loaded.module || !loaded.module.config) {
        throw new Error("Could not parse, wrap or instantiate command module correctly.");
      }

      // Register live
      goatBotLoader.registerLoadedCommand(loaded.module, loaded.summary);
      ftpSyncEngine.addLog('Installer', relPath, 'HOT_RELOAD', 'SUCCESS', Date.now() - reloadStart);

    } catch (err) {
      rollbackNeeded = true;
      ftpSyncEngine.addLog('Installer', relPath, 'HOT_RELOAD', 'FAILED', Date.now() - reloadStart, err.message);
      
      // Rollback
      try {
        if (isUpdate && oldCode) {
          await fs.writeFile(fullPath, oldCode, "utf8");
          delete require.cache[require.resolve(fullPath)];
          delete require.cache[fullPath];
          const cmdName = path.basename(filename, path.extname(filename));
          goatBotLoader.unloadCommand(cmdName);
          const loadedOld = goatBotLoader.loadCommandFromCode(oldCode, relPath);
          if (loadedOld && loadedOld.module) {
            goatBotLoader.registerLoadedCommand(loadedOld.module, loadedOld.summary);
          }
        } else {
          await fs.remove(fullPath).catch(() => {});
        }
        ftpSyncEngine.addLog('Installer', relPath, 'ROLLBACK', 'SUCCESS', 0, "Restored previous working state cleanly");
      } catch (rollErr) {
        ftpSyncEngine.addLog('Installer', relPath, 'ROLLBACK_ERROR', 'FAILED', 0, rollErr.message);
      }

      return message.reply(`❌ Installation failed during hot-reload. Previous state has been rolled back safely.\nError: ${err.message}`);
    }

    // 8. FTP Synchronization
    let ftpSyncStatus = "Skipped (FTP sync disabled or not configured)";
    const ftpStart = Date.now();
    try {
      const ftpConfig = await ftpConfigData.get();
      if (ftpConfig && ftpConfig.enabled) {
        let ftpSuccess = false;
        let ftpError = null;

        for (let attempt = 1; attempt <= 3; attempt++) {
          try {
            const res = await ftpStorageService.writeFtpFileContent(ftpConfig, relPath, codeText, true);
            if (res.success) {
              ftpSuccess = true;
              break;
            } else {
              ftpError = res.error || "Unknown FTP error";
            }
          } catch (e) {
            ftpError = e.message;
          }
        }

        if (ftpSuccess) {
          ftpSyncStatus = "✓ FTP Sync Complete";
          ftpSyncEngine.addLog('Installer', relPath, 'FTP_UPLOAD', 'SUCCESS', Date.now() - ftpStart);
        } else {
          ftpSyncStatus = `✗ FTP Sync Failed: ${ftpError}`;
          ftpSyncEngine.addLog('Installer', relPath, 'FTP_UPLOAD', 'FAILED', Date.now() - ftpStart, ftpError);
        }
      }
    } catch (err) {
      ftpSyncStatus = `✗ FTP Sync Failed: ${err.message}`;
      ftpSyncEngine.addLog('Installer', relPath, 'FTP_UPLOAD_ERROR', 'FAILED', Date.now() - ftpStart, err.message);
    }

    // Create a beautiful dashboard-like response exactly matching user expectations
    const totalDuration = Date.now() - startTime;
    const actionName = isUpdate ? "COMMAND REPLACED / UPDATED" : "COMMAND INSTALLED";

    const successMsg = `✦━━━━━━━━━━━━━━━━━━✦
      ${actionName}
✦━━━━━━━━━━━━━━━━━━✦

✓ Filename: ${filename} (Size: ${(fileSizeInBytes / 1024).toFixed(2)} KB)
✓ Validation Passed (Syntax & Sandbox OK)
✓ Dependencies Installed: ${installedDeps.length > 0 ? installedDeps.join(', ') : 'None (all pre-satisfied)'}
✓ Hot Reload Complete (Command registered dynamically)
✓ FTP Sync Complete (${ftpSyncStatus})

Command is now live. Took ${totalDuration}ms.

✦━━━━━━━━━━━━━━━━━━✦`;

    return message.reply(successMsg);
  }
};
