import mongoose from 'mongoose';
import { databaseConfig, initialAdminBot } from '../config/database';
import fs from 'fs';
import path from 'path';

// Disable command buffering so queries fail-fast when MongoDB Atlas is unreachable/disconnected
mongoose.set('bufferCommands', false);

const FALLBACK_DB_PATH = path.join(process.cwd(), 'local_db_fallback.json');

class FallbackDatabase {
  private data: Record<string, any[]> = {};

  constructor() {
    this.load();
  }

  private load() {
    try {
      if (fs.existsSync(FALLBACK_DB_PATH)) {
        const fileContent = fs.readFileSync(FALLBACK_DB_PATH, 'utf8');
        this.data = JSON.parse(fileContent);
      }
    } catch (err) {
      console.error('[FallbackDB] Error loading local DB:', err);
    }
  }

  private save() {
    try {
      fs.writeFileSync(FALLBACK_DB_PATH, JSON.stringify(this.data, null, 2), 'utf8');
    } catch (err) {
      console.error('[FallbackDB] Error saving local DB:', err);
    }
  }

  getCollection(name: string): any[] {
    const colName = name.toLowerCase();
    if (!this.data[colName]) {
      this.data[colName] = [];
    }
    return this.data[colName];
  }

  setCollection(name: string, items: any[]) {
    const colName = name.toLowerCase();
    this.data[colName] = items;
    this.save();
  }
}

const fallbackDb = new FallbackDatabase();

function matchesQuery(item: any, query: any): boolean {
  if (!query) return true;
  for (const key of Object.keys(query)) {
    let qVal = query[key];
    let iVal = item[key];

    if (qVal instanceof RegExp) {
      if (!qVal.test(String(iVal || ''))) return false;
    } else if (qVal && typeof qVal === 'object' && qVal.$regex) {
      const flags = qVal.$options || '';
      const regex = new RegExp(qVal.$regex, flags);
      if (!regex.test(String(iVal || ''))) return false;
    } else {
      if (String(iVal) !== String(qVal)) return false;
    }
  }
  return true;
}

function applyUpdate(item: any, update: any): any {
  if (!update) return item;

  if (update.$set || update.$inc || update.$setOnInsert || update.$push) {
    if (update.$set) {
      for (const [k, v] of Object.entries(update.$set)) {
        item[k] = v;
      }
    }
    if (update.$inc) {
      for (const [k, v] of Object.entries(update.$inc)) {
        item[k] = (item[k] || 0) + (v as number);
      }
    }
    if (update.$push) {
      for (const [k, v] of Object.entries(update.$push)) {
        if (!Array.isArray(item[k])) {
          item[k] = [];
        }
        item[k].push(v);
      }
    }
  } else {
    for (const [k, v] of Object.entries(update)) {
      if (!k.startsWith('$')) {
        item[k] = v;
      }
    }
  }
  return item;
}

class FallbackQuery {
  private data: any[];
  constructor(data: any[]) {
    this.data = data;
  }
  lean() { return this; }
  sort(by: any) { return this; }
  limit(n: number) {
    this.data = this.data.slice(0, n);
    return this;
  }
  skip(n: number) {
    this.data = this.data.slice(n);
    return this;
  }
  select(fields: any) { return this; }
  exec() { return Promise.resolve(this.data); }
  then(onfulfilled?: any, onrejected?: any) {
    return Promise.resolve(this.data).then(onfulfilled, onrejected);
  }
}

class FallbackFindOneQuery {
  private doc: any;
  constructor(doc: any) {
    this.doc = doc;
  }
  lean() { return this; }
  select(fields: any) { return this; }
  exec() { return Promise.resolve(this.doc); }
  then(onfulfilled?: any, onrejected?: any) {
    return Promise.resolve(this.doc).then(onfulfilled, onrejected);
  }
}

class FallbackCountQuery {
  private count: number;
  constructor(count: number) {
    this.count = count;
  }
  exec() { return Promise.resolve(this.count); }
  then(onfulfilled?: any, onrejected?: any) {
    return Promise.resolve(this.count).then(onfulfilled, onrejected);
  }
}

class DummyChangeStream {
  on(event: string, callback: any) {
    return this;
  }
  close() {
    return Promise.resolve();
  }
}

export const isMongoConnectionError = (err: any): boolean => {
  if (!err) return false;
  const errName = String(err.name || '');
  const errMsg = String(err.message || err).toLowerCase();
  const errStack = String(err.stack || '').toLowerCase();
  return (
    errName === 'MongoNetworkError' ||
    errName === 'MongoServerSelectionError' ||
    errName === 'MongoNetworkTimeoutError' ||
    errName === 'MongoTopologyClosedError' ||
    errName === 'MongoNotConnectedError' ||
    errName === 'MongooseError' ||
    errName === 'MongooseServerSelectionError' ||
    errName === 'MongoTimeoutError' ||
    errName === 'MongoError' ||
    errName === 'MongoDriverError' ||
    errMsg.includes('ssl routines') ||
    errMsg.includes('alert internal error') ||
    errMsg.includes('alert number') ||
    errMsg.includes('ssl alert') ||
    errMsg.includes('resetpool') ||
    errMsg.includes('errorlabelset') ||
    errMsg.includes('selection timed out') ||
    errMsg.includes('connection timed out') ||
    errMsg.includes('timeout') ||
    errMsg.includes('topology') ||
    errMsg.includes('buffering timed out') ||
    errMsg.includes('network') ||
    errMsg.includes('unreachable') ||
    errMsg.includes('heartbeat') ||
    errMsg.includes('server selection') ||
    errMsg.includes('before initial connection is complete') ||
    errMsg.includes('client must be connected') ||
    errMsg.includes('cooldown') ||
    errMsg.includes('econnrefused') ||
    errMsg.includes('enotfound') ||
    errMsg.includes('etimedout') ||
    errMsg.includes('ehostunreach') ||
    errMsg.includes('econnreset') ||
    errMsg.includes('connection closed') ||
    errMsg.includes('pool destroyed') ||
    errMsg.includes('not connected') ||
    errMsg.includes('no connection') ||
    errMsg.includes('offline') ||
    errStack.includes('mongonetworkerror') ||
    errStack.includes('ssl alert')
  );
};

