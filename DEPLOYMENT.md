# ShiPu Ai🤖 - Production Deployment Guide

This guide explains how to deploy **ShiPu Ai🤖** on **Cloud Run**, **Docker**, or **Linux Server (PM2 / Systemd)**.

---

## 1. Environment Variables Setup

Create your production `.env` file or pass environment variables via container secrets:

```env
PORT=3000
NODE_ENV=production
BOT_NAME="ShiPu Ai🤖"
GLOBAL_PREFIX="#"
BOT_OWNER_ID="10001"
GEMINI_API_KEY="AIzaSy..."
FACEBOOK_PAGE_ACCESS_TOKEN="EAA..."
FACEBOOK_WEBHOOK_VERIFY_TOKEN="shipu_ai_token_2026"
MONGODB_URI="mongodb+srv://user:pass@cluster.mongodb.net/shipu_ai"
```

## 2. Render.com Deployment (Zero-Config)

This repository includes a pre-configured `render.yaml` blueprint:

1. Push code to GitHub/GitLab.
2. In Render Dashboard, click **New +** -> **Blueprint**.
3. Select your repository.
4. Render automatically detects `render.yaml` and deploys using:
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`
5. Zero environment variables required — all defaults & self-healing mechanisms work out of the box!

---

## 3. Docker Deployment

### Dockerfile
```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json pnpm-lock.yaml ./
RUN npm install -g pnpm && pnpm install --frozen-lockfile
COPY . .
RUN pnpm build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/appstate_cookie.json ./appstate_cookie.json
RUN npm install --omit=dev

EXPOSE 3000
CMD ["node", "dist/server.cjs"]
```

---

## 3. Deployment with PM2

```bash
# Build production bundle
pnpm build

# Start using PM2
pm2 start dist/server.cjs --name "shipu-ai-bot"
```

---

## 4. Connecting Facebook Messenger Webhook

1. Go to the [Facebook Developers Portal](https://developers.facebook.com/).
2. Create a Messenger App & Generate a **Page Access Token**.
3. Set Webhook Callback URL to:
   `https://your-domain.com/api/bot/webhook`
4. Set Verify Token matching `FACEBOOK_WEBHOOK_VERIFY_TOKEN`.
5. Subscribe to `messages`, `messaging_postbacks`, and `message_reactions` events.

---

© 2026 ShiPu Ai🤖 Deployment Manual.
