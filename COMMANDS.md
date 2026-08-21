# ShiPu Ai🤖 - Built-In Plugin Commands

Below is the reference guide for all default command plugins pre-packaged with **ShiPu Ai🤖**.

Default Global Prefix: `#`

---

## 📂 1. System Commands (`category: system`)

### `#help [command_name]`
- **Aliases**: `menu`, `commands`
- **Permission**: Role 0 (All Users)
- **Cooldown**: 3 seconds
- **Description**: Displays the interactive command menu categorized by topic, or detailed usage specs for a specific command.

### `#ping`
- **Aliases**: `p`, `latency`
- **Permission**: Role 0
- **Cooldown**: 2 seconds
- **Description**: Checks bot response latency and server execution timestamp.

### `#uptime`
- **Aliases**: `up`, `status`
- **Permission**: Role 0
- **Cooldown**: 3 seconds
- **Description**: Displays runtime duration, active memory consumption, and thread metrics.

### `#info`
- **Aliases**: `about`, `botinfo`
- **Permission**: Role 0
- **Cooldown**: 5 seconds
- **Description**: Shows ShiPu Ai🤖 engine version, webhook gateway status, and Gemini AI status.

---

## 📂 2. Admin Commands (`category: admin`)

### `#prefix [new_prefix]`
- **Aliases**: `setprefix`, `pfx`
- **Permission**: Role 1 (Group Admin)
- **Cooldown**: 3 seconds
- **Description**: Displays or updates the command prefix for the current group thread.

### `#kick <user_name_or_id>`
- **Aliases**: `remove`
- **Permission**: Role 1 (Group Admin)
- **Cooldown**: 3 seconds
- **Description**: Kicks a member out of the Facebook Messenger group thread.

### `#autowelcome <on|off|setmsg <text>>`
- **Aliases**: `welcome`
- **Permission**: Role 1 (Group Admin)
- **Cooldown**: 3 seconds
- **Description**: Toggles or configures automatic welcome greeting for new members joining the group.

### `#ban <user_name_or_id>`
- **Aliases**: `block`
- **Permission**: Role 2 (Bot Admin)
- **Cooldown**: 3 seconds
- **Description**: Bans a user globally from executing ShiPu Ai🤖 commands.

---

## 📂 3. Economy Commands (`category: economy`)

### `#balance`
- **Aliases**: `bal`, `money`, `wallet`
- **Permission**: Role 0
- **Cooldown**: 2 seconds
- **Description**: Checks cash balance, bank savings, total net worth, level, and EXP points.

### `#daily`
- **Aliases**: `claimdaily`
- **Permission**: Role 0
- **Cooldown**: 5 seconds
- **Description**: Claims a daily cash bonus ($500 - $1,000). Cooldown: 24 hours.

### `#work`
- **Aliases**: `job`
- **Permission**: Role 0
- **Cooldown**: 10 seconds
- **Description**: Completes a mini-job to earn cash and experience points.

### `#transfer <amount> [member_name]`
- **Aliases**: `pay`, `sendmoney`
- **Permission**: Role 0
- **Cooldown**: 3 seconds
- **Description**: Transfers cash safely from your wallet to another group member.

### `#bank <deposit|withdraw|all> <amount>`
- **Aliases**: `dep`, `with`
- **Permission**: Role 0
- **Cooldown**: 3 seconds
- **Description**: Manages your savings account in the ShiPu Ai🤖 Central Bank.

### `#top [money|level]`
- **Aliases**: `leaderboard`, `rich`
- **Permission**: Role 0
- **Cooldown**: 3 seconds
- **Description**: Displays the top 10 wealthiest or highest-level members in the thread.

---

## 📂 4. Fun & Social Commands (`category: fun`)

### `#rps <rock|paper|scissors> [bet]`
- **Aliases**: `rockpaperscissors`
- **Permission**: Role 0
- **Cooldown**: 3 seconds
- **Description**: Play Rock, Paper, Scissors against ShiPu Ai🤖 with optional cash wagering.

### `#marry <member_name>`
- **Aliases**: `proposal`
- **Permission**: Role 0
- **Cooldown**: 5 seconds
- **Description**: Propose marriage to another member in the group thread.

---

## 📂 5. AI & Tools Commands (`category: ai`)

### `#gemini <prompt>`
- **Aliases**: `ai`, `ask`, `shipu`
- **Permission**: Role 0
- **Cooldown**: 3 seconds
- **Description**: Ask Google Gemini 3.6 Flash AI any question or prompt directly from Messenger.

### `#weather <city_name>`
- **Aliases**: `temp`, `forecast`
- **Permission**: Role 0
- **Cooldown**: 3 seconds
- **Description**: Check current weather conditions and temperature for any location.

---

© 2026 ShiPu Ai🤖 Command Documentation.
