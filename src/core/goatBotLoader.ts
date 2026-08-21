import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
import { ShiPuCommandModule, UserRole } from '../types/shipu';
import { dependencyManager } from '../services/dependencyManager';

const nativeRequire = typeof require !== 'undefined'
  ? require
  : createRequire(typeof __filename !== 'undefined' ? __filename : path.join(process.cwd(), 'index.js'));

export function customRequire(moduleName: string): any {
  const normalized = moduleName.toLowerCase().trim();

  if (normalized === 'canvas' || normalized === '@napi-rs/canvas') {
    try {
      return nativeRequire('@napi-rs/canvas');
    } catch {
      try {
        return nativeRequire('canvas');
      } catch {
        // Try auto installing if missing
        try {
          dependencyManager.ensurePackagesInstalledSync(['@napi-rs/canvas']);
          return nativeRequire('@napi-rs/canvas');
        } catch {
          return createFallbackCanvas();
        }
      }
    }
  }

  if (normalized === 'fs-extra') {
    try {
      return nativeRequire('fs-extra');
    } catch {
      return fs;
    }
  }

  if (normalized === 'axios') {
    try {
      return nativeRequire('axios');
    } catch {
      try {
        dependencyManager.ensurePackagesInstalledSync(['axios']);
        return nativeRequire('axios');
      } catch {
        // return fallback
      }
    }
  }

  if (normalized === 'discord-image-generation' || normalized === 'dig') {
    try {
      return nativeRequire('discord-image-generation');
    } catch {
      return createFallbackDIG();
    }
  }

  try {
    return nativeRequire(moduleName);
  } catch (err: any) {
    if (!moduleName.startsWith('.') && !moduleName.startsWith('/') && !dependencyManager.isNodeBuiltin(moduleName)) {
      if (!dependencyManager.isFailedInstall(moduleName)) {
        console.log(`[customRequire] Missing package "${moduleName}" requested at runtime. Auto-installing...`);
        try {
          const { installed } = dependencyManager.ensurePackagesInstalledSync([moduleName]);
          if (installed.length > 0) {
            return nativeRequire(moduleName);
          }
        } catch (installErr: any) {
          console.warn(`[customRequire] Auto-install failed for "${moduleName}":`, installErr.message);
        }
      }
    }
    console.warn(`[customRequire] Warning: Module "${moduleName}" could not be required:`, err.message);
    return {};
  }
}

function createFallbackDIG(): any {
  const handler = {
    get: (_target: any, prop: string) => {
      return class DIGEffect {
        async getImage(): Promise<Buffer> {
          try {
            const { createCanvas } = nativeRequire('@napi-rs/canvas');
            const canvas = createCanvas(500, 500);
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = '#1e1e2e';
            ctx.fillRect(0, 0, 500, 500);
            ctx.fillStyle = '#ffffff';
            ctx.font = '24px sans-serif';
            ctx.fillText(`[DIG ${prop}] Image Generated`, 50, 250);
            return canvas.toBuffer('image/png');
          } catch {
            return Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
          }
        }
      };
    }
  };
  return new Proxy({}, handler);
}

function createFallbackCanvas(): any {
  return {
    createCanvas: (w: number, h: number) => ({
      width: w,
      height: h,
      getContext: () => ({
        fillRect: () => { },
        clearRect: () => { },
        strokeRect: () => { },
        fillText: () => { },
        measureText: () => ({ width: 100 }),
        drawImage: () => { },
        beginPath: () => { },
        closePath: () => { },
        lineTo: () => { },
        moveTo: () => { },
        stroke: () => { },
        fill: () => { },
        arc: () => { },
        save: () => { },
        restore: () => { },
        scale: () => { },
        rotate: () => { },
        translate: () => { },
        transform: () => { },
        setTransform: () => { },
        fillStyle: '',
        strokeStyle: '',
        font: ''
      }),
      toBuffer: () => Buffer.from(''),
      toDataURL: () => 'data:image/png;base64,'
    }),
    loadImage: async () => ({ width: 100, height: 100 })
  };
}

