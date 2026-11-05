# EyesSeeBusinessBot

Telegram Business automation bot running on Cloudflare Workers.

## Included commands

- `.bold text` — bold formatting
- `.italic text` — italic formatting
- `.mono text` — monospace formatting
- `.crossed text` — crossed-out formatting
- `.time` — current Kyiv time
- `.info` — connection status
- `.help` — command list

The first version intentionally handles only text commands in Telegram Business chats. It does not include mass messaging or harassment commands.

## 1. Install and test locally

Requirements: Node.js 20+.

```bash
npm install
npx wrangler dev
```

Create a local `.dev.vars` file (never commit it):

```dotenv
BOT_TOKEN=your_new_bot_token
WEBHOOK_SECRET=your_long_random_secret
```

## 2. Deploy to Cloudflare

Connect this GitHub repository in Cloudflare Workers Builds, or deploy with Wrangler.

Add these Worker secrets in the Cloudflare dashboard under **Settings → Variables and Secrets**:

- `BOT_TOKEN` — Telegram bot token
- `WEBHOOK_SECRET` — a long random secret used to verify Telegram webhook requests

Do not put either value in source code, GitHub files, or chat messages.

## 3. Set Telegram webhook

After deployment, copy the Worker URL. Set the webhook to:

`https://YOUR-WORKER.workers.dev/telegram`

Use Telegram's `setWebhook` method with:
- `url` = the Worker URL above
- `secret_token` = exactly the same value as `WEBHOOK_SECRET`
- `allowed_updates` = `["business_message","business_connection"]`

Telegram sends the secret in the `X-Telegram-Bot-Api-Secret-Token` header. The Worker verifies it before processing updates.

## 4. Connect Telegram Business

In Telegram, open **Settings → Telegram Business → Chatbots**, choose your bot, and grant the permissions it needs. Enable message access for the chats where you want it to work.

The bot replies on behalf of the connected business account using the incoming `business_connection_id`.

## Notes

- This Worker only responds to messages beginning with a supported command.
- Telegram Business permissions and account settings are controlled by the account owner.
- The bot token previously shared in a chat should be revoked in BotFather and replaced before deployment.
