import { createHash, randomBytes, randomUUID } from "node:crypto";
import {
  ensureUserSettings,
  LANGUAGE_CODES,
  normalizeEnabledPairs,
  normalizePreferredSessions,
  normalizeWatchlist,
} from "./preferences.mjs";
import { publicUser, readDb, updateDb } from "./store.mjs";

const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30;
const LIFETIME_PROMO_CODE = "ANDRAITRAID";

function nowIso() {
  return new Date().toISOString();
}

function hashPassword(password) {
  return createHash("sha256").update(password).digest("hex");
}

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function createSessionRecord(userId) {
  return {
    id: randomUUID(),
    userId,
    token: randomBytes(32).toString("hex"),
    createdAt: nowIso(),
    expiresAt: new Date(Date.now() + SESSION_TTL_MS).toISOString(),
  };
}

function defaultSettings(overrides = {}) {
  return ensureUserSettings({
    language: overrides.language || "ru",
    theme: overrides.theme || "dark",
    notificationsEnabled: overrides.notificationsEnabled,
    soundsEnabled: overrides.soundsEnabled,
    enabledPairs: overrides.enabledPairs,
    preferredSessions: overrides.preferredSessions,
    watchlist: overrides.watchlist,
    avatarDataUrl: overrides.avatarDataUrl,
  });
}

function normalizeAvatarDataUrl(value) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }

  if (!trimmed.startsWith("data:image/") || trimmed.length > 1_500_000) {
    throw new Error("Avatar image is invalid.");
  }

  return trimmed;
}

