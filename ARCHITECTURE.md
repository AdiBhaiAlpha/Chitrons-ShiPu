# ShiPu Ai🤖 - System Architecture & Life Cycle

This document explains the internal architecture, lifecycle flow, and decoupled design of the **ShiPu Ai🤖** Messenger bot platform.

---

## 1. Message Lifecycle Flow

```text
Incoming Message
      │
      ▼
┌─────────────────────────┐
│   Messenger Adapter     │ (MockAdapter or Facebook Graph/FCA Adapter)
└──────────┬──────────────┘
           │
           ▼
┌─────────────────────────┐
│      Event Parser       │ (Formats raw payload into standardized ShiPuEvent)
└──────────┬──────────────┘
           │
           ▼
┌─────────────────────────┐
│   Middleware Pipeline   │ (Maintenance Check ➔ Thread/User Ban Check ➔ Anti-Spam)
└──────────┬──────────────┘
           │
      ┌────┴────────────────────────┐
      │                             │
   Is Command?                  No (Chat Event)
   (Starts with # or prefix)        │
      │                             ▼
      ▼                     ┌──────────────────┐
┌───────────────────────┐   │  Event Handlers  │ (onChat, Auto-Reply, Keywords)
│    Command Resolver   │   └──────────────────┘
└──────────┬────────────┘
           │
           ▼
┌───────────────────────┐
│ Permission & Cooldown │ (Role 0 = User, Role 1 = Group Admin, Role 2 = Bot Admin)
└──────────┬────────────┘
           │
           ▼
┌───────────────────────┐
│   Command Handler     │ (Executes plugin onStart method)
└──────────┬────────────┘
           │
           ▼
┌───────────────────────┐
│   Messenger Reply     │ (Routes response text / media back via Adapter)
└───────────────────────┘
```

---

## 2. Decoupled Messenger Adapter Interface

Commands and core business logic do NOT depend directly on Facebook Graph API or FCA libraries. They interact exclusively through the abstract `MessengerAdapter` interface:

```typescript
export interface MessengerAdapter {
  sendMessage(threadID: string, text: string, attachments?: string[]): Promise<ShiPuBotResponse>;
  reply(threadID: string, messageID: string, text: string): Promise<ShiPuBotResponse>;
  react(messageID: string, emoji: string): Promise<void>;
  sendImage(threadID: string, url: string): Promise<ShiPuBotResponse>;
  sendVideo(threadID: string, url: string): Promise<ShiPuBotResponse>;
  sendFile(threadID: string, url: string): Promise<ShiPuBotResponse>;
  getUserInfo(userID: string): Promise<Partial<ShiPuUser>>;
  getThreadInfo(threadID: string): Promise<Partial<ShiPuThread>>;
  getThreadList(): Promise<ShiPuThread[]>;
  addUser(threadID: string, userID: string): Promise<void>;
  removeUser(threadID: string, userID: string): Promise<void>;
  markAsRead(threadID: string): Promise<void>;
}
```

This isolation ensures that ShiPu Ai🤖 can run seamlessly in browser simulation mode or be adapted to Telegram / Discord / WhatsApp without modifying any commands.

---

## 3. Role Hierarchy & Permission Levels

ShiPu Ai🤖 uses a 4-tier permission model:

| Role Level | Identifier | Scope & Capabilities |
| :--- | :--- | :--- |
| **Role 0** | Normal User | Access to General, Economy, Fun, and AI commands |
| **Role 1** | Group Admin | Group-level admin commands (`#prefix`, `#kick`, `#autowelcome`, `#settings`) |
| **Role 2** | Bot Admin | Global bot administration, command toggles, user ban management |
| **Role 3** | Bot Owner | Full engine access, custom code evaluation, system maintenance |

---

## 4. Pending Reply & Reaction Routing Systems

1. **Pending Reply Queue**:
   When a command sends an interactive prompt, it stores a pending reply handle containing `threadID`, `senderID`, `commandName`, `replyHandler`, and an expiration TTL. When a user replies to that message in Messenger, ShiPu Ai🤖 routes the event to `onReply`.

2. **Reaction Handler Queue**:
   Command outputs register reaction hooks mapping message IDs to reaction triggers. When a user reacts with an emoji, ShiPu Ai🤖 fires `onReaction`.

---

© 2026 ShiPu Ai🤖 Architecture Manual.
