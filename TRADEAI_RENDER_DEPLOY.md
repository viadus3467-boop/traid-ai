# TradeAI Web App on Render

This repo already contains a web PWA with:

- real crypto signals from Binance public klines
- real forex rates from Frankfurter / ECB
- authentication
- web push notifications
- SQLite persistence for users, push subscriptions, and signal history

## What changed for Render

- `render.yaml` now starts the TradeAI Node server instead of the unrelated Next.js app
- persistence is moved to `TRADE_AI_DATA_DIR`, so Render can store SQLite on a mounted disk
- `render:start` is available in `package.json`

## Render service settings

Blueprint file:

- [render.yaml](/C:/Users/prost/Documents/New%20project/render.yaml)

Environment template:

- [render.tradeai.env.example](/C:/Users/prost/Documents/New%20project/render.tradeai.env.example)

## Required deployment shape

Use a Render `web` service with:

- runtime: `node`
- plan: `starter`
- region: `frankfurt`
- health check: `/api/health`
- persistent disk mounted at `/var/data`

Why `starter` instead of `free`:

- push subscriptions and users are stored in SQLite
- without a persistent disk, Render restarts or redeploys can wipe local state
- web push is much more reliable when the service stays warm

## Required environment variables

Minimum:

```env
HOST=0.0.0.0
TRADE_AI_DATA_DIR=/var/data/trade-ai
TRADE_AI_VAPID_SUBJECT=mailto:hello@trade-ai.app
```

Optional:

- `TRADE_AI_GOOGLE_CLIENT_ID`
- `TRADE_AI_GOOGLE_CLIENT_SECRET`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `NOWPAYMENTS_API_KEY`
- `NOWPAYMENTS_IPN_SECRET`

## After deploy

1. Open `/api/health`
2. Register a user in the web app
3. Install the PWA on iPhone from Safari to Home Screen
4. Enable notifications inside the app
5. Send a test push from the profile/settings flow

## Real signal sources

Current production signal inputs:

- crypto: Binance public 15m klines
- forex: Frankfurter / ECB daily rates

## Notes

- iPhone web push works only when the app is installed to the Home Screen from Safari
- push notifications require HTTPS, which Render provides automatically
- the current web app uses the existing auth + push + signal engine in [server.mjs](/C:/Users/prost/Documents/New%20project/server.mjs)