// Global GoatBot object
if (!(globalThis as any).GoatBot) {
  (globalThis as any).GoatBot = {};
}
const gGoatBot = (globalThis as any).GoatBot;
gGoatBot.onStart = gGoatBot.onStart || new Map();
gGoatBot.onChat = gGoatBot.onChat || new Map();
gGoatBot.onReply = gGoatBot.onReply || new Map();
gGoatBot.onReaction = gGoatBot.onReaction || new Map();
gGoatBot.onEvent = gGoatBot.onEvent || new Map();
gGoatBot.onLoad = gGoatBot.onLoad || new Map();
gGoatBot.onMessage = gGoatBot.onMessage || new Map();
gGoatBot.onAnyEvent = gGoatBot.onAnyEvent || new Map();
gGoatBot.commands = gGoatBot.commands || new Map();
gGoatBot.aliases = gGoatBot.aliases || new Map();
gGoatBot.envCommands = gGoatBot.envCommands || {};
gGoatBot.configCommands = gGoatBot.configCommands || {};
gGoatBot.config = gGoatBot.config || {};
gGoatBot.config.prefix = gGoatBot.config.prefix || '#';
gGoatBot.config.adminOnly = gGoatBot.config.adminOnly ?? false;
gGoatBot.config.openAIUsing = gGoatBot.config.openAIUsing || 'default';
gGoatBot.config.adminBot = gGoatBot.config.adminBot || ['10001'];

// Global utils object
if (!(globalThis as any).utils) {
  (globalThis as any).utils = {};
}
const gUtils = (globalThis as any).utils;
gUtils.getTime = gUtils.getTime || ((format?: string) => {
  const now = new Date();
  if (format === 'DD/MM/YYYY') return now.toLocaleDateString('en-GB');
  if (format === 'HH:mm:ss') return now.toTimeString().split(' ')[0];
  return now.toLocaleString('en-GB');
});
gUtils.randomString = gUtils.randomString || ((length: number = 10) => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let res = '';
  for (let i = 0; i < length; i++) res += chars.charAt(Math.floor(Math.random() * chars.length));
  return res;
});
gUtils.getStreamsFromAttachment = gUtils.getStreamsFromAttachment || (async (_attachments: any[]) => []);
gUtils.getStreamFromURL = gUtils.getStreamFromURL || (async (_url: string) => null);
gUtils.uploadImgbb = gUtils.uploadImgbb || (async (url: string) => ({ image: { url } }));
gUtils.uploadZippyshare = gUtils.uploadZippyshare || (async (url: string) => url);
gUtils.removeHomeDir = gUtils.removeHomeDir || ((p: string) => (p ? p.replace(process.cwd(), '') : ''));
gUtils.findUid = gUtils.findUid || (async (link: string) => (link ? (link.match(/\d+/)?.[0] || '10001') : '10001'));
gUtils.getPrefix = gUtils.getPrefix || ((_threadID?: string) => gGoatBot.config.prefix || '#');
gUtils.GoatBotApis = gUtils.GoatBotApis || {};
gUtils.log = gUtils.log || {
  info: (...args: any[]) => console.log('[GoatBot]', ...args),
  err: (...args: any[]) => console.error('[GoatBot]', ...args),
  warn: (...args: any[]) => console.warn('[GoatBot]', ...args),
  error: (...args: any[]) => console.error('[GoatBot]', ...args)
};
gUtils.drive = gUtils.drive || {
  getFile: async () => null,
  uploadFile: async () => null
};
gUtils.getExtFromUrl = gUtils.getExtFromUrl || ((url: string) => {
  if (!url) return 'png';
  const match = url.match(/\.([a-zA-Z0-9]+)(\?|$)/);
  return match ? match[1] : 'png';
});