export function executeFallback(modelName: string, prop: string, args: any[]): any {
  const p = prop;
  if (p === 'find') {
    const col = fallbackDb.getCollection(modelName);
    const matched = col.filter(item => matchesQuery(item, args[0]));
    return new FallbackQuery(matched);
  }
  if (p === 'findOne' || p === 'findById') {
    const col = fallbackDb.getCollection(modelName);
    const query = typeof args[0] === 'object' && args[0] !== null ? args[0] : { userID: args[0], id: args[0], _id: args[0] };
    const matched = col.find(item => matchesQuery(item, query)) || null;
    return new FallbackFindOneQuery(matched);
  }
  if (p === 'updateOne' || p === 'findByIdAndUpdate') {
    const col = fallbackDb.getCollection(modelName);
    const query = typeof args[0] === 'object' && args[0] !== null ? args[0] : { userID: args[0], id: args[0], _id: args[0] };
    let idx = col.findIndex(item => matchesQuery(item, query));
    let matchedCount = 0;
    let modifiedCount = 0;
    let upsertedCount = 0;
    const update = args[1];
    const options = args[2];

    if (idx !== -1) {
      col[idx] = applyUpdate({ ...col[idx] }, update);
      matchedCount = 1;
      modifiedCount = 1;
    } else if (options?.upsert) {
      let newItem = typeof args[0] === 'object' && args[0] !== null ? { ...args[0] } : { id: args[0] };
      if (update?.$setOnInsert) {
        newItem = { ...newItem, ...update.$setOnInsert };
      }
      newItem = applyUpdate(newItem, update);
      col.push(newItem);
      upsertedCount = 1;
    }
    fallbackDb.setCollection(modelName, col);
    return Promise.resolve({ matchedCount, modifiedCount, upsertedCount });
  }
  if (p === 'updateMany') {
    const col = fallbackDb.getCollection(modelName);
    let matchedCount = 0;
    let modifiedCount = 0;
    const update = args[1];
    const newCol = col.map(item => {
      if (matchesQuery(item, args[0])) {
        matchedCount++;
        modifiedCount++;
        return applyUpdate({ ...item }, update);
      }
      return item;
    });
    fallbackDb.setCollection(modelName, newCol);
    return Promise.resolve({ matchedCount, modifiedCount });
  }
  if (p === 'deleteOne' || p === 'findByIdAndDelete') {
    const col = fallbackDb.getCollection(modelName);
    const query = typeof args[0] === 'object' && args[0] !== null ? args[0] : { userID: args[0], id: args[0], _id: args[0] };
    const idx = col.findIndex(item => matchesQuery(item, query));
    let deletedCount = 0;
    if (idx !== -1) {
      col.splice(idx, 1);
      fallbackDb.setCollection(modelName, col);
      deletedCount = 1;
    }
    return Promise.resolve({ deletedCount });
  }
  if (p === 'deleteMany') {
    const col = fallbackDb.getCollection(modelName);
    const initialLen = col.length;
    const remaining = col.filter(item => !matchesQuery(item, args[0]));
    const deletedCount = initialLen - remaining.length;
    fallbackDb.setCollection(modelName, remaining);
    return Promise.resolve({ deletedCount });
  }
  if (p === 'countDocuments') {
    const col = fallbackDb.getCollection(modelName);
    const matched = col.filter(item => matchesQuery(item, args[0]));
    return new FallbackCountQuery(matched.length);
  }
  if (p === 'insertMany') {
    const col = fallbackDb.getCollection(modelName);
    const cleanDocs = (args[0] || []).map((d: any) => ({ ...d }));
    col.push(...cleanDocs);
    fallbackDb.setCollection(modelName, col);
    return Promise.resolve(cleanDocs);
  }
  if (p === 'create') {
    const col = fallbackDb.getCollection(modelName);
    const cleanDoc = { ...args[0] };
    col.push(cleanDoc);
    fallbackDb.setCollection(modelName, col);
    return Promise.resolve(cleanDoc);
  }
  if (p === 'aggregate' || p === 'distinct') {
    const col = fallbackDb.getCollection(modelName);
    return Promise.resolve(col);
  }
  if (p === 'watch') {
    return new DummyChangeStream();
  }
  return Promise.resolve(null);
}

function wrapQueryOrPromise(result: any, fallbackExec: () => any): any {
  if (!result) return result;

  const isThenable = typeof result.then === 'function';
  const hasExec = typeof result.exec === 'function';

  if (!isThenable && !hasExec) {
    return result;
  }

  return new Proxy(result, {
    get(target, prop, receiver) {
      if (prop === 'then') {
        return function(onfulfilled?: any, onrejected?: any) {
          if (mongoose.connection.readyState !== 1) {
            return Promise.resolve(fallbackExec()).then(onfulfilled, onrejected);
          }
          return Promise.resolve()
            .then(() => target)
            .catch(err => {
              if (isMongoConnectionError(err) || mongoose.connection.readyState !== 1) {
                return fallbackExec();
              }
              throw err;
            })
            .then(onfulfilled, onrejected);
        };
      }
      if (prop === 'catch') {
        return function(onrejected?: any) {
          if (mongoose.connection.readyState !== 1) {
            return Promise.resolve(fallbackExec()).catch(onrejected);
          }
          return Promise.resolve()
            .then(() => target)
            .catch(err => {
              if (isMongoConnectionError(err) || mongoose.connection.readyState !== 1) {
                return fallbackExec();
              }
              throw err;
            })
            .catch(onrejected);
        };
      }
      if (prop === 'exec') {
        return function() {
          if (mongoose.connection.readyState !== 1) {
            return Promise.resolve(fallbackExec());
          }
          let originalExecPromise;
          try {
            originalExecPromise = target.exec();
          } catch (err) {
            if (isMongoConnectionError(err) || mongoose.connection.readyState !== 1) {
              return Promise.resolve(fallbackExec());
            }
            throw err;
          }
          return wrapQueryOrPromise(originalExecPromise, fallbackExec);
        };
      }

      const val = Reflect.get(target, prop, receiver);
      if (typeof val === 'function') {
        return function(...args: any[]) {
          if (mongoose.connection.readyState !== 1) {
            return wrapQueryOrPromise(Promise.resolve(fallbackExec()), fallbackExec);
          }
          try {
            const methodResult = val.apply(target, args);
            return wrapQueryOrPromise(methodResult, fallbackExec);
          } catch (err) {
            if (isMongoConnectionError(err)) {
              return wrapQueryOrPromise(Promise.resolve(fallbackExec()), fallbackExec);
            }
            throw err;
          }
        };
      }
      return val;
    }
  });
}

