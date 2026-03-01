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

### Personal Statistics (Private Only)

Press **📈 7 дней** or **📅 30 дней** to see your progress:

- Last entry with date and weight (visible only to you)
- Today's delta (change from previous entry)
- Period delta (change over 7/30 days)
- Streak: consecutive days with entries
- Check-in count
- ASCII sparkline chart with min/max
- Recent entries list

**Privacy:** Personal stats including absolute weights are visible only in private chat. Group never sees actual weight values.

### PNG Chart (Private Only)

Press **📊 График** to see a visual chart of your weight progress.

- Choose period: 7, 30, 90, 180 days or all data
- Uses [QuickChart.io](https://quickchart.io) to generate PNG images
- Shows period delta, min and max values
- Chart is sent only to you in private chat

### Vacation Pause

Press **🌴 Отпуск** to pause reminders:

- Choose 7, 14, or 30 days
- No reminders will be sent during pause
- You won't appear in "missing" section of reports
- If you submit weight while on pause, it automatically clears

### Leaderboard (Private Only)

Press **🏆 Лидерборд** to see rankings:

- **Week Delta** — sorted by weight change (most lost first)
- **Regularity** — sorted by check-ins and streak

**Privacy:** Leaderboard shows only deltas and check-in counts, never absolute weights.

### Target Weight Goal (Private Only)

Press **🎯 Цель** to set a target weight:

- Set your goal weight (e.g., 75.0 kg)
- Bot tracks your progress as a percentage
- Progress bar shows how close you are to your goal
- Edit or delete goal anytime

**In group reports:** If you have a goal, reports show "до цели X кг (Y%)" — remaining kilograms and percent completed. The absolute goal number and current weight are never shown.

### Monthly Report

On the last day of each month, the bot automatically posts a monthly summary to the group:

- Month delta for each user
- Number of check-ins
- Overall total delta
- Goal progress (if set)

**Privacy:** Same as daily/weekly — only deltas, never absolute weights.

### Group Posting

**Important change:** The bot no longer posts to the group when users submit or edit weights individually.

The group receives messages only via:
- Daily report (automated, Mon-Sat at 19:00 Asia/Nicosia)
- Weekly report (automated, Sunday at 19:00 Asia/Nicosia)
- Monthly report (automated, last day of month)
- On-demand report requested by owner (`/report daily|weekly|monthly`)

### Commands

| Command | Description |
|---------|-------------|
| `/start` | Welcome message |
| `/me` | Show your last weight and delta |
| `/history 7` | Show last 7 entries |
| `/history 30` | Show last 30 entries |
| `/cancel` | Cancel pending edit action |
| `/version` | Show bot version |
| `/setgroup` | Configure group for delta posting (owner only) |
| `/setbotusername <name>` | Set bot username for deep links (owner only) |
| `/status` | Show bot configuration (owner only) |
| `/report daily\|weekly\|monthly` | Send report to group on demand (owner only) |

## Onboarding

### Настройка бота для группы

1. Добавьте бота в группу
2. Установите username бота: `/setbotusername weight_tracker_bot` (замените на ваш)
3. Привяжите группу: `/setgroup`
4. Бот отправит сообщение с инструкцией и ссылкой

### Сообщение для закрепления в группе

После настройки можно закрепить это сообщение:

```
🏋️ Отслеживание веса

Чтобы участвовать:
1. Откройте бота и нажмите Start
2. Отправьте свой вес в личку боту (например: 87.4)

🔒 Ваш точный вес видите только вы
📊 В группу приходят только изменения (+0.5 кг)
⏰ Напоминалки приходят в 11:00 если не внесли вес
```

### Telegram ограничение

Бот может отправлять личные сообщения только пользователям, которые:
- Сами написали боту хотя бы раз
- Нажали кнопку Start

Поэтому важно чтобы каждый участник сначала запустил бота в личке.

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

## Release Checklist

Before going live:

1. **Deploy worker**
   ```bash
   npx wrangler deploy
   ```

2. **Set webhook**
   ```bash
   curl "https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://<WORKER_URL>"
   ```

3. **Set secrets**
   ```bash
   npx wrangler secret put TELEGRAM_BOT_TOKEN
   npx wrangler secret put OWNER_USER_ID
   npx wrangler secret put OPENAI_API_KEY
   ```

4. **Set bot username** (in Telegram)
   ```
   /setbotusername your_bot_username
   ```

5. **Link group** (in your group chat)
   ```
   /setgroup
   ```

6. **Test reminders**
   ```
   /debug_run_reminders
   ```

7. **Test daily report**
   ```
   /debug_daily
   ```

8. **Invite friends** — ask them to press `/start` in bot's private chat

9. **Check health endpoint**
   ```bash
   curl https://<WORKER_URL>/health
   ```

## Restore from Backup

To restore database from backup:

```bash
npx wrangler d1 execute telegram-bot-db --file backup-YYYY-MM-DD.sql
```

Note: This will overwrite existing data. Make a fresh backup before restoring.

## Troubleshooting

### If bot stops working

1. **Check logs**
   ```bash
   npx wrangler tail
   ```

2. **Check health endpoint**
   ```bash
   curl https://<WORKER_URL>/health
   ```
   - `db: "error"` → database issue
   - Connection refused → worker not deployed

3. **Check webhook**
   ```bash
   curl "https://api.telegram.org/bot<TOKEN>/getWebhookInfo"
   ```
   - `pending_update_count` high → bot not responding
   - `last_error_message` → shows recent errors

4. **Check secrets**
   - TELEGRAM_BOT_TOKEN — must be valid
   - OWNER_USER_ID — must be your Telegram ID
   - OPENAI_API_KEY — optional, reports work without it

5. **Check Cloudflare billing**
   - Workers have free tier limits
   - D1 has storage limits

6. **Re-deploy**
   ```bash
   npx wrangler deploy
   ```