// Global db object
if (!(globalThis as any).db) {
  (globalThis as any).db = {};
}
const gDb = (globalThis as any).db;
gDb.sequelize = gDb.sequelize || {};
gDb.usersData = gDb.usersData || new Map();
gDb.threadsData = gDb.threadsData || new Map();

// Global busyList object
if (!(globalThis as any).busyList) {
  (globalThis as any).busyList = new Map();
}

export type CommandType = 'SHIPU_NATIVE' | 'GOATBOT_COMMONJS' | 'LEGACY_GOATBOT';

export interface LoadedCommandSummary {
  name: string;
  type: CommandType;
  source: string;
  config: any;
  hooks: string[];
}

export interface DualLoaderReport {
  shiPuCount: number;
  goatBotCount: number;
  totalLoaded: number;
  commands: LoadedCommandSummary[];
  conflicts: string[];
  logs: string[];
}

export class GoatBotCommandLoader {
  private registeredCommands = new Map<string, ShiPuCommandModule>();
  private loadedSummaries: LoadedCommandSummary[] = [];
  private conflicts: string[] = [];
  private logs: string[] = [];

  public detectCommandType(codeOrObj: any): CommandType {
    if (typeof codeOrObj === 'object' && codeOrObj !== null) {
      if (codeOrObj.config && typeof codeOrObj.onStart === 'function' && !codeOrObj.run) {
        return 'GOATBOT_COMMONJS';
      }
      if (codeOrObj.config && (typeof codeOrObj.run === 'function' || typeof codeOrObj.handleEvent === 'function')) {
        return 'LEGACY_GOATBOT';
      }
      if (codeOrObj.config && (typeof codeOrObj.onStart === 'function' || typeof codeOrObj.onChat === 'function')) {
        return 'SHIPU_NATIVE';
      }
    }

    if (typeof codeOrObj === 'string') {
      const code = codeOrObj;
      if (code.includes('module.exports') || code.includes('exports.')) {
        if (code.includes('onStart') || code.includes('onChat') || code.includes('onReply') || code.includes('onReaction')) {
          return 'GOATBOT_COMMONJS';
        }
        if (code.includes('run:') || code.includes('run =') || code.includes('handleEvent')) {
          return 'LEGACY_GOATBOT';
        }
        return 'GOATBOT_COMMONJS';
      }
    }

    return 'SHIPU_NATIVE';
  }

  public evaluateGoatBotCode(codeStr: string, fileName: string = 'goatbot_cmd.js'): any {
    const module = { exports: {} as any };
    const exports = module.exports;
    const dirname = path.dirname(path.resolve(fileName));
    const filename = path.resolve(fileName);

    const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;

    try {
      const fn = new AsyncFunction(
        'module',
        'exports',
        'require',
        '__dirname',
        '__filename',
        'global',
        'globalThis',
        'GoatBot',
        `
          ${codeStr}
          return module.exports;
        `
      );

      const res = fn(
        module,
        exports,
        customRequire,
        dirname,
        filename,
        globalThis,
        globalThis,
        (globalThis as any).GoatBot
      );

      return module.exports && Object.keys(module.exports).length > 0 ? module.exports : (res || module.exports);
    } catch (err: any) {
      try {
        const fnSync = new Function(
          'module',
          'exports',
          'require',
          '__dirname',
          '__filename',
          'global',
          'globalThis',
          'GoatBot',
          `
            ${codeStr}
            return module.exports;
          `
        );
        const resSync = fnSync(
          module,
          exports,
          customRequire,
          dirname,
          filename,
          globalThis,
          globalThis,
          (globalThis as any).GoatBot
        );
        return module.exports && Object.keys(module.exports).length > 0 ? module.exports : (resSync || module.exports);
      } catch {
        throw err;
      }
    }
  }

