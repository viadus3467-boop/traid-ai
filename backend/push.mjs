import { randomUUID } from "node:crypto";
import { readDb, updateDb } from "./store.mjs";

const DEFAULT_PUSH_SUBJECT = String(process.env.TRADE_AI_VAPID_SUBJECT || "mailto:hello@trade-ai.app").trim();
let webPushModulePromise = null;

function nowIso() {
  return new Date().toISOString();
}

function isObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isValidSubscription(subscription) {
  return isObject(subscription) && typeof subscription.endpoint === "string" && subscription.endpoint.startsWith("https://");
}

function normalizeLanguage(language) {
  return String(language || "").trim().toLowerCase() === "ru" ? "ru" : "en";
}

function getSignalStrengthLabel(confidence, language) {
  const locale = normalizeLanguage(language);
  if (confidence >= 88) {
    return locale === "ru" ? "Сильный" : "Strong";
  }

  if (confidence >= 76) {
    return locale === "ru" ? "Средний" : "Medium";
  }

  return locale === "ru" ? "Слабый" : "Weak";
}

function getSignalDirectionLabel(side) {
  return side === "long" ? "LONG" : "SHORT";
}

function buildSignalUrl(signal) {
  const params = new URLSearchParams({
    tab: "market",
    pair: signal.pair,
  });
  return `/?${params.toString()}`;
}

async function loadWebPush() {
  if (!webPushModulePromise) {
    webPushModulePromise = import("web-push")
      .then((module) => module.default || module)
      .catch(() => null);
  }

  return webPushModulePromise;
}

async function getStoredPushConfig() {
  const db = await readDb();
  return db.pushConfig || null;
}

async function persistPushConfig(vapidKeys) {
  await updateDb((db) => {
    db.pushConfig = {
      vapidPublicKey: vapidKeys.publicKey,
      vapidPrivateKey: vapidKeys.privateKey,
      subject: DEFAULT_PUSH_SUBJECT,
    };
    return db;
  });
}

async function ensurePushClient() {
  const webPush = await loadWebPush();
  if (!webPush) {
    return {
      supported: false,
      webPush: null,
      publicKey: null,
    };
  }

  const stored = await getStoredPushConfig();
  let publicKey = String(stored?.vapidPublicKey || "").trim();
  let privateKey = String(stored?.vapidPrivateKey || "").trim();

  if (!publicKey || !privateKey) {
    const nextKeys = webPush.generateVAPIDKeys();
    publicKey = nextKeys.publicKey;
    privateKey = nextKeys.privateKey;
    await persistPushConfig(nextKeys);
  }

  webPush.setVapidDetails(DEFAULT_PUSH_SUBJECT, publicKey, privateKey);

  return {
    supported: true,
    webPush,
    publicKey,
  };
}

function buildSignalNotificationLegacy(signal) {
  const level = signal.confidence >= 88 ? "STRONG" : signal.confidence >= 76 ? "MEDIUM" : "WEAK";
  const emoji = signal.side === "long" ? "🟢" : "🔴";
  const direction = signal.side === "long" ? "LONG" : "SHORT";

  return {
    title: `${emoji} ${level} ${direction} — ${signal.pair}`,
    body: `Entry: ${signal.entry}\nTP: ${signal.takeProfit}\nSL: ${signal.stopLoss}\nAI Confidence: ${signal.confidence}%`,
    tag: `signal-${signal.id}`,
    data: {
      pair: signal.pair,
      side: signal.side,
      signalId: signal.id,
      url: "/",
    },
  };
}

function buildTestNotificationLegacy() {
  return {
    title: "Trade Ai",
    body: "Web push is enabled. Strong signals will now arrive on this device.",
    tag: `push-test-${Date.now()}`,
    data: {
      url: "/",
      kind: "test",
    },
  };
}

function buildSignalNotification(signal, language = "en") {
  const locale = normalizeLanguage(language);
  const direction = getSignalDirectionLabel(signal.side);
  const strength = getSignalStrengthLabel(signal.confidence, locale);
  const entryLabel = locale === "ru" ? "Вход" : "Entry";
  const strengthLabel = locale === "ru" ? "Сила" : "Strength";

  return {
    title: locale === "ru" ? `Внимание: новый сигнал - ${signal.pair}` : `Attention: new signal - ${signal.pair}`,
    body: `${signal.pair} - ${direction}\n${strengthLabel}: ${strength}\n${entryLabel}: ${signal.entry} | TP: ${signal.takeProfit} | SL: ${signal.stopLoss}`,
    tag: `signal-${signal.id}`,
    data: {
      pair: signal.pair,
      side: signal.side,
      signalId: signal.id,
      url: buildSignalUrl(signal),
    },
  };
}

