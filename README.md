# Telegram Bot on Cloudflare Workers

Minimal Telegram bot using Cloudflare Workers, TypeScript, and D1 database.

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
# Create the database
wrangler d1 create telegram-bot-db

# Copy the database_id from output and paste it into wrangler.toml
```

### 4. Update wrangler.toml

Replace `<YOUR_DATABASE_ID_HERE>` with your actual database ID:

```toml
[[d1_databases]]
binding = "DB"
database_name = "telegram-bot-db"
database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
```

### 5. Apply Database Migration

```bash
# For remote (production)
npm run migrate:remote

# For local development
npm run migrate:local
```

### 6. Set Secrets

```bash
wrangler secret put TELEGRAM_BOT_TOKEN
# Paste your bot token when prompted

wrangler secret put OWNER_USER_ID
# Paste your Telegram user ID when prompted
```

### 7. Local Development (Optional)

Create `.dev.vars` file in project root:

```
TELEGRAM_BOT_TOKEN=your_bot_token_here
OWNER_USER_ID=your_telegram_user_id
```

Run local development server:

```bash
npm run dev
```

### 8. Deploy Worker

```bash
npm run deploy
```

Note the worker URL from output (e.g., `https://telegram-bot.your-subdomain.workers.dev`)

### 9. Set Webhook

Replace `<BOT_TOKEN>` and `<WORKER_URL>` with your values:

```bash
curl -X POST "https://api.telegram.org/bot<BOT_TOKEN>/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{"url": "<WORKER_URL>"}'
```

Example:

```bash
curl -X POST "https://api.telegram.org/bot123456789:ABCdef.../setWebhook" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://telegram-bot.johndoe.workers.dev"}'
```

### 10. Verify Webhook

```bash
curl "https://api.telegram.org/bot<BOT_TOKEN>/getWebhookInfo"
```

## Bot Commands

- `/start` - Welcome message (works in private chat)
- `/setgroup` - Configure bot's group (owner only, must be in group)
- `/status` - Show current configuration (owner only)

## Project Structure

```
├── src/
│   └── index.ts          # Main worker code
├── migrations/
│   └── 0001_init.sql     # Database schema
├── wrangler.toml         # Cloudflare configuration
├── package.json
├── tsconfig.json
└── README.md
```

## Database Schema

**users** - Telegram users who interact with the bot
- `user_id` (INTEGER, PRIMARY KEY)
- `display_name` (TEXT)
- `username` (TEXT)
- `created_at` (TEXT)

**settings** - Key-value storage
- `key` (TEXT, PRIMARY KEY)
- `value` (TEXT)