function defaultUserPayload({ name, email, password, language, theme }) {
  return {
    id: randomUUID(),
    name: String(name || "Trade User").trim() || "Trade User",
    email: normalizeEmail(email),
    passwordHash: hashPassword(password),
    plan: "free",
    signalLimit: 2,
    settings: defaultSettings({ language, theme }),
    subscription: {
      status: "inactive",
      provider: null,
      renewsAt: null,
    },
    oauthAccounts: [],
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
}

function defaultOauthUserPayload({ provider, providerUserId, email, name }) {
  const normalizedEmail = normalizeEmail(email) || `${providerUserId}@${provider}.trade-ai.local`;
  const nextUser = defaultUserPayload({
    name,
    email: normalizedEmail,
    password: randomBytes(24).toString("hex"),
  });
  nextUser.passwordHash = "";
  nextUser.oauthAccounts = [
    {
      provider,
      providerUserId,
      email: normalizedEmail,
      linkedAt: nowIso(),
    },
  ];
  return nextUser;
}

function assertCredentials(email, password) {
  if (!normalizeEmail(email) || String(password || "").trim().length < 4) {
    throw new Error("Invalid credentials.");
  }
}

export async function registerUser(payload) {
  assertCredentials(payload.email, payload.password);

  const nextUser = defaultUserPayload(payload);
  const nextSession = createSessionRecord(nextUser.id);

  await updateDb((db) => {
    const existing = db.users.find((user) => user.email === nextUser.email);
    if (existing) {
      throw new Error("Account already exists.");
    }

    db.users.push(nextUser);
    db.sessions = db.sessions.filter((session) => new Date(session.expiresAt).getTime() > Date.now());
    db.sessions.push(nextSession);
    return db;
  });

  return {
    token: nextSession.token,
    user: publicUser(nextUser),
  };
}

export async function loginUser({ email, password }) {
  assertCredentials(email, password);
  const normalizedEmail = normalizeEmail(email);
  const hashed = hashPassword(password);
  const db = await readDb();
  const user = db.users.find((candidate) => candidate.email === normalizedEmail);

  if (!user || user.passwordHash !== hashed) {
    throw new Error("Invalid email or password.");
  }

  const nextSession = createSessionRecord(user.id);

  await updateDb((nextDb) => {
    nextDb.sessions = nextDb.sessions.filter((session) => {
      const fresh = new Date(session.expiresAt).getTime() > Date.now();
      return fresh && session.userId !== user.id;
    });
    nextDb.sessions.push(nextSession);
    return nextDb;
  });

  return {
    token: nextSession.token,
    user: publicUser(user),
  };
}

export async function getUserFromToken(token) {
  if (!token) {
    return null;
  }

  const db = await readDb();
  const session = db.sessions.find((candidate) => candidate.token === token);
  if (!session) {
    return null;
  }

  if (new Date(session.expiresAt).getTime() <= Date.now()) {
    return null;
  }

  return db.users.find((user) => user.id === session.userId) || null;
}

export async function logoutToken(token) {
  if (!token) {
    return;
  }

  await updateDb((db) => {
    db.sessions = db.sessions.filter((session) => session.token !== token);
    return db;
  });
}

export async function createSessionForUserId(userId) {
  const nextSession = createSessionRecord(userId);

  await updateDb((db) => {
    db.sessions = db.sessions.filter((session) => {
      const fresh = new Date(session.expiresAt).getTime() > Date.now();
      return fresh && session.userId !== userId;
    });
    db.sessions.push(nextSession);
    return db;
  });

  return nextSession;
}

export async function loginWithOauth({ provider, providerUserId, email, name }) {
  const normalizedProvider = String(provider || "").trim().toLowerCase();
  const normalizedProviderUserId = String(providerUserId || "").trim();
  const normalizedEmail = normalizeEmail(email);

  if (!normalizedProvider || !normalizedProviderUserId) {
    throw new Error("OAuth provider data is incomplete.");
  }

  let publicProfile = null;
  let nextSession = null;

  await updateDb((db) => {
    let user = db.users.find((candidate) =>
      Array.isArray(candidate.oauthAccounts) &&
      candidate.oauthAccounts.some((account) => account.provider === normalizedProvider && account.providerUserId === normalizedProviderUserId),
    );

    if (!user && normalizedEmail) {
      user = db.users.find((candidate) => candidate.email === normalizedEmail);
      if (user) {
        user.oauthAccounts = Array.isArray(user.oauthAccounts) ? user.oauthAccounts : [];
        user.oauthAccounts.push({
          provider: normalizedProvider,
          providerUserId: normalizedProviderUserId,
          email: normalizedEmail,
          linkedAt: nowIso(),
        });
        if (name && (!user.name || user.name === "Trade User")) {
          user.name = String(name).trim() || user.name;
        }
        user.updatedAt = nowIso();
      }
    }

    if (!user) {
      user = defaultOauthUserPayload({
        provider: normalizedProvider,
        providerUserId: normalizedProviderUserId,
        email: normalizedEmail,
        name,
      });
      db.users.push(user);
    }

    nextSession = createSessionRecord(user.id);
    db.sessions = db.sessions.filter((session) => {
      const fresh = new Date(session.expiresAt).getTime() > Date.now();
      return fresh && session.userId !== user.id;
    });
    db.sessions.push(nextSession);
    publicProfile = publicUser(user);
    return db;
  });

  return {
    token: nextSession.token,
    user: publicProfile,
  };
}

export async function updateUserSettings(userId, patch) {
  const allowedThemes = new Set(["dark", "light"]);
  const allowedLanguages = new Set(LANGUAGE_CODES);

  const db = await updateDb((nextDb) => {
    const user = nextDb.users.find((candidate) => candidate.id === userId);
    if (!user) {
      throw new Error("User not found.");
    }

    if (patch.name) {
      user.name = String(patch.name).trim() || user.name;
    }

    if (patch.language && allowedLanguages.has(patch.language)) {
      user.settings.language = patch.language;
    }

    if (patch.theme && allowedThemes.has(patch.theme)) {
      user.settings.theme = patch.theme;
    }

    if (typeof patch.notificationsEnabled === "boolean") {
      user.settings.notificationsEnabled = patch.notificationsEnabled;
    }

    if (typeof patch.soundsEnabled === "boolean") {
      user.settings.soundsEnabled = patch.soundsEnabled;
    }

    if (typeof patch.signalLimit === "number") {
      const maxLimit = user.plan === "plus" ? 10 : 2;
      user.signalLimit = Math.max(1, Math.min(maxLimit, Math.round(patch.signalLimit)));
    }

    if (Array.isArray(patch.enabledPairs)) {
      user.settings.enabledPairs = normalizeEnabledPairs(patch.enabledPairs);
    }

    if (Array.isArray(patch.preferredSessions)) {
      user.settings.preferredSessions = normalizePreferredSessions(patch.preferredSessions);
    }

    if (Array.isArray(patch.watchlist)) {
      user.settings.watchlist = normalizeWatchlist(patch.watchlist);
    }

    if ("avatarDataUrl" in patch) {
      const nextAvatar = normalizeAvatarDataUrl(patch.avatarDataUrl);
      if (nextAvatar !== null) {
        user.settings.avatarDataUrl = nextAvatar;
      }
    }

    user.updatedAt = nowIso();
    return nextDb;
  });

  const user = db.users.find((candidate) => candidate.id === userId);
  return publicUser(user);
}

export async function updateUserPlan(userId, plan, details = {}) {
  const db = await updateDb((nextDb) => {
    const user = nextDb.users.find((candidate) => candidate.id === userId);
    if (!user) {
      throw new Error("User not found.");
    }

    user.plan = plan;
    user.signalLimit = plan === "plus" ? Math.max(user.signalLimit, 10) : Math.min(user.signalLimit, 2);
    user.subscription = {
      status: details.status ?? (plan === "plus" ? "active" : "inactive"),
      provider: details.provider ?? null,
      renewsAt: details.renewsAt ?? null,
    };
    user.updatedAt = nowIso();
    return nextDb;
  });

  const user = db.users.find((candidate) => candidate.id === userId);
  return publicUser(user);
}

export async function activatePromoCode(userId, code) {
  const normalizedCode = String(code || "").trim().toUpperCase();
  if (normalizedCode !== LIFETIME_PROMO_CODE) {
    throw new Error("Invalid promo code.");
  }

  return updateUserPlan(userId, "plus", {
    status: "lifetime",
    provider: "promo",
    renewsAt: null,
  });
}