function getDynamicModel(modelName: string, schema: mongoose.Schema, defaultCollectionName?: string) {
  function DummyModelProxy() {}
  return new Proxy(DummyModelProxy, {
    get(target, prop) {
      if (typeof prop === 'symbol') {
        return (target as any)[prop];
      }

      const getActiveContext = (globalThis as any).getActiveBotDbContext;
      const activeCtx = getActiveContext ? getActiveContext() : undefined;
      let conn = mongoose.connection;
      let collectionName: string | undefined = defaultCollectionName;

      if (activeCtx && activeCtx.connection) {
        conn = activeCtx.connection;
        if (activeCtx.collectionPrefix) {
          const prefix = activeCtx.collectionPrefix.trim();
          collectionName = `${prefix}${modelName.toLowerCase()}s`;
        }
      }

      if (conn.readyState !== 1) {
        if (prop === 'schema') return schema;
        return function(...args: any[]) {
          return executeFallback(modelName, String(prop), args);
        };
      }

      let model = conn.models[modelName];
      if (!model) {
        try {
          model = conn.model(modelName, schema, collectionName);
        } catch {
          model = conn.models[modelName];
        }
      }

      if (!model) {
        return function(...args: any[]) {
          return executeFallback(modelName, String(prop), args);
        };
      }

      const value = (model as any)[prop];
      if (typeof value === 'function') {
        return function(...args: any[]) {
          if (conn.readyState !== 1) {
            return executeFallback(modelName, String(prop), args);
          }

          let result;
          try {
            result = value.apply(model, args);
          } catch (err) {
            if (isMongoConnectionError(err)) {
              console.warn(`[DATABASE] Synchronous MongoDB error for ${modelName}.${String(prop)}. Falling back to local DB. Error: ${(err as any)?.message}`);
              return executeFallback(modelName, String(prop), args);
            }
            throw err;
          }
          return wrapQueryOrPromise(result, () => executeFallback(modelName, String(prop), args));
        };
      }

      if (value === undefined && typeof prop === 'string') {
        return function(...args: any[]) {
          return executeFallback(modelName, String(prop), args);
        };
      }

      return value;
    },
    apply(target, thisArg, argumentsList) {
      return executeFallback(modelName, 'create', argumentsList);
    },
    construct(target, argumentsList, newTarget) {
      const getActiveContext = (globalThis as any).getActiveBotDbContext;
      const activeCtx = getActiveContext ? getActiveContext() : undefined;
      let conn = mongoose.connection;
      let collectionName: string | undefined = defaultCollectionName;

      if (activeCtx && activeCtx.connection) {
        conn = activeCtx.connection;
        if (activeCtx.collectionPrefix) {
          const prefix = activeCtx.collectionPrefix.trim();
          collectionName = `${prefix}${modelName.toLowerCase()}s`;
        }
      }

      if (conn.readyState !== 1) {
        const obj = argumentsList[0] || {};
        return {
          ...obj,
          save: () => {
            const col = fallbackDb.getCollection(modelName);
            col.push(obj);
            fallbackDb.setCollection(modelName, col);
            return Promise.resolve(obj);
          }
        };
      }

      let model = conn.models[modelName];
      if (!model) {
        try {
          model = conn.model(modelName, schema, collectionName);
        } catch {
          model = conn.models[modelName];
        }
      }

      if (!model) {
        const obj = argumentsList[0] || {};
        return {
          ...obj,
          save: () => {
            const col = fallbackDb.getCollection(modelName);
            col.push(obj);
            fallbackDb.setCollection(modelName, col);
            return Promise.resolve(obj);
          }
        };
      }

      let instance;
      try {
        instance = Reflect.construct(model, argumentsList, newTarget);
      } catch (err) {
        if (isMongoConnectionError(err)) {
          console.warn(`[DATABASE] MongoDB error constructing instance. Falling back to local DB. Error: ${(err as any)?.message}`);
          const obj = argumentsList[0] || {};
          return {
            ...obj,
            save: () => {
              const col = fallbackDb.getCollection(modelName);
              col.push(obj);
              fallbackDb.setCollection(modelName, col);
              return Promise.resolve(obj);
            }
          };
        }
        throw err;
      }

      return new Proxy(instance, {
        get(t, p, r) {
          const val = Reflect.get(t, p, r);
          if (p === 'save' && typeof val === 'function') {
            return function(...args: any[]) {
              try {
                return Promise.resolve(val.apply(t, args)).catch(err => {
                  if (isMongoConnectionError(err)) {
                    console.warn(`[DATABASE] MongoDB error in save. Falling back to local DB. Error: ${err.message}`);
                    const obj = argumentsList[0] || {};
                    const col = fallbackDb.getCollection(modelName);
                    col.push(obj);
                    fallbackDb.setCollection(modelName, col);
                    return Promise.resolve(obj);
                  }
                  throw err;
                });
              } catch (err) {
                if (isMongoConnectionError(err)) {
                  console.warn(`[DATABASE] MongoDB error in save wrapper. Falling back to local DB. Error: ${(err as any).message}`);
                  const obj = argumentsList[0] || {};
                  const col = fallbackDb.getCollection(modelName);
                  col.push(obj);
                  fallbackDb.setCollection(modelName, col);
                  return Promise.resolve(obj);
                }
                throw err;
              }
            };
          }
          return val;
        }
      });
    }
  }) as any;
}


let isConnected = false;
let connectionError: string | null = null;
let lastAttemptTime = 0;
let reconnectAttempts = 0;
function getReconnectCooldown(): number {
  if (reconnectAttempts === 0) return 10000;
  return Math.min(15000 * Math.pow(1.8, Math.min(reconnectAttempts - 1, 5)), 120000);
}

const userSchema = new mongoose.Schema({
  userID: { type: String, required: true, unique: true },
  name: { type: String, default: '' },
  role: { type: Number, default: 0 },
  money: { type: Number, default: 500 },
  bankMoney: { type: Number, default: 0 },
  exp: { type: Number, default: 0 },
  level: { type: mongoose.Schema.Types.Mixed, default: 1 },
  accountLevel: { type: String, default: 'Starter' },
  accountStatus: { type: String, enum: ['Active', 'Frozen', 'Banned'], default: 'Active' },
  isBanned: { type: Boolean, default: false },
  totalEarned: { type: Number, default: 500 },
  totalSpent: { type: Number, default: 0 },
  totalDeposited: { type: Number, default: 0 },
  totalWithdrawn: { type: Number, default: 0 },
  totalTransactions: { type: Number, default: 0 },
  lastDailyClaim: { type: Date, default: null },
  lastWorkTime: { type: Date, default: null },
  interestEarned: { type: Number, default: 0 },
  inventory: { type: [Object], default: [] },
  lifetimeStats: {
    dailyClaims: { type: Number, default: 0 },
    jobsDone: { type: Number, default: 0 },
    gamesPlayed: { type: Number, default: 0 },
    gamesWon: { type: Number, default: 0 },
    gamblingWins: { type: Number, default: 0 },
    gamblingLosses: { type: Number, default: 0 },
    aiPurchases: { type: Number, default: 0 }
  },
  lastActive: { type: Date, default: Date.now }
}, { timestamps: true });

const economyTransactionSchema = new mongoose.Schema({
  txID: { type: String, required: true, unique: true },
  senderID: { type: String, required: true },
  senderName: { type: String, default: 'User' },
  receiverID: { type: String, default: 'SYSTEM' },
  receiverName: { type: String, default: 'System' },
  amount: { type: Number, required: true },
  currency: { type: String, default: 'Coins' },
  sourceCommand: { type: String, default: 'SYSTEM' },
  type: { type: String, enum: ['EARN', 'SPEND', 'TRANSFER', 'DEPOSIT', 'WITHDRAW', 'DAILY', 'WORK', 'REWARD', 'ADMIN_ADJUST', 'SYSTEM_DECREMENT'], default: 'TRANSFER' },
  reason: { type: String, default: '' },
  timestamp: { type: Date, default: Date.now },
  threadID: { type: String, default: 'DIRECT' },
  status: { type: String, enum: ['SUCCESS', 'PENDING', 'ROLLED_BACK', 'FAILED'], default: 'SUCCESS' },
  adminAction: { type: Boolean, default: false },
  rollbackInfo: { type: mongoose.Schema.Types.Mixed, default: null }
}, { timestamps: true });

economyTransactionSchema.index({ txID: 1 });
economyTransactionSchema.index({ senderID: 1, timestamp: -1 });
economyTransactionSchema.index({ receiverID: 1, timestamp: -1 });

const economyConfigSchema = new mongoose.Schema({
  key: { type: String, default: 'primary', unique: true },
  defaultWallet: { type: Number, default: 500 },
  defaultBank: { type: Number, default: 0 },
  dailyReward: { type: Number, default: 200 },
  workRewardMin: { type: Number, default: 50 },
  workRewardMax: { type: Number, default: 150 },
  interestRate: { type: Number, default: 1.5 }, // 1.5%
  bankLimit: { type: Number, default: 1000000 },
  transferTax: { type: Number, default: 1 }, // 1%
  shopMultiplier: { type: Number, default: 1.0 },
  gamblingMin: { type: Number, default: 10 },
  gamblingMax: { type: Number, default: 10000 },
  currencySymbol: { type: String, default: '💰' },
  currencyName: { type: String, default: 'Coins' },
  dailyCooldownMs: { type: Number, default: 86400000 }, // 24 hours
  workCooldownMs: { type: Number, default: 3600000 }, // 1 hour
  updatedAt: { type: String, default: () => new Date().toISOString() }
}, { timestamps: true });

export const EconomyTransactionModel = getDynamicModel('EconomyTransaction', economyTransactionSchema);
export const EconomyConfigModel = getDynamicModel('EconomyConfig', economyConfigSchema);