  public wrapGoatBotModule(mod: any, sourceName: string = 'GoatBotCommand'): ShiPuCommandModule {
    const config = mod.config || {};
    const cmdName = (config.name || path.basename(sourceName, path.extname(sourceName))).toLowerCase().trim();
    const version = config.version || '1.0.0';
    const role: UserRole = typeof config.role === 'number' ? (config.role as UserRole) : 0;
    const author = config.author || 'GoatBot Developer';
    const rawDesc = config.description;
    const description = typeof rawDesc === 'string'
      ? rawDesc
      : (rawDesc && typeof rawDesc === 'object'
          ? (rawDesc.en || rawDesc.bn || rawDesc.vi || Object.values(rawDesc).filter(v => typeof v === 'string').join(' ') || '')
          : String(rawDesc || ''));
    const category = config.category || 'GoatBot';
    const guide = config.guide || `{pref}${cmdName}`;
    const countDown = config.countDown || config.cooldown || 2;
    const aliases = Array.isArray(config.aliases) ? config.aliases : (config.aliases ? [config.aliases] : []);

    const hooks: string[] = [];
    if (typeof mod.onStart === 'function' || typeof mod.run === 'function') hooks.push('onStart');
    if (typeof mod.onChat === 'function' || typeof mod.handleEvent === 'function') hooks.push('onChat');
    if (typeof mod.onReply === 'function' || typeof mod.handleReply === 'function') hooks.push('onReply');
    if (typeof mod.onReaction === 'function' || typeof mod.handleReaction === 'function') hooks.push('onReaction');
    if (typeof mod.onEvent === 'function') hooks.push('onEvent');
    if (typeof mod.onLoad === 'function') hooks.push('onLoad');
    if (typeof mod.onMessage === 'function') hooks.push('onMessage');
    if (typeof mod.onAnyEvent === 'function') hooks.push('onAnyEvent');

    const createGoatContext = (ctx: any, extraProps: Record<string, any> = {}) => {
      const uID = ctx.senderID || ctx.currentUser?.userID;
      const tID = ctx.threadID || ctx.currentThread?.threadID;

      const Currencies = {
        getData: async (id?: string) => ctx.usersData.get(id || uID),
        setData: async (id: string, data: any) => ctx.usersData.set(id || uID, data),
        increaseMoney: async (id: string, amt: number) => ctx.usersData.increment(id || uID, 'money', amt),
        decreaseMoney: async (id: string, amt: number) => ctx.usersData.increment(id || uID, 'money', -amt)
      };

      const Users = {
        getData: async (id?: string) => ctx.usersData.get(id || uID),
        setData: async (id: string, data: any) => ctx.usersData.set(id || uID, data),
        getNameUser: async (id?: string) => (await ctx.usersData.get(id || uID))?.name || `User_${id || uID}`,
        getAvatarUrl: async (id?: string) => `https://graph.facebook.com/${id || uID}/picture?height=1500&width=1500&access_token=6628568379%7Cc1e620fa708a1d5696fb991c1bde5662`
      };

      const Threads = {
        getData: async (id?: string) => ctx.threadsData.get(id || tID),
        setData: async (id: string, data: any) => ctx.threadsData.set(id || tID, data),
        getInfo: async (id?: string) => ctx.threadsData.get(id || tID)
      };

      return {
        api: ctx.api,
        event: ctx.event || {
          type: 'message',
          threadID: tID,
          senderID: uID,
          body: ctx.message?.body || '',
          messageID: ctx.message?.messageID || `msg_${Date.now()}`
        },
        args: ctx.args || [],
        message: ctx.message,
        usersData: ctx.usersData,
        threadsData: ctx.threadsData,
        globalData: (globalThis as any).GoatBot,
        role: ctx.currentUser?.role ?? 0,
        commandName: cmdName,
        prefix: ctx.currentThread?.prefix || ctx.api?.getBotConfig?.()?.globalPrefix || '#',
        envCommands: config.envConfig || {},
        envGlobal: {},
        Users,
        Threads,
        Currencies,
        getLang: ctx.getLang || ((k: string) => k),
        currentUser: ctx.currentUser,
        currentThread: ctx.currentThread,
        ...extraProps
      };
    };

    const wrapper: ShiPuCommandModule = {
      config: {
        name: cmdName,
        aliases,
        version,
        role,
        author,
        description,
        category,
        guide,
        countDown,
        enabled: config.enabled !== false
      },
      onStart: async (ctx) => {
        const goatCtx = createGoatContext(ctx);
        if (typeof mod.onStart === 'function') {
          return await mod.onStart(goatCtx);
        } else if (typeof mod.run === 'function') {
          return await mod.run(goatCtx);
        }
      },
      onChat: async (ctx) => {
        const goatCtx = createGoatContext(ctx);
        if (typeof mod.onChat === 'function') {
          await mod.onChat(goatCtx);
        } else if (typeof mod.handleEvent === 'function') {
          await mod.handleEvent(goatCtx);
        }
        if (typeof mod.onMessage === 'function') {
          await mod.onMessage(goatCtx);
        }
        if (typeof mod.onAnyEvent === 'function') {
          await mod.onAnyEvent(goatCtx);
        }
      },
      onReply: async (ctx) => {
        const goatCtx = createGoatContext(ctx, { Reply: ctx.Reply || ctx.replyData || null });
        if (typeof mod.onReply === 'function') {
          await mod.onReply(goatCtx);
        } else if (typeof mod.handleReply === 'function') {
          await mod.handleReply(goatCtx);
        }
      },
      onReaction: async (ctx) => {
        const goatCtx = createGoatContext(ctx, { Reaction: ctx.Reaction || ctx.reactionData || null });
        if (typeof mod.onReaction === 'function') {
          await mod.onReaction(goatCtx);
        } else if (typeof mod.handleReaction === 'function') {
          await mod.handleReaction(goatCtx);
        }
      },
      onEvent: async (ctx) => {
        const goatCtx = createGoatContext(ctx);
        if (typeof mod.onEvent === 'function') {
          await mod.onEvent(goatCtx);
        }
      }
    };

    return wrapper;
  }

