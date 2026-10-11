import { messengerLogger } from '../MessengerLogger';

/**
 * Normalizes Facebook Chat API instance across various FCA unofficial packages
 * (DongDev FCA, Xavia FCA, Xnil FCA, Horizon FCA) to ensure uniform method signatures,
 * callback & promise dual compatibility, and missing method polyfills.
 */
export function normalizeFcaApi(api: any, providerName: string = 'FCA'): any {
  if (!api || typeof api !== 'object') return api;

  // 1. Thread List normalization
  if (!api.getThreadList && api.threads?.getList) {
    api.getThreadList = api.threads.getList.bind(api.threads);
  }
  if (!api.getThreadList && typeof api.getThreadListGraphQL === 'function') {
    api.getThreadList = api.getThreadListGraphQL.bind(api);
  }

  if (typeof api.getThreadList === 'function') {
    const rawGetThreadList = api.getThreadList.bind(api);
    api.getThreadList = function (
      limitOrArg: any,
      timestampOrTagsOrCallback?: any,
      tagsOrCallback?: any,
      maybeCallback?: any
    ) {
      let limit = typeof limitOrArg === 'number' ? limitOrArg : 50;
      let timestamp: any = null;
      let tags: any = ['INBOX'];
      let cb: any = null;

      if (typeof limitOrArg === 'function') {
        cb = limitOrArg;
        limit = 50;
      } else if (typeof timestampOrTagsOrCallback === 'function') {
        cb = timestampOrTagsOrCallback;
      } else if (typeof tagsOrCallback === 'function') {
        cb = tagsOrCallback;
        if (Array.isArray(timestampOrTagsOrCallback)) tags = timestampOrTagsOrCallback;
        else if (typeof timestampOrTagsOrCallback === 'number') timestamp = timestampOrTagsOrCallback;
      } else if (typeof maybeCallback === 'function') {
        cb = maybeCallback;
        timestamp = timestampOrTagsOrCallback;
        tags = tagsOrCallback;
      } else {
        if (Array.isArray(timestampOrTagsOrCallback)) tags = timestampOrTagsOrCallback;
        else if (typeof timestampOrTagsOrCallback === 'number') timestamp = timestampOrTagsOrCallback;
        if (Array.isArray(tagsOrCallback)) tags = tagsOrCallback;
      }

      if (cb) {
        try {
          const res = rawGetThreadList(limit, timestamp, tags, cb);
          if (res && typeof res.then === 'function') {
            res.then((data: any) => cb(null, data)).catch((err: any) => cb(err));
          }
        } catch (callErr) {
          cb(callErr);
        }
      } else {
        return new Promise((resolve, reject) => {
          try {
            const res = rawGetThreadList(limit, timestamp, tags, (err: any, data: any) => {
              if (err) reject(err);
              else resolve(data || []);
            });
            if (res && typeof res.then === 'function') {
              res.then(resolve).catch(reject);
            }
          } catch (callErr) {
            reject(callErr);
          }
        });
      }
    };
  }

  // 2. Thread History normalization
  if (!api.getThreadHistory && api.threads?.getHistory) {
    api.getThreadHistory = api.threads.getHistory.bind(api.threads);
  }
  if (!api.getThreadHistory && typeof api.getThreadHistoryGraphQL === 'function') {
    api.getThreadHistory = api.getThreadHistoryGraphQL.bind(api);
  }

  if (typeof api.getThreadHistory === 'function') {
    const rawGetThreadHistory = api.getThreadHistory.bind(api);
    api.getThreadHistory = function (
      threadID: string,
      amount: number,
      timestampOrCallback?: any,
      maybeCallback?: any
    ) {
      let timestamp: any = undefined;
      let cb: any = null;

      if (typeof timestampOrCallback === 'function') {
        cb = timestampOrCallback;
      } else if (typeof maybeCallback === 'function') {
        cb = maybeCallback;
        timestamp = timestampOrCallback;
      } else {
        timestamp = timestampOrCallback;
      }

      if (cb) {
        try {
          const res = rawGetThreadHistory(threadID, amount, timestamp, cb);
          if (res && typeof res.then === 'function') {
            res.then((data: any) => cb(null, data)).catch((err: any) => cb(err));
          }
        } catch (callErr) {
          cb(callErr);
        }
      } else {
        return new Promise((resolve, reject) => {
          try {
            const res = rawGetThreadHistory(threadID, amount, timestamp, (err: any, data: any) => {
              if (err) reject(err);
              else resolve(data || []);
            });
            if (res && typeof res.then === 'function') {
              res.then(resolve).catch(reject);
            }
          } catch (callErr) {
            reject(callErr);
          }
        });
      }
    };
  }

  // 3. Thread Info normalization
  if (!api.getThreadInfo && api.threads?.getInfo) {
    api.getThreadInfo = api.threads.getInfo.bind(api.threads);
  }
  if (!api.getThreadInfo && typeof api.getThreadInfoGraphQL === 'function') {
    api.getThreadInfo = api.getThreadInfoGraphQL.bind(api);
  }

  // 4. User Info normalization
  if (!api.getUserInfo && api.users?.getInfo) {
    api.getUserInfo = api.users.getInfo.bind(api.users);
  }
  if (!api.getUserInfo && typeof api.getUserInfoGraphQL === 'function') {
    api.getUserInfo = api.getUserInfoGraphQL.bind(api);
  }

  // 5. Send Message normalization
  if (!api.sendMessage && api.messages?.send) {
    api.sendMessage = api.messages.send.bind(api.messages);
  }

  // 6. Mark as Read / Seen
  if (!api.markAsRead && api.messages?.markRead) {
    api.markAsRead = api.messages.markRead.bind(api.messages);
  }
  if (!api.markAsSeen && api.messages?.markSeen) {
    api.markAsSeen = api.messages.markSeen.bind(api.messages);
  }

  // 7. Send Typing Indicator
  if (!api.sendTypingIndicator && api.messages?.typing) {
    api.sendTypingIndicator = api.messages.typing.bind(api.messages);
  }

  // 8. Delete / Unsend message
  if (!api.deleteMessage && api.messages?.delete) {
    api.deleteMessage = api.messages.delete.bind(api.messages);
  }
  if (!api.unsendMessage && api.messages?.unsend) {
    api.unsendMessage = api.messages.unsend.bind(api.messages);
  }

  // 9. MQTT Listener normalization (ensure both listenMqtt and listen exist and bridge)
  if (typeof api.listenMqtt === 'function' && typeof api.listen !== 'function') {
    api.listen = api.listenMqtt.bind(api);
  } else if (typeof api.listen === 'function' && typeof api.listenMqtt !== 'function') {
    api.listenMqtt = api.listen.bind(api);
  }

  messengerLogger.info('AUTH', `[${providerName}] API normalization complete. getThreadList: ${typeof api.getThreadList}, getThreadHistory: ${typeof api.getThreadHistory}, sendMessage: ${typeof api.sendMessage}, listenMqtt: ${typeof api.listenMqtt}`);
  return api;
}