const threadSchema = new mongoose.Schema({
  threadID: { type: String, required: true, unique: true },
  name: { type: String, default: '' },
  prefix: { type: String, default: '#' },
  language: { type: String, default: 'en' },
  timezone: { type: String, default: 'Asia/Dhaka' },
  members: { type: Array, default: [] },
  adminIDs: { type: Array, default: [] },
  autoWelcome: { type: Boolean, default: true },
  welcomeMessage: { type: String, default: 'Welcome!' },
  goodbyeMessage: { type: String, default: 'Goodbye!' },
  antiSpam: { type: Boolean, default: true },
  antiLink: { type: Boolean, default: false },
  aiEnabled: { type: Boolean, default: true },
  economyEnabled: { type: Boolean, default: true },
  isBanned: { type: Boolean, default: false },
  createdAt: { type: Number, default: Date.now },
  initializedAt: { type: Number, default: 0 },
  connectionMessageSent: { type: Boolean, default: false },
  nicknameUpdated: { type: Boolean, default: false },
  botPresent: { type: Boolean, default: true },
  botNickname: { type: String, default: 'ShiPu Ai🤖' }
}, { timestamps: true });

const adminBotSchema = new mongoose.Schema({
  uid: { type: String, required: true, unique: true },
  addedBy: { type: String, default: 'SYSTEM_INIT' },
  addedAt: { type: String, default: () => new Date().toISOString() },
  role: { type: String, default: 'OWNER' }
}, { timestamps: true });

const ftpConfigSchema = new mongoose.Schema({
  key: { type: String, default: 'primary', unique: true },
  enabled: { type: Boolean, default: false },
  protocol: { type: String, default: 'ftp' },
  host: { type: String, default: '' },
  port: { type: Number, default: 21 },
  username: { type: String, default: '' },
  encryptedPassword: { type: String, default: '' },
  rootDirectory: { type: String, default: '/shipu-bot/' },
  passiveMode: { type: Boolean, default: true },
  secure: { type: Boolean, default: false },
  timeout: { type: Number, default: 10000 },
  updatedAt: { type: String, default: () => new Date().toISOString() },
  updatedBy: { type: String, default: 'ADMIN' }
}, { timestamps: true });

const auditLogSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  admin: { type: String, required: true },
  action: { type: String, required: true },
  timestamp: { type: String, required: true },
  target: { type: String, default: 'System Global' },
  result: { type: String, default: 'SUCCESS' }
}, { timestamps: true });

const storedCommandSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  filename: { type: String, default: '' },
  description: { type: String, default: '' },
  category: { type: String, default: 'general' },
  role: { type: Number, default: 0 },
  aliases: { type: Array, default: [] },
  guide: { type: String, default: '' },
  countDown: { type: Number, default: 5 },
  enabled: { type: Boolean, default: true },
  author: { type: String, default: 'ShiPu Team' },
  version: { type: String, default: '1.0.0' },
  code: { type: String, default: '' },
  updatedAt: { type: String, default: () => new Date().toISOString() }
}, { timestamps: true });


const systemCredentialSchema = new mongoose.Schema({
  key: { type: String, required: true },
  version: { type: Number, required: true },
  active: { type: Boolean, default: false },
  config: { type: mongoose.Schema.Types.Mixed, required: true },
  createdAt: { type: Number },
  updatedAt: { type: Number },
  createdBy: { type: String },
  lastValidatedAt: { type: Number },
  lastValidationStatus: { type: String }
});
systemCredentialSchema.index({ key: 1, version: 1 }, { unique: true });

const botSettingSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  value: { type: mongoose.Schema.Types.Mixed, required: true }
}, { timestamps: true });

const messengerAccountSchema = new mongoose.Schema({
  accountId: { type: String, required: true, unique: true },
  uid: { type: String, default: '' },
  facebookUID: { type: String, default: '' },
  slotId: { type: String, default: '' },
  botSlotId: { type: String, default: '' },
  botId: { type: String, default: '' },
  ownerId: { type: String, default: '' },
  ownerUserId: { type: String, default: '' },
  cookie: { type: String, default: '' },
  encryptedMongoUri: { type: String, default: '' },
  dbName: { type: String, default: '' },
  collectionPrefix: { type: String, default: '' },
  connectionMode: { type: String, default: 'default' },
  displayName: { type: String, default: 'Facebook User' },
  accountName: { type: String, default: '' },
  authType: { type: String, enum: ['cookie', 'oauth'], default: 'cookie' },
  provider: { type: String, default: 'DongDev FCA' },
  encryptedAuthState: { type: String, default: '' },
  authStateVersion: { type: Number, default: 1 },
  status: {
    type: String,
    enum: [
      'VALIDATING',
      'AUTHENTICATING',
      'AUTHENTICATED',
      'CONNECTING',
      'MQTT_LISTENING',
      'CONNECTED',
      'ONLINE',
      'DISCONNECTED',
      'TEMPORARY_ERROR',
      'AUTH_EXPIRED',
      'CHECKPOINT',
      'SECURITY_CHALLENGE',
      'REAUTH_REQUIRED',
      'DISABLED',
      'FAILED',
      'PENDING',
      'MQTT_ACTIVE',
      'AI_READY',
      'AUTH_FAILED',
      'COOKIE_EXPIRED',
      'RECONNECTING',
      'DATABASE_OFFLINE'
    ],
    default: 'VALIDATING'
  },
  mqttStatus: {
    type: String,
    enum: [
      'OFF',
      'CONNECTING',
      'CONNECTED',
      'LISTENING',
      'WAITING_FOR_FIRST_EVENT',
      'EVENT_STREAM_ACTIVE',
      'DISCONNECTED',
      'ERROR',
      'MQTT_ACTIVE'
    ],
    default: 'OFF'
  },
  loginStatus: {
    type: String,
    enum: ['LOGGED_IN', 'LOGGED_OUT', 'PENDING', 'FAILED'],
    default: 'LOGGED_OUT'
  },
  creationSource: { type: String, default: 'ADMIN_DASHBOARD' },
  source: { type: String, default: 'admin' },
  lastHeartbeat: { type: Number, default: Date.now },
  lastSuccessfulLogin: { type: Number, default: 0 },
  retryCounter: { type: Number, default: 0 },
  failureReason: { type: String, default: '' },
  botEnabled: { type: Boolean, default: true },
  enabled: { type: Boolean, default: true },
  aiEnabled: { type: Boolean, default: true },
  personalAiEnabled: { type: Boolean, default: false },
  lastIncomingMessageAt: { type: Number, default: 0 },
  lastOutgoingMessageAt: { type: Number, default: 0 },
  stats: {
    messagesToday: { type: Number, default: 0 },
    aiMessages: { type: Number, default: 0 },
    totalMessages: { type: Number, default: 0 },
    reconnects: { type: Number, default: 0 },
    uptimeMs: { type: Number, default: 0 }
  },
  lastValidatedAt: { type: Number, default: Date.now },
  lastConnectedAt: { type: Number, default: 0 },
  lastDisconnectedAt: { type: Number, default: 0 },
  lastRestoreAt: { type: Number, default: 0 },
  restoreAttemptCount: { type: Number, default: 0 },
  logoutReason: { type: String, default: '' },
  lastErrorCode: { type: String, default: '' },
  lastErrorAt: { type: Number, default: 0 },
  reconnectCount: { type: Number, default: 0 },
  createdAt: { type: Number, default: Date.now },
  updatedAt: { type: Number, default: Date.now }
}, { timestamps: true });

const officialGroupSchema = new mongoose.Schema({
  threadID: { type: String, required: true, unique: true },
  threadName: { type: String, default: '' },
  inviteLink: { type: String, default: '' },
  order: { type: Number, default: 1 },
  active: { type: Boolean, default: true }
}, { timestamps: true });

