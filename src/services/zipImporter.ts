import fs from 'fs';
import path from 'path';
import AdmZip from 'adm-zip';
import { commandsData, StoredCommandData } from '../db/database';
import { botEngine } from '../core/botEngine';
import { ShiPuCommandConfig } from '../types/shipu';
import { dependencyManager, DependencyAuditReport } from './dependencyManager';

export interface CommandAuditRecord {
  commandName: string;
  sourceFile: string;
  originalFeatures: string[];
  requiredShipuApi: string[];
  dependencies: string[];
  status: 'READY' | 'CONVERTED_WITH_ADAPTER' | 'REQUIRES_DEPENDENCY' | 'REQUIRES_EXTERNAL_API' | 'INCOMPATIBLE' | 'FAILED_CONVERSION';
  notes: string;
  convertedCode: string;
  config: ShiPuCommandConfig;
}

export interface ZipImportReport {
  totalJsFilesFound: number;
  totalCommandFiles: number;
  successfullyConverted: number;
  convertedWithAdapter: number;
  importedIntoDatabase: number;
  updatedExistingCommands: number;
  skipped: number;
  failed: number;
  auditTable: CommandAuditRecord[];
  filesCreated: string[];
  filesModified: string[];
  dependenciesAdded: string[];
  databaseCollectionsChanged: string[];
  commandsRequiringManualAttention: string[];
  dependencyAudit?: DependencyAuditReport;
  dependenciesAlreadyInstalled?: string[];
  skippedBuiltins?: string[];
  invalidDependencies?: string[];
  commandDependencyMap?: Record<string, string[]>;
}

export class ZipImporterService {
  private static instance: ZipImporterService;
  private lastReport: ZipImportReport | null = null;

  public static getInstance(): ZipImporterService {
    if (!ZipImporterService.instance) {
      ZipImporterService.instance = new ZipImporterService();
    }
    return ZipImporterService.instance;
  }

  public getLastReport(): ZipImportReport | null {
    return this.lastReport;
  }

  /**
   * Main entry to scan, audit, convert, seed and reload plugins from a ZIP source or disk
   */
  public async importZip(zipInput?: string | Buffer): Promise<ZipImportReport> {
    const report: ZipImportReport = {
      totalJsFilesFound: 0,
      totalCommandFiles: 0,
      successfullyConverted: 0,
      convertedWithAdapter: 0,
      importedIntoDatabase: 0,
      updatedExistingCommands: 0,
      skipped: 0,
      failed: 0,
      auditTable: [],
      filesCreated: [],
      filesModified: [],
      dependenciesAdded: [],
      databaseCollectionsChanged: ['StoredCommandModel'],
      commandsRequiringManualAttention: []
    };

    let zip: AdmZip | null = null;
    let tempDir = '';

    try {
      if (typeof zipInput === 'string' && fs.existsSync(zipInput)) {
        zip = new AdmZip(zipInput);
      } else if (Buffer.isBuffer(zipInput)) {
        zip = new AdmZip(zipInput);
      } else {
        // Search default locations for scripts.zip
        const possibleLocations = [
          path.join(process.cwd(), 'scripts.zip'),
          path.join(process.cwd(), 'assets', 'scripts.zip'),
          '/tmp/scripts.zip',
          '/app/applet/scripts.zip',
          '/scripts.zip'
        ];

        for (const loc of possibleLocations) {
          if (fs.existsSync(loc)) {
            zip = new AdmZip(loc);
            break;
          }
        }
      }

      if (!zip) {
        // If no zip file found on disk, perform directory scan or report standby
        const scriptsDir = path.join(process.cwd(), 'scripts');
        if (fs.existsSync(scriptsDir)) {
          return await this.importFromDirectory(scriptsDir, report);
        }

        return {
          ...report,
          notes: 'No scripts.zip file found. Importer ready to accept zip uploads via API or Admin Dashboard.'
        } as any;
      }

      // Extract zip to temporary directory
      tempDir = path.join(process.cwd(), 'tmp_extracted_scripts_' + Date.now());
      zip.extractAllTo(tempDir, true);
      report.filesCreated.push(tempDir);

      return await this.importFromDirectory(tempDir, report);
    } catch (err: any) {
      console.error('[ZipImporter] Error during zip processing:', err);
      report.failed++;
      return report;
    } finally {
      if (tempDir && fs.existsSync(tempDir)) {
        try {
          fs.rmSync(tempDir, { recursive: true, force: true });
        } catch {}
      }
      this.lastReport = report;
    }
  }

