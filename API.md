# ShiPu Ai🤖 - REST & Webhook API Reference

ShiPu Ai🤖 exposes a RESTful API and real-time interface for communication between the core bot process and the Next.js/React Admin Dashboard.

---

## 🛰️ 1. Bot Engine REST Endpoints

### `GET /api/bot/stats`
Returns system status, uptime, CPU/memory usage, thread count, and message counters.
- **Response**:
  ```json
  {
    "uptimeSeconds": 1420,
    "totalCommandsExecuted": 38,
    "totalEventsHandled": 124,
    "activeThreadsCount": 3,
    "registeredUsersCount": 5,
    "memoryUsageMB": 52.4,
    "cpuLoadPercent": 8.5,
    "status": "ONLINE"
  }
  ```

### `GET /api/bot/commands`
Returns all registered plugin commands and custom modules.

### `POST /api/bot/plugins/toggle`
Enables or disables a command plugin.
- **Body**: `{ "name": "work", "enabled": false }`

### `POST /api/bot/plugins/custom`
Deploys a custom plugin dynamically into runtime memory.
- **Body**:
  ```json
  {
    "name": "hello",
    "description": "Custom greeting",
    "category": "Custom",
    "role": 0,
    "code": "await message.reply('Hello World from ShiPu Ai!');"
  }
  ```

### `POST /api/bot/chat`
Simulates an incoming Messenger event in the Live Browser Simulator.
- **Body**: `{ "threadID": "thread_101", "senderID": "10001", "message": "#ping" }`

### `GET /api/bot/threads`
Retrieves all registered group threads and settings.

### `POST /api/bot/threads`
Creates or updates a thread's configuration.

### `GET /api/bot/users`
Retrieves user records, role levels, and cash balances.

### `POST /api/bot/users/update`
Updates a user's role, cash, or ban status.

### `GET /api/bot/logs`
Fetches structured logs (`DEBUG`, `INFO`, `WARN`, `ERROR`, `CMD`, `EVENT`).

### `DELETE /api/bot/logs`
Clears terminal logs.

### `GET /api/bot/settings` & `POST /api/bot/settings`
Gets or updates global configuration (Prefix, Webhook URL, AppState cookies, Maintenance Mode).

---

## 🤖 2. Gemini AI Proxy Endpoint

### `POST /api/gemini/chat`
Proxies prompts safely to Google Gemini 3.6 Flash without exposing server secrets to the client.
- **Body**: `{ "prompt": "Explain quantum physics in Bengali" }`
- **Response**: `{ "response": "..." }`

---

© 2026 ShiPu Ai🤖 API Manual.