const sharedAccessUserSchema = new mongoose.Schema({
  userID: { type: String, required: true, unique: true },
  userName: { type: String, default: '' },
  joinedGroupIDs: { type: Array, default: [] },
  missingGroupIDs: { type: Array, default: [] },
  totalJoinedCount: { type: Number, default: 0 },
  totalRequiredCount: { type: Number, default: 0 },
  hasAccess: { type: Boolean, default: false },
  authorizedThreadIDs: { type: Array, default: [] },
  lastVerifiedAt: { type: Number, default: Date.now }
}, { timestamps: true });

const personalAIAccountSchema = new mongoose.Schema({
  accountId: { type: String, required: true, unique: true },
  uid: { type: String, required: true, unique: true },
  displayName: { type: String, default: 'Personal AI Assistant' },
  authType: { type: String, enum: ['cookie', 'oauth'], default: 'cookie' },
  provider: { type: String, default: 'DongDev FCA' },
  encryptedAuthState: { type: String, required: true },
  authStateVersion: { type: Number, default: 1 },
  status: { type: String, default: 'DISCONNECTED' },
  mqttStatus: { type: String, default: 'OFF' },
  enabled: { type: Boolean, default: true },
  // Configurable options
  autoReplyEnabled: { type: Boolean, default: true },
  typingIndicatorEnabled: { type: Boolean, default: true },
  readReceiptsEnabled: { type: Boolean, default: false },
  replyDelayMs: { type: Number, default: 1000 },
  maxHistory: { type: Number, default: 20 },
  aiModel: { type: String, default: 'gemini-3.6-flash' },
  memorySize: { type: Number, default: 10 },
  autoSleepMode: { type: Boolean, default: false },
  ignoreUnknownUsers: { type: Boolean, default: false },
  ignoreGroupChats: { type: Boolean, default: true },
  allowOnlyPrivateInbox: { type: Boolean, default: true },
  businessHoursEnabled: { type: Boolean, default: false },
  businessHoursStart: { type: String, default: '09:00' },
  businessHoursEnd: { type: String, default: '22:00' },
  blacklistUids: { type: Array, default: [] },
  whitelistUids: { type: Array, default: [] },
  // Statistics & State
  totalConversations: { type: Number, default: 0 },
  messagesReceivedToday: { type: Number, default: 0 },
  messagesRepliedToday: { type: Number, default: 0 },
  avgResponseTimeMs: { type: Number, default: 0 },
  contextMemoryUsage: { type: Number, default: 0 },
  lastIncomingMessageTime: { type: Number, default: 0 },
  lastOutgoingReplyTime: { type: Number, default: 0 },
  sessionUptime: { type: Number, default: 0 },
  reconnectCount: { type: Number, default: 0 },
  errorCount: { type: Number, default: 0 },
  aiRequestCount: { type: Number, default: 0 },
  currentQueueLength: { type: Number, default: 0 },
  liveConsoleLogs: { type: Array, default: [] },
  lastValidatedAt: { type: Number, default: Date.now },
  lastConnectedAt: { type: Number, default: 0 },
  lastDisconnectedAt: { type: Number, default: 0 },
  lastErrorCode: { type: String, default: '' }
}, { timestamps: true });

const subscriptionSchema = new mongoose.Schema({
  userID: { type: String, required: true, unique: true },
  name: { type: String, default: '' },
  status: {
    type: String,
    enum: ['TRIAL', 'ACTIVE', 'GRACE_PERIOD', 'LIMITED', 'SUSPENDED'],
    default: 'TRIAL'
  },
  registrationDate: { type: Date, default: Date.now },
  expiryDate: { type: Date, required: true },
  autoRenew: { type: Boolean, default: true },
  weeklyRentAmount: { type: Number, default: 1000 },
  totalWeeksPurchased: { type: Number, default: 0 },
  totalCoinsPaid: { type: Number, default: 0 },
  lastPaymentDate: { type: Date, default: null },
  lastNotificationStage: { type: String, default: '' },
  gracePeriodEndDate: { type: Date, default: null }
}, { timestamps: true });

subscriptionSchema.index({ userID: 1 });
subscriptionSchema.index({ status: 1 });
subscriptionSchema.index({ expiryDate: 1 });

const subscriptionPaymentSchema = new mongoose.Schema({
  txID: { type: String, required: true, unique: true },
  userID: { type: String, required: true },
  name: { type: String, default: '' },
  amount: { type: Number, required: true },
  weeks: { type: Number, required: true },
  paymentSource: { type: String, default: 'WALLET' },
  previousExpiry: { type: Date },
  newExpiry: { type: Date },
  timestamp: { type: Date, default: Date.now },
  adminAction: { type: Boolean, default: false },
  adminUid: { type: String, default: '' },
  isRefunded: { type: Boolean, default: false },
  note: { type: String, default: '' }
}, { timestamps: true });

subscriptionPaymentSchema.index({ userID: 1, timestamp: -1 });
subscriptionPaymentSchema.index({ txID: 1 });

messengerAccountSchema.index({ status: 1 });
messengerAccountSchema.index({ authType: 1 });
messengerAccountSchema.index({ updatedAt: 1 });
personalAIAccountSchema.index({ status: 1 });

const cookieSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  slotId: { type: String, required: true },
  botId: { type: String, required: true },
  cookie: { type: String, required: true },
  status: { type: String, default: 'pending' },
  version: { type: Number, default: 1 },
  lastHeartbeat: { type: Date, default: null },
  lastLogin: { type: Date, default: null },
  lastError: { type: String, default: '' },
  owner: { type: String, default: '' },
  source: { type: String, default: 'client-portal' },
  connectionMode: { type: String, default: 'PLATFORM' },
  mongoUri: { type: String, default: '' },
  dbName: { type: String, default: 'shipu_ai' },
  heartbeat: { type: mongoose.Schema.Types.Mixed, default: null }
}, { timestamps: true });

cookieSchema.index({ status: 1 });
cookieSchema.index({ version: -1 });
cookieSchema.index({ userId: 1 });
cookieSchema.index({ botId: 1 });
cookieSchema.index({ slotId: 1 });
cookieSchema.index({ updatedAt: -1 });

const queueSchema = new mongoose.Schema({
  botId: { type: String },
  slotId: { type: String },
  userId: { type: String },
  cookieDocId: { type: String, required: true },
  action: { type: String, enum: ['SYNC', 'REFRESH', 'DELETE'], required: true },
  status: { type: String, enum: ['pending', 'processing', 'completed', 'failed'], default: 'pending' }
}, { timestamps: true });

queueSchema.index({ status: 1 });
queueSchema.index({ cookieDocId: 1 });
queueSchema.index({ createdAt: -1 });

const heartbeatSchema = new mongoose.Schema({
  cookieDocId: { type: String, required: true },
  botId: { type: String },
  userId: { type: String },
  slotId: { type: String },
  lastSeen: { type: Date, required: true },
  status: { type: String, default: 'running' },
  latency: { type: Number, default: 0 },
  uptime: { type: Number, default: 0 },
  messagesToday: { type: Number, default: 0 },
  errorsToday: { type: Number, default: 0 },
  memory: { type: Number, default: 0 },
  cpu: { type: Number, default: 0 },
  mqtt: { type: mongoose.Schema.Types.Mixed, default: {} },
  facebook: { type: mongoose.Schema.Types.Mixed, default: {} },
  serverVersion: { type: String, default: '2.5.0' },
  worker: { type: String, default: 'main' },
  cookieVersion: { type: Number, default: 1 }
}, { timestamps: true });

heartbeatSchema.index({ cookieDocId: 1 });
heartbeatSchema.index({ lastSeen: -1 });

const clientLogSchema = new mongoose.Schema({
  cookieDocId: { type: String, required: true },
  botId: { type: String },
  level: { type: String, default: 'INFO' },
  event: { type: String, required: true },
  message: { type: String, required: true },
  details: { type: mongoose.Schema.Types.Mixed, default: {} }
}, { timestamps: true });