  /**
   * Process extracted directory recursively
   */
  private async importFromDirectory(dirPath: string, report: ZipImportReport): Promise<ZipImportReport> {
    const allFiles = this.getFilesRecursively(dirPath);
    const jsFiles = allFiles.filter(f => f.endsWith('.js'));
    const jsonFiles = allFiles.filter(f => f.endsWith('.json') && !f.endsWith('package.json'));

    report.totalJsFilesFound = jsFiles.length;

    // 1. Inspect package.json inside ZIP if present
    let zipPkgDeps: Record<string, string> = {};
    const zipPkgPath = path.join(dirPath, 'package.json');
    if (fs.existsSync(zipPkgPath)) {
      try {
        const zipPkgData = JSON.parse(fs.readFileSync(zipPkgPath, 'utf8'));
        zipPkgDeps = { ...zipPkgData.dependencies, ...zipPkgData.devDependencies };
      } catch (err: any) {
        console.warn('[ZipImporter] Could not parse package.json inside ZIP:', err.message);
      }
    }

    // 2. Intelligent Dependency Analysis & Smart Merge
    const depAudit = await dependencyManager.analyzeAndMergeZipDependencies(dirPath, zipPkgDeps);
    report.dependencyAudit = depAudit;
    report.dependenciesAdded = depAudit.newlyAdded;
    report.dependenciesAlreadyInstalled = depAudit.alreadyInstalled;
    report.skippedBuiltins = depAudit.skippedBuiltins;
    report.invalidDependencies = depAudit.invalidOrMissingNpm;
    report.commandDependencyMap = depAudit.commandDependencyMap;

    // Save helper JSON files to assets/data if needed
    const assetsDataDir = path.join(process.cwd(), 'assets', 'data');
    if (!fs.existsSync(assetsDataDir)) {
      fs.mkdirSync(assetsDataDir, { recursive: true });
    }

    for (const jsonPath of jsonFiles) {
      try {
        const relativeName = path.basename(jsonPath);
        const targetPath = path.join(assetsDataDir, relativeName);
        fs.copyFileSync(jsonPath, targetPath);
        report.filesCreated.push(`assets/data/${relativeName}`);
      } catch {}
    }

    const pkgPath = path.join(process.cwd(), 'package.json');
    let pkgContent: any = {};
    try {
      pkgContent = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    } catch {}
    const existingDeps = { ...pkgContent.dependencies, ...pkgContent.devDependencies };

    const existingCommands = await commandsData.getAll();
    const existingMap = new Map<string, StoredCommandData>(existingCommands.map(c => [c.name.toLowerCase(), c]));

    for (const file of jsFiles) {
      const content = fs.readFileSync(file, 'utf8');
      const filename = path.basename(file);

      // Audit and convert
      const auditResult = this.auditAndConvertFile(filename, content, existingDeps);
      report.totalCommandFiles++;
      report.auditTable.push(auditResult);

      if (auditResult.dependencies.length > 0) {
        for (const dep of auditResult.dependencies) {
          if (!report.dependenciesAdded.includes(dep)) {
            report.dependenciesAdded.push(dep);
          }
        }
      }

      if (auditResult.status === 'READY' || auditResult.status === 'CONVERTED_WITH_ADAPTER') {
        if (auditResult.status === 'CONVERTED_WITH_ADAPTER') {
          report.convertedWithAdapter++;
        } else {
          report.successfullyConverted++;
        }

        const cmdName = auditResult.config.name.toLowerCase().trim();
        const storedCmdData: StoredCommandData = {
          name: cmdName,
          filename: `${cmdName}.js`,
          description: auditResult.config.description || 'Imported Facebook Messenger Command',
          category: auditResult.config.category || 'Custom',
          role: auditResult.config.role || 0,
          aliases: auditResult.config.aliases || [],
          guide: auditResult.config.guide || `{pref}${cmdName}`,
          countDown: auditResult.config.countDown || 2,
          enabled: auditResult.config.enabled !== false,
          author: auditResult.config.author || 'Imported Module',
          version: auditResult.config.version || '1.0.0',
          code: auditResult.convertedCode,
          updatedAt: new Date().toISOString()
        };

        const existing = existingMap.get(cmdName);
        if (existing) {
          report.updatedExistingCommands++;
        } else {
          report.importedIntoDatabase++;
        }

        await commandsData.set(cmdName, storedCmdData);
      } else {
        if (auditResult.status === 'FAILED_CONVERSION' || auditResult.status === 'INCOMPATIBLE') {
          report.failed++;
          report.commandsRequiringManualAttention.push(`${filename}: ${auditResult.notes}`);
        } else {
          report.skipped++;
        }
      }
    }

    // Reload active plugins into BotEngine
    await botEngine.reloadPluginsFromDatabase();

    return report;
  }

