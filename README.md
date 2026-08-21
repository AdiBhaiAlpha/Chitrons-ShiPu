# ShiPu Ai🤖 - Production-Ready Messenger Group Chat Bot Platform

ShiPu Ai🤖 is a modular, event-driven, extensible Facebook Messenger group chat bot platform and admin dashboard engine built with **Node.js**, **TypeScript**, **Express**, **React**, **Tailwind CSS**, and **Google Gemini 3.6 Flash AI**.

ShiPu Ai🤖 is an original, clean-room implementation with its own core engine, Messenger adapter layer, reply/reaction routers, economy engine, and Next/React control dashboard.

---

## 🌟 Key Features

- **🤖 Central Bot Core**: Event-driven message dispatcher with prefix resolution, alias mapping, role permission verification, and cooldown limiters.
- **🔌 Plugin Command System**: Modular, self-contained plugins loaded dynamically without modifying the core engine (`onStart`, `onReply`, `onReaction`, `onChat`, `onEvent`).
- **💬 Reply & Reaction Routers**: State-aware reply queue routing nested conversational replies and emoji reaction triggers directly back to command instances.
- **🛡️ Messenger Adapter Layer**: Abstracted `MessengerAdapter` interface isolating Messenger API / FCA logic from commands, with `MockMessengerAdapter` for live browser simulation.
- **👥 Group Thread Management**: Per-group prefix (`#`), language (`bn`/`en`), timezone (`Asia/Dhaka`), welcome/goodbye greetings, anti-spam, and anti-link filters.
- **💰 Economy & Game Engine**: Atomic cash and bank transactions, daily rewards, mini-jobs, peer transfers, leaderboards, and Rock-Paper-Scissors betting games.
- **🧠 Server-Side Gemini AI**: Native integration with Google Gemini 3.6 Flash model for natural conversational responses and smart automated replies.
- **💻 Admin Dashboard**: Real-time control panel with live Messenger simulator, thread manager, user/role editor, custom plugin code builder, and searchable terminal log viewer.

---

## 📁 Monorepo Folder Structure

```text
shiPu-ai/
├── apps/
│   ├── bot/
│   │   └── src/
│   │       ├── core/          # Central Engine, Dispatcher, Plugin Loader
│   │       ├── commands/      # Plugin Commands (System, Admin, Economy, Fun, AI)
│   │       ├── events/        # Event Listeners (Chat, Reply, Reaction, Join, Leave)
│   │       ├── handlers/      # Reply Router & Reaction Router
│   │       ├── middleware/    # Rate Limiter, Anti-Spam, Role Checkers
│   │       ├── services/      # AI Service & Scheduler Engine
│   │       ├── database/      # Users & Threads Store (Mongoose / Memory)
│   │       ├── adapters/      # MessengerAdapter Interface & Mock/Graph Adapters
│   │       ├── utils/         # Helper functions & Formatters
│   │       └── index.ts       # Bot Entry Point
│   │
│   └── dashboard/             # Admin Web Dashboard (React + Tailwind CSS)
│       ├── app/
│       ├── components/
│       ├── lib/
│       └── public/
│
├── packages/
│   ├── types/                 # Shared TypeScript Types & Interfaces
│   ├── database/              # Schema Definitions & Models
│   ├── utils/                 # Shared Utility Helpers
│   └── config/                # Global Bot Configuration Constants
│
├── appstate_cookie.json       # Encrypted Facebook Cookie State
├── pnpm-workspace.yaml        # PNPM Workspace Definition
└── package.json               # Monorepo Root Dependencies & Scripts
```

---

## 🚀 Quick Start & Installation

1. **Clone & Install Dependencies**:
   ```bash
   pnpm install
   ```

2. **Configure Environment Variables**:
   Copy `.env.example` to `.env` and fill in your keys:
   ```bash
   cp .env.example .env
   ```

3. **Start Development Environment**:
   ```bash
   pnpm dev
   ```
   Access the ShiPu Ai🤖 Dashboard at `http://localhost:3000`.

---

## 📄 Documentation Index

- [Architecture Guide](ARCHITECTURE.md)
- [Command Reference](COMMANDS.md)
- [Plugin Development Guide](PLUGIN.md)
- [REST & Webhook API](API.md)
- [Database & Schema](DATABASE.md)
- [Deployment Guide](DEPLOYMENT.md)

---

© 2026 ShiPu Ai🤖 Ecosystem. Built with Node.js & TypeScript.