clientLogSchema.index({ cookieDocId: 1, createdAt: -1 });

export const CookieModel = getDynamicModel('cookie', cookieSchema);
export const QueueModel = getDynamicModel('queue', queueSchema);
export const HeartbeatModel = getDynamicModel('heartbeat', heartbeatSchema);
export const ClientLogModel = getDynamicModel('client_log', clientLogSchema);

export const UserModel = getDynamicModel('User', userSchema);
export const ThreadModel = getDynamicModel('Thread', threadSchema);
export const AdminBotModel = getDynamicModel('AdminBot', adminBotSchema);
export const FtpConfigModel = getDynamicModel('FtpConfig', ftpConfigSchema);
export const AuditLogModel = getDynamicModel('AuditLog', auditLogSchema);
export const StoredCommandModel = getDynamicModel('StoredCommand', storedCommandSchema);
export const SystemCredentialModel = getDynamicModel('SystemCredential', systemCredentialSchema);
export const BotSettingModel = getDynamicModel('BotSetting', botSettingSchema);
export const MessengerAccountModel = getDynamicModel('MessengerAccount', messengerAccountSchema, 'cloudaccounts');
export const OfficialGroupModel = getDynamicModel('OfficialGroup', officialGroupSchema);
export const SharedAccessUserModel = getDynamicModel('SharedAccessUser', sharedAccessUserSchema);
export const PersonalAIAccountModel = getDynamicModel('PersonalAIAccount', personalAIAccountSchema);
export const SubscriptionModel = getDynamicModel('Subscription', subscriptionSchema);
export const SubscriptionPaymentModel = getDynamicModel('SubscriptionPayment', subscriptionPaymentSchema);

const brainMemorySchema = new mongoose.Schema({
  trigger: { type: String, required: true, unique: true },
  variations: { type: [String], default: [] },
  aiNormalizedTrigger: { type: [String], default: [] },
  reply: { type: String, required: true },
  replyVariations: { type: [String], default: [] },
  category: { type: String, default: 'general' },
  createdBy: { type: String, default: 'System' },
  usageCount: { type: Number, default: 0 },
  lastUsed: { type: Date, default: null },
  confidenceScore: { type: Number, default: 1.0 },
  enabled: { type: Boolean, default: true },
  tags: { type: [String], default: [] },
  // Passive learning factual data
  isFact: { type: Boolean, default: false },
  factEntity: { type: String, default: '' },
  factAttribute: { type: String, default: '' },
  factValue: { type: String, default: '' },
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} }
}, { timestamps: true });

const brainSuggestionSchema = new mongoose.Schema({
  trigger: { type: String, required: true, unique: true },
  suggestedReply: { type: String, required: true },
  confidence: { type: Number, default: 0.8 },
  count: { type: Number, default: 1 },
  status: { type: String, enum: ['pending', 'approved', 'dismissed'], default: 'pending' },
  // Extended fields for advanced passive learning
  category: { type: String, default: 'general' },
  isFact: { type: Boolean, default: false },
  factEntity: { type: String, default: '' },
  factAttribute: { type: String, default: '' },
  factValue: { type: String, default: '' },
  learningContext: { type: String, default: '' },
  conflictStatus: { type: String, enum: ['none', 'warning', 'resolved'], default: 'none' },
  conflictDetails: { type: String, default: '' }
}, { timestamps: true });

function stripEmojiFormatters(str: string): string {
  if (!str) return '';
  return str.normalize('NFC').replace(/[\uFE00-\uFE0F\u200B-\u200D\u200E\u200F]/g, '');
}

brainMemorySchema.pre('save', function(this: any) {
  if (this.trigger) {
    this.trigger = stripEmojiFormatters(this.trigger.toLowerCase().trim());
  }
  if (Array.isArray(this.variations)) {
    this.variations = this.variations.map((v: string) => stripEmojiFormatters((v || '').toLowerCase().trim())).filter(Boolean);
  }
  if (Array.isArray(this.aiNormalizedTrigger)) {
    this.aiNormalizedTrigger = this.aiNormalizedTrigger.map((v: string) => stripEmojiFormatters((v || '').toLowerCase().trim())).filter(Boolean);
  }
});

brainSuggestionSchema.pre('save', function(this: any) {
  if (this.trigger) {
    this.trigger = stripEmojiFormatters(this.trigger.toLowerCase().trim());
  }
});

brainMemorySchema.index({ trigger: 1 });
brainMemorySchema.index({ category: 1 });
brainMemorySchema.index({ enabled: 1 });

brainSuggestionSchema.index({ status: 1 });

export const BrainMemoryModel = getDynamicModel('BrainMemory', brainMemorySchema);
export const BrainSuggestionModel = getDynamicModel('BrainSuggestion', brainSuggestionSchema);

// --- SHIPU AI OPERATING SYSTEM (AIOS) SCHEMAS ---

const aiosSessionSchema = new mongoose.Schema({
  sessionID: { type: String, required: true, unique: true },
  userID: { type: String, required: true },
  threadID: { type: String, required: true },
  accountId: { type: String }, // Messenger account ID that initiated the session
  status: { type: String, enum: ['active', 'expired', 'cooldown'], default: 'active' },
  activatedAt: { type: Date, default: Date.now },
  expiresAt: { type: Date, required: true },
  messageCount: { type: Number, default: 0 },
  maxMessages: { type: Number, default: 50 },
  lastNotifiedMinutes: { type: [Number], default: [] }, // Tracks [5, 1] warning notifications sent
  personality: { type: String, default: 'default' }
}, { timestamps: true });

aiosSessionSchema.index({ sessionID: 1 });
aiosSessionSchema.index({ userID: 1, status: 1 });

const aiosMemorySchema = new mongoose.Schema({
  userID: { type: String, required: true, unique: true },
  facts: { type: Map, of: String, default: {} }, // Personal facts e.g. "name": "Aditya"
  conversationContext: { type: [Object], default: [] }, // Array of message history: { role: 'user'|'model', content: string, timestamp: Date }
  summary: { type: String, default: '' },
  personality: { type: String, default: 'default' },
  mood: { type: String, default: 'neutral' },
  cooldownUntil: { type: Date, default: null },
  pendingSuggestion: {
    type: {
      key: String,
      value: String,
      timestamp: Date
    },
    default: null
  }
}, { timestamps: true });

aiosMemorySchema.index({ userID: 1 });

const aiosUsageSchema = new mongoose.Schema({
  userID: { type: String, required: true, unique: true },
  coinsSpent: { type: Number, default: 0 },
  totalSessions: { type: Number, default: 0 },
  brainHits: { type: Number, default: 0 },
  llmCalls: { type: Number, default: 0 },
  totalMessages: { type: Number, default: 0 },
  premiumResets: { type: Number, default: 0 },
  lastInteraction: { type: Date, default: Date.now }
}, { timestamps: true });

aiosUsageSchema.index({ userID: 1 });

const aiLogSchema = new mongoose.Schema({
  timestamp: { type: Date, default: Date.now },
  provider: { type: String, required: true },
  model: { type: String, required: true },
  prompt: { type: String },
  responseTimeMs: { type: Number, required: true },
  tokenUsage: {
    promptTokens: { type: Number, default: 0 },
    candidatesTokens: { type: Number, default: 0 },
    totalTokens: { type: Number, default: 0 }
  },
  finishReason: { type: String },
  retries: { type: Number, default: 0 },
  success: { type: Boolean, required: true },
  errorMessage: { type: String },
  quotaFailure: { type: Boolean, default: false },
  requestId: { type: String },
  endpoint: { type: String },
  httpStatus: { type: Number },
  source: { type: String }
}, { timestamps: true });

