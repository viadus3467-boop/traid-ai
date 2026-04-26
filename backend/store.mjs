import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const dataDir = path.join(root, "data");
const dataFile = path.join(dataDir, "trade-ai-db.json");

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
};

let writeQueue = Promise.resolve();

async function ensureStore() {
  await mkdir(dataDir, { recursive: true });
  try {
    await readFile(dataFile, "utf8");
  } catch {
    await writeFile(dataFile, JSON.stringify(defaultDb, null, 2), "utf8");
  }
}

export async function readDb() {
  await ensureStore();
  const raw = await readFile(dataFile, "utf8");
  return JSON.parse(raw);
}

export async function writeDb(nextDb) {
  await ensureStore();
  writeQueue = writeQueue.then(() =>
    writeFile(dataFile, JSON.stringify(nextDb, null, 2), "utf8"),
  );
  await writeQueue;
}

export async function updateDb(updater) {
  const current = await readDb();
  const nextDb = await updater(structuredClone(current));
  await writeDb(nextDb);
  return nextDb;
}

export function publicUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    plan: user.plan,
    signalLimit: user.signalLimit,
    settings: {
      language: user.settings?.language ?? "ru",
      theme: user.settings?.theme ?? "dark",
      notificationsEnabled: Boolean(user.settings?.notificationsEnabled),
      soundsEnabled: "soundsEnabled" in (user.settings || {}) ? Boolean(user.settings?.soundsEnabled) : true,
    },
    subscription: {
      status: user.subscription?.status ?? "inactive",
      provider: user.subscription?.provider ?? null,
      renewsAt: user.subscription?.renewsAt ?? null,
    },
  };
}