  public loadCommandFromCode(code: string, fileName: string = 'custom_cmd.js'): { module: ShiPuCommandModule; type: CommandType; summary: LoadedCommandSummary } {
    // Auto-detect and install missing dependencies before evaluation
    try {
      const { requiredPackages } = dependencyManager.extractDependenciesFromCode(code);
      if (requiredPackages.length > 0) {
        dependencyManager.ensurePackagesInstalledSync(requiredPackages);
      }
    } catch (depErr: any) {
      console.warn(`[DualLoader] Dependency pre-installation check warning for ${fileName}:`, depErr.message);
    }

    const type = this.detectCommandType(code);
    const cmdBaseName = path.basename(fileName, path.extname(fileName));
    let modObj: any;

    if (!code.includes('module.exports') && !code.includes('exports.')) {
      const wrappedSnippet = `
        module.exports = {
          config: { name: "${cmdBaseName}" },
          onStart: async function(ctx) {
            const { message, args, event, threadID, senderID, botUid, currentUser, currentThread, usersData, threadsData, api } = ctx;
            ${code}
          }
        };
      `;
      try {
        modObj = this.evaluateGoatBotCode(wrappedSnippet, fileName);
      } catch {
        modObj = { config: { name: cmdBaseName } };
      }
    } else {
      try {
        modObj = this.evaluateGoatBotCode(code, fileName);
      } catch (err: any) {
        console.warn(`[DualLoader] Error evaluating ${fileName}:`, err.message);
        modObj = { config: { name: cmdBaseName } };
      }
    }

    const wrappedModule = this.wrapGoatBotModule(modObj, fileName);
    const hooks: string[] = [];
    if (modObj.onStart || modObj.run) hooks.push('onStart');
    if (modObj.onChat || modObj.handleEvent) hooks.push('onChat');
    if (modObj.onReply || modObj.handleReply) hooks.push('onReply');
    if (modObj.onReaction || modObj.handleReaction) hooks.push('onReaction');
    if (modObj.onEvent) hooks.push('onEvent');
    if (modObj.onLoad) hooks.push('onLoad');
    if (modObj.onMessage) hooks.push('onMessage');
    if (modObj.onAnyEvent) hooks.push('onAnyEvent');

    const summary: LoadedCommandSummary = {
      name: wrappedModule.config.name,
      type,
      source: fileName,
      config: wrappedModule.config,
      hooks
    };

    return { module: wrappedModule, type, summary };
  }

