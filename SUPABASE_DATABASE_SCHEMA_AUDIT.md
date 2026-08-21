# Supabase PostgreSQL Database Schema Audit

This document provides a complete and accurate inventory of the Supabase PostgreSQL database schema currently used by the **ShiPu AI Server** project. It represents a strict, read-only audit of the tables, columns, indexes, constraints, triggers, real-time publication configurations, and processing flows declared in the codebase.

---

## 1. TABLE LIST

The project defines and automatically verifies **8 tables** inside Supabase PostgreSQL. These tables form the entire operational backend for the **Cloud Client Bots** system.

| Table Name | Purpose | Feature / Module | Required? | Realtime? | Auto-Created? | Expected Data? |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **`client_bot_sessions`** | Stores bot configurations, credentials (raw cookies), run states, and login history. | Cloud Client Bots | **Yes** | **Yes** (All events) | **Yes** | Yes (Bot config & state) |
| **`client_bot_queue`** | Commands/task queue to trigger actions (Sync, restart, logout). | Bot Controller | **Yes** | **Yes** (`INSERT` only) | **Yes** | Yes (Task items) |
| **`client_bot_logs`** | Streaming log ledger for debugging active bot instances. | Bot Console Log | **Yes** | **Yes** (Table only) | **Yes** | Yes (Log history) |
| **`client_bot_heartbeats`** | High-frequency time-series logging of stats and system health. | Monitor & Status | **Yes** | No | **Yes** | Yes (Historic ticks) |
| **`client_bot_metrics`** | Accumulates aggregated counters (Total messages, reconnects, uptime). | Dashboard Analytics | **Yes** | No | **Yes** | Yes (Summary stats) |
| **`client_bot_events`** | Custom event logging with details. | System Auditing | **Yes** | No | **Yes** | Yes (Custom logs) |
| **`client_bot_runtime`** | Live RAM/CPU/Uptime stats of running processes. | Live Health | **Yes** | No | **Yes** | Yes (Live snapshots) |
| **`client_bot_errors`** | Unhandled stack-traces and run-time error logging. | Quality Assurance | **Yes** | No | **Yes** | Yes (Error logs) |

---

## 2. COLUMNS

Below is the exhaustive layout of columns for every table exactly as initialized by the codebase:

### TABLE: `client_bot_sessions`

| Column | PostgreSQL Type | Nullable | Default | Primary Key | Foreign Key | Purpose |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **`id`** | `UUID` | NO | `gen_random_uuid()` | **YES** | None | Unique session identifier |
| **`bot_id`** | `TEXT` | NO | None | NO | None | Unique ID of the client bot (constrained unique) |
| **`slot_id`** | `TEXT` | YES | None | NO | None | Associated Slot ID |
| **`user_id`** | `TEXT` | YES | None | NO | None | ID of the authorized client |
| **`owner`** | `TEXT` | YES | `'Client Bot'` | NO | None | Name of the bot owner |
| **`cookie`** | `TEXT` | NO | None | NO | None | Raw JSON string containing authentication cookies |
| **`status`** | `TEXT` | YES | `'pending'` | NO | None | Current pipeline/runtime status |
| **`connection_mode`**| `TEXT` | YES | `'default'` | NO | None | Connection protocol mode (e.g. `ipv6` / `auto`) |
| **`db_name`** | `TEXT` | YES | None | NO | None | Name of target MongoDB mirror database |
| **`version`** | `INTEGER` | YES | `1` | NO | None | Version counter to trigger reloads on update |
| **`last_login`** | `TIMESTAMPTZ` | YES | None | NO | None | Timestamp of last successful login |
| **`last_heartbeat`** | `TIMESTAMPTZ` | YES | None | NO | None | Timestamp of last recorded supervisor heartbeat |
| **`last_error`** | `TEXT` | YES | None | NO | None | Latest error description message |
| **`created_at`** | `TIMESTAMPTZ` | YES | `NOW()` | NO | None | Creation timestamp |
| **`updated_at`** | `TIMESTAMPTZ` | YES | `NOW()` | NO | None | Modification timestamp |