function buildTestNotification(language = "en") {
  const locale = normalizeLanguage(language);

  return {
    title: locale === "ru" ? "Trade Ai: push включен" : "Trade Ai: push enabled",
    body: locale === "ru"
      ? "Новые сильные сигналы теперь будут приходить на это устройство."
      : "New strong signals will now arrive on this device.",
    tag: `push-test-${Date.now()}`,
    data: {
      url: "/",
      kind: "test",
    },
  };
}

async function removeSubscriptionByEndpoint(endpoint) {
  await updateDb((db) => {
    db.pushSubscriptions = (db.pushSubscriptions || []).filter((entry) => entry.endpoint !== endpoint);
    return db;
  });
}

async function sendPushPayload(subscriptionRecords, payload) {
  const client = await ensurePushClient();
  if (!client.supported || !client.webPush) {
    return {
      sent: 0,
      removed: 0,
    };
  }

  let sent = 0;
  let removed = 0;

  for (const record of subscriptionRecords) {
    try {
      await client.webPush.sendNotification(record.subscription, JSON.stringify(payload), {
        TTL: 60,
      });
      sent += 1;
    } catch (error) {
      const statusCode = Number(error?.statusCode || 0);
      if (statusCode === 404 || statusCode === 410) {
        removed += 1;
        await removeSubscriptionByEndpoint(record.endpoint);
        continue;
      }
      throw error;
    }
  }

  return {
    sent,
    removed,
  };
}

async function listUserSubscriptionRecords(userId) {
  const db = await readDb();
  return (db.pushSubscriptions || []).filter((entry) => entry.userId === userId);
}

export async function getPushRuntimeConfig() {
  const client = await ensurePushClient();
  return {
    supported: client.supported,
    publicKey: client.publicKey,
  };
}

export async function savePushSubscription(userId, subscription) {
  if (!isValidSubscription(subscription)) {
    throw new Error("Invalid push subscription.");
  }

  await ensurePushClient();

  const endpoint = subscription.endpoint;

  await updateDb((db) => {
    db.pushSubscriptions = (db.pushSubscriptions || []).filter((entry) => entry.endpoint !== endpoint);
    db.pushSubscriptions.push({
      id: randomUUID(),
      userId,
      endpoint,
      subscription,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    });
    return db;
  });

  return {
    ok: true,
    endpoint,
  };
}

export async function removePushSubscription(userId, endpoint) {
  const normalizedEndpoint = String(endpoint || "").trim();
  if (!normalizedEndpoint) {
    return {
      ok: true,
      removed: 0,
    };
  }

  await updateDb((db) => {
    db.pushSubscriptions = (db.pushSubscriptions || []).filter((entry) => !(entry.userId === userId && entry.endpoint === normalizedEndpoint));
    return db;
  });

  return {
    ok: true,
    removed: 1,
  };
}

export async function sendTestPushNotification(userId) {
  const db = await readDb();
  const records = (db.pushSubscriptions || []).filter((entry) => entry.userId === userId);
  if (!records.length) {
    throw new Error("No push-enabled device is connected yet.");
  }

  const user = (db.users || []).find((entry) => entry.id === userId);
  return sendPushPayload(records, buildTestNotification(user?.settings?.language));
}

export async function dispatchSignalPushes(snapshot) {
  const signals = Array.isArray(snapshot?.signals) ? snapshot.signals : [];
  if (!signals.length) {
    return;
  }

  const db = await readDb();
  const subscriptions = db.pushSubscriptions || [];
  if (!subscriptions.length) {
    return;
  }

  const nextSignalIdsByUser = new Map();

  for (const user of db.users || []) {
    const enabled = Boolean(user.settings?.notificationsEnabled);
    if (!enabled) {
      continue;
    }

    const userSubscriptions = subscriptions.filter((entry) => entry.userId === user.id);
    if (!userSubscriptions.length) {
      continue;
    }

    const visibleSignals = signals.slice(0, user.plan === "plus" ? 10 : 2);
    const previousIds = new Set(user.pushState?.lastSignalIds || []);
    const newSignals = visibleSignals.filter((signal) => !previousIds.has(signal.id));

    if (!newSignals.length) {
      continue;
    }

    for (const signal of newSignals.slice(0, 3)) {
      try {
        await sendPushPayload(userSubscriptions, buildSignalNotification(signal, user.settings?.language));
      } catch (error) {
        console.error("Trade Ai push send failed:", error instanceof Error ? error.message : String(error));
      }
    }

    nextSignalIdsByUser.set(user.id, visibleSignals.map((signal) => signal.id));
  }

  if (nextSignalIdsByUser.size) {
    const pushedAt = nowIso();
    await updateDb((nextDb) => {
      for (const user of nextDb.users || []) {
        const signalIds = nextSignalIdsByUser.get(user.id);
        if (!signalIds) {
          continue;
        }

        user.pushState = {
          ...(user.pushState || {}),
          lastSignalIds: signalIds,
          lastPushedAt: pushedAt,
        };
      }

      return nextDb;
    });
  }
}
