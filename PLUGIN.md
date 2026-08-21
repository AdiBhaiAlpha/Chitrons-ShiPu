# ShiPu Ai🤖 - Plugin Development Guide

ShiPu Ai🤖 uses an extensible, event-driven plugin system. Every command is an independent TypeScript/JavaScript module.

---

## 1. Plugin Interface Structure

A ShiPu Ai🤖 plugin exposes a `config` metadata object and life-cycle hook handlers:

```typescript
import { ShiPuCommandModule } from '../types/shipu';

const pingPlugin: ShiPuCommandModule = {
  config: {
    name: "ping",
    aliases: ["p", "latency"],
    version: "1.0.0",
    author: "ShiPu Ai Dev Team",
    role: 0, // 0 = User, 1 = Group Admin, 2 = Bot Admin
    category: "system",
    description: "Check bot response speed and server latency",
    guide: "{pref}ping",
    countDown: 2, // Cooldown in seconds
    enabled: true
  },

  // Main command execution hook
  async onStart({ message, args, event, currentUser, currentThread, usersData, threadsData, api }) {
    const startTime = Date.now();
    await message.reply(`🏓 **Pong from ShiPu Ai🤖!**\n⚡ Roundtrip: ${Date.now() - startTime}ms`);
  },

  // Optional: Passive chat event listener for non-command messages
  async onChat({ message, event, currentUser }) {
    if (event.body.toLowerCase().includes('hello shipu')) {
      await message.reply(`👋 Hello ${currentUser.name}! How can ShiPu Ai🤖 help you today?`);
    }
  },

  // Optional: Handler when a user replies to a message sent by this command
  async onReply({ message, args, replyData }) {
    await message.reply(`Received your reply: "${args.join(' ')}"`);
  },

  // Optional: Handler when a user reacts with an emoji to this command's message
  async onReaction({ message, reaction, userID }) {
    if (reaction === '❤️') {
      await message.reply(`Thanks for the love! ❤️`);
    }
  }
};

export default pingPlugin;
```

---

## 2. Command Context Parameters

When `onStart` or `onReply` is executed, ShiPu Ai🤖 injects a rich execution context:

| Context Property | Description |
| :--- | :--- |
| `message` | Reply API helper (`reply()`, `send()`, `react()`, `kick()`) |
| `args` | Tokenized array of arguments passed after the command name |
| `event` | Standardized event payload (`threadID`, `senderID`, `messageID`, `body`, `prefixUsed`) |
| `currentUser` | `ShiPuUser` record of the sender |
| `currentThread` | `ShiPuThread` configuration for the group |
| `usersData` | Key-value database getter/setter for users |
| `threadsData` | Key-value database getter/setter for thread settings |
| `api` | Access to global bot configuration (`getBotConfig()`) |

---

## 3. Creating Custom Plugins via Admin Dashboard

ShiPu Ai🤖 features a built-in Live Plugin Creator on the Admin Dashboard:

1. Open the **Plugins** tab in the ShiPu Ai🤖 Dashboard.
2. Click **Create Custom Plugin**.
3. Write your JavaScript / TypeScript execution body using the `ctx` object.
4. Click **Deploy Plugin Live**. ShiPu Ai🤖 compiles and registers the plugin instantly without restarting the bot!

---

© 2026 ShiPu Ai🤖 Plugin Development Guide.