---

### TABLE: `client_bot_queue`

| Column | PostgreSQL Type | Nullable | Default | Primary Key | Foreign Key | Purpose |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **`id`** | `UUID` | NO | `gen_random_uuid()` | **YES** | None | Unique queue item identifier |
| **`bot_id`** | `TEXT` | NO | None | NO | None | Target bot identifier |
| **`slot_id`** | `TEXT` | YES | None | NO | None | Associated Slot ID |
| **`user_id`** | `TEXT` | YES | None | NO | None | Requesting user identifier |
| **`session_id`** | `UUID` | YES | None | NO | `client_bot_sessions(id) ON DELETE CASCADE` | Associated active session |
| **`action`** | `TEXT` | NO | None | NO | None | Command name (`SYNC`, `REFRESH`, `RESTART`, `DELETE`, `LOGOUT`, `RECONNECT`) |
| **`status`** | `TEXT` | YES | `'pending'` | NO | None | Action status (`pending`, `processing`, `completed`, `failed`) |
| **`created_at`** | `TIMESTAMPTZ` | YES | `NOW()` | NO | None | Queue insertion timestamp |
| **`updated_at`** | `TIMESTAMPTZ` | YES | `NOW()` | NO | None | Queue update timestamp |

---

### TABLE: `client_bot_logs`

| Column | PostgreSQL Type | Nullable | Default | Primary Key | Foreign Key | Purpose |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **`id`** | `UUID` | NO | `gen_random_uuid()` | **YES** | None | Log entry identifier |
| **`bot_id`** | `TEXT` | NO | None | NO | None | Bot identifier |
| **`session_id`** | `UUID` | YES | None | NO | `client_bot_sessions(id) ON DELETE CASCADE` | Associated active session |
| **`level`** | `TEXT` | NO | None | NO | None | Log level (`INFO`, `WARNING`, `ERROR`, `SUCCESS`) |
| **`category`** | `TEXT` | NO | None | NO | None | Logging component category (e.g. `AUTH`, `MQTT`, `SYSTEM`) |
| **`message`** | `TEXT` | NO | None | NO | None | Main log details |
| **`details`** | `JSONB` | YES | `'{}'::jsonb` | NO | None | Supplemental trace metadata |
| **`created_at`** | `TIMESTAMPTZ` | YES | `NOW()` | NO | None | Logging timestamp |

---

### TABLE: `client_bot_heartbeats`

| Column | PostgreSQL Type | Nullable | Default | Primary Key | Foreign Key | Purpose |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **`id`** | `UUID` | NO | `gen_random_uuid()` | **YES** | None | Heartbeat tick identifier |
| **`bot_id`** | `TEXT` | NO | None | NO | None | Bot identifier |
| **`session_id`** | `UUID` | YES | None | NO | `client_bot_sessions(id) ON DELETE CASCADE` | Associated active session |
| **`last_seen`** | `TIMESTAMPTZ` | YES | `NOW()` | NO | None | Uptime tracking timestamp |
| **`status`** | `TEXT` | NO | None | NO | None | Instance online status (`running`, `offline`) |
| **`messages_today`** | `INTEGER` | YES | `0` | NO | None | Total messages processed today |
| **`commands_today`** | `INTEGER` | YES | `0` | NO | None | AI queries executed today |
| **`errors_today`** | `INTEGER` | YES | `0` | NO | None | Errors encountered today |
| **`uptime_seconds`**| `INTEGER` | YES | `0` | NO | None | Session uptime duration |
| **`cpu_usage`** | `DOUBLE PRECISION`| YES | `0.0` | NO | None | Snapshot CPU load percent |
| **`memory_usage`** | `DOUBLE PRECISION`| YES | `0.0` | NO | None | Process heap memory allocation in MB |
| **`mqtt_status`** | `TEXT` | YES | `'OFF'` | NO | None | Instant MQTT broker status (`CONNECTED`, `OFF`) |
| **`facebook_status`**| `TEXT` | YES | `'DISCONNECTED'`| NO| None | Instant Facebook connection status |
| **`created_at`** | `TIMESTAMPTZ` | YES | `NOW()` | NO | None | Creation timestamp |

