# Weight Tracker Telegram Bot

Telegram bot for tracking weight with privacy-first design. Built on Cloudflare Workers with D1 database.

## Features

- **Private weight tracking** — only you can see your absolute weights
- **Group delta posting** — share only weight changes (Δ), never absolute values
- **Edit last entry** — inline button to correct mistakes
- **Daily entries** — one weight per day, overwrites if updated
- **Timezone support** — Asia/Nicosia timezone for date calculation
- **Scheduled reports** — daily (Mon-Sat) and weekly (Sunday) group reports at 19:00 Asia/Nicosia
- **AI-powered reports** — OpenAI generates friendly intro/outro for group reports (optional)
- **Daily reminders** — private reminder at 11:00 Asia/Nicosia for users who haven't logged weight

## Privacy

- Absolute weights are visible ONLY to the user who submitted them
- Owner cannot access other users' weights
- Group messages show only delta changes, never absolute weights
- **OpenAI integration**: Only names and deltas are sent to OpenAI — absolute weights are NEVER shared with external services

## Setup Instructions

### 1. Create Telegram Bot

1. Open Telegram and find [@BotFather](https://t.me/BotFather)
2. Send `/newbot` and follow instructions
3. Copy the bot token (looks like `123456789:ABCdefGHIjklMNOpqrsTUVwxyz`)
4. Get your Telegram user ID (send message to [@userinfobot](https://t.me/userinfobot))

### 2. Install Dependencies

```bash
npm install
```

### 3. Create D1 Database

```bash
wrangler d1 create weight-tracker-db
# Copy the database_id from output and paste it into wrangler.toml
```

### 4. Update wrangler.toml

Replace `<YOUR_DATABASE_ID_HERE>` with your actual database ID.

### 5. Apply Database Migrations

```bash
# Apply all migrations
wrangler d1 execute DB --remote --file=migrations/0001_init.sql
wrangler d1 execute DB --remote --file=migrations/0002_weights.sql
wrangler d1 execute DB --remote --file=migrations/0003_pending_actions.sql
wrangler d1 execute DB --remote --file=migrations/0004_reminders_sent.sql
wrangler d1 execute DB --remote --file=migrations/0005_reliability.sql
```

### 6. Set Secrets

```bash
wrangler secret put TELEGRAM_BOT_TOKEN
wrangler secret put OWNER_USER_ID

# Optional: OpenAI for AI-generated report intro/outro
wrangler secret put OPENAI_API_KEY
# Optional: specify model (defaults to gpt-4o-mini)
wrangler secret put OPENAI_MODEL
```

### 7. Deploy Worker

```bash
npm run deploy
```

### 8. Set Webhook

```bash
curl -X POST "https://api.telegram.org/bot<BOT_TOKEN>/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{"url": "<WORKER_URL>"}'
```

## Usage

### Tracking Weight (Private Chat)

Send your weight in any of these formats:
- `87.4`
- `87,4`
- `вес 87.4`
- `/w 87.4`

Bot will reply with confirmation and delta from previous entry.

### Edit Last Entry

After saving weight, press the **✏️ Edit last** button to correct mistakes.
Send the new weight and the entry will be updated.

### Commands

| Command | Description |
|---------|-------------|
| `/start` | Welcome message |
| `/me` | Show your last weight and delta |
| `/history 7` | Show last 7 entries |
| `/history 30` | Show last 30 entries |
| `/cancel` | Cancel pending edit action |
| `/setgroup` | Configure group for delta posting (owner only) |
| `/status` | Show bot configuration (owner only) |

## Group Posting

1. Add bot to your group
2. Send `/setgroup` in the group (owner only)
3. When users log weight in private chat, only delta is posted to group:
   - `Username: Δ -0.3 kg`
   - `Username: first entry`
   - `Username: Δ +0.2 kg (updated)` (after edit)

## Напоминалки

- Отправляются ежедневно в 11:00 Asia/Nicosia
- Только в личные сообщения
- Только пользователям, которые не внесли вес сегодня
- Пользователь должен сначала написать боту `/start`
- Debug команда: `/debug_run_reminders` (owner only)

## Project Structure

```
├── src/
│   ├── index.ts              # Main worker entry point
│   ├── types.ts              # TypeScript interfaces
│   ├── config.ts             # Constants
│   ├── i18n.ts               # Russian translations
│   ├── openai.ts             # OpenAI integration
│   ├── utils.ts              # Utility functions
│   ├── telegram/
│   │   └── api.ts            # Telegram API with retry
│   ├── db/
│   │   ├── users.ts          # User operations
│   │   ├── weights.ts        # Weight operations
│   │   ├── settings.ts       # Settings operations
│   │   └── pending-actions.ts
│   ├── handlers/
│   │   ├── commands.ts       # Command handlers
│   │   ├── weight.ts         # Weight input handler
│   │   ├── callback.ts       # Callback query handler
│   │   ├── reports.ts        # Daily/weekly reports
│   │   └── reminders.ts      # Reminder logic
│   └── helpers/
│       ├── job-lock.ts       # Idempotent job execution
│       └── rate-limit.ts     # Anti-spam rate limiting
├── migrations/
│   ├── 0001_init.sql
│   ├── 0002_weights.sql
│   ├── 0003_pending_actions.sql
│   ├── 0004_reminders_sent.sql
│   └── 0005_reliability.sql
├── wrangler.toml
├── package.json
├── tsconfig.json
└── README.md
```

## Database Schema

**users** — Telegram users
- `user_id` (INTEGER, PRIMARY KEY)
- `display_name`, `username`, `created_at`

**settings** — Key-value storage
- `key` (TEXT, PRIMARY KEY), `value`

**weights** — Weight entries (one per user per day)
- `id`, `user_id`, `date`, `weight_kg`, `created_at`, `updated_at`
- UNIQUE(user_id, date)

**pending_actions** — Temporary action states (e.g., edit mode)
- `user_id` (PRIMARY KEY), `action`, `created_at`

**reminders_sent** — Tracks sent reminders to avoid duplicates
- `user_id`, `date` (PRIMARY KEY)
- `sent_at`

**cron_runs** — Tracks scheduled job executions (idempotency)
- `job`, `date` (PRIMARY KEY)
- `started_at`, `finished_at`, `status`, `info`

**rate_limits** — Anti-spam rate limiting
- `user_id`, `key` (PRIMARY KEY)
- `window_start`, `count`

## Reliability

- **Idempotent cron jobs** — each scheduled task runs only once per day/week
- **Rate limiting** — max 6 weight inputs per 2 minutes per user
- **Telegram retry** — automatic retry on 429/5xx errors with backoff
- **OpenAI timeout** — 10 second timeout, fallback to plain report on failure
- **OpenAI validation** — suspicious numbers filtered, invalid JSON rejected
- **Privacy guards** — group messages never contain absolute weights

## Backup

Export database weekly:

```bash
npx wrangler d1 export telegram-bot-db --output backup-$(date +%Y-%m-%d).sql
```

Store backups locally or in cloud storage.

## Manual Test Plan

### Privacy Tests
- [ ] Send weight in private chat → absolute weight visible only to you
- [ ] Check group message → only delta shown, never absolute weight
- [ ] `/status` shows only settings, not user weights
- [ ] OpenAI payload inspection → only deltas, never absolute weights

### Cron Tests
- [ ] `/debug_daily` sends report to group
- [ ] `/debug_daily` second time → "already sent today"
- [ ] `/debug_weekly` sends weekly report
- [ ] `/debug_run_reminders` sends reminders to users without weight today

### Reminder Tests
- [ ] Remove today's weight with `/debug_addday 0 null`
- [ ] Run `/debug_run_reminders` → should receive reminder
- [ ] Run again → should skip (already sent)

### Rate Limit Test
- [ ] Send 7+ weights rapidly → should see "Слишком часто" message

### OpenAI Fallback Test
- [ ] If OpenAI fails, report still sends (without intro/outro)
