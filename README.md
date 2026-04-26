# Trade Ai

`Trade Ai` is a mobile-first AI trading web app with selective `LONG / SHORT` signals, account registration, promo-based `PLUS`, and an iPhone-friendly PWA shell.

## Start locally

```bash
npm install
npm start
```

Then open:

- `http://127.0.0.1:4173/`

## Deploy to Render

This project already includes [render.yaml](/C:/Users/prost/Documents/New project/render.yaml), so Render can detect the service settings automatically.

### 1. Push the project to GitHub

Create a new GitHub repository and push this folder to it.

### 2. Create a new Blueprint on Render

In Render:

1. Click `New`
2. Select `Blueprint`
3. Choose your GitHub repository
4. Render will read `render.yaml`
5. Confirm the web service creation

### 3. Recommended environment variables

Set these in Render:

- `TRADE_AI_PUBLIC_URL`
  - example: `https://your-service-name.onrender.com`
- `TRADE_AI_VAPID_SUBJECT`
  - example: `mailto:you@example.com`
- `TRADE_AI_GOOGLE_CLIENT_ID`
- `TRADE_AI_GOOGLE_CLIENT_SECRET`
- `TRADE_AI_APPLE_CLIENT_ID`
- `TRADE_AI_APPLE_TEAM_ID`
- `TRADE_AI_APPLE_KEY_ID`
- `TRADE_AI_APPLE_PRIVATE_KEY`

Google sign-in can work with free Google OAuth credentials.

Apple / iCloud sign-in requires Apple developer credentials and service setup.

### 4. Open the deployed app

After deployment, Render will give you a public HTTPS URL.

Open it in Safari on iPhone and add it to the Home Screen as a Web App.

## Important note about free Render

The current app stores users and sessions in a local JSON file:

- [data/trade-ai-db.json](/C:/Users/prost/Documents/New project/data/trade-ai-db.json)

On a free Render web service, filesystem storage is not production-grade persistent storage. That means registrations, sessions, and promo activations can reset after redeploys or infrastructure restarts.

For a stable production version, the next step is moving auth and app data to:

- `Render Postgres`
- or `Supabase`

## iPhone notifications

For real notifications on iPhone:

1. Deploy the app to a public `HTTPS` URL
2. Open it in `Safari`
3. Add it to the Home Screen
4. Open the installed Web App
5. Grant notification permission

This project now includes a web push backend, device subscription endpoints, and a service worker push handler. After deploy:

1. Open the app from the iPhone Home Screen
2. Turn on notifications in `Settings`
3. Use the `Test push` action to verify delivery

## OAuth login

The auth screen now supports:

- `Email / password`
- `Google`
- `Apple / iCloud`

Important:

- `Google` becomes fully working after you add Google OAuth client credentials in Render
- `Apple / iCloud` needs Apple developer-side credentials and configuration before it can go live