---

### TABLE: `client_bot_metrics`

| Column | PostgreSQL Type | Nullable | Default | Primary Key | Foreign Key | Purpose |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **`id`** | `UUID` | NO | `gen_random_uuid()` | **YES** | None | Metrics entry identifier |
| **`bot_id`** | `TEXT` | NO | None | NO | None | Target bot ID (constrained unique) |
| **`total_messages`**| `INTEGER` | YES | `0` | NO | None | Aggregate parsed messages count |
| **`ai_messages`** | `INTEGER` | YES | `0` | NO | None | Aggregate executed AI completions count |
| **`reconnects`** | `INTEGER` | YES | `0` | NO | None | Cumulative reconnect attempts made |
| **`uptime_ms`** | `BIGINT` | YES | `0` | NO | None | Sum total uptime duration in milliseconds |
| **`created_at`** | `TIMESTAMPTZ` | YES | `NOW()` | NO | None | Creation timestamp |
| **`updated_at`** | `TIMESTAMPTZ` | YES | `NOW()` | NO | None | Modification timestamp |

---

### TABLE: `client_bot_events`

| Column | PostgreSQL Type | Nullable | Default | Primary Key | Foreign Key | Purpose |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **`id`** | `UUID` | NO | `gen_random_uuid()` | **YES** | None | Event entry identifier |
| **`bot_id`** | `TEXT` | NO | None | NO | None | Bot identifier |
| **`event_type`** | `TEXT` | NO | None | NO | None | Event classifier |
| **`payload`** | `JSONB` | YES | `'{}'::jsonb` | NO | None | Event details JSON |
| **`created_at`** | `TIMESTAMPTZ` | YES | `NOW()` | NO | None | Creation timestamp |

---

### TABLE: `client_bot_runtime`

| Column | PostgreSQL Type | Nullable | Default | Primary Key | Foreign Key | Purpose |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **`id`** | `UUID` | NO | `gen_random_uuid()` | **YES** | None | Snapshot entry identifier |
| **`bot_id`** | `TEXT` | NO | None | NO | None | Target bot ID (constrained unique) |
| **`cpu`** | `DOUBLE PRECISION`| YES | `0.0` | NO | None | Latest CPU load percent |
| **`memory`** | `DOUBLE PRECISION`| YES | `0.0` | NO | None | Heap memory consumption in MB |
| **`uptime`** | `INTEGER` | YES | `0` | NO | None | Cumulative runtime seconds |
| **`last_updated`** | `TIMESTAMPTZ` | YES | `NOW()` | NO | None | Heartbeat tick timestamp |

---

### TABLE: `client_bot_errors`

| Column | PostgreSQL Type | Nullable | Default | Primary Key | Foreign Key | Purpose |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **`id`** | `UUID` | NO | `gen_random_uuid()` | **YES** | None | Error entry identifier |
| **`bot_id`** | `TEXT` | NO | None | NO | None | Target bot ID |
| **`error_code`** | `TEXT` | YES | None | NO | None | System error type classification |
| **`error_message`** | `TEXT` | YES | None | NO | None | Readable exception description |
| **`stack_trace`** | `TEXT` | YES | None | NO | None | Debugging trace log dump |
| **`created_at`** | `TIMESTAMPTZ` | YES | `NOW()` | NO | None | Timestamp of exception occurrence |

---

## 3. PRIMARY KEYS

All tables use a uniform Primary Key strategy:
- **Primary Key Column**: `id`
- **PostgreSQL Type**: `UUID`
- **Auto-Generation Mechanism**: Automatically generated at database insert time via the Postgres native function **`gen_random_uuid()`**.

---