  public scanDirectoryAndLoad(dirPath: string): ShiPuCommandModule[] {
    const loadedModules: ShiPuCommandModule[] = [];
    if (!fs.existsSync(dirPath)) {
      return loadedModules;
    }

    const files = fs.readdirSync(dirPath);
    for (const file of files) {
      if (file.endsWith('.js') || file.endsWith('.ts')) {
        const fullPath = path.join(dirPath, file);
        try {
          const content = fs.readFileSync(fullPath, 'utf-8');
          const { module, type, summary } = this.loadCommandFromCode(content, file);

          const existing = this.registeredCommands.get(module.config.name);
          if (existing) {
            const conflictMsg = `[DualLoader Conflict] Command "${module.config.name}" from ${file} overrides previous registration (${existing.config.name})`;
            this.conflicts.push(conflictMsg);
            this.logs.push(conflictMsg);
          }

          this.registeredCommands.set(module.config.name, module);
          this.loadedSummaries.push(summary);
          this.logs.push(`[DualLoader] Loaded ${type} command: ${module.config.name} (${file})`);
          loadedModules.push(module);

          if (typeof (module as any).onLoad === 'function') {
            try {
              (module as any).onLoad({});
            } catch (err: any) {
              console.warn(`[DualLoader] Error in onLoad for ${module.config.name}:`, err.message);
            }
          }
        } catch (err: any) {
          const errMsg = `[DualLoader Error] Failed to load ${file}: ${err.message}`;
          this.logs.push(errMsg);
          console.error(errMsg);
        }
      }
    }

    return loadedModules;
  }

  public registerShiPuCommand(cmd: ShiPuCommandModule, source: string = 'Native Seed'): void {
    const summary: LoadedCommandSummary = {
      name: cmd.config.name,
      type: 'SHIPU_NATIVE',
      source,
      config: cmd.config,
      hooks: ['onStart']
    };
    this.registeredCommands.set(cmd.config.name, cmd);
    this.loadedSummaries.push(summary);
    this.logs.push(`[DualLoader] Registered ShiPu Native command: ${cmd.config.name}`);
  }

  public getRegisteredCommands(): Map<string, ShiPuCommandModule> {
    return this.registeredCommands;
  }

  public registerLoadedCommand(module: ShiPuCommandModule, summary: LoadedCommandSummary): void {
    const name = module.config.name;
    this.registeredCommands.set(name, module);
    this.loadedSummaries = this.loadedSummaries.filter(s => s.name !== name);
    this.loadedSummaries.push(summary);
    this.logs.push(`[DualLoader] Registered loaded command: ${name}`);
  }

  public unloadCommand(name: string): boolean {
    const hasCmd = this.registeredCommands.has(name);
    if (hasCmd) {
      this.registeredCommands.delete(name);
      this.loadedSummaries = this.loadedSummaries.filter(s => s.name !== name);
      this.logs.push(`[DualLoader] Unloaded command: ${name}`);
      return true;
    }
    return false;
  }

  public generateReport(): DualLoaderReport {
    let shiPuCount = 0;
    let goatBotCount = 0;

    for (const item of this.loadedSummaries) {
      if (item.type === 'SHIPU_NATIVE') shiPuCount++;
      else goatBotCount++;
    }

    return {
      shiPuCount,
      goatBotCount,
      totalLoaded: this.loadedSummaries.length,
      commands: this.loadedSummaries,
      conflicts: this.conflicts,
      logs: this.logs
    };
  }
}

export const goatBotLoader = new GoatBotCommandLoader();