export const AIOSSessionModel = getDynamicModel('AIOSSession', aiosSessionSchema);
export const AIOSMemoryModel = getDynamicModel('AIOSMemory', aiosMemorySchema);
export const AIOSUsageModel = getDynamicModel('AIOSUsage', aiosUsageSchema);
export const AILogModel = getDynamicModel('AILog', aiLogSchema);

const messageLogSchema = new mongoose.Schema({
  messageID: { type: String, required: true, unique: true },
  threadID: { type: String, required: true },
  senderID: { type: String, required: true },
  senderName: { type: String, default: '' },
  body: { type: String, default: '' },
  replyToMessageID: { type: String, default: null },
  isBotMessage: { type: Boolean, default: false },
  attachments: { type: [Object], default: [] }
}, { timestamps: true });

messageLogSchema.index({ messageID: 1 });
messageLogSchema.index({ threadID: 1, createdAt: -1 });

export const MessageLogModel = getDynamicModel('MessageLog', messageLogSchema);

const threadMemorySchema = new mongoose.Schema({
  threadID: { type: String, required: true, unique: true },
  rules: { type: [String], default: [] },
  pinnedDiscussions: { type: [String], default: [] },
  ongoingProjects: { type: [String], default: [] },
  customNotes: { type: Map, of: String, default: {} },
  summary: { type: String, default: '' }
}, { timestamps: true });

export const ThreadMemoryModel = getDynamicModel('ThreadMemory', threadMemorySchema);

const aiFeedbackSchema = new mongoose.Schema({
  messageID: { type: String, required: true },
  userID: { type: String, required: true },
  threadID: { type: String, required: true },
  rating: { type: String, enum: ['helpful', 'wrong', 'corrected'], required: true },
  correctedAnswer: { type: String, default: '' },
  confidenceDelta: { type: Number, default: 0 }
}, { timestamps: true });

export const AIFeedbackModel = getDynamicModel('AIFeedback', aiFeedbackSchema);

const inferredAttributeSchema = new mongoose.Schema({
  threadID: { type: String, required: true },
  userID: { type: String, required: true },
  userName: { type: String, default: '' },
  attributeType: { type: String, enum: ['relationship', 'nickname', 'communication_style'], required: true },
  value: { type: String, required: true },
  confidence: { type: Number, default: 1.0 },
  history: [{
    value: String,
    timestamp: { type: Date, default: Date.now },
    context: String
  }]
}, { timestamps: true });

inferredAttributeSchema.index({ threadID: 1, userID: 1, attributeType: 1 });

export const InferredAttributeModel = getDynamicModel('InferredAttribute', inferredAttributeSchema);

const fallbackApiSchema = new mongoose.Schema({
  name: { type: String, required: true },
  url: { type: String, required: true },
  apiKey: { type: String, required: true },
  model: { type: String, default: 'gemini-flash-latest' },
  enabled: { type: Boolean, default: true },
  priority: { type: Number, default: 0 },
  successCount: { type: Number, default: 0 },
  failCount: { type: Number, default: 0 },
  lastUsedAt: { type: Date },
  lastError: { type: String }
}, { timestamps: true });

export const FallbackApiModel = getDynamicModel('FallbackApi', fallbackApiSchema) as mongoose.Model<any>;

const telegramConfigSchema = new mongoose.Schema({
  configId: { type: String, default: 'primary', unique: true },
  encryptedToken: { type: String, default: '' },
  adminUserIds: { type: [String], default: [] },
  enabled: { type: Boolean, default: false },
  autoConnect: { type: Boolean, default: true },
  botUsername: { type: String, default: '' },
  botId: { type: String, default: '' },
  botFirstName: { type: String, default: '' },
  status: { type: String, default: 'OFFLINE' },
  receiverStatus: { type: String, default: 'STOPPED' },
  lastConnectedAt: { type: Number, default: 0 },
  lastDisconnectedAt: { type: Number, default: 0 },
  lastUpdateAt: { type: Number, default: 0 },
  lastError: { type: String, default: '' },
  stats: {
    messagesReceived: { type: Number, default: 0 },
    messagesProcessed: { type: Number, default: 0 },
    messagesFailed: { type: Number, default: 0 },
    commandsExecuted: { type: Number, default: 0 },
    uptimeMs: { type: Number, default: 0 }
  }
}, { timestamps: true });

export const TelegramConfigModel = getDynamicModel('TelegramConfig', telegramConfigSchema);