## 4. FOREIGN KEYS

The schema uses strict cascading referential integrity to clean up secondary/historical data automatically if a parent bot session is removed:

1. **`client_bot_queue.session_id`** $\rightarrow$ **`client_bot_sessions.id`**
   - **Parent Table**: `client_bot_sessions`
   - **Child Table**: `client_bot_queue`
   - **Referenced Column**: `id`
   - **ON DELETE Behavior**: `CASCADE` (Removes queued commands automatically if a session is deleted).
   - **ON UPDATE Behavior**: Default (No actions).

2. **`client_bot_logs.session_id`** $\rightarrow$ **`client_bot_sessions.id`**
   - **Parent Table**: `client_bot_sessions`
   - **Child Table**: `client_bot_logs`
   - **Referenced Column**: `id`
   - **ON DELETE Behavior**: `CASCADE` (Purges session execution log histories on session removal).

3. **`client_bot_heartbeats.session_id`** $\rightarrow$ **`client_bot_sessions.id`**
   - **Parent Table**: `client_bot_sessions`
   - **Child Table**: `client_bot_heartbeats`
   - **Referenced Column**: `id`
   - **ON DELETE Behavior**: `CASCADE` (Wipes historical heartbeat statistics logs if the parent session is removed).

---

## 5. INDEXES

The database automatically initializes **6 indexes** to ensure ultra-low latency searches and avoid full table scans:

| Index Name | Target Table | Target Column(s) | Is Unique? | Engineering Purpose |
| :--- | :--- | :--- | :--- | :--- |
| **`idx_sessions_bot_id`** | `client_bot_sessions` | `bot_id` | No | Optimizes finding active sessions by Bot ID |
| **`idx_queue_bot_id`** | `client_bot_queue` | `bot_id` | No | Rapid command filtering for an individual bot |
| **`idx_queue_status`** | `client_bot_queue` | `status` | No | Speeds up the server's periodic queue worker searching for `'pending'` tasks |
| **`idx_logs_bot_id`** | `client_bot_logs` | `bot_id` | No | Speeds up log querying on the client console view |
| **`idx_logs_category`**| `client_bot_logs` | `category` | No | Speeds up console filtering (e.g. viewing only `AUTH` or `MQTT` errors) |
| **`idx_heartbeats_bot_id`**| `client_bot_heartbeats`| `bot_id` | No | Speeds up historical status trend line rendering |

---

## 6. UNIQUE CONSTRAINTS

To maintain integrity and prevent corrupt duplicated threads, unique index constraints are placed on specific table columns:
1. **`client_bot_sessions.bot_id`**: Prevents establishing multiple active concurrent session handlers for the same physical Bot ID.
2. **`client_bot_metrics.bot_id`**: Restricts the stats table to exactly one reporting aggregate row per Bot ID.
3. **`client_bot_runtime.bot_id`**: Ensures only a single active resource footprint is recorded for a specific Bot ID.

---

## 7. CHECK CONSTRAINTS

- **Database level**: There are **no** explicit, database-enforced `CHECK` constraints (such as `status IN (...)` or `cpu_usage >= 0`) defined within the PostgreSQL DDL.
- **Application level**: Type and content safety validation (e.g. confirming status labels) are strictly evaluated inside the server's application layers (`CookieLoader.ts`, `ClientBotsManager.ts`, and the router schemas).

---

## 8. DEFAULT VALUES

Key system defaults specified in PostgreSQL to ensure fail-safe row insertion:
- **All Tables**: `id` defaults to `gen_random_uuid()`
- **Timestamps (`created_at`, `updated_at`, `last_seen`, `last_updated`)**: Default to database system clock **`NOW()`** / `TIMESTAMPTZ DEFAULT NOW()`
- **Boolean / Numeric Counts (`messages_today`, `commands_today`, `errors_today`, `uptime_seconds`, `cpu_usage`, `memory_usage`, `total_messages`, `ai_messages`, `reconnects`, `uptime_ms`, `cpu`, `memory`, `uptime`)**: Default to `0`, `0.0`, or `1` where appropriate.
- **`status`**: Defaults to `'pending'` in both `client_bot_sessions` and `client_bot_queue`.
- **`connection_mode`**: Defaults to `'default'`.
- **`owner`**: Defaults to `'Client Bot'`.
- **`details` & `payload`**: Default to `'{}'::jsonb`.

