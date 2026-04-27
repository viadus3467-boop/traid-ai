import { existsSync, mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import { ensureUserSettings } from "./preferences.mjs";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const dataDir = path.join(root, "data");
const sqliteFile = path.join(dataDir, "trade-ai.db");
const legacyJsonFile = path.join(dataDir, "trade-ai-db.json");
const APP_STATE_KEY = "trade-ai-state";

const defaultDb = {
  users: [],
  sessions: [],
  payments: [],
  pushSubscriptions: [],
  pushConfig: {
    vapidPublicKey: "",
    vapidPrivateKey: "",
    subject: "",
  },
  signalHistory: [],
  pushHistory: [],
};

let database = null;
let cachedDb = null;
let writeQueue = Promise.resolve();

function nowIso() {
  return new Date().toISOString();
}

function ensureDatabase() {
  if (database) {
    return database;
  }

  mkdirSync(dataDir, { recursive: true });
  database = new DatabaseSync(sqliteFile);
  database.exec(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS app_state (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);
  return database;
}

function normalizeSubscription(subscription = {}) {
  return {
    status: subscription.status ?? "inactive",
    provider: subscription.provider ?? null,
    renewsAt: subscription.renewsAt ?? null,
  };
}

function normalizeUser(user = {}) {
  return {
    id: user.id,
    name: String(user.name || "Trade User").trim() || "Trade User",
    email: String(user.email || "").trim().toLowerCase(),
    passwordHash: String(user.passwordHash || ""),
    plan: user.plan === "plus" ? "plus" : "free",
    signalLimit: Math.max(1, Number(user.signalLimit || (user.plan === "plus" ? 10 : 2))),
    settings: ensureUserSettings(user.settings || {}),
    subscription: normalizeSubscription(user.subscription || {}),
    oauthAccounts: Array.isArray(user.oauthAccounts) ? user.oauthAccounts : [],
    pushState: user.pushState && typeof user.pushState === "object" ? user.pushState : {},
    createdAt: user.createdAt || nowIso(),
    updatedAt: user.updatedAt || user.createdAt || nowIso(),
  };
}

function normalizeDbShape(db = {}) {
  return {
    users: Array.isArray(db.users) ? db.users.map((user) => normalizeUser(user)) : [],
    sessions: Array.isArray(db.sessions) ? db.sessions : [],
    payments: Array.isArray(db.payments) ? db.payments : [],
    pushSubscriptions: Array.isArray(db.pushSubscriptions) ? db.pushSubscriptions : [],
    pushConfig: {
      vapidPublicKey: String(db.pushConfig?.vapidPublicKey || ""),
      vapidPrivateKey: String(db.pushConfig?.vapidPrivateKey || ""),
      subject: String(db.pushConfig?.subject || ""),
    },
    signalHistory: Array.isArray(db.signalHistory) ? db.signalHistory : [],
    pushHistory: Array.isArray(db.pushHistory) ? db.pushHistory : [],
  };
}

function readLegacyDb() {
  if (!existsSync(legacyJsonFile)) {
    return null;
  }

  try {
    const raw = readFileSync(legacyJsonFile, "utf8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function writeStateSync(nextDb) {
  const db = ensureDatabase();
  const normalized = normalizeDbShape(nextDb);
  const payload = JSON.stringify(normalized);
  const statement = db.prepare(`
    INSERT INTO app_state (key, value, updated_at)
    VALUES (?, ?, ?)
    ON CONFLICT(key) DO UPDATE SET
      value = excluded.value,
      updated_at = excluded.updated_at
  `);
  statement.run(APP_STATE_KEY, payload, nowIso());
  cachedDb = normalized;
  return normalized;
}

function loadStateSync() {
  if (cachedDb) {
    return cachedDb;
  }

  const db = ensureDatabase();
  const row = db.prepare("SELECT value FROM app_state WHERE key = ?").get(APP_STATE_KEY);

  if (!row?.value) {
    const initial = normalizeDbShape(readLegacyDb() || defaultDb);
    return writeStateSync(initial);
  }

  try {
    cachedDb = normalizeDbShape(JSON.parse(row.value));
  } catch {
    cachedDb = normalizeDbShape(defaultDb);
    writeStateSync(cachedDb);
  }

  return cachedDb;
}

export async function readDb() {
  return structuredClone(loadStateSync());
}

export async function writeDb(nextDb) {
  writeQueue = writeQueue.then(() => {
    writeStateSync(nextDb);
  });
  await writeQueue;
}

export async function updateDb(updater) {
  const current = await readDb();
  const updated = await updater(structuredClone(current));
  const nextDb = normalizeDbShape(updated || current);
  await writeDb(nextDb);
  return nextDb;
}

export function publicUser(user) {
  const settings = ensureUserSettings(user?.settings || {});
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    plan: user.plan,
    signalLimit: user.signalLimit,
    settings,
    subscription: normalizeSubscription(user.subscription || {}),
  };
}