export async function connectMongoDB(): Promise<{ connected: boolean; error?: string }> {
  if (isConnected && mongoose.connection.readyState === 1) {
    return { connected: true };
  }

  if ((mongoose.connection.readyState as any) === 2) {
    // Wait for connection to establish
    await new Promise<void>((resolve) => {
      const check = () => {
        if ((mongoose.connection.readyState as any) === 1) {
          resolve();
        } else if ((mongoose.connection.readyState as any) === 0 || (mongoose.connection.readyState as any) === 3) {
          resolve();
        } else {
          setTimeout(check, 100);
        }
      };
      setTimeout(check, 100);
    });
    if ((mongoose.connection.readyState as any) === 1) {
      isConnected = true;
      return { connected: true };
    }
    return { connected: false, error: 'MongoDB connection in progress timed out' };
  }

  const now = Date.now();
  const cooldown = getReconnectCooldown();
  if (now - lastAttemptTime < cooldown) {
    return { connected: false, error: connectionError || 'MongoDB Atlas offline (fallback mode active)' };
  }

  lastAttemptTime = now;

  console.log('[DATABASE] MongoDB configuration loaded');
  console.log('[DATABASE] Connecting to MongoDB Atlas...');

  try {
    // Connect to MongoDB Atlas using hard-coded databaseConfig with fast fail-fast timeout (2s)
    await mongoose.connect(databaseConfig.uriMongodb, {
      serverSelectionTimeoutMS: 2000, 
      connectTimeoutMS: 2000,
    });
    isConnected = true;
    connectionError = null;
    reconnectAttempts = 0;

    console.log('[SUCCESS][DATABASE] MongoDB Atlas connection established successfully');
    console.log('[SUCCESS][DATABASE] Mongoose connection ready and verified');
    console.log('[DATABASE] Runtime storage: ONLINE (Atlas Mode)');

    // Auto-sync initial adminBot list if enabled in databaseConfig
    if (databaseConfig.autoSyncWhenStart) {
      try {
        for (const uid of initialAdminBot) {
          await AdminBotModel.updateOne(
            { uid },
            { $setOnInsert: { uid, addedBy: 'SYSTEM_CONFIG', addedAt: new Date().toISOString(), role: 'OWNER' } },
            { upsert: true }
          ).maxTimeMS(2000); // Small timeout for sync
        }

        // Auto-seed primary system fallback API
        const fallbackCount = await FallbackApiModel.countDocuments();
        if (fallbackCount === 0) {
          await FallbackApiModel.create({
            name: 'Primary System Fallback',
            url: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent',
            apiKey: 'AQ.Ab8RN6IehQEBeOqTHmEkmOGOYbYzSrS6VNkYVzWf_SJDbLSERA',
            model: 'gemini-flash-latest',
            enabled: true,
            priority: 10
          });
          console.log('[DATABASE] Seeded default fallback API configuration');
        }

        // Auto-seed user requested ChatGPT Fallback APIs if they are not already present
        const chatGptCount = await FallbackApiModel.countDocuments({ name: { $regex: /^ChatGPT Backup Route/ } });
        if (chatGptCount === 0) {
          const chatGptKeys = [
            "sk-abcdef1234567890abcdef1234567890abcdef12",
            "sk-1234567890abcdef1234567890abcdef12345678",
            "sk-abcdefabcdefabcdefabcdefabcdefabcdef12",
            "sk-7890abcdef7890abcdef7890abcdef7890abcd",
            "sk-1234abcd1234abcd1234abcd1234abcd1234abcd",
            "sk-abcd1234abcd1234abcd1234abcd1234abcd1234",
            "sk-5678efgh5678efgh5678efgh5678efgh5678efgh",
            "sk-efgh5678efgh5678efgh5678efgh5678efgh5678",
            "sk-ijkl1234ijkl1234ijkl1234ijkl1234ijkl1234",
            "sk-mnop5678mnop5678mnop5678mnop5678mnop5678",
            "sk-qrst1234qrst1234qrst1234qrst1234qrst1234",
            "sk-uvwx5678uvwx5678uvwx5678uvwx5678uvwx5678",
            "sk-1234ijkl1234ijkl1234ijkl1234ijkl1234ijkl",
            "sk-5678mnop5678mnop5678mnop5678mnop5678mnop",
            "sk-qrst5678qrst5678qrst5678qrst5678qrst5678",
            "sk-uvwx1234uvwx1234uvwx1234uvwx1234uvwx1234",
            "sk-1234abcd5678efgh1234abcd5678efgh1234abcd",
            "sk-5678ijkl1234mnop5678ijkl1234mnop5678ijkl",
            "sk-abcdqrstefghuvwxabcdqrstefghuvwxabcdqrst",
            "sk-ijklmnop1234qrstijklmnop1234qrstijklmnop",
            "sk-1234uvwx5678abcd1234uvwx5678abcd1234uvwx",
            "sk-efghijkl5678mnopabcd1234efghijkl5678mnop",
            "sk-mnopqrstuvwxabcdmnopqrstuvwxabcdmnopqrst",
            "sk-ijklmnopqrstuvwxijklmnopqrstuvwxijklmnop",
            "sk-abcd1234efgh5678abcd1234efgh5678abcd1234",
            "sk-1234ijklmnop5678ijklmnop1234ijklmnop5678",
            "sk-qrstefghuvwxabcdqrstefghuvwxabcdqrstefgh",
            "sk-uvwxijklmnop1234uvwxijklmnop1234uvwxijkl",
            "sk-abcd5678efgh1234abcd5678efgh1234abcd5678",
            "sk-ijklmnopqrstuvwxijklmnopqrstuvwxijklmnop",
            "sk-1234qrstuvwxabcd1234qrstuvwxabcd1234qrst",
            "sk-efghijklmnop5678efghijklmnop5678efghijkl",
            "sk-mnopabcd1234efghmnopabcd1234efghmnopabcd",
            "sk-ijklqrst5678uvwxijklqrst5678uvwxijklqrst",
            "sk-1234ijkl5678mnop1234ijkl5678mnop1234ijkl",
            "sk-abcdqrstefgh5678abcdqrstefgh5678abcdqrst",
            "sk-ijklmnopuvwx1234ijklmnopuvwx1234ijklmnop",
            "sk-efgh5678abcd1234efgh5678abcd1234efgh5678",
            "sk-mnopqrstijkl5678mnopqrstijkl5678mnopqrst",
            "sk-1234uvwxabcd5678uvwxabcd1234uvwxabcd5678",
            "sk-ijklmnop5678efghijklmnop5678efghijklmnop",
            "sk-abcd1234qrstuvwxabcd1234qrstuvwxabcd1234",
            "sk-1234efgh5678ijkl1234efgh5678ijkl1234efgh",
            "sk-5678mnopqrstuvwx5678mnopqrstuvwx5678mnop",
            "sk-abcdijkl1234uvwxabcdijkl1234uvwxabcdijkl",
            "sk-ijklmnopabcd5678ijklmnopabcd5678ijklmnop",
            "sk-1234efghqrstuvwx1234efghqrstuvwx1234efgh",
            "sk-5678ijklmnopabcd5678ijklmnopabcd5678ijkl",
            "sk-abcd1234efgh5678abcd1234efgh5678abcd1234",
            "sk-ijklmnopqrstuvwxijklmnopqrstuvwxijklmnop"
          ];

          const fallbackDocs = chatGptKeys.map((key, idx) => ({
            name: `ChatGPT Backup Route ${idx + 1}`,
            url: 'https://api.openai.com/v1/chat/completions',
            apiKey: key,
            model: 'gpt-4o-mini',
            enabled: true,
            priority: 2
          }));

          await FallbackApiModel.insertMany(fallbackDocs);
          console.log(`[DATABASE] Seeded ${fallbackDocs.length} ChatGPT fallback APIs successfully`);
        }

        // Auto-seed user requested OpenRouter Free Fallback APIs
        const openRouterCount = await FallbackApiModel.countDocuments({ name: { $regex: /^OpenRouter Free/ } });
        if (openRouterCount === 0) {
          const openRouterKey = "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";
          const openRouterModels = [
            { id: "google/gemma-4-26b-a4b-it:free", label: "Gemma 4 26B" },
            { id: "openai/gpt-oss-20b:free", label: "GPT OSS 20B" },
            { id: "cohere/north-mini-code:free", label: "Cohere North Mini Code" },
            { id: "google/gemma-2-9b-it:free", label: "Gemma 2 9B" },
            { id: "meta-llama/llama-3-8b-instruct:free", label: "Llama 3 8B Instruct" },
            { id: "meta-llama/llama-3.1-8b-instruct:free", label: "Llama 3.1 8B Instruct" },
            { id: "mistralai/mistral-7b-instruct:free", label: "Mistral 7B Instruct" },
            { id: "qwen/qwen-2-7b-instruct:free", label: "Qwen 2 7B Instruct" },
            { id: "microsoft/phi-3-medium-128k-instruct:free", label: "Phi 3 Medium" },
            { id: "openchat/openchat-7b:free", label: "OpenChat 7B" }
          ];

          const openRouterDocs = openRouterModels.map((m, idx) => ({
            name: `OpenRouter Free - ${m.label}`,
            url: 'https://openrouter.ai/api/v1/chat/completions',
            apiKey: openRouterKey,
            model: m.id,
            enabled: true,
            priority: 5
          }));

          await FallbackApiModel.insertMany(openRouterDocs);
          console.log(`[DATABASE] Seeded ${openRouterDocs.length} OpenRouter Free fallback APIs successfully`);
        }
      } catch (syncErr: any) {
        console.warn('[DATABASE] Warning: Initial admin/fallback sync failed (possibly primary selection pending):', syncErr.message);
      }
    }

    return { connected: true };
  } catch (err: any) {
    isConnected = false;
    reconnectAttempts++;
    await mongoose.disconnect().catch(() => {});
    // Sanitize any potential sensitive credentials in error message
    const rawError = err?.message || 'MongoDB connection failed';
    connectionError = rawError.replace(/mongodb(\+srv)?:\/\/[^@]+@/gi, 'mongodb+srv://<credentials>@');
    console.warn('[DATABASE] MongoDB Atlas offline (local fallback active):', connectionError);
    return { connected: false, error: connectionError };
  }
}

export function getMongoStatus(): { connected: boolean; status: string; transport: string; database: string; error?: string } {
  const readyState = mongoose.connection.readyState;
  if (readyState === 1) {
    return {
      connected: true,
      status: 'ONLINE',
      transport: 'Mongoose ODM',
      database: 'MongoDB Atlas'
    };
  }
  return {
    connected: false,
    status: 'OFFLINE',
    transport: 'Mongoose ODM',
    database: 'MongoDB Atlas',
    error: connectionError || 'Disconnected'
  };
}