---

## 9. ENUMS

- Native PostgreSQL `CREATE TYPE ... AS ENUM` constructs are **not** used by this project.
- Statuses and log levels are managed cleanly using basic, indexed PostgreSQL **`TEXT`** columns to allow smooth runtime extension without locking schema tables.

---

## 10. JSON / JSONB

The schema uses native **`JSONB`** columns to support extensible and dynamic structured payloads without altering tables:

1. **`client_bot_logs.details`**:
   - Purpose: Stores contextual trace outputs.
   - Example structure: `{ raw: details }` or `{ error: err.message, provider: "FCA" }`.
2. **`client_bot_events.payload`**:
   - Purpose: Encapsulates generic, event-specific details (e.g., specific MQTT event callbacks or login response payloads).

---

## 11. REALTIME

The ShiPu AI server utilizes Supabase's WebSocket-based Realtime system heavily to process operations dynamically.

The database initialization adds 3 tables to the native **`supabase_realtime`** publication:

### Real-Time Subscriptions

| Table | Event | Action/Trigger Condition | Server Response Handler |
| :--- | :--- | :--- | :--- |
| **`client_bot_sessions`** | `INSERT` | Row created with `status === 'pending'` | Calls `activationPipeline(record)` to parse, authenticate, and run the bot. |
| | `UPDATE` | State changed to `status === 'pending'` | Re-runs `activationPipeline` to launch or synchronize the bot. |
| | `UPDATE` | State changed to `status === 'removed'` | Triggers `handleDeleteFlow(bot_id)` to shut down listeners and disconnect connection. |
| | `UPDATE` | `new.version > old.version` | Detects credential/cookie update; performs a hot-reboot of the active thread. |
| | `DELETE` | Row completely removed | Performs emergency runner cleanup and teardown. |
| **`client_bot_queue`** | `INSERT` | Row inserted with `status === 'pending'` | Transitions state to `'processing'`, runs queue actions (`SYNC`, `REFRESH`, `RESTART` $\rightarrow$ activates; `DELETE`, `LOGOUT` $\rightarrow$ deletes; `RECONNECT` $\rightarrow$ reconnects), and sets state to `'completed'` or `'failed'`. |
| **`client_bot_logs`** | - | *Published but not read by server* | Server writes log items to this table. Published for real-time visualization on the frontend web app's live terminal component. |

---

## 12. CLOUD CLIENT BOT FLOW

The visual flow of how a client-side interaction turns into a running, real-time bot process:

```
[ Client Web Dashboard UI ]
          │
          │ User enters Facebook cookie JSON string
          ▼
[ Supabase table: client_bot_sessions ] ──(Inserts session with status = 'pending')
          │
          │ Realtime WebSockets notification fires
          ▼
[ ShiPu AI Server: clientBotsManager.ts ]
          │
          ├──► 1. Transitions status to 'processing'
          │
          ├──► 2. Transitions status to 'validating' (runs CookieLoader.validateCookieJson)
          │
          ├──► 3. Transitions status to 'logging_in' (runs FallbackManager.authenticate)
          │
          ├──► 4. Transitions status to 'connected' (encrypts cookies, configures meta)
          │
          ├──► 5. Transitions status to 'mqtt_connecting' (launches AccountConnection)
          │
          ├──► 6. Handshake Success: Logs success, sets status to 'running'
          │
          ▼
[ Active Chat Broker Engine Running ]
          │ (Periodic 30s Loop: writes metrics, runtime load, and ticks logs)
          ▼
[ Supabase: client_bot_heartbeats, client_bot_runtime, client_bot_metrics ]
```

