import { randomUUID } from "node:crypto";
import { filterSignalsForUser, getVisibleSignalLimit } from "./preferences.mjs";
import { readDb, updateDb } from "./store.mjs";

const MAX_SIGNAL_HISTORY_PER_USER = 80;
const MAX_PUSH_HISTORY_PER_USER = 60;

function nowIso() {
  return new Date().toISOString();
}

function parseNumericPrice(value) {
  const normalized = String(value ?? "")
    .replace(/,/g, "")
    .replace(/\s+/g, "")
    .trim();
  const numeric = Number(normalized);
  return Number.isFinite(numeric) ? numeric : null;
}

function parseLifetimeMs(lifetime) {
  const match = /^(\d+)([mhd])$/iu.exec(String(lifetime || "").trim());
  if (!match) {
    return 60 * 60 * 1000;
  }

  const amount = Number(match[1]);
  const unit = match[2].toLowerCase();
  if (unit === "m") return amount * 60 * 1000;
  if (unit === "h") return amount * 60 * 60 * 1000;
  return amount * 24 * 60 * 60 * 1000;
}

function buildSignalEventKey(signal) {
  return [
    signal.id,
    signal.pair,
    signal.side,
    signal.entry,
    signal.takeProfit,
    signal.stopLoss,
    signal.time,
  ].join(":");
}

function updateSignalStatuses(historyEntries, marketPriceMap, currentIso) {
  const currentTime = new Date(currentIso).getTime();

  for (const entry of historyEntries) {
    if (entry.status !== "open") {
      continue;
    }

    const currentPrice = marketPriceMap.get(entry.pair);
    if (Number.isFinite(currentPrice)) {
      if (entry.side === "long") {
        if (currentPrice >= entry.takeProfit) {
          entry.status = "win";
          entry.closedAt = currentIso;
          entry.outcomePrice = currentPrice;
          continue;
        }
        if (currentPrice <= entry.stopLoss) {
          entry.status = "loss";
          entry.closedAt = currentIso;
          entry.outcomePrice = currentPrice;
          continue;
        }
      } else if (entry.side === "short") {
        if (currentPrice <= entry.takeProfit) {
          entry.status = "win";
          entry.closedAt = currentIso;
          entry.outcomePrice = currentPrice;
          continue;
        }
        if (currentPrice >= entry.stopLoss) {
          entry.status = "loss";
          entry.closedAt = currentIso;
          entry.outcomePrice = currentPrice;
          continue;
        }
      }
    }

    if (currentTime >= new Date(entry.expiresAt).getTime()) {
      entry.status = "expired";
      entry.closedAt = currentIso;
    }
  }
}

function trimHistoryForUser(items, userId, maxItems) {
  const mine = items
    .filter((entry) => entry.userId === userId)
    .sort((left, right) => new Date(right.createdAt || right.sentAt).getTime() - new Date(left.createdAt || left.sentAt).getTime());
  const keepIds = new Set(mine.slice(0, maxItems).map((entry) => entry.id));
  return items.filter((entry) => entry.userId !== userId || keepIds.has(entry.id));
}

export async function registerSnapshotForUser(user, snapshot) {
  if (!user?.id) {
    return;
  }

  const visibleSignals = filterSignalsForUser(snapshot?.signals || [], user).slice(0, getVisibleSignalLimit(user));
  const marketPriceMap = new Map(
    (snapshot?.market || []).map((entry) => [entry.pair, parseNumericPrice(entry.price)]),
  );
  const generatedAt = snapshot?.generatedAt || nowIso();

  await updateDb((db) => {
    db.signalHistory = Array.isArray(db.signalHistory) ? db.signalHistory : [];
    updateSignalStatuses(db.signalHistory, marketPriceMap, generatedAt);

    const existingKeys = new Set(
      db.signalHistory
        .filter((entry) => entry.userId === user.id)
        .map((entry) => entry.eventKey),
    );

    for (const signal of visibleSignals) {
      const eventKey = buildSignalEventKey(signal);
      if (existingKeys.has(eventKey)) {
        continue;
      }

      const entry = parseNumericPrice(signal.entry);
      const takeProfit = parseNumericPrice(signal.takeProfit);
      const stopLoss = parseNumericPrice(signal.stopLoss);
      if (!Number.isFinite(entry) || !Number.isFinite(takeProfit) || !Number.isFinite(stopLoss)) {
        continue;
      }

      db.signalHistory.unshift({
        id: randomUUID(),
        userId: user.id,
        eventKey,
        signalId: signal.id,
        pair: signal.pair,
        side: signal.side,
        confidence: signal.confidence,
        entry,
        takeProfit,
        stopLoss,
        session: signal.session || "",
        marketStructure: signal.marketStructure || null,
        reason: signal.reason || {},
        status: "open",
        createdAt: generatedAt,
        expiresAt: new Date(new Date(generatedAt).getTime() + parseLifetimeMs(signal.lifetime)).toISOString(),
        closedAt: null,
      });
    }

    db.signalHistory = trimHistoryForUser(db.signalHistory, user.id, MAX_SIGNAL_HISTORY_PER_USER);
    return db;
  });
}

export async function recordPushHistory({
  userId,
  kind = "signal",
  title,
  body,
  signal = null,
  sent = 0,
  removed = 0,
}) {
  if (!userId) {
    return;
  }

  await updateDb((db) => {
    db.pushHistory = Array.isArray(db.pushHistory) ? db.pushHistory : [];
    db.pushHistory.unshift({
      id: randomUUID(),
      userId,
      kind,
      title: String(title || "Trade Ai"),
      body: String(body || ""),
      pair: signal?.pair || null,
      side: signal?.side || null,
      confidence: signal?.confidence ?? null,
      signalId: signal?.id || null,
      sent,
      removed,
      sentAt: nowIso(),
    });
    db.pushHistory = trimHistoryForUser(db.pushHistory, userId, MAX_PUSH_HISTORY_PER_USER);
    return db;
  });
}

export async function getUserActivity(userId) {
  const db = await readDb();
  return getUserActivityFromDb(db, userId);
}

export function getUserActivityFromDb(db, userId) {
  const signalHistory = (db.signalHistory || [])
    .filter((entry) => entry.userId === userId)
    .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
    .slice(0, 24);

  const pushHistory = (db.pushHistory || [])
    .filter((entry) => entry.userId === userId)
    .sort((left, right) => new Date(right.sentAt).getTime() - new Date(left.sentAt).getTime())
    .slice(0, 20);

  return {
    signalHistory,
    pushHistory,
  };
}
