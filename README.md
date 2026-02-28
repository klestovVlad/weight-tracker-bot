# Weight Tracker Telegram Bot

Telegram bot for tracking weight with privacy-first design. Built on Cloudflare Workers with D1 database.

## Features

- **Private weight tracking** — only you can see your absolute weights
- **Group delta posting** — share only weight changes (Δ), never absolute values
- **Edit last entry** — inline button to correct mistakes
- **Daily entries** — one weight per day, overwrites if updated
- **Timezone support** — Asia/Nicosia timezone for date calculation

## Privacy

- Absolute weights are visible ONLY to the user who submitted them
- Owner cannot access other users' weights
- Group messages show only delta changes, never absolute weights

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
```

### 6. Set Secrets

```bash
wrangler secret put TELEGRAM_BOT_TOKEN
wrangler secret put OWNER_USER_ID
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

## Project Structure

```
├── src/
│   └── index.ts              # Main worker code
├── migrations/
│   ├── 0001_init.sql         # Users and settings tables
│   ├── 0002_weights.sql      # Weights table
│   └── 0003_pending_actions.sql  # Pending actions table
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