---

## 13. COOKIE STORAGE

- **Target Table**: `client_bot_sessions`
- **Target Column**: `cookie`
- **PostgreSQL Type**: `TEXT`
- **Encryption**: Stored as a raw, readable JSON string in Supabase. (Encryption is performed in-memory on the Node.js server-side process using `encryptAuthState` AES-256-GCM for storage inside the active connection metadata, but the source of truth in Supabase is unencrypted text to allow straightforward client/admin inputs).
- **Actual cookie stored**: Yes, the full raw cookie list is stored directly.
- **Read & Write actors**:
  - **Written by**: Frontend dashboards/admins configuring the bot.
  - **Read by**: `ClientBotsManager.ts` on the ShiPu AI backend server during initial launch, auto-recovery checks, or hot-reload version bumps.
  - **Detection method**: Listened to by the server through the `client_bot_changes` Supabase Realtime Channel.

---

## 14. BOT STATUS

The execution/pipeline states are tracked under **`client_bot_sessions.status`**. The lifecycle statuses used by the project are:

1. `'pending'`: Newly inserted or requested to run.
2. `'processing'`: Server has claimed the task and is bootstrapping the workflow.
3. `'validating'`: Verifying the cookie structure and parameters.
4. `'logging_in'`: Contacting Facebook login/FCA servers.
5. `'connected'`: Successfully authenticated with credentials.
6. `'mqtt_connecting'`: Establishing active connection with Chat network.
7. `'running'`: Fully online, listening to events, and actively executing AI prompts.
8. `'recovering'`: Unplanned disconnect detected; the watchdog supervisor is trying to restore connection.
9. `'failed'`: An error was encountered during setup/validation (see `last_error`).
10. `'removed'`: Session marked as deleted; active instance killed.

---

## 15. HEARTBEAT / HEALTH

Active running instances are checked and recorded every **30 seconds** by the server watchdog loops:

- **Tables utilized**: `client_bot_heartbeats`, `client_bot_sessions`, `client_bot_runtime`, `client_bot_metrics`.
- **Columns updated**:
  - `client_bot_heartbeats.status` (set to `'running'` or `'offline'`)
  - `client_bot_heartbeats.facebook_status` & `mqtt_status`
  - `client_bot_sessions.last_heartbeat` & `updated_at` (updated to `NOW()`)
  - `client_bot_runtime.cpu`, `memory`, `uptime`
  - `client_bot_metrics.total_messages`, `ai_messages`, `reconnects`
- **Update Mechanism**:
  - `ClientBotsManager.ts` launches an asynchronous `setInterval` loop during startup that fires every 30 seconds.
  - It pulls diagnostic runtime data from the running `AccountConnection` instances, aggregates metrics, and executes concurrent database write queries (`INSERT` / `UPSERT` / `UPDATE`) to report fresh metrics to Supabase.

---

## 16. LOGGING

Logs are written dynamically to separate historical, debugging, and analytical tables:

1. **`client_bot_logs`**:
   - Stores general execution logs.
   - Contains: `bot_id`, `session_id`, `level` (`INFO`, `WARNING`, `ERROR`, `SUCCESS`), `category` (`SESSION`, `AUTH`, `LOGIN`, `MQTT`, `SYSTEM`), `message`, and `details` JSONB.
2. **`client_bot_errors`**:
   - Stores uncaught failures.
   - Contains: `bot_id`, `error_code`, `error_message`, and `stack_trace`.

---

## 17. QUEUE SYSTEM

The task processor coordinates manual user operations on the bots:

- **Task Entry**: Users execute an action in the UI, which creates a row in `client_bot_queue` containing the target `bot_id`, the desired `action` (`SYNC`, `REFRESH`, `RESTART`, `DELETE`, `LOGOUT`, `RECONNECT`), and `status: 'pending'`.
- **Process Claim**: Server's realtime trigger catches the `INSERT` on `client_bot_queue`, instantly sets status to `'processing'`, and begins the designated action logic.
- **Race/Duplicate Protection**: Transitioning status to `'processing'` in the database prevents multiple workers from processing the same command concurrently.
- **Resolution**: Once completed, status is set to `'completed'`. If an error occurs, it transitions to `'failed'` and logs the issue under `last_error` in the queue item.