  /**
   * Recursive file scanner
   */
  private getFilesRecursively(dir: string): string[] {
    let results: string[] = [];
    const list = fs.readdirSync(dir);
    list.forEach(file => {
      const fullPath = path.join(dir, file);
      const stat = fs.statSync(fullPath);
      if (stat && stat.isDirectory()) {
        results = results.concat(this.getFilesRecursively(fullPath));
      } else {
        results.push(fullPath);
      }
    });
    return results;
  }

  /**
   * Audit individual command file and convert to ShiPu format
   */
  public auditAndConvertFile(filename: string, code: string, existingDeps: Record<string, string>): CommandAuditRecord {
    const originalFeatures: string[] = [];
    const requiredShipuApi: string[] = [];
    const dependencies: string[] = [];
    let notes = 'Clean conversion to ShiPu Ai architecture';
    let status: CommandAuditRecord['status'] = 'READY';

    // 1. Detect dependencies
    const requireMatches = code.match(/require\(['"]([^'"]+)['"]\)/g) || [];
    const importMatches = code.match(/import\s+.*?\s+from\s+['"]([^'"]+)['"]/g) || [];

    const extractedPkgs = new Set<string>();
    [...requireMatches, ...importMatches].forEach(m => {
      const pkg = m.replace(/.*['"]([^'"]+)['"].*/, '$1');
      if (pkg && !pkg.startsWith('.') && !pkg.startsWith('/') && !['fs', 'path', 'crypto', 'os', 'http', 'https', 'stream', 'util', 'child_process'].includes(pkg)) {
        extractedPkgs.add(pkg);
        if (!existingDeps[pkg]) {
          dependencies.push(pkg);
        }
      }
    });

    // 2. Extract metadata (Mirai/FCA module.exports.config or GoatBot/ShiPu module.exports)
    let name = path.basename(filename, '.js').toLowerCase();
    let aliases: string[] = [];
    let version = '1.0.0';
    let author = 'Imported Module';
    let role = 0;
    let category = 'Custom';
    let description = '';
    let guide = '';
    let countDown = 2;

    // Regex matchers for config block
    const nameMatch = code.match(/name\s*:\s*["']([^"']+)["']/i);
    if (nameMatch) name = nameMatch[1].toLowerCase().trim();

    const aliasesMatch = code.match(/aliases\s*:\s*\[([^\]]+)\]/i);
    if (aliasesMatch) {
      aliases = aliasesMatch[1].split(',').map(s => s.replace(/["'\s]/g, '')).filter(Boolean);
    }

    const versionMatch = code.match(/version\s*:\s*["']([^"']+)["']/i);
    if (versionMatch) version = versionMatch[1];

    const authorMatch = code.match(/(?:credits|author)\s*:\s*["']([^"']+)["']/i);
    if (authorMatch) author = authorMatch[1];

    const roleMatch = code.match(/(?:hasPermssion|role)\s*:\s*(\d+)/i);
    if (roleMatch) {
      const r = parseInt(roleMatch[1], 10);
      role = r > 3 ? 3 : r;
    }

    const categoryMatch = code.match(/(?:commandCategory|category)\s*:\s*["']([^"']+)["']/i);
    if (categoryMatch) category = categoryMatch[1];

    const descMatch = code.match(/description\s*:\s*["']([^"']+)["']/i);
    if (descMatch) description = descMatch[1];

    const usagesMatch = code.match(/(?:usages|guide)\s*:\s*["']([^"']+)["']/i);
    if (usagesMatch) guide = usagesMatch[1];

    const cooldownMatch = code.match(/(?:cooldowns|countDown|cooldown)\s*:\s*(\d+)/i);
    if (cooldownMatch) countDown = parseInt(cooldownMatch[1], 10);

    // 3. Feature detection
    if (code.includes('api.sendMessage')) {
      originalFeatures.push('api.sendMessage');
      requiredShipuApi.push('message.send / message.reply');
    }
    if (code.includes('api.setMessageReaction')) {
      originalFeatures.push('api.setMessageReaction');
      requiredShipuApi.push('message.react');
    }
    if (code.includes('api.markAsRead')) {
      originalFeatures.push('api.markAsRead');
      requiredShipuApi.push('MessengerAdapter.markAsRead');
    }
    if (code.includes('api.sendTypingIndicator')) {
      originalFeatures.push('api.sendTypingIndicator');
      requiredShipuApi.push('MessengerAdapter.sendTypingIndicator');
    }
    if (code.includes('handleReply') || code.includes('onReply')) {
      originalFeatures.push('Reply Handler');
      requiredShipuApi.push('ShiPu onReply');
    }
    if (code.includes('handleReaction') || code.includes('onReaction')) {
      originalFeatures.push('Reaction Handler');
      requiredShipuApi.push('ShiPu onReaction');
    }
    if (code.includes('handleEvent') || code.includes('onChat') || code.includes('onEvent')) {
      originalFeatures.push('Passive Chat Listener');
      requiredShipuApi.push('ShiPu onChat / onEvent');
    }

    // Determine adapter requirement
    const isMiraiFcaFormat = code.includes('module.exports.run') || code.includes('module.exports.config');
    if (isMiraiFcaFormat) {
      status = 'CONVERTED_WITH_ADAPTER';
      notes = 'Converted FCA/Mirai module.exports structure with ShiPu Compatibility Adapter';
    }

    if (dependencies.length > 0) {
      notes += `. Requires npm packages: ${dependencies.join(', ')}`;
    }

    // 4. Generate Clean Executable ShiPu Code Body
    let convertedCode = '';

    if (isMiraiFcaFormat) {
      // Build compatibility adapter wrapper
      convertedCode = `// ShiPu Ai v2.5 Converted Command: ${name}.js
// Source Format: FCA / Mirai Compatible

// --- SHIPU COMPATIBILITY ADAPTER LAYER ---
const prefix = (typeof currentThread !== 'undefined' && currentThread?.prefix) ? currentThread.prefix : (typeof api !== 'undefined' && api.getBotConfig ? api.getBotConfig().globalPrefix : '#');

// Polyfill FCA api object using ShiPu MessengerAdapter
const fcaApi = {
  sendMessage: async (msg, threadID, cb, msgID) => {
    try {
      const text = typeof msg === 'string' ? msg : (msg?.body || '');
      const attachments = msg?.attachment ? [msg.attachment] : undefined;
      const res = await message.send(text, threadID || event.threadID);
      if (typeof cb === 'function') cb(null, res);
      return res;
    } catch (err) {
      if (typeof cb === 'function') cb(err);
      throw err;
    }
  },
  setMessageReaction: async (emoji, messageID, cb) => {
    try {
      await message.react(emoji);
      if (typeof cb === 'function') cb(null);
    } catch (err) {
      if (typeof cb === 'function') cb(err);
    }
  },
  markAsRead: async (threadID) => {},
  sendTypingIndicator: async (threadID) => {},
  getUserInfo: async (userID, cb) => {
    const user = usersData.get(userID);
    const res = { [userID]: { name: user?.name || "User_" + userID } };
    if (typeof cb === 'function') cb(null, res);
    return res;
  },
  getThreadInfo: async (threadID, cb) => {
    const thread = threadsData.get(threadID);
    const res = { threadName: thread?.name || "Thread_" + threadID };
    if (typeof cb === 'function') cb(null, res);
    return res;
  }
};

// Polyfill Mirai Currencies & Data Handlers
const Currencies = {
  getData: async (uID) => usersData.get(uID || currentUser.userID),
  setData: async (uID, data) => usersData.set(uID || currentUser.userID, data),
  increaseMoney: async (uID, amount) => usersData.increment(uID || currentUser.userID, 'money', amount),
  decreaseMoney: async (uID, amount) => usersData.increment(uID || currentUser.userID, 'money', -amount)
};

const Users = {
  getData: async (uID) => usersData.get(uID || currentUser.userID),
  setData: async (uID, data) => usersData.set(uID || currentUser.userID, data),
  getNameUser: async (uID) => (usersData.get(uID || currentUser.userID))?.name || "User_" + uID
};

const Threads = {
  getData: async (tID) => threadsData.get(tID || currentThread.threadID),
  setData: async (tID, data) => threadsData.set(tID || currentThread.threadID, data)
};

// Execute Legacy Run Handler safely
${code}

if (typeof module !== 'undefined' && module.exports && typeof module.exports.run === 'function') {
  await module.exports.run({ api: fcaApi, event, args, Users, Threads, Currencies });
} else if (typeof module !== 'undefined' && module.exports && typeof module.exports.onStart === 'function') {
  await module.exports.onStart(ctx);
}`;
    } else {
      // Direct JS or ShiPu format
      convertedCode = `// ShiPu Ai Converted Command: ${name}.js
${code.includes('await') || code.includes('message.reply') ? code : `
// Native execution body
if (typeof onStart === 'function') {
  await onStart(ctx);
} else {
  ${code}
}`}`;
    }

    const config: ShiPuCommandConfig = {
      name,
      aliases,
      version,
      author,
      role: role as any,
      category: (category as any) || 'Custom',
      description: description || `Messenger Bot Command (${name})`,
      guide: guide || `{pref}${name}`,
      countDown,
      enabled: true
    };

    return {
      commandName: name,
      sourceFile: filename,
      originalFeatures,
      requiredShipuApi,
      dependencies,
      status,
      notes,
      convertedCode,
      config
    };
  }
}

export const zipImporterService = ZipImporterService.getInstance();
