# ShiPu Ai🤖 - Database Schema & Data Models

ShiPu Ai🤖 uses MongoDB (with Mongoose) and an in-memory fallback layer for seamless deployment across containerized environments.

---

## 1. Thread Document Schema (`ThreadSettings`)

```typescript
export interface ShiPuThread {
  threadID: string;            // Facebook Messenger Thread ID
  name: string;                // Group Thread Title
  prefix: string;              // Custom prefix (default: "#")
  language: string;            // Language code ("bn", "en")
  timezone: string;            // Timezone string ("Asia/Dhaka")
  members: ShiPuUser[];        // Array of member records
  adminIDs: string[];          // List of thread admin Facebook user IDs
  autoWelcome: boolean;        // Welcome new members toggle
  welcomeMessage: string;      // Custom greeting template
  goodbyeMessage: string;      // Custom departure template
  antiSpam: boolean;           // Rate-limit anti-spam filter
  antiLink: boolean;           // Auto-remove external links
  aiEnabled: boolean;          // Enable Gemini AI auto-reply
  economyEnabled: boolean;     // Enable cash/bank commands
  isBanned: boolean;           // Group ban status
  createdAt: number;           // Creation epoch timestamp
}
```

---

## 2. User Document Schema (`UserSchema`)

```typescript
export interface ShiPuUser {
  userID: string;              // Facebook User ID
  name: string;                // Full Name
  avatarUrl?: string;          // Avatar Image URL
  role: 0 | 1 | 2 | 3;         // 0: User, 1: Group Admin, 2: Bot Admin, 3: Owner
  exp: number;                 // Experience Points
  level: number;               // Member Level
  money: number;               // Wallet Cash Balance ($)
  bankMoney: number;           // Savings Account Balance ($)
  isBanned: boolean;           // Global Ban Status
  banReason?: string;          // Reason for ban
  marriagePartner?: {          // Married partner record
    userID: string;
    name: string;
  } | null;
  lastDaily?: number;          // Epoch timestamp of last daily claim
  lastWork?: number;           // Epoch timestamp of last work claim
}
```

---

## 3. Atomic Economy Transactions

To prevent race conditions during money transfers, deposits, or daily rewards, ShiPu Ai🤖 performs atomic field increments:

```typescript
// Example Atomic Money Transfer
usersData.increment(senderID, 'money', -amount);
usersData.increment(targetID, 'money', amount);
```

---

© 2026 ShiPu Ai🤖 Database Reference.