---

## 18. AUTOMATIC DATABASE INITIALIZATION

The server's `initializeDatabase()` method in `SupabaseService.ts` automatically runs upon startup to ensure all tables, indexes, and triggers exist cleanly in the target Supabase Postgres instance.

### Actually Implemented
- **Tables**: Creates 8 `client_bot_` prefixed tables: `sessions`, `queue`, `logs`, `heartbeats`, `metrics`, `events`, `runtime`, and `errors`.
- **Triggers**: Hooks `BEFORE UPDATE` triggers on `sessions`, `queue`, and `metrics` to update `updated_at` automatically using the function `update_updated_at_column()`.
- **Indexes**: Creates 6 indices for optimizing bot_id and status lookups.
- **Realtime**: Appends `client_bot_sessions`, `client_bot_queue`, and `client_bot_logs` into the native `supabase_realtime` publication.

### Expected but not implemented (Not in Code)
- Database-level validation check constraints.
- Foreign Keys referencing general user account tables or billing profiles (handled exclusively inside Node.js application memory).

---

## 19. TRIGGERS

The database initializes **3 active triggers** executing the same helper function:

| Trigger Name | Target Table | Event | Function Executed | Engineering Purpose |
| :--- | :--- | :--- | :--- | :--- |
| **`trg_update_client_bot_sessions`**| `client_bot_sessions`| `BEFORE UPDATE` | `update_updated_at_column()`| Automatically keeps `updated_at` accurate on updates |
| **`trg_update_client_bot_queue`** | `client_bot_queue` | `BEFORE UPDATE` | `update_updated_at_column()`| Automatically updates `updated_at` on queue items |
| **`trg_update_client_bot_metrics`** | `client_bot_metrics` | `BEFORE UPDATE` | `update_updated_at_column()`| Automatically updates `updated_at` on stats updates |

---

## 20. FUNCTIONS / RPC

- **Functions Created**:
  - **`update_updated_at_column()`**: A PL/pgSQL function returning `TRIGGER` which sets `NEW.updated_at = NOW(); RETURN NEW;`.
- **RPC / Stored Procedures Called**: None.

---

## 21. FINAL SCHEMA SUMMARY

- **TOTAL TABLES**: 8

```
1. client_bot_sessions
   Columns: 15
   Realtime: YES
   Purpose: Main credentials registry and lifecycle states holder.

2. client_bot_queue
   Columns: 9
   Realtime: YES
   Purpose: Command/actions queue.

3. client_bot_logs
   Columns: 8
   Realtime: YES
   Purpose: Diagnostic and activity execution log stream.

4. client_bot_heartbeats
   Columns: 14
   Realtime: NO
   Purpose: Time-series statistical tracker of system resource usage.

5. client_bot_metrics
   Columns: 8
   Realtime: NO
   Purpose: Aggregated lifetime performance metrics.

6. client_bot_events
   Columns: 5
   Realtime: NO
   Purpose: System-level audit trail.

7. client_bot_runtime
   Columns: 6
   Realtime: NO
   Purpose: Live instant status snapshot tracker.

8. client_bot_errors
   Columns: 6
   Realtime: NO
   Purpose: Unhandled application stack traces registry.
```

### Relationship Map

```
client_bot_sessions (Primary Registry)
 ├── id (Primary Key UUID)
 │    ├── referenced by client_bot_queue.session_id (ON DELETE CASCADE)
 │    ├── referenced by client_bot_logs.session_id (ON DELETE CASCADE)
 │    └── referenced by client_bot_heartbeats.session_id (ON DELETE CASCADE)
 └── bot_id (TEXT UNIQUE)
```
